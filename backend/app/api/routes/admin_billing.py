from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.exceptions import IrreversibleActionConflict
from app.db.session import get_db
from app.models.enums import InvoiceStatus
from app.models.invoice import Invoice
from app.models.user import User
from app.schemas.invoice import InvoiceCreateRequest, InvoiceOut, InvoiceUpdateRequest
from app.services.email import notify_invoice_issued
from app.services.invoicing import build_draft_invoice, generate_signed_document

router = APIRouter(prefix="/api/admin/billing/invoices", tags=["admin-billing"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[InvoiceOut])
def list_all_invoices(db: Session = Depends(get_db)):
    return db.query(Invoice).order_by(Invoice.created_at.desc()).all()


@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def generate_draft_invoice(payload: InvoiceCreateRequest, db: Session = Depends(get_db)):
    client = db.get(User, payload.client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return build_draft_invoice(client, payload.feature_ids, payload.tax_amount, payload.notes, db)


def _get_invoice_or_404(invoice_id: int, db: Session) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return invoice


@router.put("/{invoice_id}", response_model=InvoiceOut)
def overwrite_invoice(invoice_id: int, payload: InvoiceUpdateRequest, db: Session = Depends(get_db)):
    invoice = _get_invoice_or_404(invoice_id, db)
    if invoice.status != InvoiceStatus.DRAFT:
        raise IrreversibleActionConflict("Only draft invoices can be overwritten")
    invoice.tax_amount = payload.tax_amount
    invoice.notes = payload.notes
    invoice.total = round(invoice.subtotal - invoice.discount_amount + payload.tax_amount, 2)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/finalize", response_model=InvoiceOut)
def finalize_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = _get_invoice_or_404(invoice_id, db)
    if invoice.status != InvoiceStatus.DRAFT:
        raise IrreversibleActionConflict("Invoice has already been finalized")

    client = db.get(User, invoice.client_id)
    invoice.signed_document_path = generate_signed_document(invoice, client)
    invoice.status = InvoiceStatus.FINALIZED
    invoice.finalized_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invoice)

    if client:
        notify_invoice_issued(client.email, invoice.id, float(invoice.total))
    return invoice


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_draft_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = _get_invoice_or_404(invoice_id, db)
    if invoice.status != InvoiceStatus.DRAFT:
        raise IrreversibleActionConflict("Only draft invoices can be deleted")
    db.delete(invoice)
    db.commit()

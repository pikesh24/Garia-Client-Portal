from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import require_client
from app.db.session import get_db
from app.models.enums import InvoiceStatus
from app.models.invoice import Invoice
from app.models.user import User
from app.schemas.invoice import InvoiceOut

router = APIRouter(prefix="/api/billing/invoices", tags=["billing"], dependencies=[Depends(require_client)])


@router.get("", response_model=list[InvoiceOut])
def list_my_invoices(current_user: User = Depends(require_client), db: Session = Depends(get_db)):
    return (
        db.query(Invoice)
        .filter(Invoice.client_id == current_user.id)
        .order_by(Invoice.created_at.desc())
        .all()
    )


@router.get("/{invoice_id}/download")
def download_signed_document(
    invoice_id: int, current_user: User = Depends(require_client), db: Session = Depends(get_db)
):
    invoice = db.get(Invoice, invoice_id)
    if not invoice or invoice.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    if invoice.status != InvoiceStatus.FINALIZED or not invoice.signed_document_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signed document not yet available")
    return FileResponse(invoice.signed_document_path, filename=f"invoice_{invoice.id}.txt")

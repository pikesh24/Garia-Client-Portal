from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import FeatureRequestStatus
from app.models.feature_request import FeatureRequest
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.user import User
from app.services.pricing import apply_discount, get_active_discount


def build_draft_invoice(client: User, feature_ids: list[int], tax_amount: float, notes: str | None, db: Session) -> Invoice:
    eligible_features = (
        db.query(FeatureRequest)
        .filter(
            FeatureRequest.id.in_(feature_ids),
            FeatureRequest.client_id == client.id,
            FeatureRequest.status != FeatureRequestStatus.CANCELLED,
            FeatureRequest.added_by_client == True,  # noqa: E712
        )
        .all()
    )

    invoice = Invoice(client_id=client.id, tax_amount=tax_amount, notes=notes)
    db.add(invoice)
    db.flush()

    subtotal = 0.0
    for feature in eligible_features:
        frontend_hours = float(feature.quoted_frontend_hours or 0)
        backend_hours = float(feature.quoted_backend_hours or 0)
        production_hours = float(feature.quoted_production_hours or 0)
        amount = round(
            frontend_hours * float(client.hourly_rate_frontend or 0)
            + backend_hours * float(client.hourly_rate_backend or 0)
            + production_hours * float(client.hourly_rate_production or 0),
            2,
        )
        subtotal += amount
        db.add(
            InvoiceLineItem(
                invoice_id=invoice.id,
                feature_request_id=feature.id,
                description=feature.name,
                frontend_hours=frontend_hours,
                backend_hours=backend_hours,
                production_hours=production_hours,
                amount=amount,
            )
        )

    subtotal = round(subtotal, 2)
    discount = get_active_discount(client.id, db)
    discount_amount = apply_discount(subtotal, discount)
    total = round(subtotal - discount_amount + tax_amount, 2)

    invoice.subtotal = subtotal
    invoice.discount_amount = discount_amount
    invoice.total = total
    db.commit()
    db.refresh(invoice)
    return invoice


def generate_signed_document(invoice: Invoice, client: User) -> str:
    """Produces the finalized, issued document the client downloads from their
    dashboard. A real PDF/e-signature pipeline can replace this writer later
    without changing the invoice.signed_document_path contract."""
    target_dir = Path(settings.UPLOAD_DIR) / "invoices"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"invoice_{invoice.id}.txt"

    lines = [
        f"Garia Solutions - Invoice #{invoice.id}",
        f"Client: {client.full_name} <{client.email}>",
        f"Subtotal: ${invoice.subtotal:.2f}",
        f"Discount: -${invoice.discount_amount:.2f}",
        f"Tax: ${invoice.tax_amount:.2f}",
        f"Total Due: ${invoice.total:.2f}",
        "",
        "Line items:",
    ]
    for item in invoice.line_items:
        lines.append(f"  - {item.description}: ${item.amount:.2f}")

    target_path.write_text("\n".join(lines), encoding="utf-8")
    return str(target_path).replace("\\", "/")

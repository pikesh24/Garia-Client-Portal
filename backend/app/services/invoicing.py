from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import FeatureRequestStatus, InvoiceLineItemType
from app.models.feature_request import FeatureRequest
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.maintenance import MaintenanceRecord
from app.models.project import Project
from app.models.user import User
from app.services.pricing import apply_discount, get_active_discount
from app.services.realtime import manager


# A feature remains billable through its whole post-approval lifecycle — restricting this to
# only FeatureRequestStatus.APPROVED meant a feature became permanently unbillable the moment
# work started/finished (the normal next step), since status moves on and never returns to
# APPROVED. Double-billing is instead prevented explicitly below via existing line items.
BILLABLE_STATUSES = (
    FeatureRequestStatus.APPROVED,
    FeatureRequestStatus.IN_PROGRESS,
    FeatureRequestStatus.COMPLETED,
)


def _eligible_features(project: Project, feature_ids: list[int], db: Session) -> list[FeatureRequest]:
    already_invoiced_feature_ids = {
        row[0]
        for row in db.query(InvoiceLineItem.feature_request_id)
        .filter(InvoiceLineItem.feature_request_id.isnot(None))
        .all()
    }
    query = db.query(FeatureRequest).filter(
        FeatureRequest.id.in_(feature_ids),
        FeatureRequest.project_id == project.id,
        FeatureRequest.status.in_(BILLABLE_STATUSES),
        FeatureRequest.added_by_client == True,  # noqa: E712
    )
    if already_invoiced_feature_ids:
        query = query.filter(FeatureRequest.id.notin_(already_invoiced_feature_ids))
    return query.all()


def _eligible_maintenance_records(
    project: Project, maintenance_record_ids: list[int], db: Session
) -> list[MaintenanceRecord]:
    already_invoiced_ids = {
        row[0]
        for row in db.query(InvoiceLineItem.maintenance_record_id)
        .filter(InvoiceLineItem.maintenance_record_id.isnot(None))
        .all()
    }
    query = db.query(MaintenanceRecord).filter(
        MaintenanceRecord.id.in_(maintenance_record_ids),
        MaintenanceRecord.project_id == project.id,
    )
    if already_invoiced_ids:
        query = query.filter(MaintenanceRecord.id.notin_(already_invoiced_ids))
    return query.all()


def _add_feature_line_item(invoice: Invoice, feature: FeatureRequest, project: Project, db: Session) -> None:
    frontend_hours = float(feature.quoted_frontend_hours or 0)
    backend_hours = float(feature.quoted_backend_hours or 0)
    production_hours = float(feature.quoted_production_hours or 0)
    amount = round(
        frontend_hours * float(project.hourly_rate_frontend or 0)
        + backend_hours * float(project.hourly_rate_backend or 0)
        + production_hours * float(project.hourly_rate_production or 0),
        2,
    )
    db.add(
        InvoiceLineItem(
            invoice_id=invoice.id,
            item_type=InvoiceLineItemType.FEATURE,
            feature_request_id=feature.id,
            description=feature.name,
            frontend_hours=frontend_hours,
            backend_hours=backend_hours,
            production_hours=production_hours,
            amount=amount,
        )
    )


def _add_maintenance_line_item(invoice: Invoice, record: MaintenanceRecord, db: Session) -> None:
    amount = round(float(record.amount), 2)
    db.add(
        InvoiceLineItem(
            invoice_id=invoice.id,
            item_type=InvoiceLineItemType.MAINTENANCE,
            maintenance_record_id=record.id,
            description=f"Annual Maintenance — Cycle {record.cycle_year}",
            amount=amount,
        )
    )


def _recompute_totals(invoice: Invoice, project: Project, db: Session) -> None:
    db.flush()
    line_items = db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id == invoice.id).all()
    subtotal = round(sum(float(li.amount) for li in line_items), 2)
    discount = get_active_discount(project.id, db)
    discount_amount = apply_discount(subtotal, discount)
    invoice.subtotal = subtotal
    invoice.discount_amount = discount_amount
    invoice.total = round(subtotal - discount_amount + float(invoice.tax_amount), 2)


def build_draft_invoice(
    client: User,
    project: Project,
    feature_ids: list[int],
    maintenance_record_ids: list[int],
    tax_amount: float,
    notes: str | None,
    db: Session,
) -> Invoice:
    eligible_features = _eligible_features(project, feature_ids, db)
    eligible_maintenance_records = _eligible_maintenance_records(project, maintenance_record_ids, db)

    invoice = Invoice(client_id=client.id, project_id=project.id, tax_amount=tax_amount, notes=notes)
    db.add(invoice)
    db.flush()

    for feature in eligible_features:
        _add_feature_line_item(invoice, feature, project, db)
    for record in eligible_maintenance_records:
        _add_maintenance_line_item(invoice, record, db)

    _recompute_totals(invoice, project, db)
    db.commit()
    db.refresh(invoice)
    manager.broadcast_change("invoices", client_id=invoice.client_id)
    return invoice


def add_line_items_to_invoice(
    invoice: Invoice,
    project: Project,
    feature_ids: list[int],
    maintenance_record_ids: list[int],
    db: Session,
) -> Invoice:
    for feature in _eligible_features(project, feature_ids, db):
        _add_feature_line_item(invoice, feature, project, db)
    for record in _eligible_maintenance_records(project, maintenance_record_ids, db):
        _add_maintenance_line_item(invoice, record, db)

    _recompute_totals(invoice, project, db)
    db.commit()
    db.refresh(invoice)
    manager.broadcast_change("invoices", client_id=invoice.client_id)
    return invoice


def remove_line_item_from_invoice(
    invoice: Invoice, project: Project, line_item_id: int, db: Session
) -> Invoice | None:
    item = (
        db.query(InvoiceLineItem)
        .filter(InvoiceLineItem.id == line_item_id, InvoiceLineItem.invoice_id == invoice.id)
        .first()
    )
    if item is None:
        return None
    db.delete(item)
    _recompute_totals(invoice, project, db)
    db.commit()
    db.refresh(invoice)
    manager.broadcast_change("invoices", client_id=invoice.client_id)
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

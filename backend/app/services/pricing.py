from sqlalchemy.orm import Session

from app.models.discount import Discount
from app.models.enums import DiscountType
from app.models.user import User


def compute_feature_price(
    client: User,
    frontend_hours: float | None,
    backend_hours: float | None,
    production_hours: float | None,
) -> float:
    """Computes a feature's price from the client's hourly rates, never an admin-entered value."""
    return round(
        float(frontend_hours or 0) * float(client.hourly_rate_frontend or 0)
        + float(backend_hours or 0) * float(client.hourly_rate_backend or 0)
        + float(production_hours or 0) * float(client.hourly_rate_production or 0),
        2,
    )


def get_active_discount(project_id: int, db: Session) -> Discount | None:
    return (
        db.query(Discount)
        .filter(Discount.project_id == project_id, Discount.is_active == True)  # noqa: E712
        .first()
    )


def apply_discount(subtotal: float, discount: Discount | None) -> float:
    """Returns the discount amount (not the post-discount total)."""
    if not discount:
        return 0.0
    if discount.discount_type == DiscountType.PERCENTAGE:
        return round(subtotal * float(discount.value) / 100, 2)
    return min(round(float(discount.value), 2), subtotal)

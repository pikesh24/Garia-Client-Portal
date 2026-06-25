from sqlalchemy.orm import Session

from app.models.discount import Discount
from app.models.enums import DiscountType
from app.models.feature_request import FeatureRequest
from app.models.user import User


def get_active_discount(client_id: int, db: Session) -> Discount | None:
    return (
        db.query(Discount)
        .filter(Discount.client_id == client_id, Discount.is_active == True)  # noqa: E712
        .first()
    )


def apply_discount(subtotal: float, discount: Discount | None) -> float:
    """Returns the discount amount (not the post-discount total)."""
    if not discount:
        return 0.0
    if discount.discount_type == DiscountType.PERCENTAGE:
        return round(subtotal * float(discount.value) / 100, 2)
    return min(round(float(discount.value), 2), subtotal)


def quote_feature_request(feature_request: FeatureRequest, client: User, db: Session) -> dict:
    frontend_amount = float(feature_request.quoted_frontend_hours or 0) * float(client.hourly_rate_frontend or 0)
    backend_amount = float(feature_request.quoted_backend_hours or 0) * float(client.hourly_rate_backend or 0)
    production_amount = float(feature_request.quoted_production_hours or 0) * float(
        client.hourly_rate_production or 0
    )
    subtotal = round(frontend_amount + backend_amount + production_amount, 2)

    discount = get_active_discount(client.id, db)
    discount_amount = apply_discount(subtotal, discount)
    total = round(subtotal - discount_amount, 2)

    return {
        "frontend_amount": round(frontend_amount, 2),
        "backend_amount": round(backend_amount, 2),
        "production_amount": round(production_amount, 2),
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "total": total,
    }

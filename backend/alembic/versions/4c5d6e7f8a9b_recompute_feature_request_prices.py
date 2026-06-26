"""recompute feature request prices from client hourly rates

Revision ID: 4c5d6e7f8a9b
Revises: 2b3c4d5e6f7a
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4c5d6e7f8a9b'
down_revision: Union[str, None] = '2b3c4d5e6f7a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE feature_requests fr
        SET price = ROUND(
            COALESCE(fr.quoted_frontend_hours, 0) * COALESCE(u.hourly_rate_frontend, 0)
            + COALESCE(fr.quoted_backend_hours, 0) * COALESCE(u.hourly_rate_backend, 0)
            + COALESCE(fr.quoted_production_hours, 0) * COALESCE(u.hourly_rate_production, 0),
            2
        )
        FROM users u
        WHERE u.id = fr.client_id
        """
    )


def downgrade() -> None:
    pass

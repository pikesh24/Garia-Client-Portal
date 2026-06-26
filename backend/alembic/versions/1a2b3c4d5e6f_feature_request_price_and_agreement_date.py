"""feature request price and agreement date

Revision ID: 1a2b3c4d5e6f
Revises: 9c4d2f6a8e13
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, None] = '9c4d2f6a8e13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('feature_requests', sa.Column('price', sa.Numeric(12, 2), nullable=True))
    op.add_column('feature_requests', sa.Column('agreement_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('feature_requests', 'agreement_date')
    op.drop_column('feature_requests', 'price')

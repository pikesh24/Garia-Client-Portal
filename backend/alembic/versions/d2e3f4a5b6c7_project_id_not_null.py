"""project_id not null

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-06-27 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCOPED_TABLES = [
    'feature_requests',
    'support_tickets',
    'meetings',
    'invoices',
    'discounts',
    'maintenance_records',
    'infrastructure_cost_entries',
]


def upgrade() -> None:
    for table in SCOPED_TABLES:
        op.alter_column(table, 'project_id', nullable=False)


def downgrade() -> None:
    for table in SCOPED_TABLES:
        op.alter_column(table, 'project_id', nullable=True)

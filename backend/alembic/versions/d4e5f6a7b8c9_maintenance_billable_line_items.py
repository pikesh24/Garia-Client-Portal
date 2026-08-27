"""allow maintenance records to be billed as invoice line items

Revision ID: d4e5f6a7b8c9
Revises: c8d9e0f1a2b3
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c8d9e0f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

invoice_line_item_type = sa.Enum('FEATURE', 'MAINTENANCE', name='invoice_line_item_type')


def upgrade() -> None:
    invoice_line_item_type.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'invoice_line_items',
        sa.Column('item_type', invoice_line_item_type, nullable=False, server_default='FEATURE'),
    )
    op.add_column(
        'invoice_line_items',
        sa.Column('maintenance_record_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_invoice_line_items_maintenance_record_id',
        'invoice_line_items',
        'maintenance_records',
        ['maintenance_record_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_invoice_line_items_maintenance_record_id', 'invoice_line_items', type_='foreignkey')
    op.drop_column('invoice_line_items', 'maintenance_record_id')
    op.drop_column('invoice_line_items', 'item_type')
    invoice_line_item_type.drop(op.get_bind(), checkfirst=True)

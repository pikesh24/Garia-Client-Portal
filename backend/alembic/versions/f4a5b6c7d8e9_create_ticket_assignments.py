"""create ticket assignments

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-07-13 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, None] = 'e3f4a5b6c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ticket_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ticket_id', sa.Integer(), nullable=False),
        sa.Column('developer_id', sa.Integer(), nullable=False),
        sa.Column('queue_position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['support_tickets.id'], ),
        sa.ForeignKeyConstraint(['developer_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_id', 'developer_id', name='uq_ticket_assignment_ticket_developer'),
    )
    op.create_index(op.f('ix_ticket_assignments_ticket_id'), 'ticket_assignments', ['ticket_id'], unique=False)
    op.create_index(op.f('ix_ticket_assignments_developer_id'), 'ticket_assignments', ['developer_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ticket_assignments_developer_id'), table_name='ticket_assignments')
    op.drop_index(op.f('ix_ticket_assignments_ticket_id'), table_name='ticket_assignments')
    op.drop_table('ticket_assignments')

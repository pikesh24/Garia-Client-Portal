"""add ticket name and priority

Revision ID: a1b2c3d4e5f6
Revises: 7f8a9b0c1d2e
Create Date: 2026-06-26 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '7f8a9b0c1d2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # We create the ENUM type first if it doesn't exist
    ticket_priority = postgresql.ENUM('low', 'medium', 'high', 'critical', name='ticketpriority')
    ticket_priority.create(op.get_bind(), checkfirst=True)

    op.add_column('support_tickets', sa.Column('name', sa.String(length=255), server_default='Untitled Incident', nullable=False))
    op.add_column('support_tickets', sa.Column('priority', ticket_priority, server_default='medium', nullable=False))

    # Remove server_defaults if you don't want them persistent, but it's fine to leave them.
    op.alter_column('support_tickets', 'name', server_default=None)
    op.alter_column('support_tickets', 'priority', server_default=None)


def downgrade() -> None:
    op.drop_column('support_tickets', 'priority')
    op.drop_column('support_tickets', 'name')
    ticket_priority = postgresql.ENUM('low', 'medium', 'high', 'critical', name='ticketpriority')
    ticket_priority.drop(op.get_bind(), checkfirst=True)

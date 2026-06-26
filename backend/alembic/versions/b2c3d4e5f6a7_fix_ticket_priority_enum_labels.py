"""fix ticket_priority enum labels to match SQLAlchemy enum names

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE ticketpriority RENAME VALUE 'low' TO 'LOW'")
    op.execute("ALTER TYPE ticketpriority RENAME VALUE 'medium' TO 'MEDIUM'")
    op.execute("ALTER TYPE ticketpriority RENAME VALUE 'high' TO 'HIGH'")
    op.execute("ALTER TYPE ticketpriority RENAME VALUE 'critical' TO 'CRITICAL'")
    op.execute("ALTER TABLE support_tickets ALTER COLUMN priority SET DEFAULT 'MEDIUM'")


def downgrade() -> None:
    op.execute("ALTER TABLE support_tickets ALTER COLUMN priority SET DEFAULT 'medium'")
    op.execute("ALTER TYPE ticketpriority RENAME VALUE 'LOW' TO 'low'")
    op.execute("ALTER TYPE ticketpriority RENAME VALUE 'MEDIUM' TO 'medium'")
    op.execute("ALTER TYPE ticketpriority RENAME VALUE 'HIGH' TO 'high'")
    op.execute("ALTER TYPE ticketpriority RENAME VALUE 'CRITICAL' TO 'critical'")

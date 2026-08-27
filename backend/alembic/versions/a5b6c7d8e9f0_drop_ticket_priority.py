"""drop ticket priority

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-07-13 00:00:02.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a5b6c7d8e9f0'
down_revision: Union[str, None] = 'f4a5b6c7d8e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ticket priority is replaced by each developer's private drag-ordered queue
    # (see ticket_assignments.queue_position) — no client/admin-visible priority remains.
    # The live Postgres type is named "ticketpriority" (no underscore) — it was created
    # directly via postgresql.ENUM(..., name='ticketpriority') in a1b2c3d4e5f6, which predates
    # (and doesn't match) the "ticket_priority" name the SQLAlchemy model declares.
    op.execute("ALTER TABLE support_tickets DROP COLUMN priority")
    op.execute("DROP TYPE ticketpriority")


def downgrade() -> None:
    op.execute("CREATE TYPE ticketpriority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')")
    op.execute(
        "ALTER TABLE support_tickets ADD COLUMN priority ticketpriority NOT NULL DEFAULT 'MEDIUM'"
    )

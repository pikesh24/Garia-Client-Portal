"""meeting negotiation workflow redesign

Revision ID: 3b1c7e4a9d02
Revises: 0dd0924b6772
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b1c7e4a9d02'
down_revision: Union[str, None] = '0dd0924b6772'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- meeting_status: drop to text, remap old values, recreate as the new enum ---
    op.execute("ALTER TABLE meetings ALTER COLUMN status TYPE VARCHAR USING status::text")
    op.execute("DROP TYPE meeting_status")

    op.execute("UPDATE meetings SET status = 'CANCELLED' WHERE status = 'RESCHEDULED'")

    op.execute(
        "CREATE TYPE meeting_status AS ENUM "
        "('REQUESTED', 'CONFIRMED', 'RESCHEDULE_PENDING', 'DENIED', 'CANCELLED', 'COMPLETED')"
    )
    op.execute(
        "ALTER TABLE meetings ALTER COLUMN status TYPE meeting_status USING status::meeting_status"
    )

    # --- new columns for the negotiation workflow ---
    op.execute("CREATE TYPE meeting_proposed_by AS ENUM ('CLIENT', 'ADMIN')")

    op.add_column('meetings', sa.Column('confirmed_datetime', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'meetings',
        sa.Column('pending_proposed_by', sa.Enum('CLIENT', 'ADMIN', name='meeting_proposed_by'), nullable=True),
    )
    op.add_column('meetings', sa.Column('denial_reason', sa.Text(), nullable=True))

    # proposed_datetime -> pending_datetime (rename, keep data)
    op.alter_column('meetings', 'proposed_datetime', new_column_name='pending_datetime')

    # already-confirmed meetings: their pending_datetime is the agreed time
    op.execute("UPDATE meetings SET confirmed_datetime = pending_datetime WHERE status = 'CONFIRMED'")

    op.drop_column('meetings', 'rescheduled_datetime')
    op.drop_column('meetings', 'reschedule_reason')


def downgrade() -> None:
    op.add_column('meetings', sa.Column('reschedule_reason', sa.Text(), nullable=True))
    op.add_column('meetings', sa.Column('rescheduled_datetime', sa.DateTime(timezone=True), nullable=True))

    op.alter_column('meetings', 'pending_datetime', new_column_name='proposed_datetime')

    op.drop_column('meetings', 'denial_reason')
    op.drop_column('meetings', 'pending_proposed_by')
    op.drop_column('meetings', 'confirmed_datetime')

    op.execute("DROP TYPE meeting_proposed_by")

    op.execute("ALTER TABLE meetings ALTER COLUMN status TYPE VARCHAR USING status::text")
    op.execute("DROP TYPE meeting_status")

    op.execute("UPDATE meetings SET status = 'CANCELLED' WHERE status IN ('RESCHEDULE_PENDING', 'DENIED')")

    op.execute(
        "CREATE TYPE meeting_status AS ENUM "
        "('REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED')"
    )
    op.execute(
        "ALTER TABLE meetings ALTER COLUMN status TYPE meeting_status USING status::meeting_status"
    )

"""remove sent feature request status

Revision ID: 0dd0924b6772
Revises: 8f9044c813e1
Create Date: 2026-06-26 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0dd0924b6772'
down_revision: Union[str, None] = '8f9044c813e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A new feature request now starts directly in UNDER_REVIEW; there is no separate "sent" state.
    op.execute("ALTER TABLE feature_requests ALTER COLUMN status TYPE VARCHAR USING status::text")
    op.execute("DROP TYPE feature_request_status")

    op.execute("UPDATE feature_requests SET status = 'UNDER_REVIEW' WHERE status = 'SENT'")

    op.execute(
        "CREATE TYPE feature_request_status AS ENUM "
        "('UNDER_REVIEW', 'APPROVED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'OUT_OF_SCOPE', 'CANCELLED')"
    )
    op.execute(
        "ALTER TABLE feature_requests ALTER COLUMN status TYPE feature_request_status "
        "USING status::feature_request_status"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE feature_requests ALTER COLUMN status TYPE VARCHAR USING status::text")
    op.execute("DROP TYPE feature_request_status")

    op.execute(
        "CREATE TYPE feature_request_status AS ENUM "
        "('SENT', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'OUT_OF_SCOPE', 'CANCELLED')"
    )
    op.execute(
        "ALTER TABLE feature_requests ALTER COLUMN status TYPE feature_request_status "
        "USING status::feature_request_status"
    )

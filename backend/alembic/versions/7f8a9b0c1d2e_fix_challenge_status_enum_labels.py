"""fix challenge_status enum labels to match SQLAlchemy enum names

Revision ID: 7f8a9b0c1d2e
Revises: 6e7f8a9b0c1d
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '7f8a9b0c1d2e'
down_revision: Union[str, None] = '6e7f8a9b0c1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE challenge_status RENAME VALUE 'none' TO 'NONE'")
    op.execute("ALTER TYPE challenge_status RENAME VALUE 'open' TO 'OPEN'")
    op.execute("ALTER TYPE challenge_status RENAME VALUE 'approved' TO 'APPROVED'")
    op.execute("ALTER TYPE challenge_status RENAME VALUE 'denied' TO 'DENIED'")
    op.execute("ALTER TABLE feature_requests ALTER COLUMN challenge_status SET DEFAULT 'NONE'")


def downgrade() -> None:
    op.execute("ALTER TABLE feature_requests ALTER COLUMN challenge_status SET DEFAULT 'none'")
    op.execute("ALTER TYPE challenge_status RENAME VALUE 'NONE' TO 'none'")
    op.execute("ALTER TYPE challenge_status RENAME VALUE 'OPEN' TO 'open'")
    op.execute("ALTER TYPE challenge_status RENAME VALUE 'APPROVED' TO 'approved'")
    op.execute("ALTER TYPE challenge_status RENAME VALUE 'DENIED' TO 'denied'")

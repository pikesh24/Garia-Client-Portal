"""add developer role

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-07-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_role is also used by feature_request_messages.sender_role — both columns must be
    # cast away from the type before it can be dropped and recreated.
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR USING role::text")
    op.execute("ALTER TABLE feature_request_messages ALTER COLUMN sender_role TYPE VARCHAR USING sender_role::text")
    op.execute("DROP TYPE user_role")
    op.execute("CREATE TYPE user_role AS ENUM ('ADMIN', 'CLIENT', 'DEVELOPER')")
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role")
    op.execute(
        "ALTER TABLE feature_request_messages ALTER COLUMN sender_role TYPE user_role USING sender_role::user_role"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR USING role::text")
    op.execute("ALTER TABLE feature_request_messages ALTER COLUMN sender_role TYPE VARCHAR USING sender_role::text")
    op.execute("DROP TYPE user_role")
    op.execute("CREATE TYPE user_role AS ENUM ('ADMIN', 'CLIENT')")
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role")
    op.execute(
        "ALTER TABLE feature_request_messages ALTER COLUMN sender_role TYPE user_role USING sender_role::user_role"
    )

"""feature request challenge workflow

Revision ID: 6e7f8a9b0c1d
Revises: 5d6e7f8a9b0c
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e7f8a9b0c1d'
down_revision: Union[str, None] = '5d6e7f8a9b0c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


challenge_status_enum = sa.Enum('none', 'open', 'approved', 'denied', name='challenge_status')


def upgrade() -> None:
    challenge_status_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'feature_requests',
        sa.Column('challenge_status', challenge_status_enum, nullable=False, server_default='none'),
    )
    op.add_column(
        'feature_request_messages',
        sa.Column('is_challenge', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('feature_request_messages', 'is_challenge')
    op.drop_column('feature_requests', 'challenge_status')
    challenge_status_enum.drop(op.get_bind(), checkfirst=True)

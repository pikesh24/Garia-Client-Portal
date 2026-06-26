"""meeting availability toggle

Revision ID: 7a2f5c8e1b40
Revises: 3b1c7e4a9d02
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a2f5c8e1b40'
down_revision: Union[str, None] = '3b1c7e4a9d02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'meeting_availability',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('accepts_online', sa.Boolean(), nullable=False),
        sa.Column('accepts_offline', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.execute(
        "INSERT INTO meeting_availability (id, accepts_online, accepts_offline, created_at, updated_at) "
        "VALUES (1, true, true, now(), now())"
    )


def downgrade() -> None:
    op.drop_table('meeting_availability')

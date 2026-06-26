"""meeting time ranges and admin blocks

Revision ID: 9c4d2f6a8e13
Revises: 7a2f5c8e1b40
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c4d2f6a8e13'
down_revision: Union[str, None] = '7a2f5c8e1b40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_DURATION_MINUTES = 30


def upgrade() -> None:
    op.add_column('meetings', sa.Column('pending_end_datetime', sa.DateTime(timezone=True), nullable=True))
    op.add_column('meetings', sa.Column('confirmed_end_datetime', sa.DateTime(timezone=True), nullable=True))

    op.execute(
        "UPDATE meetings SET pending_end_datetime = pending_datetime + INTERVAL '30 minutes'"
    )
    op.execute(
        "UPDATE meetings SET confirmed_end_datetime = confirmed_datetime + INTERVAL '30 minutes' "
        "WHERE confirmed_datetime IS NOT NULL"
    )

    op.alter_column('meetings', 'pending_end_datetime', nullable=False)
    op.alter_column('meetings', 'pending_datetime', new_column_name='pending_start_datetime')
    op.alter_column('meetings', 'confirmed_datetime', new_column_name='confirmed_start_datetime')

    op.create_table(
        'meeting_blocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('start_datetime', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_datetime', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_meeting_blocks_start_datetime'), 'meeting_blocks', ['start_datetime'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_meeting_blocks_start_datetime'), table_name='meeting_blocks')
    op.drop_table('meeting_blocks')

    op.alter_column('meetings', 'confirmed_start_datetime', new_column_name='confirmed_datetime')
    op.alter_column('meetings', 'pending_start_datetime', new_column_name='pending_datetime')
    op.drop_column('meetings', 'confirmed_end_datetime')
    op.drop_column('meetings', 'pending_end_datetime')

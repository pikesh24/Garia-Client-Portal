"""recurring meeting blocks and meeting code

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


recurrence_frequency_enum = sa.Enum('WEEKLY', 'MONTHLY', 'YEARLY', name='recurrence_frequency')


def upgrade() -> None:
    op.create_table(
        'recurring_meeting_blocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('frequency', recurrence_frequency_enum, nullable=False),
        sa.Column('day_of_week', sa.SmallInteger(), nullable=True),
        sa.Column('day_of_month', sa.SmallInteger(), nullable=True),
        sa.Column('month', sa.SmallInteger(), nullable=True),
        sa.Column('until', sa.Date(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('meetings', sa.Column('meeting_code', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'meeting_code')
    op.drop_table('recurring_meeting_blocks')
    recurrence_frequency_enum.drop(op.get_bind(), checkfirst=True)

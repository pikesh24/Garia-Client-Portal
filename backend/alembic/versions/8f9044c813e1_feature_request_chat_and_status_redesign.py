"""feature request chat and status redesign

Revision ID: 8f9044c813e1
Revises: 44b90af4b66b
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8f9044c813e1'
down_revision: Union[str, None] = '44b90af4b66b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- feature_request_status: drop to text, remap old values, recreate as the new enum ---
    op.execute("ALTER TABLE feature_requests ALTER COLUMN status TYPE VARCHAR USING status::text")
    op.execute("DROP TYPE feature_request_status")

    op.execute("UPDATE feature_requests SET status = 'SENT' WHERE status = 'INITIATED'")
    op.execute("UPDATE feature_requests SET status = 'UNDER_REVIEW' WHERE status IN ('CLARIFICATION_REQUESTED', 'QUOTED')")
    op.execute("UPDATE feature_requests SET status = 'APPROVED' WHERE status = 'ACCEPTED'")

    op.execute(
        "CREATE TYPE feature_request_status AS ENUM "
        "('SENT', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'OUT_OF_SCOPE', 'CANCELLED')"
    )
    op.execute(
        "ALTER TABLE feature_requests ALTER COLUMN status TYPE feature_request_status "
        "USING status::feature_request_status"
    )

    # --- drop initiated_by (admin-initiated requests no longer exist) ---
    op.drop_column('feature_requests', 'initiated_by')
    op.execute("DROP TYPE initiated_by")

    # --- replace one-way clarifications with a real chat thread ---
    op.drop_index(op.f('ix_feature_request_clarifications_feature_request_id'), table_name='feature_request_clarifications')
    op.drop_table('feature_request_clarifications')

    op.create_table(
        'feature_request_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('feature_request_id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('sender_role', postgresql.ENUM('ADMIN', 'CLIENT', name='user_role', create_type=False), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['feature_request_id'], ['feature_requests.id'], ),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_feature_request_messages_feature_request_id'),
        'feature_request_messages',
        ['feature_request_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_feature_request_messages_feature_request_id'), table_name='feature_request_messages')
    op.drop_table('feature_request_messages')

    op.create_table(
        'feature_request_clarifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('feature_request_id', sa.Integer(), nullable=False),
        sa.Column('admin_query', sa.Text(), nullable=False),
        sa.Column('client_description_override', sa.Text(), nullable=True),
        sa.Column('resolved', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['feature_request_id'], ['feature_requests.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_feature_request_clarifications_feature_request_id'),
        'feature_request_clarifications',
        ['feature_request_id'],
        unique=False,
    )

    op.execute("CREATE TYPE initiated_by AS ENUM ('CLIENT', 'GARIA')")
    op.add_column('feature_requests', sa.Column('initiated_by', sa.Enum('CLIENT', 'GARIA', name='initiated_by'), nullable=True))
    op.execute("UPDATE feature_requests SET initiated_by = 'CLIENT'")
    op.alter_column('feature_requests', 'initiated_by', nullable=False)

    op.execute("ALTER TABLE feature_requests ALTER COLUMN status TYPE VARCHAR USING status::text")
    op.execute("DROP TYPE feature_request_status")

    op.execute("UPDATE feature_requests SET status = 'OUT_OF_SCOPE' WHERE status = 'DECLINED'")
    op.execute("UPDATE feature_requests SET status = 'ACCEPTED' WHERE status = 'APPROVED'")
    op.execute("UPDATE feature_requests SET status = 'CLARIFICATION_REQUESTED' WHERE status = 'UNDER_REVIEW'")
    op.execute("UPDATE feature_requests SET status = 'INITIATED' WHERE status = 'SENT'")

    op.execute(
        "CREATE TYPE feature_request_status AS ENUM "
        "('INITIATED', 'CLARIFICATION_REQUESTED', 'QUOTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'OUT_OF_SCOPE', 'CANCELLED')"
    )
    op.execute(
        "ALTER TABLE feature_requests ALTER COLUMN status TYPE feature_request_status "
        "USING status::feature_request_status"
    )

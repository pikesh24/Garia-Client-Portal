"""create projects and backfill

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-06-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


project_status_enum = sa.Enum('ACTIVE', 'INACTIVE', name='project_status')

SCOPED_TABLES = [
    'feature_requests',
    'support_tickets',
    'meetings',
    'invoices',
    'discounts',
    'maintenance_records',
    'infrastructure_cost_entries',
]


def upgrade() -> None:
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('status', project_status_enum, nullable=False, server_default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_projects_client_id'), 'projects', ['client_id'], unique=False)

    for table in SCOPED_TABLES:
        op.add_column(table, sa.Column('project_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            f'fk_{table}_project_id_projects', table, 'projects', ['project_id'], ['id']
        )
        op.create_index(op.f(f'ix_{table}_project_id'), table, ['project_id'], unique=False)

    op.execute(
        """
        INSERT INTO projects (client_id, name, status, created_at, updated_at)
        SELECT id, 'Demo Project', 'ACTIVE', now(), now() FROM users WHERE role = 'CLIENT'
        """
    )

    for table in SCOPED_TABLES:
        op.execute(
            f"""
            UPDATE {table}
            SET project_id = (
                SELECT id FROM projects WHERE projects.client_id = {table}.client_id LIMIT 1
            )
            WHERE project_id IS NULL
            """
        )


def downgrade() -> None:
    for table in SCOPED_TABLES:
        op.drop_index(op.f(f'ix_{table}_project_id'), table_name=table)
        op.drop_constraint(f'fk_{table}_project_id_projects', table, type_='foreignkey')
        op.drop_column(table, 'project_id')

    op.drop_index(op.f('ix_projects_client_id'), table_name='projects')
    op.drop_table('projects')

    project_status_enum.drop(op.get_bind(), checkfirst=True)

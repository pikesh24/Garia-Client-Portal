"""move hourly rates and maintenance price from users to projects

Revision ID: b7c8d9e0f1a2
Revises: a5b6c7d8e9f0
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, None] = 'a5b6c7d8e9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('hourly_rate_frontend', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('projects', sa.Column('hourly_rate_backend', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('projects', sa.Column('hourly_rate_production', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('projects', sa.Column('maintenance_price', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('projects', sa.Column('project_start_date', sa.Date(), nullable=True))

    # Billing configuration was previously one row per client -- copy each client's
    # existing values onto every one of their projects so nothing changes financially
    # for in-flight work until an admin sets per-project values going forward.
    op.execute(
        """
        UPDATE projects p
        SET hourly_rate_frontend = u.hourly_rate_frontend,
            hourly_rate_backend = u.hourly_rate_backend,
            hourly_rate_production = u.hourly_rate_production,
            maintenance_price = u.maintenance_price,
            project_start_date = u.project_start_date
        FROM users u
        WHERE u.id = p.client_id
        """
    )

    op.drop_column('users', 'hourly_rate_frontend')
    op.drop_column('users', 'hourly_rate_backend')
    op.drop_column('users', 'hourly_rate_production')
    op.drop_column('users', 'maintenance_price')
    op.drop_column('users', 'project_start_date')


def downgrade() -> None:
    op.add_column('users', sa.Column('hourly_rate_frontend', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('users', sa.Column('hourly_rate_backend', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('users', sa.Column('hourly_rate_production', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('users', sa.Column('maintenance_price', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('users', sa.Column('project_start_date', sa.Date(), nullable=True))

    # Best-effort: pull values back from each client's most recently created project.
    op.execute(
        """
        UPDATE users u
        SET hourly_rate_frontend = p.hourly_rate_frontend,
            hourly_rate_backend = p.hourly_rate_backend,
            hourly_rate_production = p.hourly_rate_production,
            maintenance_price = p.maintenance_price,
            project_start_date = p.project_start_date
        FROM (
            SELECT DISTINCT ON (client_id) client_id, hourly_rate_frontend, hourly_rate_backend,
                   hourly_rate_production, maintenance_price, project_start_date
            FROM projects
            ORDER BY client_id, created_at DESC
        ) p
        WHERE p.client_id = u.id
        """
    )

    op.drop_column('projects', 'project_start_date')
    op.drop_column('projects', 'maintenance_price')
    op.drop_column('projects', 'hourly_rate_production')
    op.drop_column('projects', 'hourly_rate_backend')
    op.drop_column('projects', 'hourly_rate_frontend')

"""add contact_email to handoff_requests

Revision ID: 8bdf5f2ff893
Revises: d4e5f6a7b8c9
Create Date: 2026-05-21 20:34:35.891914

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '8bdf5f2ff893'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('handoff_requests', sa.Column('contact_email', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('handoff_requests', 'contact_email')

"""add parent_content to chunks

Revision ID: a9f3c2b1d8e7
Revises: fe6267543cdb
Create Date: 2026-05-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'a9f3c2b1d8e7'
down_revision = 'fe6267543cdb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('chunks', sa.Column('parent_content', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('chunks', 'parent_content')

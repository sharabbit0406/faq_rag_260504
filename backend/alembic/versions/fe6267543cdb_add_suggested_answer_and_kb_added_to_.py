"""add suggested_answer and kb_added to handoff_requests

Revision ID: fe6267543cdb
Revises: 8bdf5f2ff893
Create Date: 2026-05-21 21:22:39.085116

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'fe6267543cdb'
down_revision: Union[str, None] = '8bdf5f2ff893'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('handoff_requests', sa.Column('suggested_answer', sa.Text(), nullable=True))
    op.add_column('handoff_requests', sa.Column('kb_added', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('handoff_requests', 'kb_added')
    op.drop_column('handoff_requests', 'suggested_answer')

"""Add diagram share links

Enlace de acceso general por diagrama ("cualquiera con el enlace"), con token
secreto y rol (EDITOR/READER), revocable y regenerable.

Revision ID: c3f8a1d27e55
Revises: a7c1e5b09d42
Create Date: 2026-11-02 18:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3f8a1d27e55"
down_revision: Union[str, Sequence[str], None] = "a7c1e5b09d42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "diagram_share_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("diagram_id", sa.Integer(), sa.ForeignKey("diagrams.id"), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="EDITOR"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_diagram_share_links_id", "diagram_share_links", ["id"])
    op.create_index("ix_diagram_share_links_diagram_id", "diagram_share_links", ["diagram_id"], unique=True)
    op.create_index("ix_diagram_share_links_token", "diagram_share_links", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_diagram_share_links_token", table_name="diagram_share_links")
    op.drop_index("ix_diagram_share_links_diagram_id", table_name="diagram_share_links")
    op.drop_index("ix_diagram_share_links_id", table_name="diagram_share_links")
    op.drop_table("diagram_share_links")

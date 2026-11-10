"""Add per-diagram AI execution policy.

Revision ID: b72d4c90e1fa
Revises: f6c1a3e8b2d4
Create Date: 2026-11-07 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b72d4c90e1fa"
down_revision: str | Sequence[str] | None = "b8d4e2f1a6c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "diagrams",
        sa.Column(
            "agent_permission",
            sa.String(),
            nullable=False,
            server_default="ask",
        ),
    )


def downgrade() -> None:
    op.drop_column("diagrams", "agent_permission")

"""Move AI execution preference from diagram to each member.

Revision ID: c31a9f207b64
Revises: b72d4c90e1fa
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c31a9f207b64"
down_revision: str | Sequence[str] | None = "b72d4c90e1fa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "diagram_permissions",
        sa.Column("agent_permission", sa.String(), nullable=False, server_default="ask"),
    )
    op.execute(
        "UPDATE diagram_permissions SET agent_permission = diagrams.agent_permission "
        "FROM diagrams WHERE diagram_permissions.diagram_id = diagrams.id"
    )
    op.drop_column("diagrams", "agent_permission")


def downgrade() -> None:
    op.add_column(
        "diagrams",
        sa.Column("agent_permission", sa.String(), nullable=False, server_default="ask"),
    )
    op.execute(
        "UPDATE diagrams SET agent_permission = diagram_permissions.agent_permission "
        "FROM diagram_permissions WHERE diagram_permissions.diagram_id = diagrams.id "
        "AND diagram_permissions.role = 'OWNER'"
    )
    op.drop_column("diagram_permissions", "agent_permission")

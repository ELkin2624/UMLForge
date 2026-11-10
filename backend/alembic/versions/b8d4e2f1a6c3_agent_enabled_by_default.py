"""Agente de IA activo por defecto

Los diagramas nacen con el agente activo (antes había que activarlo en
Colaboración) y los existentes se activan. El propietario puede apagarlo.

Revision ID: b8d4e2f1a6c3
Revises: f6c1a3e8b2d4
Create Date: 2026-11-10 12:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b8d4e2f1a6c3"
down_revision: str | Sequence[str] | None = "f6c1a3e8b2d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("diagrams") as batch:
        batch.alter_column(
            "agent_enabled", existing_type=sa.Boolean(), server_default=sa.true()
        )
    op.execute(sa.text("UPDATE diagrams SET agent_enabled = true"))


def downgrade() -> None:
    # Solo se restaura el valor por defecto; no se apaga el agente en diagramas existentes.
    with op.batch_alter_table("diagrams") as batch:
        batch.alter_column(
            "agent_enabled", existing_type=sa.Boolean(), server_default=sa.false()
        )

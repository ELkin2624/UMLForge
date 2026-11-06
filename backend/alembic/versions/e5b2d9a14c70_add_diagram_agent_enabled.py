"""Add diagrams.agent_enabled

El propietario activa o desactiva la presencia del agente de IA en la sala
colaborativa de cada diagrama (desactivada por defecto).

Revision ID: e5b2d9a14c70
Revises: c3f8a1d27e55
Create Date: 2026-11-05 10:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5b2d9a14c70"
down_revision: Union[str, Sequence[str], None] = "c3f8a1d27e55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "diagrams",
        sa.Column(
            "agent_enabled", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    op.drop_column("diagrams", "agent_enabled")

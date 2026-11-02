"""Move diagram data to MongoDB

El contenido de cada diagrama (columna ``diagrams.data``) pasa a MongoDB
(colecciones ``diagram_documents`` y ``diagram_versions``). PostgreSQL conserva
solo la fila índice (id, name, owner_id, fechas) por las FK de permisos e
invitaciones.

upgrade:
  1. copia cada diagrama a Mongo (documento + versión 1 "migration"), idempotente;
  2. verifica que todos quedaron en Mongo;
  3. solo entonces elimina la columna ``data``.
downgrade: recrea la columna y copia de vuelta el documento actual desde Mongo.

Revision ID: a7c1e5b09d42
Revises: d4a3c7c2bcb4
Create Date: 2026-11-02 12:00:00

"""
import datetime
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a7c1e5b09d42"
down_revision: Union[str, Sequence[str], None] = "d4a3c7c2bcb4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _mongo_db():
    from pymongo import MongoClient

    from app.core.config import settings

    client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
    return client[settings.MONGO_DB_NAME]


def _as_dict(value):
    if value is None:
        return {}
    if isinstance(value, str):
        return json.loads(value)
    return value


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT d.id, d.data, u.display_name, u.username, d.owner_id "
        "FROM diagrams d LEFT JOIN users u ON u.id = d.owner_id ORDER BY d.id"
    )).fetchall()

    db = _mongo_db()
    docs, versions = db["diagram_documents"], db["diagram_versions"]
    docs.create_index("diagram_id", unique=True)
    versions.create_index([("diagram_id", 1), ("version", -1)], unique=True)

    now = datetime.datetime.now(datetime.timezone.utc)
    for diagram_id, data, display_name, username, owner_id in rows:
        data = _as_dict(data)
        # Idempotente: si ya existe (migración repetida), no se sobrescribe.
        if docs.count_documents({"diagram_id": diagram_id}, limit=1):
            continue
        author = {
            "type": "user", "user_id": owner_id,
            "name": display_name or username or "Desconocido",
        }
        versions.insert_one({
            "diagram_id": diagram_id, "version": 1, "author": author,
            "source": "migration", "created_at": now,
            "summary": "Importado desde PostgreSQL", "changes": [],
            "data": data, "restored_from": None,
        })
        docs.insert_one({
            "diagram_id": diagram_id, "data": data, "version": 1, "updated_at": now,
        })

    # Verificación previa a borrar nada en PostgreSQL.
    missing = [
        r[0] for r in rows
        if not docs.count_documents({"diagram_id": r[0]}, limit=1)
    ]
    if missing:
        raise RuntimeError(
            f"Migración abortada: diagramas sin documento en MongoDB: {missing}"
        )

    op.drop_column("diagrams", "data")


def downgrade() -> None:
    op.add_column("diagrams", sa.Column(
        "data", postgresql.JSONB(astext_type=sa.Text()), nullable=True
    ))
    bind = op.get_bind()
    db = _mongo_db()
    for (diagram_id,) in bind.execute(sa.text("SELECT id FROM diagrams")).fetchall():
        doc = db["diagram_documents"].find_one({"diagram_id": diagram_id}, {"_id": 0})
        data = doc["data"] if doc else {}
        bind.execute(
            sa.text("UPDATE diagrams SET data = CAST(:d AS JSONB) WHERE id = :i"),
            {"d": json.dumps(data), "i": diagram_id},
        )
    op.alter_column("diagrams", "data", nullable=False)

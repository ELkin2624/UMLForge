"""Persistencia de diagramas (documento actual + historial de versiones).

Interfaz común (``DiagramRepository``) con dos implementaciones:
- ``MongoDiagramRepository``: producción (MongoDB, ``pymongo`` síncrono).
- ``InMemoryDiagramRepository``: tests.

El CRUD de diagramas es síncrono (SQLAlchemy), por eso aquí se usa ``pymongo``
y no ``motor``.
"""

import copy
import datetime
import threading
from abc import ABC, abstractmethod
from typing import Any

from .diff import diff_models, summarize

Author = dict[str, Any]
Version = dict[str, Any]


class DiagramNotFoundInStore(Exception):
    """El diagrama no tiene documento en el almacén."""


class VersionNotFound(Exception):
    """La versión solicitada no existe."""


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


def user_author(user_id: int, name: str) -> Author:
    return {"type": "user", "user_id": user_id, "name": name}


def ai_author(on_behalf_of_id: int, on_behalf_of_name: str) -> Author:
    return {
        "type": "ai",
        "user_id": None,
        "name": "IA",
        "on_behalf_of": {"user_id": on_behalf_of_id, "name": on_behalf_of_name},
    }


class DiagramRepository(ABC):
    """Contrato del almacén de diagramas."""

    @abstractmethod
    def ensure_indexes(self) -> None: ...

    @abstractmethod
    def _get_document(self, diagram_id: int) -> dict[str, Any] | None: ...

    @abstractmethod
    def _put_document(self, diagram_id: int, data: dict[str, Any], version: int) -> None: ...

    @abstractmethod
    def _insert_version(self, version: Version) -> None: ...

    @abstractmethod
    def delete(self, diagram_id: int) -> None: ...

    @abstractmethod
    def list_versions(
        self, diagram_id: int, limit: int = 50, before: int | None = None
    ) -> list[Version]:
        """Versiones sin snapshot, de la más nueva a la más antigua."""

    @abstractmethod
    def get_version(self, diagram_id: int, version: int) -> Version | None:
        """Versión con su snapshot completo."""

    @abstractmethod
    def has_document(self, diagram_id: int) -> bool: ...

    @abstractmethod
    def get_dependencies(self, diagram_id: int) -> list[dict[str, Any]]:
        """Decisiones del usuario sobre dependencias funcionales (diseño de datos)."""

    @abstractmethod
    def save_dependencies(self, diagram_id: int, dependencies: list[dict[str, Any]]) -> None: ...

    # --- Operaciones de alto nivel (comunes) ---------------------------------

    def get_data(self, diagram_id: int) -> dict[str, Any]:
        doc = self._get_document(diagram_id)
        return copy.deepcopy(doc["data"]) if doc else {}

    def current_version(self, diagram_id: int) -> int:
        doc = self._get_document(diagram_id)
        return int(doc["version"]) if doc else 0

    def create(
        self,
        diagram_id: int,
        data: dict[str, Any],
        author: Author,
        source: str = "user",
        summary: str = "Diagrama creado",
    ) -> int:
        """Crea el documento y la versión 1. Devuelve el número de versión."""
        data = copy.deepcopy(data or {})
        self._put_document(diagram_id, data, 1)
        self._insert_version(self._build_version(
            diagram_id, 1, data, author, source,
            changes=diff_models({}, data), summary=summary,
        ))
        return 1

    def save(
        self,
        diagram_id: int,
        data: dict[str, Any],
        author: Author,
        source: str = "user",
        restored_from: int | None = None,
    ) -> Version | None:
        """Guarda ``data`` como estado actual.

        Devuelve la versión creada, o ``None`` si no hay diferencias (no se
        registra nada). Lanza ``DiagramNotFoundInStore`` si no hay documento.
        """
        doc = self._get_document(diagram_id)
        if doc is None:
            raise DiagramNotFoundInStore(diagram_id)

        new_data = copy.deepcopy(data or {})
        changes = diff_models(doc["data"], new_data)
        if not changes:
            return None

        number = int(doc["version"]) + 1
        summary = summarize(changes)
        if restored_from is not None:
            summary = f"Restauró la versión {restored_from}. {summary}"
        version = self._build_version(
            diagram_id, number, new_data, author, source,
            changes=changes, summary=summary, restored_from=restored_from,
        )
        # Primero la versión (inmutable), luego el documento actual.
        self._insert_version(version)
        self._put_document(diagram_id, new_data, number)
        return self._without_snapshot(version)

    def restore(self, diagram_id: int, version: int, author: Author) -> Version | None:
        """Restaura el snapshot ``version`` como una versión nueva."""
        target = self.get_version(diagram_id, version)
        if target is None:
            raise VersionNotFound(version)
        return self.save(
            diagram_id, target["data"], author, source="restore", restored_from=version
        )

    # --- Utilidades -----------------------------------------------------------

    @staticmethod
    def _build_version(
        diagram_id: int, number: int, data: dict[str, Any], author: Author,
        source: str, changes: list[dict[str, Any]], summary: str,
        restored_from: int | None = None,
    ) -> Version:
        return {
            "diagram_id": diagram_id,
            "version": number,
            "author": author,
            "source": source,
            "created_at": _now(),
            "summary": summary,
            "changes": changes,
            "data": data,
            "restored_from": restored_from,
        }

    @staticmethod
    def _without_snapshot(version: Version) -> Version:
        return {k: v for k, v in version.items() if k != "data"}


class MongoDiagramRepository(DiagramRepository):
    def __init__(self, mongo_uri: str, db_name: str) -> None:
        from pymongo import MongoClient

        self._client: Any = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        self._db = self._client[db_name]
        self._indexes_done = False

    @property
    def documents(self) -> Any:
        self.ensure_indexes()
        return self._db["diagram_documents"]

    @property
    def versions(self) -> Any:
        self.ensure_indexes()
        return self._db["diagram_versions"]

    def ensure_indexes(self) -> None:
        """Crea los índices una sola vez, de forma perezosa (no exige Mongo al arrancar)."""
        if self._indexes_done:
            return
        self._db["diagram_documents"].create_index("diagram_id", unique=True)
        self._db["diagram_versions"].create_index(
            [("diagram_id", 1), ("version", -1)], unique=True
        )
        self._db["diagram_dependencies"].create_index("diagram_id", unique=True)
        self._indexes_done = True

    def _get_document(self, diagram_id: int) -> dict[str, Any] | None:
        return self.documents.find_one({"diagram_id": diagram_id}, {"_id": 0})

    def _put_document(self, diagram_id: int, data: dict[str, Any], version: int) -> None:
        self.documents.update_one(
            {"diagram_id": diagram_id},
            {"$set": {"data": data, "version": version, "updated_at": _now()}},
            upsert=True,
        )

    def _insert_version(self, version: Version) -> None:
        self.versions.insert_one(dict(version))

    def has_document(self, diagram_id: int) -> bool:
        return self.documents.count_documents({"diagram_id": diagram_id}, limit=1) > 0

    @property
    def dependencies(self) -> Any:
        self.ensure_indexes()
        return self._db["diagram_dependencies"]

    def get_dependencies(self, diagram_id: int) -> list[dict[str, Any]]:
        doc = self.dependencies.find_one({"diagram_id": diagram_id}, {"_id": 0})
        return list(doc["dependencies"]) if doc else []

    def save_dependencies(self, diagram_id: int, dependencies: list[dict[str, Any]]) -> None:
        self.dependencies.update_one(
            {"diagram_id": diagram_id},
            {"$set": {"dependencies": dependencies, "updated_at": _now()}},
            upsert=True,
        )

    def delete(self, diagram_id: int) -> None:
        self.documents.delete_many({"diagram_id": diagram_id})
        self.versions.delete_many({"diagram_id": diagram_id})
        self.dependencies.delete_many({"diagram_id": diagram_id})

    def list_versions(
        self, diagram_id: int, limit: int = 50, before: int | None = None
    ) -> list[Version]:
        query: dict[str, Any] = {"diagram_id": diagram_id}
        if before is not None:
            query["version"] = {"$lt": before}
        cursor = (
            self.versions.find(query, {"_id": 0, "data": 0})
            .sort("version", -1)
            .limit(limit)
        )
        return list(cursor)

    def get_version(self, diagram_id: int, version: int) -> Version | None:
        return self.versions.find_one(
            {"diagram_id": diagram_id, "version": version}, {"_id": 0}
        )


class InMemoryDiagramRepository(DiagramRepository):
    """Implementación en memoria (tests)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._docs: dict[int, dict[str, Any]] = {}
        self._versions: dict[int, list[Version]] = {}
        self._deps: dict[int, list[dict[str, Any]]] = {}

    def ensure_indexes(self) -> None:
        return None

    def _get_document(self, diagram_id: int) -> dict[str, Any] | None:
        doc = self._docs.get(diagram_id)
        return copy.deepcopy(doc) if doc else None

    def _put_document(self, diagram_id: int, data: dict[str, Any], version: int) -> None:
        with self._lock:
            self._docs[diagram_id] = {
                "diagram_id": diagram_id, "data": copy.deepcopy(data),
                "version": version, "updated_at": _now(),
            }

    def _insert_version(self, version: Version) -> None:
        with self._lock:
            self._versions.setdefault(version["diagram_id"], []).append(
                copy.deepcopy(version)
            )

    def has_document(self, diagram_id: int) -> bool:
        return diagram_id in self._docs

    def get_dependencies(self, diagram_id: int) -> list[dict[str, Any]]:
        return copy.deepcopy(self._deps.get(diagram_id, []))

    def save_dependencies(self, diagram_id: int, dependencies: list[dict[str, Any]]) -> None:
        with self._lock:
            self._deps[diagram_id] = copy.deepcopy(dependencies)

    def delete(self, diagram_id: int) -> None:
        with self._lock:
            self._docs.pop(diagram_id, None)
            self._versions.pop(diagram_id, None)
            self._deps.pop(diagram_id, None)

    def list_versions(
        self, diagram_id: int, limit: int = 50, before: int | None = None
    ) -> list[Version]:
        items = sorted(
            self._versions.get(diagram_id, []), key=lambda v: v["version"], reverse=True
        )
        if before is not None:
            items = [v for v in items if v["version"] < before]
        return [self._without_snapshot(copy.deepcopy(v)) for v in items[:limit]]

    def get_version(self, diagram_id: int, version: int) -> Version | None:
        for v in self._versions.get(diagram_id, []):
            if v["version"] == version:
                return copy.deepcopy(v)
        return None

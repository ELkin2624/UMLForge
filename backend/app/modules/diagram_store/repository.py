"""Persistencia de diagramas (documento actual + historial de versiones).

Interfaz común (``DiagramRepository``) con dos implementaciones:
- ``MongoDiagramRepository``: producción (MongoDB, ``pymongo`` síncrono).
- ``InMemoryDiagramRepository``: tests.

El CRUD de diagramas es síncrono (SQLAlchemy), por eso aquí se usa ``pymongo``
y no ``motor``.
"""

import copy
import logging
import datetime
import threading
from abc import ABC, abstractmethod
from typing import Any

from .diff import diff_models, summarize

Author = dict[str, Any]
Version = dict[str, Any]


class RevisionConflict(Exception):
    """El documento cambió antes de confirmar la operación."""


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

    @abstractmethod
    def _cas_document(self, diagram_id: int, expected: int, document: dict[str, Any]) -> bool: ...

    def state(self, diagram_id: int) -> dict[str, Any]:
        doc = self._get_document(diagram_id)
        if doc is None:
            raise DiagramNotFoundInStore(diagram_id)
        return {"data": copy.deepcopy(doc.get("data", {})),
                "layout": copy.deepcopy(doc.get("layout", {})),
                "revision": int(doc["version"])}

    def receipt(self, diagram_id: int, batch_id: str) -> Version | None:
        doc = self._get_document(diagram_id) or {}
        for event in doc.get("pending_versions", []):
            if event.get("batch_id") == batch_id:
                return copy.deepcopy(event)
        for event in self.list_versions(diagram_id, limit=200):
            if event.get("batch_id") == batch_id:
                return self.get_version(diagram_id, event["version"])
        return None

    def commit(self, diagram_id: int, expected: int, data: dict[str, Any],
               layout: dict[str, Any], author: Author, source: str, batch_id: str,
               inverse: list[dict[str, Any]] | None = None, restored_from: int | None = None) -> Version:
        previous = self.receipt(diagram_id, batch_id)
        if previous:
            return previous
        doc = self._get_document(diagram_id)
        if doc is None:
            raise DiagramNotFoundInStore(diagram_id)
        if int(doc["version"]) != expected:
            raise RevisionConflict()
        changes = diff_models(doc.get("data", {}), data)
        summary = summarize(changes) if changes else "Reorganizó las posiciones del diagrama"
        if restored_from:
            summary = f"Restauró la versión {restored_from}. {summary}"
        event = self._build_version(diagram_id, expected + 1, copy.deepcopy(data), author,
            source, changes, summary, restored_from=restored_from)
        event.update(layout=copy.deepcopy(layout), batch_id=batch_id, inverse=inverse or [])
        pending = list(doc.get("pending_versions", []))
        if len(pending) >= 8:
            raise RuntimeError("No se puede guardar: hay versiones pendientes de persistencia.")
        updated = {**doc, "data": copy.deepcopy(data), "layout": copy.deepcopy(layout),
                   "version": expected + 1, "pending_versions": [*pending, event],
                   "publish_pending": True, "updated_at": _now()}
        if not self._cas_document(diagram_id, expected, updated):
            raise RevisionConflict()
        try:
            self.project_versions(diagram_id)
        except Exception:
            logging.getLogger(__name__).exception("Versión confirmada; proyección pendiente para %s", diagram_id)
        return event

    def project_versions(self, diagram_id: int) -> None:
        doc = self._get_document(diagram_id) or {}
        for event in doc.get("pending_versions", []):
            self._insert_version(event)
        # La implementación concreta retira únicamente los eventos ya proyectados.
        self._ack_versions(diagram_id, [e["version"] for e in doc.get("pending_versions", [])])

    def _ack_versions(self, diagram_id: int, versions: list[int]) -> None: ...

    def pending_publications(self) -> list[int]:
        return []

    def acknowledge_publication(self, diagram_id: int, revision: int) -> None: ...

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
        self.versions.update_one(
            {"diagram_id": version["diagram_id"], "version": version["version"]},
            {"$setOnInsert": dict(version)}, upsert=True,
        )

    def _cas_document(self, diagram_id: int, expected: int, document: dict[str, Any]) -> bool:
        result = self.documents.replace_one({"diagram_id": diagram_id, "version": expected}, document)
        return bool(result.matched_count)

    def receipt(self, diagram_id: int, batch_id: str) -> Version | None:
        found = self.versions.find_one({"diagram_id": diagram_id, "batch_id": batch_id}, {"_id": 0})
        if found:
            return found
        doc = self._get_document(diagram_id) or {}
        return next((e for e in doc.get("pending_versions", []) if e.get("batch_id") == batch_id), None)

    def _ack_versions(self, diagram_id: int, versions: list[int]) -> None:
        self.documents.update_one({"diagram_id": diagram_id},
            {"$pull": {"pending_versions": {"version": {"$in": versions}}}})

    def pending_publications(self) -> list[int]:
        return [d["diagram_id"] for d in self.documents.find(
            {"$or": [{"publish_pending": True}, {"pending_versions.0": {"$exists": True}}]},
            {"diagram_id": 1}).limit(100)]

    def acknowledge_publication(self, diagram_id: int, revision: int) -> None:
        self.documents.update_one({"diagram_id": diagram_id, "version": revision},
            {"$set": {"publish_pending": False}})

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
            versions = self._versions.setdefault(version["diagram_id"], [])
            if not any(v["version"] == version["version"] for v in versions):
                versions.append(copy.deepcopy(version))

    def receipt(self, diagram_id: int, batch_id: str) -> Version | None:
        for version in self._versions.get(diagram_id, []):
            if version.get("batch_id") == batch_id:
                return copy.deepcopy(version)
        return super().receipt(diagram_id, batch_id)

    def _cas_document(self, diagram_id: int, expected: int, document: dict[str, Any]) -> bool:
        with self._lock:
            if self._docs.get(diagram_id, {}).get("version") != expected:
                return False
            self._docs[diagram_id] = copy.deepcopy(document)
            return True

    def _ack_versions(self, diagram_id: int, versions: list[int]) -> None:
        with self._lock:
            if diagram_id in self._docs:
                self._docs[diagram_id]["pending_versions"] = [
                    e for e in self._docs[diagram_id].get("pending_versions", []) if e["version"] not in versions]

    def pending_publications(self) -> list[int]:
        return [key for key, doc in self._docs.items() if doc.get("publish_pending")]

    def acknowledge_publication(self, diagram_id: int, revision: int) -> None:
        with self._lock:
            if self._docs.get(diagram_id, {}).get("version") == revision:
                self._docs[diagram_id]["publish_pending"] = False

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

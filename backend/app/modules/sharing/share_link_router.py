"""Enlace de acceso general ("cualquiera con el enlace") con token en el backend."""

import datetime
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth_deps import require_authenticated_user
from app.core.database.models import (
    Diagram,
    DiagramPermission,
    DiagramRole,
    DiagramShareLink,
    User,
)
from app.core.database.session import get_db
from app.modules.sharing.router import require_owner

router = APIRouter(prefix="/api/v1", tags=["share_links"])

LinkRole = Literal["EDITOR", "READER"]


class ShareLinkUpdate(BaseModel):
    enabled: bool
    role: LinkRole = "EDITOR"


class ShareLinkResponse(BaseModel):
    enabled: bool
    role: LinkRole
    # Solo se devuelve al propietario, y solo si hay un enlace creado.
    token: str | None = None
    updated_at: datetime.datetime | None = None


class JoinResponse(BaseModel):
    diagram_id: int
    diagram_name: str
    role: str
    already_member: bool


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def _to_response(link: DiagramShareLink | None) -> ShareLinkResponse:
    if link is None:
        return ShareLinkResponse(enabled=False, role="EDITOR", token=None)
    return ShareLinkResponse(
        enabled=link.enabled, role=link.role, token=link.token, updated_at=link.updated_at  # type: ignore[arg-type]
    )


@router.get("/diagrams/{diagram_id}/share-link", response_model=ShareLinkResponse)
def get_share_link(
    diagram_id: int,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Estado del enlace (solo propietario: el token es secreto)."""
    diagram = require_owner(diagram_id, db, current_user)
    return _to_response(diagram.share_link)


@router.put("/diagrams/{diagram_id}/share-link", response_model=ShareLinkResponse)
def update_share_link(
    diagram_id: int,
    payload: ShareLinkUpdate,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Activa/desactiva el enlace y fija su rol. Crea el token la primera vez."""
    diagram = require_owner(diagram_id, db, current_user)
    link = diagram.share_link
    if link is None:
        link = DiagramShareLink(
            diagram_id=diagram_id, token=_new_token(), created_by=current_user.id
        )
        db.add(link)
    link.enabled = payload.enabled
    link.role = payload.role
    link.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(link)
    return _to_response(link)


@router.post("/diagrams/{diagram_id}/share-link/regenerate", response_model=ShareLinkResponse)
def regenerate_share_link(
    diagram_id: int,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Invalida el enlace anterior y genera uno nuevo (conserva rol y estado)."""
    diagram = require_owner(diagram_id, db, current_user)
    link = diagram.share_link
    if link is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Este diagrama aún no tiene enlace")
    link.token = _new_token()
    link.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(link)
    return _to_response(link)


@router.post("/share-links/{token}/join", response_model=JoinResponse)
def join_by_share_link(
    token: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Quien presenta un enlace válido obtiene acceso al diagrama con el rol del enlace.

    Nunca rebaja ni cambia un rol existente (ej. el propietario no pasa a lector).
    """
    link = (
        db.query(DiagramShareLink)
        .filter(DiagramShareLink.token == token, DiagramShareLink.enabled.is_(True))
        .first()
    )
    if link is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "El enlace no es válido o fue desactivado"
        )
    diagram = db.query(Diagram).filter(Diagram.id == link.diagram_id).first()
    if diagram is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El diagrama ya no existe")

    existing = db.query(DiagramPermission).filter(
        DiagramPermission.diagram_id == link.diagram_id,
        DiagramPermission.user_id == current_user.id,
    ).first()
    if existing is not None:
        return JoinResponse(
            diagram_id=diagram.id, diagram_name=diagram.name,
            role=existing.role, already_member=True,
        )

    role = DiagramRole.READER.value if link.role == "READER" else DiagramRole.EDITOR.value
    db.add(DiagramPermission(diagram_id=link.diagram_id, user_id=current_user.id, role=role))
    try:
        db.commit()
    except IntegrityError:  # carrera: se unió en paralelo
        db.rollback()
        existing = db.query(DiagramPermission).filter(
            DiagramPermission.diagram_id == link.diagram_id,
            DiagramPermission.user_id == current_user.id,
        ).first()
        return JoinResponse(
            diagram_id=diagram.id, diagram_name=diagram.name,
            role=existing.role if existing else role, already_member=True,
        )
    return JoinResponse(
        diagram_id=diagram.id, diagram_name=diagram.name, role=role, already_member=False
    )

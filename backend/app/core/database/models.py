import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, Index, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship

JSON_TYPE = JSON().with_variant(JSONB, "postgresql")

Base = declarative_base()

class DiagramRole(str, Enum):
    OWNER = "OWNER"
    EDITOR = "EDITOR"
    READER = "READER"

class InvitationRole(str, Enum):
    EDITOR = "EDITOR"
    READER = "READER"

class InvitationStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    display_name = Column(String, nullable=True)
    auth_provider = Column(String, default="local")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    diagram_permissions = relationship("DiagramPermission", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="recipient", cascade="all, delete-orphan")
    sent_invitations = relationship("DiagramInvitation", foreign_keys="DiagramInvitation.inviter_user_id", back_populates="inviter", cascade="all, delete-orphan")
    received_invitations = relationship("DiagramInvitation", foreign_keys="DiagramInvitation.invitee_user_id", back_populates="invitee", cascade="all, delete-orphan")

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    rotated_from = Column(String, nullable=True)

    user = relationship("User", back_populates="refresh_tokens")

class Diagram(Base):
    __tablename__ = "diagrams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    data = Column(JSON_TYPE, nullable=False, default={})
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    permissions = relationship("DiagramPermission", back_populates="diagram", cascade="all, delete-orphan")
    invitations = relationship("DiagramInvitation", back_populates="diagram", cascade="all, delete-orphan")
    owner = relationship("User")

class DiagramPermission(Base):
    __tablename__ = "diagram_permissions"
    __table_args__ = (
        UniqueConstraint('diagram_id', 'user_id', name='uq_diagram_user_permission'),
    )

    id = Column(Integer, primary_key=True, index=True)
    diagram_id = Column(Integer, ForeignKey("diagrams.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, nullable=False, default=DiagramRole.EDITOR.value) # OWNER, EDITOR, READER
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    diagram = relationship("Diagram", back_populates="permissions")
    user = relationship("User", back_populates="diagram_permissions")

class DiagramInvitation(Base):
    __tablename__ = "diagram_invitations"
    __table_args__ = (
        Index(
            'uq_pending_diagram_invitation',
            'diagram_id',
            'invitee_user_id',
            unique=True,
            postgresql_where=(Column('status') == InvitationStatus.PENDING.value)
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    diagram_id = Column(Integer, ForeignKey("diagrams.id"), nullable=False, index=True)
    inviter_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    invitee_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    requested_role = Column(String, nullable=False, default=InvitationRole.EDITOR.value)
    status = Column(String, nullable=False, default=InvitationStatus.PENDING.value) # PENDING, ACCEPTED, REJECTED, EXPIRED, CANCELLED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)

    diagram = relationship("Diagram", back_populates="invitations")
    inviter = relationship("User", foreign_keys=[inviter_user_id], back_populates="sent_invitations")
    invitee = relationship("User", foreign_keys=[invitee_user_id], back_populates="received_invitations")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    read = Column(Boolean, default=False, index=True)
    data = Column(JSON_TYPE, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    recipient = relationship("User", back_populates="notifications")

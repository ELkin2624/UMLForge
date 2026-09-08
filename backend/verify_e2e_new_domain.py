import uuid
import sys
import os
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.canonical_model.class_model import UMLClass, UMLAttribute
from app.core.canonical_model.relationship_model import UMLRelationship, RelationshipKind
from app.core.canonical_model.model import UMLModel
from app.modules.generator.application.generate_project import ProjectGenerator

def _uid() -> str:
    return str(uuid.uuid4())

def build_conference_model() -> UMLModel:
    conf_id = _uid()
    sess_id = _uid()
    att_id = _uid()
    spk_id = _uid()
    track_id = _uid()

    conference = UMLClass(
        id=conf_id,
        name="Conference",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="name", type="String", is_nullable=False),
            UMLAttribute(id=_uid(), name="city", type="String"),
            UMLAttribute(id=_uid(), name="year", type="Integer"),
        ]
    )

    session = UMLClass(
        id=sess_id,
        name="Session",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="title", type="String", is_nullable=False),
            UMLAttribute(id=_uid(), name="durationMinutes", type="Integer"),
        ]
    )

    attendee = UMLClass(
        id=att_id,
        name="Attendee",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="fullName", type="String", is_nullable=False),
            UMLAttribute(id=_uid(), name="email", type="String", is_nullable=False),
        ]
    )

    speaker = UMLClass(
        id=spk_id,
        name="KeynoteSpeaker",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="biography", type="String"),
            UMLAttribute(id=_uid(), name="organization", type="String"),
        ]
    )

    track = UMLClass(
        id=track_id,
        name="TopicTrack",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="topicName", type="String", is_nullable=False),
            UMLAttribute(id=_uid(), name="difficultyLevel", type="String"),
        ]
    )

    # Relaciones:
    # 1. Composición 1:N Conference (1) -> Session (*)
    rel_comp = UMLRelationship(
        id=_uid(),
        name="rel_conference_sessions",
        type=RelationshipKind.COMPOSITION,
        source=conf_id,
        target=sess_id,
        source_multiplicity="1",
        target_multiplicity="*",
    )

    # 2. Generalización: KeynoteSpeaker extends Attendee
    rel_gen = UMLRelationship(
        id=_uid(),
        name="rel_speaker_attendee",
        type=RelationshipKind.GENERALIZATION,
        source=spk_id,
        target=att_id,
    )

    # 3. ManyToMany: Session (*) <-> TopicTrack (*)
    rel_m2m = UMLRelationship(
        id=_uid(),
        name="rel_session_tracks",
        type=RelationshipKind.ASSOCIATION,
        source=sess_id,
        target=track_id,
        source_multiplicity="*",
        target_multiplicity="*",
    )

    return UMLModel(
        id="ConferenceBackend",
        name="Conference Management System",
        classes=[conference, session, attendee, speaker, track],
        relationships=[rel_comp, rel_gen, rel_m2m]
    )

def main():
    print("=== Generating ConferenceBackend from CanonicalModel ===")
    model = build_conference_model()
    templates_dir = Path(__file__).parent / "app" / "modules" / "generator" / "templates"
    generator = ProjectGenerator(templates_dir)

    target_dir = Path(r"c:\Parcial-sw1-of\backend-springboot\ConferenceBackend")
    target_dir.mkdir(parents=True, exist_ok=True)

    generated = generator.generate(model, "ConferenceBackend", "com.conference.app")

    print(f"Generated {len(generated.files)} files. Writing to {target_dir}...")
    for gf in generated.files:
        out_path = target_dir / gf.path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        if gf.media_type.startswith("text/") or gf.media_type in ("application/json", "application/xml", "application/x-yaml", "application/sql"):
            out_path.write_text(gf.content, encoding="utf-8")
        else:
            out_path.write_bytes(gf.content if isinstance(gf.content, bytes) else gf.content.encode("utf-8"))

    print("=== Project written successfully! ===")
    schema_path = target_dir / "src" / "main" / "resources" / "schema.sql"
    data_path = target_dir / "src" / "main" / "resources" / "data.sql"
    postman_path = target_dir / "postman" / "ConferenceBackend.postman_collection.json"

    print(f"\n--- schema.sql exists: {schema_path.exists()} (size: {schema_path.stat().st_size if schema_path.exists() else 0} bytes)")
    print(f"--- data.sql exists: {data_path.exists()} (size: {data_path.stat().st_size if data_path.exists() else 0} bytes)")
    print(f"--- postman collection exists: {postman_path.exists()} (size: {postman_path.stat().st_size if postman_path.exists() else 0} bytes)")

if __name__ == "__main__":
    main()

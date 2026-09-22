import uuid
from app.core.canonical_model.class_model import UMLClass, UMLAttribute
from app.core.canonical_model.relationship_model import UMLRelationship, RelationshipKind
from app.core.canonical_model.model import UMLModel
from app.modules.generator.domain.domain_analyzer import DomainAnalyzer, DomainType
from app.modules.generator.domain.entity_mapper import EntityMapper
from app.modules.generator.domain.dependency_graph import DependencyGraph
from app.modules.generator.domain.schema_mapper import SchemaMapper
from app.modules.generator.domain.synthetic_data_generator import SyntheticDataGenerator
from app.modules.postman.generator import generate_postman_collection
from app.modules.generator.application.generate_project import ProjectGenerator

def _uid() -> str:
    return str(uuid.uuid4())

def test_new_real_domain_generation_e2e():
    """
    Verifica de punta a punta un dominio nuevo y real (Conferencias / Eventos Cientificos)
    con 5 clases, 1:N, N:M, Composicion y Herencia (JOINED).
    """
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

    model = UMLModel(
        id="ConferenceBackend",
        name="Conference Management System",
        classes=[conference, session, attendee, speaker, track],
        relationships=[rel_comp, rel_gen, rel_m2m]
    )

    # Pipeline de generación
    entities = EntityMapper.map_entities(model)
    ordered = DependencyGraph.topological_sort(entities)
    domain = DomainAnalyzer.analyze(model)
    dataset = SyntheticDataGenerator.generate(model, ordered, domain)
    schema = SchemaMapper.map_schema(ordered)
    col = generate_postman_collection(model, ordered_entities=ordered, domain=domain, dataset=dataset)

    # 1. Verificación de orden topológico y herencia en schema.sql
    table_names = [t.name for t in schema.tables]
    assert "attendees" in table_names
    assert "keynote_speakers" in table_names
    assert "sessions_topic_tracks" in table_names
    # La join table debe estar al final
    assert table_names[-1] == "sessions_topic_tracks"

    # 2. Verificación de persistencia N:M en data.sql
    sql = "\n".join(dataset.sql_statements)
    assert "INSERT INTO sessions_topic_tracks (session_id, topictrack_id)" in sql
    assert "ON CONFLICT DO NOTHING" in sql

    # 3. Verificación de representación REST en Postman
    session_folder = next(f for f in col.item if f.name == "Session")
    create_session = next(i for i in session_folder.item if i.name == "Create Session")
    raw_body = create_session.request.body.raw

    # Debe contener conferenceId y topicTrackIds como arreglo
    assert '"conferenceId": {{conferenceId}}' in raw_body
    assert '"topicTrackIds": [' in raw_body
    assert '{{topicTrackId}}' in raw_body

    # 4. Variables de colección preinicializadas con IDs del seed
    var_dict = {v.key: v.value for v in col.variable}
    assert "conferenceId" in var_dict
    assert "topicTrackId" in var_dict
    assert var_dict["conferenceId"] == "1"
    assert var_dict["topicTrackId"] == "1"


def test_self_referencing_category_generation_e2e():
    """
    Verifica que la generación de una entidad auto-referenciada (como Categoria
    que puede o no tener una categoria padre) funcione de extremo a extremo:
    - schema.sql con FK nullable hacia sí misma
    - data.sql con categoria raíz con categoria_id = NULL y subcategoría con categoria_id = 1
    - CategoriaRequest sin @NotNull en categoriaId
    - CategoriaService con manejo de null y asignación de padre
    - Postman collection con Create Categoria sin auto-referencia para crear la raíz
    """
    cat_id = _uid()
    categoria = UMLClass(
        id=cat_id,
        name="Categoria",
        attributes=[
            UMLAttribute(id=_uid(), name="id", type="Long", is_primary_key=True),
            UMLAttribute(id=_uid(), name="nombre", type="String", is_nullable=False),
            UMLAttribute(id=_uid(), name="descripcion", type="String"),
        ],
    )

    # Relación Categoria (*) -> Categoria (0..1) (subcategorías apuntan a su categoría padre)
    rel_self = UMLRelationship(
        id=_uid(),
        name="categoriaPadre",
        source=cat_id,
        target=cat_id,
        source_multiplicity="*",
        target_multiplicity="0..1",
        type=RelationshipKind.ASSOCIATION,
    )

    model = UMLModel(
        id=_uid(),
        name="Store Management",
        classes=[categoria],
        relationships=[rel_self],
    )

    from pathlib import Path
    templates_dir = Path(__file__).parents[2] / "app" / "modules" / "generator" / "templates"
    generator = ProjectGenerator(templates_dir=templates_dir)
    generated = generator.generate(model, "store", "com.example.store")

    file_map = {f.path: f.content for f in generated.files}

    # 1. schema.sql debe tener columna categoria_id y FOREIGN KEY
    schema_sql = file_map["src/main/resources/schema.sql"]
    assert "categoria_id" in schema_sql
    assert "FOREIGN KEY (categoria_id) REFERENCES categorias(id)" in schema_sql

    # 2. data.sql: la fila 0 (raíz) DEBE tener categoria_id NULL y la fila 1 DEBE tener categoria_id 1
    data_sql = file_map["src/main/resources/data.sql"]
    lines = [l for l in data_sql.splitlines() if l.startswith("INSERT INTO categorias")]
    assert len(lines) >= 2
    assert "NULL" in lines[0]  # Raíz no tiene padre
    assert "1" in lines[1]     # Subcategoría tiene como padre la categoría 1

    # 3. CategoriaRequest.java: categoriaId es opcional (no lleva @NotNull)
    req_java = file_map["src/main/java/com/example/store/dto/request/CategoriaRequest.java"]
    assert "private Long categoriaId;" in req_java
    assert "@NotNull\n    private Long categoriaId;" not in req_java

    # 4. CategoriaService.java: manejo de null para categoría padre
    svc_java = file_map["src/main/java/com/example/store/service/CategoriaService.java"]
    assert "if (request.getCategoriaId() != null)" in svc_java
    assert "entity.setCategoria(null);" in svc_java

    # 5. Postman: Create Categoria no envía categoriaId para crear la raíz sin problemas
    postman_coll = file_map["postman/store.postman_collection.json"]
    assert '"categoriaId":' not in postman_coll


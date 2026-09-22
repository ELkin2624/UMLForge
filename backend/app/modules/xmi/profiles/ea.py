"""
Perfil de adaptación XMI 2.5.1 específico para Sparx Systems Enterprise Architect (EA).
Mapea entre el modelo intermedio neutral XMIElement y el CanonicalModel (UMLModel).
"""

from typing import Literal, cast
from uuid import NAMESPACE_URL, UUID, uuid5

from app.core.canonical_model.class_model import UMLAttribute, UMLClass
from app.core.canonical_model.component_model import (
    UMLComponent,
    UMLConnector,
    UMLDependency,
    UMLInterface,
    UMLPort,
)
from app.core.canonical_model.model import UMLModel
from app.core.canonical_model.operation_model import UMLOperation, UMLParameter
from app.core.canonical_model.relationship_model import UMLRelationship
from app.core.uml_core.enums import (
    ParameterDirectionKind,
    RelationshipKind,
    VisibilityKind,
)

from ..core.id_map import IDMapper
from ..core.intermediate import XMIElement, XMIModelDocument
from ..core.namespaces import match_uml_type


class XMIReferenceNotFoundError(Exception):
    """Lanzada cuando un elemento XMI hace referencia a un xmi:id inexistente."""

    def __init__(self, message: str, code: str = "XMI_REFERENCE_NOT_FOUND") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


def _parse_visibility(val: str | None, default: VisibilityKind) -> VisibilityKind:
    if not val:
        return default
    val_lower = val.lower()
    for kind in VisibilityKind:
        if kind.value == val_lower:
            return kind
    return default


def _parse_direction(val: str | None) -> ParameterDirectionKind:
    if not val:
        return ParameterDirectionKind.IN
    val_lower = val.lower()
    for kind in ParameterDirectionKind:
        if kind.value == val_lower:
            return kind
    return ParameterDirectionKind.IN


def _compute_multiplicity(lower: str | None, upper: str | None) -> str:
    if lower is None and upper is None:
        return "1"
    low = "0" if lower is None else str(lower)
    up = "1" if upper is None else str(upper)
    if low == up:
        return low
    return f"{low}..{up}"


def _parse_multiplicity_bounds(mult: str | None) -> tuple[str, str]:
    if not mult or str(mult).strip() == "":
        return "1", "1"
    m = str(mult).strip()
    if m == "*":
        return "0", "*"
    if ".." in m:
        parts = m.split("..", 1)
        low = parts[0].strip()
        up = parts[1].strip()
        if low == "*":
            low = "0"
        return low, up
    if m == "0":
        return "0", "0"
    return m, m



EA_PRIMITIVE_TYPE_MAP: dict[str, str] = {
    "int": "Integer",
    "integer": "Integer",
    "smallint": "Integer",
    "tinyint": "Integer",
    "long": "Long",
    "bigint": "Long",
    "string": "String",
    "varchar": "String",
    "char": "String",
    "text": "String",
    "nvarchar": "String",
    "character": "String",
    "boolean": "Boolean",
    "bool": "Boolean",
    "bit": "Boolean",
    "float": "Double",
    "double": "Double",
    "real": "Double",
    "decimal": "BigDecimal",
    "numeric": "BigDecimal",
    "date": "LocalDate",
    "datetime": "LocalDateTime",
    "timestamp": "LocalDateTime",
    "time": "LocalTime",
    "uuid": "UUID",
    "byte": "byte",
    "void": "void",
}


def normalize_ea_type(raw_type: str | None) -> str:
    """Normaliza un tipo de dato proveniente de Enterprise Architect a un tipo canónico legible."""
    if not raw_type:
        return "String"

    cleaned = raw_type.strip()
    for prefix in ("EAJava_", "EAC_", "EACSharp_", "EAPrimitive_", "EA_"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
            break

    lower_key = cleaned.lower()
    if lower_key in EA_PRIMITIVE_TYPE_MAP:
        return EA_PRIMITIVE_TYPE_MAP[lower_key]

    # Si es un nombre válido de identificador Java / UML (ej. NombreDeClase)
    if cleaned.isalnum() or "_" in cleaned:
        return cleaned

    return "String"



def map_intermediate_to_canonical(
    doc: XMIModelDocument,
    id_mapper: IDMapper | None = None,
) -> tuple[UMLModel, list[str]]:
    """
    Convierte un documento intermedio XMIModelDocument a un UMLModel canónico siguiendo
    las reglas del perfil Enterprise Architect.
    Retorna el modelo canónico y una lista de advertencias sobre elementos no soportados.
    """
    if id_mapper is None:
        id_mapper = IDMapper(doc.doc_fingerprint)

    warnings: list[str] = []

    classes: list[UMLClass] = []
    components: list[UMLComponent] = []
    interfaces: list[UMLInterface] = []
    ports: list[UMLPort] = []
    connectors: list[UMLConnector] = []
    dependencies: list[UMLDependency] = []
    relationships: list[UMLRelationship] = []

    # Registrar primero todos los elementos raíz para resolución de IDs
    for elem in doc.root_elements:
        id_mapper.register(elem.xmi_id)
        for child in elem.children:
            id_mapper.register(child.xmi_id)

    def find_element_by_id(target_id: str) -> XMIElement | None:
        def _search_recursively(elements: list[XMIElement]) -> XMIElement | None:
            for el in elements:
                if el.xmi_id == target_id:
                    return el
                if el.children:
                    found = _search_recursively(el.children)
                    if found:
                        return found
            return None
        return _search_recursively(doc.root_elements)

    def resolve_type(type_name: str | None, type_ref: str | None) -> str:
        if type_name:
            return normalize_ea_type(type_name)
        if type_ref:
            # 1. Normalizar directamente si coincide con tipos conocidos o prefijos EA (ej. EAJava_int)
            clean_type = normalize_ea_type(type_ref)
            if clean_type != "String" or type_ref.lower().endswith("string"):
                return clean_type

            # 2. Buscar si es un elemento referenciado por ID en el documento
            ref_elem = find_element_by_id(type_ref)
            if ref_elem and ref_elem.name:
                return normalize_ea_type(ref_elem.name)

            # 3. Si apunta a una clase o interfaz del modelo
            if ref_elem and (
                match_uml_type(ref_elem.xmi_type, "Class")
                or match_uml_type(ref_elem.xmi_type, "Interface")
            ):
                return ref_elem.name or "String"

            return "String"
        return "String"

    # Procesar elementos (soportando clases anidadas de forma recursiva)
    def process_element(elem: XMIElement, current_owner_id: str | None = None) -> None:
        elem_id = id_mapper.register(elem.xmi_id)
        elem_name = elem.name or f"Unnamed_{elem.xmi_id}"
        handled = False

        # 1. Clases (uml:Class) o AssociationClass
        if match_uml_type(elem.xmi_type, "Class") or match_uml_type(elem.xmi_type, "AssociationClass"):
            handled = True
            attributes: list[UMLAttribute] = []
            operations: list[UMLOperation] = []

            for child in elem.children:
                child_id = id_mapper.register(child.xmi_id)
                child_name = child.name or f"attr_{child.xmi_id}"

                # Atributos (uml:Property)
                if (
                    match_uml_type(child.xmi_type, "Property")
                    or child.tag_name == "ownedAttribute"
                ):
                    # Extremos de asociación en una AssociationClass NO son atributos de la entidad
                    if child.tag_name == "ownedEnd":
                        continue
                    if not child.name and child.type_ref:
                        continue

                    attr_type = resolve_type(child.type_name, child.type_ref)
                    multiplicity = _compute_multiplicity(
                        child.lower_value, child.upper_value
                    )
                    vis = _parse_visibility(child.visibility, VisibilityKind.PRIVATE)

                    attributes.append(
                        UMLAttribute(
                            id=child_id,
                            name=child_name,
                            type=attr_type,
                            visibility=vis,
                            multiplicity=multiplicity,
                            is_static=child.is_static,
                            initial_value=child.default_value,
                        )
                    )

                # Operaciones (uml:Operation)
                elif (
                    match_uml_type(child.xmi_type, "Operation")
                    or child.tag_name == "ownedOperation"
                ):
                    params: list[UMLParameter] = []
                    return_type: str | None = None

                    for p_elem in child.children:
                        if (
                            match_uml_type(p_elem.xmi_type, "Parameter")
                            or p_elem.tag_name == "ownedParameter"
                        ):
                            p_id = id_mapper.register(p_elem.xmi_id)
                            p_name = p_elem.name or "param"
                            p_type = resolve_type(p_elem.type_name, p_elem.type_ref)
                            p_dir = _parse_direction(p_elem.direction)

                            if p_dir == ParameterDirectionKind.RETURN:
                                return_type = p_type
                            else:
                                params.append(
                                    UMLParameter(
                                        id=p_id,
                                        name=p_name,
                                        type=p_type,
                                        direction=p_dir,
                                    )
                                )

                    op_vis = _parse_visibility(child.visibility, VisibilityKind.PUBLIC)
                    operations.append(
                        UMLOperation(
                            id=child_id,
                            name=child_name,
                            visibility=op_vis,
                            is_abstract=child.is_abstract,
                            is_static=child.is_static,
                            return_type=return_type or "void",
                            parameters=params,
                        )
                    )

                # Generalizaciones internas (<generalization general="..."/>)
                elif (
                    match_uml_type(child.xmi_type, "Generalization")
                    or child.tag_name == "generalization"
                ):
                    if not child.general_ref:
                        warnings.append(
                            f"Generalización {child.xmi_id} en clase {elem_name} no especifica general_ref."
                        )
                        continue
                    gen_target_uuid = id_mapper.get_uuid(child.general_ref)
                    if not gen_target_uuid:
                        gen_target_uuid = id_mapper.register(child.general_ref)

                    relationships.append(
                        UMLRelationship(
                            id=child_id,
                            name=child.name or f"Inherits_{elem_name}",
                            type=RelationshipKind.GENERALIZATION,
                            source=str(elem_id),
                            target=str(gen_target_uuid),
                        )
                    )

                # Soporte para Nested Classes
                elif match_uml_type(child.xmi_type, "Class") or match_uml_type(child.xmi_type, "AssociationClass"):
                    process_element(child, current_owner_id=str(elem_id))
                    
                # Procesar asociación o generalización anidada
                elif match_uml_type(child.xmi_type, "Association") or match_uml_type(child.xmi_type, "Generalization"):
                    process_element(child)

            classes.append(
                UMLClass(
                    id=elem_id,
                    name=elem_name,
                    is_abstract=elem.is_abstract,
                    attributes=attributes,
                    operations=operations,
                    owner_id=current_owner_id,
                )
            )

        # 2. Interfaces (uml:Interface)
        elif match_uml_type(elem.xmi_type, "Interface"):
            handled = True
            if_ops: list[UMLOperation] = []
            for child in elem.children:
                if (
                    match_uml_type(child.xmi_type, "Operation")
                    or child.tag_name == "ownedOperation"
                ):
                    child_id = id_mapper.register(child.xmi_id)
                    child_name = child.name or f"op_{child.xmi_id}"

                    params = []
                    return_type = None
                    for p_elem in child.children:
                        if (
                            match_uml_type(p_elem.xmi_type, "Parameter")
                            or p_elem.tag_name == "ownedParameter"
                        ):
                            p_id = id_mapper.register(p_elem.xmi_id)
                            p_name = p_elem.name or "param"
                            p_type = p_elem.type_name or "String"
                            p_dir = _parse_direction(p_elem.direction)

                            if p_dir == ParameterDirectionKind.RETURN:
                                return_type = p_type
                            else:
                                params.append(
                                    UMLParameter(
                                        id=p_id,
                                        name=p_name,
                                        type=p_type,
                                        direction=p_dir,
                                    )
                                )

                    if_ops.append(
                        UMLOperation(
                            id=child_id,
                            name=child_name,
                            visibility=_parse_visibility(
                                child.visibility, VisibilityKind.PUBLIC
                            ),
                            is_abstract=True,
                            return_type=return_type or "void",
                            parameters=params,
                        )
                    )

            interfaces.append(
                UMLInterface(
                    id=elem_id,
                    name=elem_name,
                    description=elem.raw_attributes.get("description"),
                    operations=if_ops,
                )
            )

        # 3. Componentes (uml:Component)
        elif match_uml_type(elem.xmi_type, "Component"):
            handled = True
            for child in elem.children:
                # Puertos de componente (uml:Port)
                if (
                    match_uml_type(child.xmi_type, "Port")
                    or child.tag_name == "ownedPort"
                ):
                    port_id = id_mapper.register(child.xmi_id)
                    port_name = child.name or f"port_{child.xmi_id}"

                    # Obtener interfaz asociada (por type_ref o type)
                    if_ref_id = child.type_ref or child.raw_attributes.get("type")
                    if not if_ref_id:
                        warnings.append(
                            f"Puerto {port_name} en componente {elem_name} no especifica interface_id."
                        )
                        continue

                    if_uuid = id_mapper.register(if_ref_id)
                    # Deducción de kind (provided / required) a partir de nombre o atributos
                    kind_val = "provided"
                    if (
                        "req" in port_name.lower()
                        or child.raw_attributes.get("kind") == "required"
                    ):
                        kind_val = "required"

                    ports.append(
                        UMLPort(
                            id=port_id,
                            name=port_name,
                            component_id=elem_id,
                            interface_id=if_uuid,
                            kind=cast(Literal["provided", "required"], kind_val),
                        )
                    )

            components.append(
                UMLComponent(
                    id=elem_id,
                    name=elem_name,
                    description=elem.raw_attributes.get("description"),
                )
            )

        # 4. Asociaciones (uml:Association o AssociationClass)
        if match_uml_type(elem.xmi_type, "Association") or match_uml_type(elem.xmi_type, "AssociationClass"):
            handled = True
            # Encontrar los dos extremos de la asociación
            owned_ends = [
                c
                for c in elem.children
                if match_uml_type(c.xmi_type, "Property") or c.tag_name == "ownedEnd"
            ]

            src_ref = None
            tgt_ref = None
            end1 = None
            end2 = None

            if len(owned_ends) >= 2:
                end1 = owned_ends[0]
                end2 = owned_ends[1]
                src_ref = end1.type_ref or end1.raw_attributes.get("type")
                tgt_ref = end2.type_ref or end2.raw_attributes.get("type")
            elif len(elem.member_end_refs) >= 2:
                end1 = find_element_by_id(elem.member_end_refs[0])
                end2 = find_element_by_id(elem.member_end_refs[1])
                if end1 and end2:
                    src_ref = end1.type_ref or end1.raw_attributes.get("type")
                    tgt_ref = end2.type_ref or end2.raw_attributes.get("type")

            if src_ref and tgt_ref and end1 and end2:
                src_uuid = id_mapper.register(src_ref)
                tgt_uuid = id_mapper.register(tgt_ref)

                rel_type = RelationshipKind.ASSOCIATION
                # Determinar agregación / composición
                if end1.aggregation == "composite":
                    rel_type = RelationshipKind.COMPOSITION
                elif end1.aggregation == "shared":
                    rel_type = RelationshipKind.AGGREGATION
                elif end2.aggregation == "composite":
                    rel_type = RelationshipKind.COMPOSITION
                elif end2.aggregation == "shared":
                    rel_type = RelationshipKind.AGGREGATION

                if match_uml_type(elem.xmi_type, "AssociationClass"):
                    # Representar AssociationClass conectada a ambas entidades
                    rel1_id = id_mapper.register(f"{elem.xmi_id}_rel_end1")
                    rel2_id = id_mapper.register(f"{elem.xmi_id}_rel_end2")
                    end1_mult = _compute_multiplicity(end1.lower_value, end1.upper_value)
                    end2_mult = _compute_multiplicity(end2.lower_value, end2.upper_value)

                    # Relación 1: src (ej. Producto) 1 -> * AssociationClass (DetalleFactura)
                    relationships.append(
                        UMLRelationship(
                            id=rel1_id,
                            name=f"{elem_name}_{getattr(end1, 'name', None) or 'item'}",
                            type=RelationshipKind.ASSOCIATION,
                            source=str(src_uuid),
                            target=str(elem_id),
                            source_multiplicity="1" if end1_mult == "1" else end1_mult,
                            target_multiplicity="*" if end1_mult == "1" else end1_mult,
                        )
                    )
                    # Relación 2: tgt (ej. Factura) 1 -> * AssociationClass (DetalleFactura)
                    relationships.append(
                        UMLRelationship(
                            id=rel2_id,
                            name=f"{elem_name}_{getattr(end2, 'name', None) or 'header'}",
                            type=RelationshipKind.ASSOCIATION,
                            source=str(tgt_uuid),
                            target=str(elem_id),
                            source_multiplicity="1" if end2_mult == "1" else end2_mult,
                            target_multiplicity="*" if end2_mult == "1" else end2_mult,
                        )
                    )
                else:
                    relationships.append(
                        UMLRelationship(
                            id=elem_id,
                            name=elem.name or f"Assoc_{elem.xmi_id}",
                            type=rel_type,
                            source=str(src_uuid),
                            target=str(tgt_uuid),
                            source_multiplicity=_compute_multiplicity(
                                end1.lower_value, end1.upper_value
                            ),
                            target_multiplicity=_compute_multiplicity(
                                end2.lower_value, end2.upper_value
                            ),
                        )
                    )
            else:
                warnings.append(
                    f"Asociación {elem_name} ({elem.xmi_id}) ignorada por no poder resolver 2 extremos."
                )

        # 5. Conectores (uml:Connector)
        elif match_uml_type(elem.xmi_type, "Connector"):
            handled = True
            if not elem.source_ref or not elem.target_ref:
                raise XMIReferenceNotFoundError(
                    f"Conector {elem_name} ({elem.xmi_id}) carece de extremos (roles) válidos.",
                    code="XMI_REFERENCE_NOT_FOUND",
                )

            src_port_uuid = id_mapper.register(elem.source_ref)
            tgt_port_uuid = id_mapper.register(elem.target_ref)

            connectors.append(
                UMLConnector(
                    id=elem_id,
                    name=elem.name,
                    source_port_id=src_port_uuid,
                    target_port_id=tgt_port_uuid,
                )
            )

        # 6. Dependencias (uml:Dependency)
        elif match_uml_type(elem.xmi_type, "Dependency"):
            handled = True
            if not elem.client_ref or not elem.supplier_ref:
                raise XMIReferenceNotFoundError(
                    f"Dependencia {elem_name} ({elem.xmi_id}) carece de client o supplier referenciado.",
                    code="XMI_REFERENCE_NOT_FOUND",
                )

            src_uuid = id_mapper.register(elem.client_ref)
            tgt_uuid = id_mapper.register(elem.supplier_ref)

            dependencies.append(
                UMLDependency(
                    id=elem_id,
                    source_id=src_uuid,
                    target_id=tgt_uuid,
                    type="dependency",
                )
            )

        # Elementos no soportados
        if not handled:
            warnings.append(
                f"Elemento no soportado '{elem.xmi_type}' (id={elem.xmi_id}, name='{elem_name}') ignorado."
            )

    for elem in doc.root_elements:
        process_element(elem)

    model = UMLModel(
        id=str(id_mapper.register(doc.model_id)),
        classes=classes,
        components=components,
        interfaces=interfaces,
        ports=ports,
        connectors=connectors,
        dependencies=dependencies,
        relationships=relationships,
    )

    return model, warnings


def canonical_to_ea_intermediate(
    model: UMLModel,
    id_mapper: IDMapper | None = None,
) -> XMIModelDocument:
    """
    Transforma un UMLModel canónico a un XMIModelDocument intermedio siguiendo el perfil EA.
    Garantiza que todos los identificadores xmi:id sigan el estándar EAID_ (<= 41 caracteres)
    para compatibilidad estricta con Enterprise Architect y motores relacionales DAO / Jet.
    """
    if id_mapper is None:
        id_mapper = IDMapper()

    model_xmi_id = id_mapper.register_canonical(model.id, prefix="EAID_")
    root_elements: list[XMIElement] = []

    # 1. Clases
    # Agrupar clases por owner_id
    classes_by_owner: dict[str | None, list[UMLClass]] = {None: []}
    for cls in model.classes:
        owner = cls.owner_id
        if owner not in classes_by_owner:
            classes_by_owner[owner] = []
        classes_by_owner[owner].append(cls)

    def generate_class_element(cls: UMLClass) -> XMIElement:
        cls_xmi_id = id_mapper.register_canonical(cls.id, prefix="EAID_")
        cls_children: list[XMIElement] = []

        # Atributos
        for attr in cls.attributes:
            attr_xmi_id = id_mapper.register_canonical(attr.id, prefix="EAID_")
            attr_low, attr_up = _parse_multiplicity_bounds(attr.multiplicity)
            cls_children.append(
                XMIElement(
                    xmi_id=attr_xmi_id,
                    xmi_type="uml:Property",
                    tag_name="ownedAttribute",
                    name=attr.name,
                    visibility=attr.visibility.value,
                    is_static=attr.is_static,
                    type_name=attr.type,
                    lower_value=attr_low,
                    upper_value=attr_up,
                    default_value=attr.initial_value,
                )
            )

        # Operaciones
        for op in cls.operations:
            op_xmi_id = id_mapper.register_canonical(op.id, prefix="EAID_")
            op_children: list[XMIElement] = []

            for param in op.parameters:
                p_xmi_id = id_mapper.register_canonical(param.id, prefix="EAID_")
                op_children.append(
                    XMIElement(
                        xmi_id=p_xmi_id,
                        xmi_type="uml:Parameter",
                        tag_name="ownedParameter",
                        name=param.name,
                        direction=param.direction.value,
                        type_name=param.type,
                    )
                )

            if op.return_type and op.return_type != "void":
                op_uuid = id_mapper.register(op_xmi_id)
                ret_uuid = uuid5(op_uuid, "return")
                ret_xmi_id = id_mapper.register_canonical(ret_uuid, prefix="EAID_")
                op_children.append(
                    XMIElement(
                        xmi_id=ret_xmi_id,
                        xmi_type="uml:Parameter",
                        tag_name="ownedParameter",
                        direction="return",
                        type_name=op.return_type,
                    )
                )

            cls_children.append(
                XMIElement(
                    xmi_id=op_xmi_id,
                    xmi_type="uml:Operation",
                    tag_name="ownedOperation",
                    name=op.name,
                    visibility=op.visibility.value,
                    is_abstract=op.is_abstract,
                    is_static=op.is_static,
                    children=op_children,
                )
            )

        # Generalizaciones de esta clase (<generalization general="..."/>)
        for rel in model.relationships:
            if rel.type == RelationshipKind.GENERALIZATION and str(rel.source) == str(cls.id):
                gen_uuid = uuid5(id_mapper.register(cls_xmi_id), f"gen_{rel.target}")
                gen_xmi_id = id_mapper.register_canonical(gen_uuid, prefix="EAID_")
                tgt_xmi_id = id_mapper.register_canonical(rel.target, prefix="EAID_")
                cls_children.append(
                    XMIElement(
                        xmi_id=gen_xmi_id,
                        xmi_type="uml:Generalization",
                        tag_name="generalization",
                        name=rel.name,
                        general_ref=tgt_xmi_id,
                    )
                )

        # Clases anidadas
        if str(cls.id) in classes_by_owner:
            for nested_cls in classes_by_owner[str(cls.id)]:
                cls_children.append(generate_class_element(nested_cls))

        return XMIElement(
            xmi_id=cls_xmi_id,
            xmi_type="uml:Class",
            tag_name="packagedElement",
            name=cls.name,
            visibility="public",
            is_abstract=cls.is_abstract,
            children=cls_children,
        )

    for cls in classes_by_owner.get(None, []):
        root_elements.append(generate_class_element(cls))

    # 2. Interfaces
    for iface in model.interfaces:
        if_xmi_id = id_mapper.register_canonical(iface.id, prefix="EAID_")
        if_children: list[XMIElement] = []

        for op in iface.operations:
            op_xmi_id = id_mapper.register_canonical(op.id, prefix="EAID_")
            op_children = []

            for param in op.parameters:
                p_xmi_id = id_mapper.register_canonical(param.id, prefix="EAID_")
                op_children.append(
                    XMIElement(
                        xmi_id=p_xmi_id,
                        xmi_type="uml:Parameter",
                        tag_name="ownedParameter",
                        name=param.name,
                        direction=param.direction.value,
                        type_name=param.type,
                    )
                )

            if op.return_type and op.return_type != "void":
                op_uuid = id_mapper.register(op_xmi_id)
                ret_uuid = uuid5(op_uuid, "return")
                ret_xmi_id = id_mapper.register_canonical(ret_uuid, prefix="EAID_")
                op_children.append(
                    XMIElement(
                        xmi_id=ret_xmi_id,
                        xmi_type="uml:Parameter",
                        tag_name="ownedParameter",
                        direction="return",
                        type_name=op.return_type,
                    )
                )

            if_children.append(
                XMIElement(
                    xmi_id=op_xmi_id,
                    xmi_type="uml:Operation",
                    tag_name="ownedOperation",
                    name=op.name,
                    visibility=op.visibility.value,
                    is_abstract=True,
                    children=op_children,
                )
            )

        root_elements.append(
            XMIElement(
                xmi_id=if_xmi_id,
                xmi_type="uml:Interface",
                tag_name="packagedElement",
                name=iface.name,
                visibility="public",
                children=if_children,
            )
        )

    # 3. Componentes y sus puertos
    for comp in model.components:
        comp_xmi_id = id_mapper.register_canonical(comp.id, prefix="EAID_")
        comp_children: list[XMIElement] = []

        # Buscar puertos pertenecientes a este componente
        comp_uuid = UUID(comp.id) if isinstance(comp.id, str) else comp.id
        for port in model.ports:
            if port.component_id == comp_uuid:
                port_xmi_id = id_mapper.register_canonical(port.id, prefix="EAID_")
                if_xmi_id = id_mapper.register_canonical(
                    port.interface_id, prefix="EAID_"
                )

                comp_children.append(
                    XMIElement(
                        xmi_id=port_xmi_id,
                        xmi_type="uml:Port",
                        tag_name="ownedPort",
                        name=port.name,
                        type_ref=if_xmi_id,
                        raw_attributes={"kind": port.kind},
                    )
                )

        root_elements.append(
            XMIElement(
                xmi_id=comp_xmi_id,
                xmi_type="uml:Component",
                tag_name="packagedElement",
                name=comp.name,
                visibility="public",
                children=comp_children,
            )
        )

    # 4. Relaciones (Asociaciones)
    class_names: dict[str, str] = {str(c.id): c.name for c in model.classes}

    for rel in model.relationships:
        if rel.type == RelationshipKind.GENERALIZATION:
            # Las generalizaciones se incrustan como <generalization> dentro de la subclase
            continue

        rel_xmi_id = id_mapper.register_canonical(rel.id, prefix="EAID_")
        src_xmi_id = id_mapper.register_canonical(rel.source, prefix="EAID_")
        tgt_xmi_id = id_mapper.register_canonical(rel.target, prefix="EAID_")
        src_name = class_names.get(str(rel.source), "source")
        tgt_name = class_names.get(str(rel.target), "target")

        # Nombre legible si viene con fallback 'rel_...' o vacío
        if not rel.name or rel.name.startswith("rel_") or rel.name == "rel":
            rel_name = f"{src_name}_{tgt_name}"
        else:
            rel_name = rel.name

        agg_val = "none"
        rel_type_str = str(
            rel.type.value if hasattr(rel.type, "value") else rel.type
        ).lower()
        if "composite" in rel_type_str or "composition" in rel_type_str:
            agg_val = "composite"
        elif "shared" in rel_type_str or "aggregation" in rel_type_str:
            agg_val = "shared"

        src_low, src_up = _parse_multiplicity_bounds(rel.source_multiplicity)
        tgt_low, tgt_up = _parse_multiplicity_bounds(rel.target_multiplicity)

        rel_uuid = id_mapper.register(rel_xmi_id)
        end1_uuid = uuid5(rel_uuid, "end1")
        end2_uuid = uuid5(rel_uuid, "end2")
        end1_id = id_mapper.register_canonical(end1_uuid, prefix="EAID_")
        end2_id = id_mapper.register_canonical(end2_uuid, prefix="EAID_")

        end1 = XMIElement(
            xmi_id=end1_id,
            xmi_type="uml:Property",
            tag_name="ownedEnd",
            name=src_name.lower(),
            type_ref=src_xmi_id,
            aggregation="none",
            lower_value=src_low,
            upper_value=src_up,
            raw_attributes={"association": rel_xmi_id},
        )
        end2 = XMIElement(
            xmi_id=end2_id,
            xmi_type="uml:Property",
            tag_name="ownedEnd",
            name=tgt_name.lower(),
            type_ref=tgt_xmi_id,
            aggregation=agg_val,
            lower_value=tgt_low,
            upper_value=tgt_up,
            raw_attributes={"association": rel_xmi_id},
        )

        root_elements.append(
            XMIElement(
                xmi_id=rel_xmi_id,
                xmi_type="uml:Association",
                tag_name="packagedElement",
                name=rel_name,
                member_end_refs=[end1_id, end2_id],
                children=[end1, end2],
            )
        )

    # 5. Conectores
    for conn in model.connectors:
        conn_xmi_id = id_mapper.register_canonical(conn.id, prefix="EAID_")
        src_p_xmi_id = id_mapper.register_canonical(
            conn.source_port_id, prefix="EAID_"
        )
        tgt_p_xmi_id = id_mapper.register_canonical(
            conn.target_port_id, prefix="EAID_"
        )

        root_elements.append(
            XMIElement(
                xmi_id=conn_xmi_id,
                xmi_type="uml:Connector",
                tag_name="packagedElement",
                name=conn.name,
                source_ref=src_p_xmi_id,
                target_ref=tgt_p_xmi_id,
            )
        )

    # 6. Dependencias
    for dep in model.dependencies:
        dep_xmi_id = id_mapper.register_canonical(dep.id, prefix="EAID_")
        src_elem_xmi_id = id_mapper.register_canonical(
            dep.source_id, prefix="EAID_"
        )
        tgt_elem_xmi_id = id_mapper.register_canonical(
            dep.target_id, prefix="EAID_"
        )

        root_elements.append(
            XMIElement(
                xmi_id=dep_xmi_id,
                xmi_type="uml:Dependency",
                tag_name="packagedElement",
                client_ref=src_elem_xmi_id,
                supplier_ref=tgt_elem_xmi_id,
            )
        )

    raw_name = getattr(model, "name", None)
    clean_model_name = (
        raw_name.strip()
        if raw_name and raw_name.strip() and not raw_name.startswith("Model_")
        else "UMLForge_Model"
    )

    return XMIModelDocument(
        doc_fingerprint="exported",
        model_id=model_xmi_id,
        model_name=clean_model_name,
        root_elements=root_elements,
    )

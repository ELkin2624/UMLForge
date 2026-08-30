"""
Perfil de adaptación XMI 2.5.1 específico para Sparx Systems Enterprise Architect (EA).
Mapea entre el modelo intermedio neutral XMIElement y el CanonicalModel (UMLModel).
"""

from typing import Literal, cast
from uuid import UUID

from canonical_model.class_model import UMLAttribute, UMLClass
from canonical_model.component_model import (
    UMLComponent,
    UMLConnector,
    UMLDependency,
    UMLInterface,
    UMLPort,
)
from canonical_model.model import UMLModel
from canonical_model.operation_model import UMLOperation, UMLParameter
from canonical_model.relationship_model import UMLRelationship
from uml_core.enums import (
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

    # Procesar elementos raíz
    for elem in doc.root_elements:
        elem_id = id_mapper.register(elem.xmi_id)
        elem_name = elem.name or f"Unnamed_{elem.xmi_id}"

        # 1. Clases (uml:Class)
        if match_uml_type(elem.xmi_type, "Class"):
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
                    attr_type = child.type_name or (
                        str(id_mapper.register(child.type_ref))
                        if child.type_ref
                        else "String"
                    )
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

            classes.append(
                UMLClass(
                    id=elem_id,
                    name=elem_name,
                    is_abstract=elem.is_abstract,
                    attributes=attributes,
                    operations=operations,
                )
            )

        # 2. Interfaces (uml:Interface)
        elif match_uml_type(elem.xmi_type, "Interface"):
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

        # 4. Asociaciones (uml:Association)
        elif match_uml_type(elem.xmi_type, "Association"):
            # Encontrar los dos extremos de la asociación
            owned_ends = [
                c
                for c in elem.children
                if match_uml_type(c.xmi_type, "Property") or c.tag_name == "ownedEnd"
            ]

            if len(owned_ends) >= 2:
                end1 = owned_ends[0]
                end2 = owned_ends[1]

                src_ref = end1.type_ref or end1.raw_attributes.get("type")
                tgt_ref = end2.type_ref or end2.raw_attributes.get("type")

                if not src_ref or not tgt_ref:
                    raise XMIReferenceNotFoundError(
                        f"Asociación {elem_name} ({elem.xmi_id}) contiene extremos sin tipo referenciado.",
                        code="XMI_REFERENCE_NOT_FOUND",
                    )

                src_uuid = id_mapper.register(src_ref)
                tgt_uuid = id_mapper.register(tgt_ref)

                rel_type = RelationshipKind.ASSOCIATION

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
                    f"Asociación {elem_name} ({elem.xmi_id}) ignorada por no tener al menos 2 extremos."
                )

        # 5. Conectores (uml:Connector)
        elif match_uml_type(elem.xmi_type, "Connector"):
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

        # Elementos no soportados en el subconjunto práctico (ej. Activity, StateMachine)
        else:
            warnings.append(
                f"Elemento no soportado '{elem.xmi_type}' (id={elem.xmi_id}, name='{elem.name}') ignorado."
            )

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
    """
    if id_mapper is None:
        id_mapper = IDMapper()

    model_xmi_id = id_mapper.register_canonical(model.id, prefix="EAID_Model_")
    root_elements: list[XMIElement] = []

    # 1. Clases
    for cls in model.classes:
        cls_xmi_id = id_mapper.register_canonical(cls.id, prefix="EAID_Class_")
        cls_children: list[XMIElement] = []

        # Atributos
        for attr in cls.attributes:
            attr_xmi_id = id_mapper.register_canonical(attr.id, prefix="EAID_Attr_")
            cls_children.append(
                XMIElement(
                    xmi_id=attr_xmi_id,
                    xmi_type="uml:Property",
                    tag_name="ownedAttribute",
                    name=attr.name,
                    visibility=attr.visibility.value,
                    is_static=attr.is_static,
                    type_name=attr.type,
                    lower_value=(
                        attr.multiplicity.split("..")[0]
                        if ".." in attr.multiplicity
                        else attr.multiplicity
                    ),
                    upper_value=(
                        attr.multiplicity.split("..")[1]
                        if ".." in attr.multiplicity
                        else attr.multiplicity
                    ),
                    default_value=attr.initial_value,
                )
            )

        # Operaciones
        for op in cls.operations:
            op_xmi_id = id_mapper.register_canonical(op.id, prefix="EAID_Op_")
            op_children: list[XMIElement] = []

            for param in op.parameters:
                p_xmi_id = id_mapper.register_canonical(param.id, prefix="EAID_Param_")
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
                ret_xmi_id = f"{op_xmi_id}_ret"
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

        root_elements.append(
            XMIElement(
                xmi_id=cls_xmi_id,
                xmi_type="uml:Class",
                tag_name="packagedElement",
                name=cls.name,
                visibility="public",
                is_abstract=cls.is_abstract,
                children=cls_children,
            )
        )

    # 2. Interfaces
    for iface in model.interfaces:
        if_xmi_id = id_mapper.register_canonical(iface.id, prefix="EAID_If_")
        if_children: list[XMIElement] = []

        for op in iface.operations:
            op_xmi_id = id_mapper.register_canonical(op.id, prefix="EAID_Op_")
            op_children = []

            for param in op.parameters:
                p_xmi_id = id_mapper.register_canonical(param.id, prefix="EAID_Param_")
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
                ret_xmi_id = f"{op_xmi_id}_ret"
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
        comp_xmi_id = id_mapper.register_canonical(comp.id, prefix="EAID_Comp_")
        comp_children: list[XMIElement] = []

        # Buscar puertos pertenecientes a este componente
        comp_uuid = UUID(comp.id) if isinstance(comp.id, str) else comp.id
        for port in model.ports:
            if port.component_id == comp_uuid:
                port_xmi_id = id_mapper.register_canonical(port.id, prefix="EAID_Port_")
                if_xmi_id = id_mapper.register_canonical(
                    port.interface_id, prefix="EAID_If_"
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

    # 4. Relaciones (Asociaciones y Generalizaciones)
    for rel in model.relationships:
        rel_xmi_id = id_mapper.register_canonical(rel.id, prefix="EAID_Rel_")

        if rel.type == RelationshipKind.GENERALIZATION:
            # En UML XMI, generalización se puede colocar como packagedElement o dentro de la subclase
            src_xmi_id = id_mapper.register_canonical(rel.source, prefix="EAID_Class_")
            tgt_xmi_id = id_mapper.register_canonical(rel.target, prefix="EAID_Class_")

            root_elements.append(
                XMIElement(
                    xmi_id=rel_xmi_id,
                    xmi_type="uml:Generalization",
                    tag_name="packagedElement",
                    name=rel.name,
                    client_ref=src_xmi_id,
                    general_ref=tgt_xmi_id,
                )
            )
        else:
            src_xmi_id = id_mapper.register_canonical(rel.source, prefix="EAID_Class_")
            tgt_xmi_id = id_mapper.register_canonical(rel.target, prefix="EAID_Class_")

            agg_val = "none"
            rel_type_str = str(
                rel.type.value if hasattr(rel.type, "value") else rel.type
            ).lower()
            if "composite" in rel_type_str or "composition" in rel_type_str:
                agg_val = "composite"
            elif "shared" in rel_type_str or "aggregation" in rel_type_str:
                agg_val = "shared"

            end1 = XMIElement(
                xmi_id=f"{rel_xmi_id}_end1",
                xmi_type="uml:Property",
                tag_name="ownedEnd",
                type_ref=src_xmi_id,
                aggregation="none",
                lower_value=(
                    rel.source_multiplicity.split("..")[0]
                    if ".." in rel.source_multiplicity
                    else rel.source_multiplicity
                ),
                upper_value=(
                    rel.source_multiplicity.split("..")[1]
                    if ".." in rel.source_multiplicity
                    else rel.source_multiplicity
                ),
            )
            end2 = XMIElement(
                xmi_id=f"{rel_xmi_id}_end2",
                xmi_type="uml:Property",
                tag_name="ownedEnd",
                type_ref=tgt_xmi_id,
                aggregation=agg_val,
                lower_value=(
                    rel.target_multiplicity.split("..")[0]
                    if ".." in rel.target_multiplicity
                    else rel.target_multiplicity
                ),
                upper_value=(
                    rel.target_multiplicity.split("..")[1]
                    if ".." in rel.target_multiplicity
                    else rel.target_multiplicity
                ),
            )

            root_elements.append(
                XMIElement(
                    xmi_id=rel_xmi_id,
                    xmi_type="uml:Association",
                    tag_name="packagedElement",
                    name=rel.name,
                    children=[end1, end2],
                )
            )

    # 5. Conectores
    for conn in model.connectors:
        conn_xmi_id = id_mapper.register_canonical(conn.id, prefix="EAID_Conn_")
        src_p_xmi_id = id_mapper.register_canonical(
            conn.source_port_id, prefix="EAID_Port_"
        )
        tgt_p_xmi_id = id_mapper.register_canonical(
            conn.target_port_id, prefix="EAID_Port_"
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
        dep_xmi_id = id_mapper.register_canonical(dep.id, prefix="EAID_Dep_")
        src_elem_xmi_id = id_mapper.register_canonical(
            dep.source_id, prefix="EAID_Elem_"
        )
        tgt_elem_xmi_id = id_mapper.register_canonical(
            dep.target_id, prefix="EAID_Elem_"
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

    return XMIModelDocument(
        doc_fingerprint="exported",
        model_id=model_xmi_id,
        model_name=getattr(model, "name", None) or f"Model_{model.id}",
        root_elements=root_elements,
    )

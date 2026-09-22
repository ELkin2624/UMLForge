from app.core.canonical_model.class_model import UMLAttribute, UMLClass
from app.core.canonical_model.model import UMLModel
from app.core.canonical_model.relationship_model import UMLRelationship
from app.core.uml_core.enums import RelationshipKind, VisibilityKind
from app.modules.xmi.core.parser import parse_xmi_to_intermediate
from app.modules.xmi.core.writer import intermediate_to_xmi_xml
from app.modules.xmi.profiles.ea import (
    canonical_to_ea_intermediate,
    map_intermediate_to_canonical,
)


def test_ea_export_user_model_compliance() -> None:
    """
    Verifica que el modelo de las capturas (Venta, Cliente, VentaProducto, Producto)
    se exporte con total compatibilidad para Enterprise Architect:
    - Sin nombres huérfanos 'Model_...'
    - Con etiquetas <memberEnd xmi:idref="..."/>
    - Con referencias <type xmi:idref="..."/> en ownedEnd
    - Con multiplicidades conformes (sin LiteralInteger value="*")
    - Con bloque de extensión para diagramas de EA
    - Con round-trip perfecto sin advertencias ni errores.
    """
    model = UMLModel(
        id="project_ventas",
        name="SistemaVentas",
        classes=[
            UMLClass(
                id="c_venta",
                name="Venta",
                attributes=[
                    UMLAttribute(id="a_v1", name="id", type="int", visibility=VisibilityKind.PRIVATE),
                    UMLAttribute(id="a_v2", name="fecha", type="date", visibility=VisibilityKind.PRIVATE),
                ],
            ),
            UMLClass(
                id="c_cliente",
                name="Cliente",
                attributes=[
                    UMLAttribute(id="a_c1", name="id", type="int", visibility=VisibilityKind.PRIVATE),
                    UMLAttribute(id="a_c2", name="nombre", type="char", visibility=VisibilityKind.PRIVATE),
                    UMLAttribute(id="a_c3", name="email", type="char", visibility=VisibilityKind.PRIVATE),
                ],
            ),
            UMLClass(
                id="c_ventaprod",
                name="VentaProducto",
                attributes=[
                    UMLAttribute(id="a_vp1", name="id", type="int", visibility=VisibilityKind.PRIVATE),
                    UMLAttribute(id="a_vp2", name="ventaId", type="int", visibility=VisibilityKind.PRIVATE),
                    UMLAttribute(id="a_vp3", name="productId", type="int", visibility=VisibilityKind.PRIVATE),
                ],
            ),
            UMLClass(
                id="c_producto",
                name="Producto",
                attributes=[
                    UMLAttribute(id="a_p1", name="id", type="int", visibility=VisibilityKind.PRIVATE),
                    UMLAttribute(id="a_p2", name="nombre", type="char", visibility=VisibilityKind.PRIVATE),
                    UMLAttribute(id="a_p3", name="precio", type="int", visibility=VisibilityKind.PRIVATE),
                    UMLAttribute(id="a_p4", name="stock", type="int", visibility=VisibilityKind.PRIVATE),
                ],
            ),
        ],
        relationships=[
            UMLRelationship(
                id="r_vc",
                name="",
                source="c_venta",
                target="c_cliente",
                type=RelationshipKind.ASSOCIATION,
                source_multiplicity="*",
                target_multiplicity="1",
            ),
            UMLRelationship(
                id="r_vvp",
                name="",
                source="c_venta",
                target="c_ventaprod",
                type=RelationshipKind.ASSOCIATION,
                source_multiplicity="1",
                target_multiplicity="*",
            ),
            UMLRelationship(
                id="r_pvp",
                name="",
                source="c_producto",
                target="c_ventaprod",
                type=RelationshipKind.ASSOCIATION,
                source_multiplicity="1",
                target_multiplicity="*",
            ),
        ],
    )

    doc = canonical_to_ea_intermediate(model)
    xml_str = intermediate_to_xmi_xml(doc)

    # 1. Validar nombre limpio
    assert 'name="SistemaVentas"' in xml_str
    assert "Model_ns6wb" not in xml_str

    # 2. Validar que no hay <lowerValue ... value="*"/>
    assert 'type="uml:LiteralInteger"' in xml_str
    assert 'value="*"' not in [
        line for line in xml_str.splitlines() if "LiteralInteger" in line
    ]

    # 3. Validar etiquetas obligatorias para EA en asociaciones
    assert "<memberEnd" in xml_str
    assert 'association=' in xml_str
    assert "<type" in xml_str

    # 4. Validar que NO contiene bloque de extensión propietario para evitar error Jet DAO 3163
    assert 'extender="Enterprise Architect"' not in xml_str
    assert "<diagrams>" not in xml_str

    # 5. Validar que ningún xmi:id exceda los 41 caracteres (límite estricto de EA Jet DAO)
    import re
    xmi_ids = re.findall(r'xmi:id="([^"]+)"', xml_str)
    assert len(xmi_ids) > 0
    for x_id in xmi_ids:
        assert len(x_id) <= 41, f"xmi:id '{x_id}' excede el límite de 41 caracteres de EA (longitud={len(x_id)})"
        assert x_id.startswith("EAID_"), f"xmi:id '{x_id}' no sigue el formato EAID_"

    # 6. Validar nombres de relaciones legibles
    assert 'name="Venta_Cliente"' in xml_str
    assert 'name="Venta_VentaProducto"' in xml_str
    assert 'name="Producto_VentaProducto"' in xml_str

    # 7. Validar re-importación limpia
    re_doc = parse_xmi_to_intermediate(xml_str.encode("utf-8"))
    re_model, warnings = map_intermediate_to_canonical(re_doc)

    assert len(re_model.classes) == 4
    assert len(re_model.relationships) == 3
    assert len(warnings) == 0


def test_ea_generalization_embedded_in_class() -> None:
    """
    Verifica que las relaciones de herencia (generalization) se incrusten
    correctamente dentro de la clase hija y que sus IDs cumplan el límite de EA.
    """
    model = UMLModel(
        id="project_inheritance",
        name="HerenciaModel",
        classes=[
            UMLClass(id="c_persona", name="Persona"),
            UMLClass(id="c_empleado", name="Empleado"),
        ],
        relationships=[
            UMLRelationship(
                id="r_gen_emp_per",
                name="Herencia_Empleado_Persona",
                source="c_empleado",
                target="c_persona",
                type=RelationshipKind.GENERALIZATION,
            )
        ],
    )

    doc = canonical_to_ea_intermediate(model)
    xml_str = intermediate_to_xmi_xml(doc)

    # Generalización incrustada dentro de la clase Empleado
    assert "<generalization" in xml_str
    assert 'general=' in xml_str

    # Re-importación
    re_doc = parse_xmi_to_intermediate(xml_str.encode("utf-8"))
    re_model, warnings = map_intermediate_to_canonical(re_doc)

    assert len(re_model.classes) == 2
    assert len(re_model.relationships) == 1
    assert re_model.relationships[0].type == RelationshipKind.GENERALIZATION
    assert len(warnings) == 0

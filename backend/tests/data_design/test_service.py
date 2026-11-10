"""Modelo lógico + normalización sobre diagramas de clases reales."""

import pytest

from app.modules.data_design.schemas import DependencyDecision
from app.modules.data_design.service import InvalidModelForDesign, analyze


def attr(i, name, type_="String", pk=False, mult="1"):
    return {"id": i, "name": name, "type": type_, "is_primary_key": pk, "multiplicity": mult}


def cls(i, name, attrs):
    return {"id": i, "name": name, "attributes": attrs, "operations": []}


def rel(i, src, tgt, sm, tm, type_="association"):
    return {"id": i, "source": src, "target": tgt, "type": type_,
            "source_multiplicity": sm, "target_multiplicity": tm}


def model(classes, rels=()):
    return {"id": "m", "name": "M", "classes": classes, "relationships": list(rels)}


CLIENTE = cls("c1", "Cliente", [attr("a", "id", "Long", True), attr("b", "nombre")])
PRODUCTO = cls("c3", "Producto", [attr("g", "id", "Long", True), attr("h", "nombre")])


def venta(extra=()):
    return cls("c2", "Venta", [attr("d", "id", "Long", True), attr("e", "total", "double"), *extra])


def by_table(result):
    return {t.table: t for t in result.normalization}


def test_modelo_logico_clase_a_tabla_con_fk():
    r = analyze(model([CLIENTE, venta()], [rel("r", "c2", "c1", "*", "1")]), [])
    tables = {t.name: t for t in r.logical.tables}
    assert set(tables) == {"clientes", "ventas"}
    ventas = tables["ventas"]
    assert ventas.primary_key == ["id"]
    assert [f.ref_table for f in ventas.foreign_keys] == ["clientes"]
    col = next(c for c in ventas.columns if c.name == "cliente_id")
    assert col.is_fk and col.references == "clientes.id"
    assert any(e.from_table == "ventas" and e.to_table == "clientes" and e.cardinality == "N:1"
               for e in r.logical.edges)
    assert any(m.kind == "class" and m.element == "Cliente" for m in r.logical.mappings)


def test_muchos_a_muchos_genera_tabla_intermedia():
    r = analyze(model([venta(), PRODUCTO], [rel("r", "c2", "c3", "*", "*")]), [])
    join = next(t for t in r.logical.tables if t.kind == "join")
    assert sorted(join.primary_key) == sorted(c.name for c in join.columns)
    assert len(join.primary_key) == 2 and len(join.foreign_keys) == 2
    assert any("N:M" in m.element for m in r.logical.mappings)
    # una clave compuesta sin atributos adicionales está en FNBC
    assert by_table(r)[join.name].normal_form == "FNBC"


def test_herencia_pk_es_fk():
    hijo = cls("c4", "Empleado", [attr("x", "sueldo", "double")])
    padre = cls("c5", "Persona", [attr("y", "id", "Long", True), attr("z", "nombre")])
    r = analyze(model([padre, hijo], [rel("r", "c4", "c5", "1", "1", "generalization")]), [])
    emp = next(t for t in r.logical.tables if t.class_name == "Empleado")
    assert any("Herencia" in n for n in emp.notes)
    assert any(m.kind == "inheritance" for m in r.logical.mappings)


def test_sin_sugerencias_aceptadas_se_mantiene_fnbc_pero_se_avisa():
    m = model([CLIENTE, venta([attr("n", "clienteNombre")])], [rel("r", "c2", "c1", "*", "1")])
    t = by_table(analyze(m, []))["ventas"]
    assert t.normal_form == "FNBC"
    assert t.normal_form_if_suggestions_accepted == "2FN"
    assert t.pending_suggestions == 1
    sug = next(d for d in t.dependencies if d.source == "inferred")
    assert sug.lhs == ["cliente_id"] and sug.rhs == ["clienteNombre"] and sug.status == "suggested"


def test_aceptar_sugerencia_detecta_3fn_violada_y_descompone():
    m = model([CLIENTE, venta([attr("n", "clienteNombre")])], [rel("r", "c2", "c1", "*", "1")])
    dec = [DependencyDecision(table="ventas", lhs=["cliente_id"], rhs=["clienteNombre"], status="accepted")]
    r = analyze(m, dec)
    t = by_table(r)["ventas"]
    assert t.normal_form == "2FN"
    check3 = next(c for c in t.checks if c.form == "3FN")
    assert not check3.ok and "clienteNombre" in check3.evidence[0]
    assert t.decomposition is not None
    rels = {x.name: x for x in t.decomposition.relations}
    assert "ventas" in rels and "clienteNombre" not in rels["ventas"].attributes
    assert any("clienteNombre" in x.attributes for x in t.decomposition.relations if x.name != "ventas")
    assert t.decomposition.lossless and t.decomposition.preserves_dependencies
    assert r.summary.all_in_3nf is False and r.summary.by_form["2FN"] == 1


def test_rechazar_sugerencia():
    m = model([CLIENTE, venta([attr("n", "clienteNombre")])], [rel("r", "c2", "c1", "*", "1")])
    dec = [DependencyDecision(table="ventas", lhs=["cliente_id"], rhs=["clienteNombre"], status="rejected")]
    t = by_table(analyze(m, dec))["ventas"]
    assert t.pending_suggestions == 0 and t.normal_form == "FNBC"
    assert next(d for d in t.dependencies if d.source == "inferred").status == "rejected"


def test_dependencia_personalizada():
    m = model([cls("c1", "Direccion", [
        attr("a", "id", "Long", True), attr("b", "ciudad"), attr("c", "pais"),
    ])])
    dec = [DependencyDecision(table="direccions", lhs=["ciudad"], rhs=["pais"], status="custom")]
    t = by_table(analyze(m, dec))["direccions"]
    assert t.normal_form == "2FN"


def test_dependencia_personalizada_con_columna_inexistente_se_ignora():
    m = model([CLIENTE])
    dec = [DependencyDecision(table="clientes", lhs=["zzz"], rhs=["nombre"], status="custom")]
    t = by_table(analyze(m, dec))["clientes"]
    assert any("zzz" in w for w in t.warnings)
    assert not any(d.source == "custom" for d in t.dependencies)


def test_clave_natural_permite_detectar_dependencia_parcial():
    # Detalle(venta_id, producto_id, cantidad, productoNombre) con id surrogado.
    detalle = cls("c6", "Detalle", [
        attr("a", "id", "Long", True), attr("b", "cantidad", "int"), attr("c", "productoNombre"),
    ])
    m = model([venta(), PRODUCTO, detalle], [
        rel("r1", "c6", "c2", "*", "1"), rel("r2", "c6", "c3", "*", "1"),
    ])
    dec = [
        DependencyDecision(table="detalles", lhs=["producto_id", "venta_id"], rhs=["id"], status="accepted"),
        DependencyDecision(table="detalles", lhs=["producto_id"], rhs=["productoNombre"], status="accepted"),
    ]
    t = by_table(analyze(m, dec))["detalles"]
    check2 = next(c for c in t.checks if c.form == "2FN")
    assert not check2.ok and "productoNombre" in check2.evidence[0]
    assert t.normal_form == "1FN"
    assert t.decomposition is not None


def test_atributo_multivaluado_viola_1fn():
    m = model([cls("c1", "Persona", [
        attr("a", "id", "Long", True), attr("b", "telefonos", "List<String>"),
    ])])
    t = by_table(analyze(m, []))["personas"]
    assert t.normal_form == "Sin 1FN"
    assert not next(c for c in t.checks if c.form == "1FN").ok


def test_advertencia_por_nombre_no_viola_1fn():
    m = model([cls("c1", "Persona", [
        attr("a", "id", "Long", True), attr("b", "telefonos", "String"),
    ])])
    t = by_table(analyze(m, []))["personas"]
    assert t.normal_form == "FNBC" and any("telefonos" in w for w in t.warnings)


def test_modelo_invalido():
    with pytest.raises(InvalidModelForDesign):
        analyze({"classes": "no"}, [])


def test_modelo_vacio():
    r = analyze({"id": "m", "name": "M"}, [])
    assert r.logical.tables == [] and r.summary.tables == 0 and r.summary.all_in_3nf


def test_dependencia_personalizada_que_coincide_con_sugerencia_queda_confirmada():
    m = model([cls("c1", "Direccion", [
        attr("a", "id", "Long", True), attr("b", "ciudad"), attr("c", "pais"),
    ])])
    dec = [DependencyDecision(table="direccions", lhs=["ciudad"], rhs=["pais"], status="custom")]
    t = by_table(analyze(m, dec))["direccions"]
    dep = next(d for d in t.dependencies if d.rhs == ["pais"])
    assert dep.status == "confirmed" and t.pending_suggestions == 0 and t.normal_form == "2FN"


def test_dependencia_personalizada_nueva():
    m = model([cls("c1", "Auto", [
        attr("a", "id", "Long", True), attr("b", "placa"), attr("c", "chasis"),
    ])])
    dec = [DependencyDecision(table="autos", lhs=["placa"], rhs=["chasis"], status="custom")]
    t = by_table(analyze(m, dec))["autos"]
    dep = next(d for d in t.dependencies if d.source == "custom")
    assert dep.status == "confirmed"

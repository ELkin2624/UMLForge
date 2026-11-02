from app.modules.diagram_store import diff_models, summarize


def _cls(cid, name, attrs=None, ops=None):
    return {"id": cid, "name": name, "attributes": attrs or [], "operations": ops or []}


def test_sin_cambios():
    m = {"classes": [_cls("c1", "A", [{"id": "a1", "name": "x", "type": "String"}])]}
    assert diff_models(m, m) == []
    assert summarize([]) == "Sin cambios"


def test_agregar_y_eliminar_clase():
    old = {"classes": [_cls("c1", "A")]}
    new = {"classes": [_cls("c2", "B")]}
    ch = diff_models(old, new)
    assert {(c["op"], c["name"]) for c in ch} == {("added", "B"), ("removed", "A")}


def test_modificar_atributo_anidado():
    old = {"classes": [_cls("c1", "Venta", [{"id": "a1", "name": "total", "type": "int"}])]}
    new = {"classes": [_cls("c1", "Venta", [{"id": "a1", "name": "total", "type": "double"}])]}
    ch = diff_models(old, new)
    assert len(ch) == 1
    assert ch[0]["op"] == "modified" and ch[0]["kind"] == "atributo"
    assert ch[0]["parent"] == "Venta" and "int" in ch[0]["detail"]
    assert summarize(ch) == "Modificó atributo Venta.total"


def test_agregar_atributo_a_clase_existente():
    old = {"classes": [_cls("c1", "A")]}
    new = {"classes": [_cls("c1", "A", [{"id": "a1", "name": "x", "type": "String"}])]}
    ch = diff_models(old, new)
    assert [(c["op"], c["kind"], c["parent"]) for c in ch] == [("added", "atributo", "A")]


def test_relaciones_y_renombrar():
    old = {"classes": [_cls("c1", "A")], "relationships": []}
    new = {
        "classes": [_cls("c1", "A2")],
        "relationships": [{"id": "r1", "name": "usa", "source": "c1", "target": "c1"}],
    }
    kinds = {(c["op"], c["kind"]) for c in diff_models(old, new)}
    assert kinds == {("modified", "clase"), ("added", "relación")}


def test_resumen_trunca():
    ch = [{"op": "added", "kind": "clase", "name": f"C{i}", "parent": None} for i in range(6)]
    assert summarize(ch).endswith("y 2 cambios más")

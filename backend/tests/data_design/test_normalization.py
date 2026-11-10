from app.modules.data_design.normalization import (
    candidate_keys,
    check_2nf,
    check_3nf,
    check_bcnf,
    closure,
    minimal_cover,
    normal_form,
    synthesize_3nf,
)


def fd(lhs, rhs):
    return (frozenset(lhs.split()), frozenset(rhs.split()))


def checks(attrs, fds):
    keys, _ = candidate_keys(attrs, fds)
    return keys, [check_2nf(attrs, fds, keys), check_3nf(attrs, fds, keys), check_bcnf(attrs, fds)]


def test_closure():
    fds = [fd("A", "B"), fd("B", "C")]
    assert closure(frozenset("A"), fds) == frozenset("ABC")
    assert closure(frozenset("C"), fds) == frozenset("C")


def test_clave_candidata_unica_y_multiples():
    attrs = frozenset("ABC")
    assert candidate_keys(attrs, [fd("A", "B C")])[0] == [frozenset("A")]
    keys, exact = candidate_keys(attrs, [fd("A", "B C"), fd("B", "A")])
    assert exact and sorted(map(sorted, keys)) == [["A"], ["B"]]


def test_clave_compuesta():
    attrs = frozenset("ABCD")
    keys, _ = candidate_keys(attrs, [fd("A B", "C D")])
    assert keys == [frozenset("AB")]


def test_2fn_violada_por_dependencia_parcial():
    # Ejemplo clásico: (venta, producto) -> cantidad ; producto -> nombre
    attrs = frozenset({"venta", "producto", "cantidad", "nombre"})
    fds = [fd("venta producto", "cantidad nombre"), fd("producto", "nombre")]
    keys, cs = checks(attrs, fds)
    assert keys == [frozenset({"venta", "producto"})]
    assert not cs[0].ok and "nombre" in cs[0].evidence[0]
    assert normal_form([check_2nf(attrs, fds, keys)]) == "1FN"


def test_3fn_violada_por_dependencia_transitiva():
    # id -> cliente_id ; cliente_id -> cliente_nombre
    attrs = frozenset({"id", "cliente_id", "cliente_nombre", "total"})
    fds = [fd("id", "cliente_id cliente_nombre total"), fd("cliente_id", "cliente_nombre")]
    keys, cs = checks(attrs, fds)
    assert cs[0].ok            # 2FN: clave simple
    assert not cs[1].ok        # 3FN falla
    assert "cliente_nombre" in cs[1].evidence[0]
    assert normal_form(cs + [check_2nf(attrs, fds, keys)]) == "2FN"


def test_3fn_pero_no_fnbc():
    # R(A,B,C): AB -> C ; C -> B  (claves: AB y AC). Está en 3FN, no en FNBC.
    attrs = frozenset("ABC")
    fds = [fd("A B", "C"), fd("C", "B")]
    keys, cs = checks(attrs, fds)
    assert sorted(map(sorted, keys)) == [["A", "B"], ["A", "C"]]
    assert cs[1].ok and not cs[2].ok
    assert normal_form([check_2nf(attrs, fds, keys), cs[1], cs[2]]) == "3FN"


def test_fnbc():
    attrs = frozenset({"id", "nombre", "precio"})
    fds = [fd("id", "nombre precio")]
    keys, cs = checks(attrs, fds)
    assert all(c.ok for c in cs) and normal_form(cs) == "FNBC"


def test_cobertura_minima():
    # A->BC, B->C, A->B, AB->C  =>  A->B, B->C
    fds = [fd("A", "B C"), fd("B", "C"), fd("A", "B"), fd("A B", "C")]
    cover, steps = minimal_cover(fds)
    assert sorted(map(lambda f: (sorted(f[0]), sorted(f[1])), cover)) == [(["A"], ["B"]), (["B"], ["C"])]
    assert any("redundante" in s or "extraño" in s for s in steps)


def test_sintesis_3fn_transitiva():
    attrs = frozenset({"id", "cliente_id", "cliente_nombre", "total"})
    fds = [fd("id", "cliente_id cliente_nombre total"), fd("cliente_id", "cliente_nombre")]
    keys, _ = candidate_keys(attrs, fds)
    d = synthesize_3nf("ventas", attrs, fds, keys, ["id"])
    rels = {r.name: r for r in d.relations}
    assert set(rels) == {"ventas", "cliente"}
    assert rels["ventas"].attributes == ["cliente_id", "id", "total"]
    assert rels["cliente"].attributes == ["cliente_id", "cliente_nombre"]
    assert rels["cliente"].primary_key == ["cliente_id"]
    assert d.lossless and d.preserves_dependencies


def test_sintesis_agrega_relacion_de_clave():
    # R(A,B,C,D): A->B ; C->D. Clave = AC; ninguna relación la contiene.
    attrs = frozenset("ABCD")
    fds = [fd("A", "B"), fd("C", "D")]
    keys, _ = candidate_keys(attrs, fds)
    d = synthesize_3nf("r", attrs, fds, keys, [])
    assert sorted(sorted(r.attributes) for r in d.relations) == [["A", "B"], ["A", "C"], ["C", "D"]]
    assert any("sin pérdida" in s for s in d.steps)


def test_sin_dependencias_no_triviales():
    attrs = frozenset({"id", "x"})
    keys, cs = checks(attrs, [fd("id", "x")])
    assert all(c.ok for c in cs)

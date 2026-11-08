"""Resumen compacto del diagrama para el agente: contenido, selección y presupuesto."""

from app.modules.ai_agent.context_builder import build_context, estimate_tokens
from app.modules.ai_agent.context_service import ContextService
from app.modules.diagram_store import InMemoryDiagramRepository, user_author


def cls(cid, name, attrs=(), ops=(), **extra):
    return {
        "id": cid,
        "name": name,
        "attributes": [{"id": f"{cid}-{a}", "name": a, "type": t} for a, t in attrs],
        "operations": [{"id": f"{cid}-{o}", "name": o} for o in ops],
        **extra,
    }


def rel(rid, src, dst, kind="association", sm="1", tm="*"):
    return {"id": rid, "source_id": src, "target_id": dst, "type": kind,
            "source_multiplicity": sm, "target_multiplicity": tm}


MODEL = {
    "classes": [
        cls("u", "Usuario", [("id", "Long"), ("nombre", "String")], ["login"]),
        cls("p", "Pedido", [("total", "Double")]),
        cls("f", "Factura", [("numero", "String")], is_abstract=True),
    ],
    "relationships": [rel("r1", "u", "p", tm="0..*"), rel("r2", "p", "f", "composition")],
}


def test_resume_clases_atributos_operaciones_y_relaciones_por_nombre():
    ctx = build_context(MODEL, version=7)
    assert "versión 7" in ctx.text and "3 clases, 2 relaciones" in ctx.text
    assert "- Usuario [id:Long, nombre:String] ops: login()" in ctx.text
    assert "Factura (abstracta)" in ctx.text
    # las relaciones usan nombres, no ids (la IA propone parches por nombre)
    assert "Usuario [1] —association→ [0..*] Pedido" in ctx.text
    assert "r1" not in ctx.text and "'u'" not in ctx.text
    assert not ctx.truncated and ctx.warnings == []


def test_la_seleccion_va_primero_con_detalle_y_marca_las_vecinas():
    ctx = build_context(MODEL, selection=["p"])
    text = ctx.text
    assert "SELECCIÓN DEL USUARIO" in text
    assert "* Pedido [total:Double]" in text
    assert "Vecinas directas: Usuario, Factura" in text or "Vecinas directas: Factura, Usuario" in text
    assert text.index("SELECCIÓN DEL USUARIO") < text.index("CLASES:")
    # la seleccionada no se repite en la lista general
    assert text.count("Pedido [total:Double]") == 1


def test_la_seleccion_acepta_nombres_ids_y_relaciones():
    by_name = build_context(MODEL, selection=["usuario"])
    assert "* Usuario" in by_name.text
    by_rel = build_context(MODEL, selection=["r2"])
    assert "* Pedido" in by_rel.text and "* Factura" in by_rel.text
    assert "composition" in by_rel.text.split("RELACIONES")[0]  # la relación seleccionada va en su sección


def test_seleccion_inexistente_se_avisa_sin_fallar():
    ctx = build_context(MODEL, selection=["fantasma"])
    assert any("fantasma" in w for w in ctx.warnings)
    assert "SELECCIÓN DEL USUARIO" not in ctx.text


def test_tolera_diagramas_a_medio_construir():
    broken = {
        "classes": [{"id": "a"}, {"name": "Sin id"}, "basura", cls("b", "B")],
        "relationships": [{"id": "x"}, {"source_id": "nada", "target_id": "b"}, 5],
    }
    ctx = build_context(broken)
    assert "B []" in ctx.text
    assert build_context({}).classes == 0
    assert build_context(None).text.startswith("DIAGRAMA")  # type: ignore[arg-type]


def big_model(n):
    classes = [cls(f"c{i}", f"Clase{i}", [(f"campo{j}", "String") for j in range(8)]) for i in range(n)]
    rels = [rel(f"r{i}", f"c{i}", f"c{(i + 1) % n}") for i in range(n)]
    return {"classes": classes, "relationships": rels}


def test_respeta_el_presupuesto_y_avisa_de_lo_recortado():
    ctx = build_context(big_model(120), budget_tokens=800)
    assert ctx.approx_tokens <= 800 + 120  # margen: las notas de recorte siempre caben
    assert ctx.truncated is True
    assert any("solo por nombre" in w for w in ctx.warnings)
    assert any("relación" in w for w in ctx.warnings)
    assert "Otras" in ctx.text and "omitidas por tamaño" in ctx.text


def test_con_presupuesto_amplio_no_recorta():
    ctx = build_context(big_model(10), budget_tokens=20000)
    assert ctx.truncated is False
    assert all(f"Clase{i} [" in ctx.text for i in range(10))


def test_al_recortar_se_conservan_la_seleccion_y_sus_vecinas_con_detalle():
    ctx = build_context(big_model(120), selection=["c60"], budget_tokens=800)
    assert "* Clase60 [campo0:String" in ctx.text
    # sus vecinas directas (c59 y c61) tienen prioridad para el detalle
    assert "- Clase61 [campo0:String" in ctx.text and "- Clase59 [campo0:String" in ctx.text
    # y las lejanas se resumen
    assert "- Clase5 [campo0:String" not in ctx.text


def test_limita_atributos_por_clase_y_recorta_nombres_largos():
    huge = {"classes": [cls("a", "N" * 500, [(f"a{i}", "int") for i in range(100)])], "relationships": []}
    ctx = build_context(huge, budget_tokens=20000)
    assert "…(+60 atributos)" in ctx.text
    assert "N" * 500 not in ctx.text


def test_incluye_validacion_y_formas_normales_si_se_proveen():
    ctx = build_context(
        MODEL,
        validation_errors=["La clase X no tiene atributos"],
        validation_warnings=[f"aviso {i}" for i in range(12)],
        normal_forms=[("usuarios", "3FN"), ("pedidos", "2FN")],
    )
    assert "- error: La clase X no tiene atributos" in ctx.text
    assert "…y 4 advertencia(s) más" in ctx.text
    assert "usuarios=3FN, pedidos=2FN" in ctx.text


def test_estimacion_de_tokens():
    assert estimate_tokens("") == 0 and estimate_tokens("abcd") == 1 and estimate_tokens("abcde") == 2


# --- ContextService (con el almacén en memoria) ------------------------------


def seeded_repo():
    repo = InMemoryDiagramRepository()
    repo.create(1, MODEL, user_author(1, "Ana"))
    return repo


def test_servicio_usa_el_almacen_y_no_la_copia_del_cliente():
    ctx, data = ContextService(seeded_repo()).build(1, ["u"], {"classes": [cls("z", "Inventada")]})
    assert ctx.source == "server" and ctx.version == 1
    assert "Inventada" not in ctx.text and "Usuario" in ctx.text
    assert [c["name"] for c in data["classes"]] == ["Usuario", "Pedido", "Factura"]


def test_servicio_usa_la_copia_del_cliente_solo_como_respaldo():
    ctx, _ = ContextService(InMemoryDiagramRepository()).build(5, [], {"classes": [cls("z", "Local")]})
    assert ctx.source == "client" and "Local" in ctx.text
    assert any("copia del cliente" in w for w in ctx.warnings)


def test_servicio_se_recupera_si_el_almacen_falla():
    class Broken(InMemoryDiagramRepository):
        def has_document(self, diagram_id):
            raise ConnectionError("mongo caído")

    ctx, _ = ContextService(Broken()).build(1, [], {"classes": [cls("z", "Local")]})
    assert ctx.source == "client" and "Local" in ctx.text
    assert any("No se pudo leer" in w for w in ctx.warnings)

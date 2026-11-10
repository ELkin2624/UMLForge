"""Acceso, aislamiento y límites de los endpoints de IA (/api/v1/ai/*).

Usa un repositorio en memoria y un LLM falso: no necesita Mongo ni Gemini.
"""

from datetime import datetime, timezone

import pytest

from app.core.database.models import DiagramPermission
from app.main import app
from app.modules.ai_agent import router as ai_router
from app.modules.ai_agent.access import RateLimiter, collaborate_limiter
from app.modules.ai_agent.schemas import AgentResult, AgentStructuredOutput, CanvasPatchOperation
from tests.api.test_diagrams_versions import _h, _model, _user, client, db_session, world  # noqa: F401


class FakeRepo:
    def __init__(self):
        self.chats, self.audit, self.decisions = [], [], {}

    async def get_private_history(self, diagram_id, user_id, limit=25):
        rows = [
            c for c in self.chats
            if c["diagram_id"] == str(diagram_id) and c["user_id"] == str(user_id)
        ]
        return rows[-limit:]

    async def get_team_history(self, diagram_id, user_id, limit=20):
        rows = [
            c for c in self.chats
            if c["diagram_id"] == str(diagram_id) and c["user_id"] != str(user_id)
        ]
        return [
            {"user_id": c["user_id"], "role": c["role"], "content": c["content"][:500]}
            for c in rows[-limit:]
        ]

    async def append_private_message(
        self, diagram_id, user_id, role, content, patches=None, image_base64=None
    ):
        self.chats.append({
            "diagram_id": str(diagram_id), "user_id": str(user_id), "role": role,
            "content": content, "patches": patches or [],
        })

    async def clear_private_history(self, diagram_id, user_id):
        before = len(self.chats)
        self.chats = [
            c for c in self.chats
            if not (c["diagram_id"] == str(diagram_id) and c["user_id"] == str(user_id))
        ]
        return before - len(self.chats)

    async def get_shared_context(self, diagram_id):
        return {
            "diagram_id": str(diagram_id),
            "architectural_decisions": self.decisions.get(str(diagram_id), []),
        }

    async def append_shared_decision(self, diagram_id, user_name, decision):
        self.decisions.setdefault(str(diagram_id), []).append(
            {"author": user_name, "decision": decision}
        )

    async def get_recent_audit_logs(self, diagram_id, limit=30):
        return [a for a in self.audit if a["diagram_id"] == str(diagram_id)][-limit:]

    async def log_audit_event(self, diagram_id, actor, action_summary):
        self.audit.append({
            "diagram_id": str(diagram_id), "actor": actor, "action_summary": action_summary,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })


class FakeLLM:
    async def invoke_architect_agent(self, user_name, **kwargs):
        self.last_kwargs = kwargs
        return AgentStructuredOutput(
            reply_to_user=f"Hola {user_name}",
            shared_decision_note=f"{user_name} pidió MetodoPago",
            canvas_patches=[
                CanvasPatchOperation(op="ADD_CLASS", target_name="MetodoPago", reason="Strategy")
            ],
            execution_mode="DIRECT",
        )


@pytest.fixture(autouse=True)
def ai_fakes():
    repo = FakeRepo()
    repo.llm = FakeLLM()
    app.dependency_overrides[ai_router.get_nosql_repo] = lambda: repo
    app.dependency_overrides[ai_router.get_llm_client] = lambda: repo.llm
    collaborate_limiter._hits.clear()
    yield repo
    app.dependency_overrides.pop(ai_router.get_nosql_repo, None)
    app.dependency_overrides.pop(ai_router.get_llm_client, None)


def ask(client, w, who, prompt="Crea MetodoPago", **extra):
    return client.post(
        "/api/v1/ai/collaborate",
        json={"diagram_id": w["id"], "prompt": prompt, **extra},
        headers=w[who],
    )


def history(client, w, who, query=""):
    return client.get(f"/api/v1/ai/history/{w['id']}{query}", headers=w[who])


def test_sin_token_todo_da_401(client, world):
    d = world["id"]
    res = client.post("/api/v1/ai/collaborate", json={"diagram_id": d, "prompt": "x"})
    assert res.status_code == 401
    for path in ("history", "shared-memory", "audit-feed"):
        assert client.get(f"/api/v1/ai/{path}/{d}").status_code == 401
    assert client.delete(f"/api/v1/ai/history/{d}").status_code == 401
    res = client.post(f"/api/v1/ai/audit-feed/{d}", json={"action_summary": "x"})
    assert res.status_code == 401


def test_usuario_ajeno_al_diagrama_recibe_403(client, world, db_session):
    w = {**world, "outsider": _h(_user(db_session, "mallory"))}
    assert ask(client, w, "outsider").status_code == 403
    d = world["id"]
    for path in ("history", "shared-memory", "audit-feed"):
        res = client.get(f"/api/v1/ai/{path}/{d}", headers=w["outsider"])
        assert res.status_code == 403
    assert client.delete(f"/api/v1/ai/history/{d}", headers=w["outsider"]).status_code == 403


def test_diagrama_inexistente_da_404(client, world):
    res = client.post(
        "/api/v1/ai/collaborate",
        json={"diagram_id": 999999, "prompt": "x"},
        headers=world["owner"],
    )
    assert res.status_code == 404


def test_reader_puede_conversar_pero_no_aplicar_parches_ni_escribir_auditoria(client, world):
    settings_url = f"/api/v1/diagrams/{world['id']}/agent"
    client.put(settings_url, json={"permission": "full"}, headers=world["reader"])
    response = ask(client, world, "reader")
    assert response.status_code == 200
    assert response.json()["execution_mode"] == "SUGGESTION"
    assert response.json()["allow_delete"] is False
    res = client.post(
        f"/api/v1/ai/audit-feed/{world['id']}",
        json={"action_summary": "x"},
        headers=world["reader"],
    )
    assert res.status_code == 403


def test_reader_si_puede_leer_memoria_auditoria_y_su_historial(client, world):
    d = world["id"]
    assert ask(client, world, "editor").status_code == 200
    for path in ("shared-memory", "audit-feed", "history"):
        assert client.get(f"/api/v1/ai/{path}/{d}", headers=world["reader"]).status_code == 200
    assert history(client, world, "reader").json() == []


def test_editor_obtiene_parches_y_el_historial_es_privado(client, world):
    res = ask(client, world, "editor")
    assert res.status_code == 200, res.text
    assert any(p["target"] == "MetodoPago" for p in res.json()["patches"])
    mine = history(client, world, "editor").json()
    assert len(mine) == 2 and mine[0]["role"] == "user"
    assert history(client, world, "owner").json() == []


def test_la_ia_recibe_contexto_del_equipo_sin_exponer_chats_ajenos(client, world, ai_fakes):
    ask(client, world, "owner", prompt="Usaremos pagos con tarjeta")
    res = ask(client, world, "editor", prompt="Añade facturas")
    assert res.status_code == 200
    team = ai_fakes.llm.last_kwargs["team_history"]
    assert any(row["content"] == "Usaremos pagos con tarjeta" for row in team)
    assert not any(row["content"] == "Añade facturas" for row in team)
    assert history(client, world, "editor").json()[0]["content"] == "Añade facturas"
    assert history(client, world, "owner").json()[0]["content"] == "Usaremos pagos con tarjeta"
    assert "Usaremos pagos con tarjeta" not in res.text


def test_permiso_personal_controla_el_modo_de_ejecucion(client, world):
    res = ask(client, world, "editor")
    assert res.status_code == 200
    assert res.json()["execution_mode"] == "SUGGESTION"
    assert res.json()["allow_delete"] is False

    settings_url = f"/api/v1/diagrams/{world['id']}/agent"
    client.put(settings_url, json={"permission": "full"}, headers=world["editor"])
    res = ask(client, world, "editor")
    assert res.status_code == 200
    assert res.json()["execution_mode"] == "DIRECT"
    assert res.json()["allow_delete"] is True

    owner_res = ask(client, world, "owner")
    assert owner_res.json()["execution_mode"] == "SUGGESTION"
    assert owner_res.json()["allow_delete"] is False


def test_user_id_en_query_o_cuerpo_se_ignora(client, world, db_session):
    editor_id = (
        db_session.query(DiagramPermission)
        .filter_by(diagram_id=world["id"], role="EDITOR")
        .one()
        .user_id
    )
    ask(client, world, "editor")
    # El propietario intenta leer el historial del editor pasando su user_id.
    assert history(client, world, "owner", f"?user_id={editor_id}").json() == []
    # Tampoco puede suplantar a otro desde el cuerpo: el chat se guarda a nombre del token.
    ask(client, world, "owner", user_id=str(editor_id), user_name="Falso")
    assert len(history(client, world, "editor").json()) == 2


def test_borrar_historial_solo_afecta_al_propio(client, world):
    d = world["id"]
    ask(client, world, "editor")
    ask(client, world, "owner")
    res = client.delete(f"/api/v1/ai/history/{d}", headers=world["owner"])
    assert res.json()["deleted_count"] == 2
    assert len(history(client, world, "editor").json()) == 2


def test_la_auditoria_usa_el_autor_del_token(client, world):
    d = world["id"]
    res = client.post(
        f"/api/v1/ai/audit-feed/{d}",
        json={"action_summary": "Aprobó algo", "actor": "Suplantado"},
        headers=world["editor"],
    )
    assert res.status_code == 200
    feed = client.get(f"/api/v1/ai/audit-feed/{d}", headers=world["owner"]).json()
    assert feed[-1]["actor"] == "Bob"


def test_memoria_compartida_visible_para_el_equipo(client, world):
    ask(client, world, "editor")
    data = client.get(f"/api/v1/ai/shared-memory/{world['id']}", headers=world["owner"]).json()
    assert data["architectural_decisions"] == []  # Una propuesta no es una decisión aceptada.


def test_la_respuesta_indica_si_fue_simulada(client, world):
    assert ask(client, world, "editor").json()["simulated"] is False

    class SimulatedLLM:
        async def invoke_architect_agent(self, user_name, **kwargs):
            return AgentResult(reply_to_user="x", shared_decision_note="nota", simulated=True)

    app.dependency_overrides[ai_router.get_llm_client] = lambda: SimulatedLLM()
    assert ask(client, world, "editor").json()["simulated"] is True
    feed = client.get(f"/api/v1/ai/audit-feed/{world['id']}", headers=world["owner"]).json()
    # la auditoría distingue lo simulado de lo que respondió el modelo real
    assert feed == []  # Las consultas no registran cambios aplicados.


class CapturingLLM:
    def __init__(self):
        self.calls = []

    async def invoke_architect_agent(self, user_name, **kwargs):
        self.calls.append(kwargs)
        return AgentStructuredOutput(reply_to_user="ok")


def test_el_contexto_sale_del_almacen_y_no_del_cliente(client, world):
    llm = CapturingLLM()
    app.dependency_overrides[ai_router.get_llm_client] = lambda: llm
    saved = client.put(
        f"/api/v1/diagrams/{world['id']}", json={"data": _model("Cliente", "Pedido"), "expected_revision": 1}, headers=world["owner"]
    )
    assert saved.status_code == 200

    res = ask(
        client, world, "editor",
        current_canvas_snapshot={"classes": [{"id": "z", "name": "Inventada", "attributes": []}]},
        selection=["Cliente"],
    )
    assert res.status_code == 200, res.text
    sent = llm.calls[0]
    assert "Inventada" not in sent["diagram_context"]
    assert "* Cliente" in sent["diagram_context"] and "Pedido" in sent["diagram_context"]
    assert [c["name"] for c in sent["canvas_snapshot"]["classes"]] == ["Cliente", "Pedido"]
    info = res.json()["context"]
    assert info["source"] == "server" and info["version"] == 2 and info["classes"] == 2
    assert info["truncated"] is False


def test_sin_documento_guardado_se_usa_la_copia_del_cliente_y_se_avisa(client, world, diagram_repo):
    llm = CapturingLLM()
    app.dependency_overrides[ai_router.get_llm_client] = lambda: llm
    diagram_repo.delete(world["id"])
    res = ask(client, world, "editor", current_canvas_snapshot={"classes": [{"id": "z", "name": "Local", "attributes": []}]})
    assert res.status_code == 200
    assert "Local" in llm.calls[0]["diagram_context"]
    info = res.json()["context"]
    assert info["source"] == "client" and any("copia del cliente" in w for w in info["warnings"])


def test_la_seleccion_se_valida_y_se_acota(client, world):
    assert ask(client, world, "editor", selection=["a"] * 21).status_code == 422
    llm = CapturingLLM()
    app.dependency_overrides[ai_router.get_llm_client] = lambda: llm
    res = ask(client, world, "editor", selection=["x" * 500])
    assert res.status_code == 200
    assert any("ya no existe" in w for w in res.json()["context"]["warnings"])


def test_diagrama_grande_se_recorta_y_el_cliente_lo_sabe(client, world):
    llm = CapturingLLM()
    app.dependency_overrides[ai_router.get_llm_client] = lambda: llm
    big = {"classes": [
        {"id": f"c{i}", "name": f"Clase{i}", "operations": [],
         "attributes": [{"id": f"c{i}a{j}", "name": f"campo{j}", "type": "String"} for j in range(10)]}
        for i in range(150)
    ]}
    client.put(f"/api/v1/diagrams/{world['id']}", json={"data": big, "expected_revision":1}, headers=world["owner"])
    res = ask(client, world, "editor")
    info = res.json()["context"]
    assert info["truncated"] is True and info["classes"] == 150
    assert info["approx_tokens"] < 3500
    assert any("solo por nombre" in w for w in info["warnings"])


def test_limites_de_entrada(client, world):
    assert ask(client, world, "editor", prompt="").status_code == 422
    assert ask(client, world, "editor", prompt="x" * 4001).status_code == 422
    big = {"classes": [{"name": "A" * 1000} for _ in range(600)]}
    assert ask(client, world, "editor", current_canvas_snapshot=big).status_code == 422


def test_rate_limit_por_usuario(client, world):
    collaborate_limiter.limit = 2
    try:
        assert ask(client, world, "editor").status_code == 200
        assert ask(client, world, "editor").status_code == 200
        limited = ask(client, world, "editor")
        assert limited.status_code == 429 and "Retry-After" in limited.headers
        assert ask(client, world, "owner").status_code == 200  # el límite es por usuario
    finally:
        collaborate_limiter.limit = 20


def test_ventana_deslizante_libera_cupo():
    now = [0.0]
    rl = RateLimiter(limit=1, window=10, clock=lambda: now[0])
    assert rl.check(1) is None
    assert rl.check(1) is not None
    now[0] = 11
    assert rl.check(1) is None

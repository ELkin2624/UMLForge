from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ai_agent_collaborate_and_dual_memory():
    diagram_id = "test_diag_flow_99"
    user_a_id = "user_alpha"
    user_b_id = "user_beta"

    # 1. Limpiar historiales previos si existen
    client.delete(f"/api/v1/ai/history/{diagram_id}?user_id={user_a_id}")
    client.delete(f"/api/v1/ai/history/{diagram_id}?user_id={user_b_id}")

    # 2. Usuario A interactúa en su chat privado
    prompt_a = "Crea el módulo de pagos con el patrón Strategy para soportar QR y Tarjeta"
    resp_a = client.post(
        "/api/v1/ai/collaborate",
        json={
            "diagram_id": diagram_id,
            "user_id": user_a_id,
            "user_name": "Usuario A",
            "prompt": prompt_a,
            "current_canvas_snapshot": {"classes": [], "relationships": []},
        },
    )
    assert resp_a.status_code == 200, resp_a.text
    data_a = resp_a.json()
    assert "reply" in data_a
    assert len(data_a["patches"]) > 0
    assert any("MetodoPago" in p["target"] for p in data_a["patches"])

    # 3. Comprobar que el historial privado del Usuario A contiene sus mensajes
    hist_a = client.get(f"/api/v1/ai/history/{diagram_id}?user_id={user_a_id}")
    assert hist_a.status_code == 200
    messages_a = hist_a.json()
    assert len(messages_a) >= 2  # user + model
    assert messages_a[0]["role"] == "user"
    assert prompt_a in messages_a[0]["content"]

    # 4. Comprobar que el historial privado del Usuario B está COMPLETAMENTE VACÍO (aislamiento estricto)
    hist_b = client.get(f"/api/v1/ai/history/{diagram_id}?user_id={user_b_id}")
    assert hist_b.status_code == 200
    messages_b = hist_b.json()
    assert len(messages_b) == 0

    # 5. Comprobar la Memoria Compartida
    shared = client.get(f"/api/v1/ai/shared-memory/{diagram_id}")
    assert shared.status_code == 200
    shared_data = shared.json()
    decisions = shared_data.get("architectural_decisions", [])
    assert len(decisions) >= 1
    assert any("Usuario A" in d.get("author", "") for d in decisions)

    # 6. Comprobar la Bitácora de Auditoría (Audit Feed)
    audit = client.get(f"/api/v1/ai/audit-feed/{diagram_id}")
    assert audit.status_code == 200
    audit_events = audit.json()
    assert len(audit_events) >= 1

    # 7. Usuario B pregunta en su chat privado por qué apareció MetodoPago
    resp_b = client.post(
        "/api/v1/ai/collaborate",
        json={
            "diagram_id": diagram_id,
            "user_id": user_b_id,
            "user_name": "Usuario B",
            "prompt": "¿Por qué apareció la interfaz MetodoPago?",
            "current_canvas_snapshot": {"classes": [{"name": "MetodoPago"}], "relationships": []},
        },
    )
    assert resp_b.status_code == 200, resp_b.text
    data_b = resp_b.json()
    # La IA responde a Usuario B con la decisión de Usuario A obtenida de la Memoria Compartida
    reply_b = data_b["reply"]
    assert "Usuario A" in reply_b or "memoria compartida" in reply_b.lower()

    # 8. Historial privado de B ahora tiene sus mensajes pero NO los de A
    hist_b_after = client.get(f"/api/v1/ai/history/{diagram_id}?user_id={user_b_id}")
    messages_b_after = hist_b_after.json()
    assert len(messages_b_after) >= 2
    # No contiene el prompt original de A
    assert not any(prompt_a == m.get("content") for m in messages_b_after)


if __name__ == "__main__":
    test_ai_agent_collaborate_and_dual_memory()
    print("ALL TESTS PASSED SUCCESSFULLY!")

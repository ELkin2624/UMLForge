/**
 * Consulta al backend FastAPI qué puede hacer un token sobre una sala.
 * El backend es la única autoridad de permisos; aquí solo se interpreta su respuesta.
 *
 * Salas numéricas = diagramas (se usa el rol real del usuario).
 * Cualquier otro nombre de sala solo exige una sesión válida.
 */
async function fetchAccess(backendUrl, docName, token) {
  const headers = { Authorization: `Bearer ${token}` };

  if (/^\d+$/.test(docName)) {
    const res = await fetch(`${backendUrl}/api/v1/diagrams/${docName}`, { headers });
    if (!res.ok) {
      return { authorized: false, status: res.status, reason: `diagrama ${docName}: FastAPI respondió ${res.status}` };
    }
    const body = await res.json().catch(() => ({}));
    return {
      authorized: true,
      // Sin rol explícito se asume el más restrictivo.
      role: body.my_role || 'READER',
      agentEnabled: body.agent_enabled === true,
    };
  }

  const res = await fetch(`${backendUrl}/api/v1/auth/me`, { headers });
  if (!res.ok) {
    return { authorized: false, status: res.status, reason: `/auth/me: FastAPI respondió ${res.status}` };
  }
  return { authorized: true, role: 'EDITOR', agentEnabled: false };
}

module.exports = { fetchAccess };

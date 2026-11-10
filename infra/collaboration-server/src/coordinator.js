const crypto = require("crypto");
const yUtils = require("y-websocket/bin/utils");
const { AGENT_USER, applyAgentPresence } = require("./agent-presence");
const engine = import("../../../packages/uml-commands/coordinator.ts");

async function body(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error("Solicitud demasiado grande");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
function authorized(request) {
  const secret = process.env.COLLAB_SERVICE_TOKEN || "";
  const token = (request.headers.authorization || "").replace(/^Bearer /, "");
  const secretBytes = Buffer.from(secret),
    tokenBytes = Buffer.from(token);
  return (
    secret &&
    tokenBytes.length === secretBytes.length &&
    crypto.timingSafeEqual(secretBytes, tokenBytes)
  );
}
function publish(diagramId, state) {
  const doc = yUtils.getYDoc(String(diagramId));
  const revision = doc.getMap("room").get("revision") || 0;
  if (state.revision < revision) return;
  doc.transact(() => {
    doc.getMap("umlforge").set("model", JSON.stringify(state.data));
    const layout = doc.getMap("visual-state");
    for (const key of layout.keys())
      if (!(key in (state.layout || {}))) layout.delete(key);
    for (const [id, position] of Object.entries(state.layout || {}))
      layout.set(id, position);
    doc.getMap("room").set("revision", state.revision);
  }, "server-commit");
}
function agentPresence(diagramId, state) {
  const doc = yUtils.getYDoc(String(diagramId));
  const { awareness } = doc;
  if (!doc.getMap("room").get("agent_enabled")) return;
  if (state.status === "disabled") {
    awareness.setLocalState(null);
    return;
  }
  const previous = awareness.getLocalState() || {};
  const active = ["thinking", "pointing", "proposing", "applying"].includes(
    state.status,
  );
  const sameRun = previous.agent?.run_id === state.run_id;
  const position =
    state.cursor ||
    ((active || state.status === "idle") && sameRun
      ? previous.cursor
      : undefined);
  const target = Object.hasOwn(state, "targetId")
    ? state.targetId
    : active && sameRun
      ? previous.selectedNode
      : undefined;
  awareness.setLocalState({
    user: { ...AGENT_USER },
    cursor: position,
    selectedNode: target,
    editingNode: state.status === "applying" ? state.targetId : undefined,
    agent: state,
  });
}
async function handleInternal(request, response, sendJson) {
  if (request.method !== "POST")
    return sendJson(response, 405, { error: "Method not allowed" });
  if (!authorized(request))
    return sendJson(response, 401, { error: "Unauthorized" });
  const payload = await body(request);
  const api = await engine;
  let result;
  switch (request.url) {
    case "/internal/agent_enabled":
      applyAgentPresence(String(payload.diagram_id), payload.enabled === true);
      result = { ok: true };
      break;
    case "/internal/diff":
      result = {
        commands: api.diffModels(
          payload.before,
          payload.after,
          payload.batch_id,
        ),
      };
      break;
    case "/internal/busy": {
      const doc = yUtils.getYDoc(String(payload.diagram_id));
      const targets = new Set(payload.target_ids);
      const busy = [];
      for (const state of doc.awareness.getStates().values()) {
        if (!state.user?.isAgent)
          for (const id of [state.draggingNode, state.editingNode])
            if (targets.has(id)) busy.push(id);
      }
      result = { busy };
      break;
    }
    case "/internal/execute":
      result = api.applyRoomBatch(
        payload.model,
        payload.layout || {},
        payload.commands,
      );
      break;
    case "/internal/translate":
      result = api.translatePatches(
        payload.model,
        payload.patches,
        payload.batch_id,
      );
      break;
    case "/internal/publish":
      publish(payload.diagram_id, payload);
      result = { ok: true };
      break;
    case "/internal/presence":
      agentPresence(payload.diagram_id, payload.state);
      result = { ok: true };
      break;
    default:
      return sendJson(response, 404, { error: "Not found" });
  }
  return sendJson(response, 200, result);
}
module.exports = { handleInternal, publish, agentPresence };

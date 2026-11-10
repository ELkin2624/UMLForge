const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const WebSocket = require("ws");
const Y = require("yjs");
const { WebsocketProvider } = require("y-websocket");
const { createCollabServer } = require("../server");

// ── Backend FastAPI simulado ────────────────────────────────────────────────
const users = {
  "tok-owner": "OWNER",
  "tok-editor": "EDITOR",
  "tok-reader": "READER",
};
let agentEnabled = false;

const backend = http.createServer((req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const role = users[token];
  if (!role) {
    res.writeHead(401);
    return res.end();
  }
  if (req.url === "/api/v1/diagrams/7") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ id: 7, my_role: role, agent_enabled: agentEnabled }),
    );
  }
  res.writeHead(403); // sin permiso sobre otros diagramas
  res.end();
});

let collab;
let wsUrl;
let httpUrl;
const providers = [];

before(async () => {
  await new Promise((r) => backend.listen(0, r));
  collab = createCollabServer({
    backendUrl: `http://localhost:${backend.address().port}`,
  });
  await new Promise((r) => collab.listen(0, r));
  const port = collab.address().port;
  wsUrl = `ws://localhost:${port}`;
  httpUrl = `http://localhost:${port}`;
});

after(async () => {
  providers.forEach((p) => {
    p.destroy();
    p.awareness.destroy();
    p.doc.destroy();
  });
  collab.collaborationSockets.clients.forEach((conn) => conn.terminate());
  backend.closeAllConnections?.();
  collab.closeAllConnections?.();
  await new Promise((r) => collab.close(r));
  await new Promise((r) => backend.close(r));
  const utils = require("y-websocket/bin/utils");
  for (const doc of utils.docs.values()) {
    doc.awareness.destroy();
    doc.destroy();
  }
  utils.docs.clear();
});

function connect(room, token) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(wsUrl, room, doc, {
    params: { token },
    WebSocketPolyfill: WebSocket,
    disableBc: true,
  });
  providers.push(provider);
  return { doc, provider, awareness: provider.awareness };
}

async function waitFor(condition, ms = 3000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await condition()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

const synced = (c) => waitFor(() => c.provider.synced);
const agentPeers = (c) =>
  [...c.awareness.getStates().values()].filter((s) => s.user && s.user.isAgent);

// ── Roles ───────────────────────────────────────────────────────────────────
test("el servidor publica y los navegadores reciben sin poder escribir snapshots", async () => {
  const editor = connect("7", "tok-editor");
  const reader = connect("7", "tok-reader");
  assert.ok((await synced(editor)) && (await synced(reader)));

  process.env.COLLAB_SERVICE_TOKEN = "test-service";
  const response = await fetch(httpUrl + "/internal/publish", {
    method: "POST",
    headers: { Authorization: "Bearer test-service" },
    body: JSON.stringify({
      diagram_id: 7,
      revision: 2,
      data: { classes: [], relationships: [] },
      layout: {},
    }),
  });
  assert.equal(response.status, 200);
  assert.ok(
    await waitFor(
      () =>
        JSON.parse(reader.doc.getMap("umlforge").get("model") || "{}").classes
          ?.length === 0,
    ),
  );
  editor.doc.getMap("m").set("model", "untrusted");
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(reader.doc.getMap("m").get("model"), undefined);
});

test("los cambios de un lector se descartan en el servidor", async () => {
  const editor = connect("7", "tok-editor");
  const reader = connect("7", "tok-reader");
  assert.ok((await synced(editor)) && (await synced(reader)));

  reader.doc.getMap("m").set("hack", "x");
  // un cliente nuevo (que lee el estado del servidor) no debe ver la escritura
  await new Promise((r) => setTimeout(r, 400));
  const late = connect("7", "tok-owner");
  assert.ok(await synced(late));
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(late.doc.getMap("m").get("hack"), undefined);
  assert.equal(editor.doc.getMap("m").get("hack"), undefined);
});

test("el lector sigue compartiendo presencia (awareness)", async () => {
  const owner = connect("7", "tok-owner");
  const reader = connect("7", "tok-reader");
  assert.ok((await synced(owner)) && (await synced(reader)));
  reader.awareness.setLocalStateField("cursor", { x: 5, y: 9 });
  assert.ok(
    await waitFor(
      () =>
        owner.awareness.getStates().get(reader.doc.clientID)?.cursor?.x === 5,
    ),
  );
});

test("token inválido o sin permiso: la conexión se rechaza", async () => {
  const bad = connect("7", "tok-falso");
  const noAccess = connect("8", "tok-owner");
  const closed = (c) =>
    new Promise((resolve) =>
      c.provider.on("connection-close", (e) => resolve(e && e.code)),
    );
  assert.equal(await closed(bad), 4001);
  assert.equal(await closed(noAccess), 4003);
});

// ── Presencia del agente ────────────────────────────────────────────────────
test("con el agente desactivado nadie lo ve", async () => {
  agentEnabled = false;
  const c = connect("7", "tok-owner");
  assert.ok(await synced(c));
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(agentPeers(c).length, 0);
});

test("activar el agente y avisar al servidor lo muestra a TODOS; desactivar lo oculta", async () => {
  agentEnabled = false;
  const a = connect("7", "tok-owner");
  const b = connect("7", "tok-reader");
  assert.ok((await synced(a)) && (await synced(b)));

  agentEnabled = true; // el propietario lo activó en el backend
  const res = await fetch(`${httpUrl}/agent/7/refresh`, {
    method: "POST",
    headers: { Authorization: "Bearer tok-owner" },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { enabled: true });
  assert.ok(
    await waitFor(
      () => agentPeers(a).length === 1 && agentPeers(b).length === 1,
    ),
  );
  assert.equal(agentPeers(b)[0].user.name, "Asistente IA");

  // quien entra después también lo ve
  const late = connect("7", "tok-editor");
  assert.ok(await synced(late));
  assert.ok(await waitFor(() => agentPeers(late).length === 1));

  agentEnabled = false;
  await fetch(`${httpUrl}/agent/7/refresh`, {
    method: "POST",
    headers: { Authorization: "Bearer tok-owner" },
  });
  assert.ok(
    await waitFor(
      () => agentPeers(a).length === 0 && agentPeers(b).length === 0,
    ),
  );
});

test("refresh exige sesión y permiso sobre el diagrama", async () => {
  const noToken = await fetch(`${httpUrl}/agent/7/refresh`, { method: "POST" });
  assert.equal(noToken.status, 401);
  const badToken = await fetch(`${httpUrl}/agent/7/refresh`, {
    method: "POST",
    headers: { Authorization: "Bearer tok-falso" },
  });
  assert.equal(badToken.status, 401);
  const noAccess = await fetch(`${httpUrl}/agent/8/refresh`, {
    method: "POST",
    headers: { Authorization: "Bearer tok-owner" },
  });
  assert.equal(noAccess.status, 403);
});

test("solo el canal interno autenticado publica el cursor del agente", async () => {
  agentEnabled = true;
  const one = connect("7", "tok-owner"),
    two = connect("7", "tok-editor");
  assert.ok((await synced(one)) && (await synced(two)));
  const refresh = await fetch(httpUrl + "/agent/7/refresh", {
    method: "POST",
    headers: { Authorization: "Bearer tok-owner" },
  });
  assert.equal(refresh.status, 200);
  const payload = {
    diagram_id: 7,
    state: {
      status: "pointing",
      targetId: "clase",
      cursor: { x: 125, y: 250 },
    },
  };
  assert.equal(
    (
      await fetch(httpUrl + "/internal/presence", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(httpUrl + "/internal/presence", {
        method: "POST",
        headers: { Authorization: "Bearer test-service" },
        body: JSON.stringify(payload),
      })
    ).status,
    200,
  );
  assert.ok(
    await waitFor(() =>
      [one, two].every((c) =>
        agentPeers(c).some(
          (state) => state.cursor?.x === 125 && state.cursor?.y === 250,
        ),
      ),
    ),
  );
});

test("un usuario no puede suplantar la presencia del agente", async () => {
  const one = connect("7", "tok-owner"),
    two = connect("7", "tok-editor");
  assert.ok((await synced(one)) && (await synced(two)));
  one.awareness.setLocalState({
    user: { name: "Falso agente", isAgent: true },
    agent: { status: "applying" },
    cursor: { x: 99, y: 99 },
  });
  assert.ok(
    await waitFor(() => two.awareness.getStates().has(one.doc.clientID)),
  );
  const received = two.awareness.getStates().get(one.doc.clientID);
  assert.equal(received.user.isAgent, false);
  assert.equal(received.agent, undefined);
});

test("una publicación antigua no reemplaza una revisión nueva", async () => {
  const reader = connect("7", "tok-reader");
  assert.ok(await synced(reader));
  const publish = async (revision) =>
    fetch(httpUrl + "/internal/publish", {
      method: "POST",
      headers: { Authorization: "Bearer test-service" },
      body: JSON.stringify({
        diagram_id: 7,
        revision,
        data: {
          classes: [{ id: "c", name: "Revision" + revision }],
          relationships: [],
        },
        layout: {},
      }),
    });
  await publish(100);
  await publish(99);
  assert.ok(
    await waitFor(() => reader.doc.getMap("room").get("revision") === 100),
  );
  assert.equal(
    JSON.parse(reader.doc.getMap("umlforge").get("model")).classes[0].name,
    "Revision100",
  );
});

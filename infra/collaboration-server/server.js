const http = require('http');
const WebSocket = require('ws');
const yUtils = require('y-websocket/bin/utils');
const { fetchAccess } = require('./src/access');
const { restrictToReadOnly } = require('./src/read-only');
const { applyAgentPresence } = require('./src/agent-presence');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function bearerToken(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  response.end(JSON.stringify(body));
}

/**
 * POST /agent/<diagrama>/refresh  (Authorization: Bearer <token>)
 * Tras activar o desactivar el agente en el backend, el cliente avisa aquí y el servidor
 * vuelve a leer el estado REAL desde FastAPI: no se confía en lo que diga el cliente.
 */
async function handleAgentRefresh(backendUrl, docName, request, response) {
  const token = bearerToken(request);
  if (!token) return sendJson(response, 401, { error: 'Unauthorized' });
  const access = await fetchAccess(backendUrl, docName, token).catch(() => null);
  if (!access) return sendJson(response, 502, { error: 'Backend no disponible' });
  if (!access.authorized) {
    return sendJson(response, access.status === 401 ? 401 : 403, { error: 'Forbidden' });
  }
  applyAgentPresence(docName, access.agentEnabled);
  return sendJson(response, 200, { enabled: access.agentEnabled });
}

/**
 * Crea el servidor HTTP + WebSocket (sin ponerlo a escuchar).
 * `backendUrl`: FastAPI contra el que se validan token, rol y estado del agente.
 */
function createCollabServer({ backendUrl = process.env.BACKEND_URL || 'http://localhost:8000' } = {}) {
  const server = http.createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, CORS_HEADERS);
      return response.end();
    }
    const match = request.method === 'POST' && /^\/agent\/(\d+)\/refresh$/.exec(request.url.split('?')[0]);
    if (match) {
      handleAgentRefresh(backendUrl, match[1], request, response).catch((err) => {
        console.error('Error en agent/refresh:', err);
        sendJson(response, 500, { error: 'Internal Server Error' });
      });
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('Yjs Collaboration Server is running');
  });

  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (conn, req) => {
    // Buffer de mensajes entrantes durante la validación asíncrona de autenticación.
    // Evita perder el 'sync step 1' que el cliente envía de inmediato al abrir la conexión.
    const messageQueue = [];
    const messageBuffer = (data, isBinary) => {
      messageQueue.push({ data, isBinary });
    };
    conn.on('message', messageBuffer);

    try {
      const url = new URL(req.url, 'http://localhost');
      const docName = url.pathname.slice(1);
      const token = url.searchParams.get('token');

      if (!token) {
        console.log(`Connection rejected for ${docName}: No token provided`);
        conn.off('message', messageBuffer);
        conn.close(4001, 'Unauthorized');
        return;
      }

      const access = await fetchAccess(backendUrl, docName, token);
      if (!access.authorized) {
        // 4001: token inválido/vencido (el cliente puede refrescar y reintentar).
        // 4003: sin permiso sobre el diagrama (definitivo).
        const code = access.status === 401 ? 4001 : 4003;
        console.log(`Connection rejected for ${docName}: Forbidden or Invalid Token (${access.reason})`);
        conn.off('message', messageBuffer);
        conn.close(code, code === 4001 ? 'Unauthorized' : 'Forbidden');
        return;
      }

      conn.off('message', messageBuffer);
      console.log(`Connection accepted for ${docName} (rol ${access.role})`);

      // Los lectores no pueden modificar el documento (solo verlo y compartir presencia).
      if (access.role === 'READER') restrictToReadOnly(conn);

      yUtils.setupWSConnection(conn, req, { docName });
      applyAgentPresence(docName, access.agentEnabled);

      // Reproducir los mensajes acumulados durante el handshake de autenticación
      for (const item of messageQueue) {
        conn.emit('message', item.data, item.isBinary);
      }
    } catch (err) {
      console.error('Error during connection validation:', err);
      conn.off('message', messageBuffer);
      conn.close(4001, 'Internal Server Error');
    }
  });

  return server;
}

module.exports = { createCollabServer };

if (require.main === module) {
  const port = process.env.PORT || 1234;
  createCollabServer().listen(port, () => {
    console.log(`Yjs WebSocket server running on ws://localhost:${port}`);
  });
}

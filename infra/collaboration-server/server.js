const http = require('http');
const WebSocket = require('ws');
const yUtils = require('y-websocket/bin/utils');

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Yjs Collaboration Server is running');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', async (conn, req) => {
  // Buffer de mensajes entrantes durante la validación asíncrona de autenticación
  // Esto previene que se pierda el mensaje 'sync step 1' que el cliente envía de inmediato al abrir la conexión.
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

    // Validar token y permisos contra FastAPI
    let authorized = false;
    if (/^\d+$/.test(docName)) {
      const res = await fetch(`http://localhost:8000/api/v1/diagrams/${docName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      authorized = res.ok;
    } else {
      const res = await fetch(`http://localhost:8000/api/v1/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      authorized = res.ok;
    }

    if (!authorized) {
      console.log(`Connection rejected for ${docName}: Forbidden or Invalid Token`);
      conn.off('message', messageBuffer);
      conn.close(4003, 'Forbidden');
      return;
    }

    // Si tiene acceso, desconectar el buffer temporal y conectar con Yjs
    conn.off('message', messageBuffer);
    console.log(`Connection accepted for ${docName}`);
    yUtils.setupWSConnection(conn, req, { docName });

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

const port = process.env.PORT || 1234;
server.listen(port, () => {
  console.log(`Yjs WebSocket server running on ws://localhost:${port}`);
});

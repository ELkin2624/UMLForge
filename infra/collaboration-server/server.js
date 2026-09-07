const http = require('http');
const WebSocket = require('ws');
const yUtils = require('y-websocket/bin/utils');

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Yjs Collaboration Server is running');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', async (conn, req) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const docName = url.pathname.slice(1);
    const token = url.searchParams.get('token');

    if (!token) {
      console.log(`Connection rejected for ${docName}: No token provided`);
      conn.close(4001, 'Unauthorized');
      return;
    }

    // Validar token y permisos contra FastAPI
    // Asumimos que FastAPI corre en el puerto 8000.
    const res = await fetch(`http://localhost:8000/api/v1/diagrams/${docName}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      console.log(`Connection rejected for ${docName}: Forbidden`);
      conn.close(4003, 'Forbidden');
      return;
    }

    // Si tiene acceso, permitir la conexión al documento Yjs
    console.log(`Connection accepted for ${docName}`);
    yUtils.setupWSConnection(conn, req, { docName });

  } catch (err) {
    console.error('Error during connection validation:', err);
    conn.close(4001, 'Internal Server Error');
  }
});

const port = process.env.PORT || 1234;
server.listen(port, () => {
  console.log(`Yjs WebSocket server running on ws://localhost:${port}`);
});

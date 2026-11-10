# UMLForge — servidor de colaboración

Servidor WebSocket Yjs para distribuir el estado confirmado y la presencia de los participantes. Requiere Node.js 24 o superior, FastAPI, MongoDB y PostgreSQL.

## Arranque

Desde la raíz del repositorio:

```bash
python scripts/configure-collaboration.py
cd infra/collaboration-server
npm install
npm start
```

El script genera un secreto compartido en los archivos `.env` ignorados por Git. `npm start` carga el archivo local. Iniciar también FastAPI y el frontend (`cd frontend && npm run dev`). La configuración completa y el uso del agente están en [Agente colaborador](../../docs/agente-colaborativo.md).

| Variable | Valor predeterminado | Uso |
|---|---|---|
| `HOST` | `localhost` | Interfaz de escucha; usar `0.0.0.0` para acceso desde la red |
| `PORT` | `1234` | Puerto HTTP/WebSocket |
| `BACKEND_URL` | `http://localhost:8000` | API que valida sesiones, permisos y estado inicial |
| `COLLAB_SERVICE_TOKEN` | sin valor | Autenticación del canal interno; debe coincidir con FastAPI |

## Estado y permisos

Cada conexión exige un JWT de usuario y valida el acceso contra FastAPI. Los roles se consultan al conectar; un cambio de permiso requiere reconexión.

En salas numéricas, los navegadores envían comandos protegidos a FastAPI y reciben por Yjs el resultado confirmado. Ningún navegador puede escribir directamente el documento, incluidos los editores. Los lectores comparten presencia y reciben cambios. Las salas antiguas no numéricas mantienen la edición local anterior.

MongoDB persiste el modelo, las posiciones y las revisiones. Al conectar se hidrata la sala desde FastAPI. El Y.Doc y awareness viven en memoria; un reinicio del servidor WebSocket no borra el historial persistido. El trabajador del backend recupera publicaciones pendientes.

El agente tiene una identidad y un cursor publicados por el servidor. El canal `/internal/*` requiere el secreto de servicio y permite ejecutar el motor compartido, publicar revisiones y actualizar presencia. El navegador no recibe ese secreto ni puede suplantar al agente.

## Verificación

```bash
npm test
```

Las pruebas usan un backend simulado y verifican permisos, publicación por revisión, presencia, cursor y rechazo de suplantaciones. Para probar la integración, abrir el mismo proyecto con dos sesiones autorizadas, activar el agente como propietario y solicitar una propuesta. Ambos clientes deben recibir la propuesta y, tras aprobarla, el modelo y las posiciones confirmadas. Al desconectar el servidor, el editor espera la reconexión antes de permitir cambios.

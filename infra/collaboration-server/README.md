# UMLForge — Servidor de Colaboración en Tiempo Real

Servidor WebSocket basado en `@y/websocket-server` (Yjs) que permite a múltiples clientes editar simultáneamente el mismo diagrama UML.

---

## ⚠️ Advertencias importantes

- **Sin persistencia**: Los documentos colaborativos se almacenan **en memoria**. Al reiniciar el servidor, todos los documentos y el historial de cambios se pierden. Si deseas persistencia, necesitas un servidor personalizado con `@y/websocket-server/utils` + LevelDB.
- **Sin autenticación**: El acceso a una sala se controla únicamente por nombre. Cualquier cliente que conozca el nombre de sala puede unirse.
- **Sin granularidad CRDT por campo**: UMLForge almacena el modelo como un JSON completo en `Y.Map`. El último en escribir gana a nivel de documento.

---

## Requisitos

- Node.js ≥ 18
- npm ≥ 9

---

## Instalación

```bash
cd services/collaboration-server
npm install
```

---

## Ejecución

```bash
# Iniciar con configuración por defecto (localhost:1234)
npm start

# O con variables de entorno personalizadas:
PORT=1234 HOST=localhost npm start

# Para acceso desde red local (otros dispositivos):
PORT=1234 HOST=0.0.0.0 npm start
```

El servidor escuchará en `ws://localhost:1234` por defecto.

---

## Variables de entorno

| Variable | Default      | Descripción                    |
|----------|--------------|--------------------------------|
| `HOST`   | `localhost`  | Interfaz de red del servidor   |
| `PORT`   | `1234`       | Puerto del servidor WebSocket  |

---

## Prueba con 3 navegadores (Chrome, Edge, Firefox)

### 1. Iniciar servicios

```bash
# Terminal 1 — Servidor de colaboración
cd services/collaboration-server && npm install && npm start

# Terminal 2 — Frontend
cd apps/web && npm run dev
```

### 2. Conectar 3 clientes

Abre `http://localhost:5173` en Chrome, Edge y Firefox (o 3 perfiles distintos).

En el panel de colaboración (esquina inferior-izquierda):
1. Introduce un nombre de usuario distinto en cada navegador
2. Usa la misma sala: `umlforge-barber-shop`
3. Haz clic en **Conectar**

### 3. Prueba A — Colaboración simultánea

| Usuario | Acción                          | Resultado esperado              |
|---------|---------------------------------|---------------------------------|
| U1      | Crea clase `Cliente`            | U2 y U3 ven `Cliente`           |
| U2      | Crea clase `Cita`               | U1 y U3 ven `Cita`              |
| U3      | Crea clase `Servicio`           | U1 y U2 ven `Servicio`          |
| U1      | Modifica atributo de `Cliente`  | U2 y U3 ven el cambio           |

### 4. Prueba B — Late-joiner (sincronización inicial)

1. U1 crea `Cliente`, `Cita`, `Servicio` y está conectado
2. U2 se conecta **después** a la misma sala
3. **Resultado**: U2 recibe automáticamente las 3 clases sin acción adicional

### 5. Prueba C — Autoridad de sala (modelo local vs. remoto)

1. U1 publica el modelo **Barbería** en sala `umlforge-barber-shop`
2. U2 tiene un modelo local **Escuela**
3. U2 se conecta a `umlforge-barber-shop`
4. **Resultado**: U2 recibe el aviso `⚠️ Tu modelo local fue reemplazado por el modelo de la sala` y ve **Barbería**

### 6. Prueba D — Desconexión y reconexión

1. U3 se desconecta → U1 y U2 ven `2 usuarios online`
2. U3 reconecta → recibe el estado actual; U1 y U2 ven `3 usuarios online`

### 7. Prueba E — Aislamiento offline

1. U1 está conectado, crea `Cliente`
2. Se detiene el servidor WebSocket (`Ctrl+C`)
3. U1 sigue editando (crea `Cita`) — **el editor no debe bloquearse**
4. Se reinicia el servidor, U1 reconecta → sincronización del estado

---

## Arquitectura

```
FastAPI         → http://localhost:8000   (REST: validación, generación, XMI, E2E)
Y-WebSocket     → ws://localhost:1234     (colaboración Yjs)
Vite Dev Server → http://localhost:5173   (frontend React)
```

El servidor de colaboración **no interactúa con FastAPI**. Son servicios completamente independientes.

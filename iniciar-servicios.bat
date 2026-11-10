@echo off
echo ==============================================
echo Iniciando entorno de desarrollo UMLForge...
echo ==============================================

echo [1/4] Levantando contenedores Docker (Postgres y MongoDB)...
docker compose up -d

echo [2/4] Iniciando Backend FastAPI en el puerto 8000...
start "UMLForge Backend (:8000)" cmd /k "cd /d %~dp0backend && .venv\Scripts\uvicorn.exe app.main:app --reload --port 8000"

echo [3/4] Iniciando Servidor de Colaboracion Yjs en el puerto 1234...
start "UMLForge Collab Server (:1234)" cmd /k "cd /d %~dp0infra\collaboration-server && npm start"

echo [4/4] Iniciando Frontend React/Vite en el puerto 5173...
start "UMLForge Frontend (:5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo ==============================================
echo Todos los servicios han sido lanzados:
echo - Frontend:     http://localhost:5173
echo - Backend Docs: http://localhost:8000/docs
echo - WebSocket:    ws://localhost:1234
echo ==============================================


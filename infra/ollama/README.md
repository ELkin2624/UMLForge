# Servidor de IA local (Ollama)

Levanta Ollama con un modelo Qwen para el agente de UMLForge. No forma parte del `docker-compose.yml`
de la raíz a propósito: está pensado para correr en **otra máquina** (p. ej. un Debian con 16 GB y
solo CPU) o en la tuya, indistintamente.

## Uso

```bash
cd infra/ollama
docker compose up -d                 # arranca el servidor y descarga el modelo
docker compose logs -f ollama-pull   # progreso de la descarga (primera vez: varios GB)
```

Cuando `ollama-pull` termina (sale con código 0), el servidor está listo. Comprobación:

```bash
curl http://127.0.0.1:11434/api/tags         # lista los modelos descargados
docker exec umlforge_ollama ollama run qwen3.5:4b "Responde solo: ok"
```

## Elegir modelo

Por defecto `qwen3.5:4b`. Para cambiarlo copia `.env.example` a `.env` y edita `OLLAMA_MODEL`, luego
`docker compose up -d` otra vez. Orientación para 16 GB sin GPU (estimación, no medida):

| Modelo | Disco | Notas |
|---|---|---|
| `qwen3.5:4b` | ~4 GB | Recomendado para empezar: rápido y con holgura de RAM |
| `qwen3.5:9b` | ~7 GB | Mejor calidad; en CPU la primera respuesta puede tardar mucho |
| `qwen3.5:27b` | ~17-20 GB | No cabe en 16 GB |

## Usarlo desde otro equipo (backend de UMLForge)

Ollama **no tiene autenticación**. No abras el puerto a internet ni en tu router.

1. Instala Tailscale en esta máquina y en la que corre el backend.
2. En `.env`: `OLLAMA_BIND=<IP de Tailscale de esta máquina>` (la ves con `tailscale ip -4`), y
   `docker compose up -d`.
3. En el backend: `OLLAMA_BASE_URL=http://<esa IP>:11434` (variable que usará el proveedor de IA
   local; ver `docs/plan-agente-colaborativo.md`, Fase 4).

Alternativa sin Tailscale: túnel SSH desde el equipo del backend,
`ssh -N -L 11434:127.0.0.1:11434 usuario@maquina`, y `OLLAMA_BASE_URL=http://127.0.0.1:11434`.

## Mantenimiento

```bash
docker compose ps                    # estado
docker compose logs -f ollama        # registros del servidor
docker compose pull && docker compose up -d   # actualizar la imagen de Ollama
docker compose down                  # parar (los modelos se conservan en el volumen)
docker compose down -v               # parar Y borrar los modelos descargados
```

## GPU

Sin GPU funciona solo con CPU (lo esperado en un Ryzen 5000U). Con una GPU NVIDIA instala
`nvidia-container-toolkit` y descomenta el bloque `deploy` de `docker-compose.yml`. Las GPU
integradas de AMD/Intel no se aprovechan dentro de Docker en este montaje.

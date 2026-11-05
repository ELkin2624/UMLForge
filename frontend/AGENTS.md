# Frontend — Guía para agentes

SPA **React 19 + TypeScript + Vite 8**. Editor UML con **`@tumaet/apollon`**, colaboración con **Yjs**, estado con **Zustand**, estilos con Tailwind 4 más CSS propio. El lenguaje visual está en `DESIGN.md`; léelo antes de tocar UI.

## Comandos

```bash
cd frontend
npm install
npm run dev        # Vite en :5173, proxy /api -> http://localhost:8000
npm run build      # tsc && vite build
npm test           # vitest run (jsdom, setup en tests/setup.ts)
```

Variable de entorno: `VITE_YJS_WS_URL` (por defecto `ws://localhost:1234`). Ver `.env.example`. Requiere backend en :8000 y, para colaborar, `infra/collaboration-server`.

## Arquitectura (Feature-Sliced Design, migración a medias)

```
src/
  main.tsx, App.tsx       # raíz: sesión, invitaciones, layout, paneles
  features/               # lógica de negocio por capacidad
    auth, sharing, collaboration, ai-assistant, voice,
    model-validation, project-deployment, versioning, data-design, diagram-manager,
    projects-dashboard
    (cada una: api/ model/ ui/ index.ts)
  widgets/                # bloques compuestos: diagram-editor, top-menu-bar
  shared/ui/              # UI reutilizable (Notification)
  api/                    # client.ts (fetch + refresh de token), diagrams-api, models-api
  adapters/               # canónico <-> Apollon (apollon-adapter, component-apollon-adapter)
  store/                  # model-store, use-voice-assistant
  types/                  # canonical-model.ts, api-responses.ts
  style.css               # tokens globales + layout + paneles (1249 líneas)
```

Reglas de capas: `shared` no importa de `features`; `features` no importa de otras `features` salvo por su `index.ts`; `widgets` componen `features`; `App.tsx` ensambla.

## Reglas

- Estricto: `strict` y `noUnusedLocals/Parameters`. Evita `any`; usa los tipos de `types/`.
- Solo componentes funcionales y hooks.
- Llamadas HTTP solo vía `src/api/client.ts` (`request`), que añade el JWT y refresca el token. No uses `fetch` directo contra `/api`.
- El modelo canónico (`types/canonical-model.ts`) es la fuente de verdad en el cliente; Apollon es solo una vista, y la conversión vive en `adapters/`. Mantenlo en espejo con `backend/app/core/canonical_model`.
- Permisos: usa `features/sharing/model/capabilities.ts` (`canEdit`, `canShare`, `canManageAccess`, `canUseMutatingVoiceCommands`). No compares roles con cadenas sueltas.
- Versionado (`features/versioning`): `useAutosave()` (montado en `App.tsx`) guarda 3 s después de un cambio **local** del `model-store`; los cambios que llegan por Yjs usan `setModelFromRemote` y **no** se guardan (así cada versión queda atribuida a quien la hizo). Si aplicas cambios del lado de la IA, llama antes a `markAiChange()` para atribuirlos a la IA. `HistoryDialog` lista versiones, muestra una vista previa de solo lectura (Apollon `readonly`) y restaura; al restaurar se hace `setModel(res.data)`, que lo publica al Y.Doc.
- Administrador de diagramas (`features/diagram-manager`): diálogo "Mis diagramas" (Archivo → Mis diagramas) para listar, abrir, crear, renombrar y eliminar. Para cambiar de diagrama usa **siempre** `switchToDiagram(id)`: guarda el actual, sale de la sala Yjs, cambia `roomId`/rol y solo después carga el modelo (si no, el autosave podría escribir el modelo de un diagrama en otro). Un diagrama vacío se carga como `emptyModel()`, no `null` (el editor ignora `null`).
- Pantalla de proyectos (`features/projects-dashboard`): es la pantalla de inicio tras iniciar sesión (`useDashboardStore.screen`: `dashboard` | `editor`; arranca en `editor` solo si la URL trae `?diagram=`). Lista los diagramas en tarjetas con versión actual y autor de la última, estado del enlace de acceso y colaboradores (solo OWNER). Abrir / Historial / Compartir pasan siempre por `switchToDiagram(id)` y luego abren el editor o el diálogo correspondiente; `ShareDialog` e `HistoryDialog` están montados en ambas pantallas. Archivo → Mis proyectos vuelve a ella. `DiagramManagerDialog` ya no tiene punto de entrada en el menú.
- Diseño de datos (`features/data-design`): diálogo con 3 pestañas (modelo lógico, normalización, diagrama BD). Se abre desde **Validación → Diseño de datos** y analiza el modelo actual del `model-store` en el backend (`POST /data-design/analyze`). El diagrama BD usa `@xyflow/react` + `dagre` con nodos de tabla propios (`layoutTables`); no toca Apollon ni Yjs. Las decisiones sobre dependencias se guardan en el backend solo si el rol puede editar.
- Si necesitas reemplazar el modelo con datos recibidos de otro usuario o de la sala, usa `setModelFromRemote`, no `setModel`.
- Colaboración: el modelo se comparte como JSON completo en un `Y.Map` (último en escribir gana). Toda la lógica Yjs va en `features/collaboration`.
- Estilos: reutiliza los tokens de `DESIGN.md` y las variables de `:root`; no pongas hex nuevos si ya existe un token.
- Tests junto al código (`*.test.ts`). Nuevo parser, adapter o util = test nuevo.
- Textos de UI en español.

## Deuda técnica conocida (no la agraves)

- **Re-exports de compatibilidad**: `src/components/*`, `src/components/presence/*` y `src/hooks/*` son archivos de 1–7 líneas que reexportan las implementaciones reales de `widgets/` y `features/` (ej. `components/TopMenuBar.tsx` -> `widgets/top-menu-bar`). No son duplicados. `App.tsx` aún importa por esas rutas antiguas; migrar esos imports a `widgets/`/`features/` y borrar los shims es limpieza opcional. Edita siempre la implementación, no el shim.
- `App.tsx` (305 líneas) mezcla inicialización de sesión, invitaciones (deep-link y formato legacy `?room=&token=`) y layout. Candidato a extraerse a hooks.
- Hay `any` en `App.tsx` (respuestas de `request<any>`); tipa con `api-responses.ts`.
- `style.css` (1249 líneas) mezcla tokens, layout y estilos de paneles (`.collab-panel__*`, `.gdocs-*`). Los estilos nuevos van junto a su feature.
- `index.html` aún dice `lang="en"` y título "UML CASE Tool".
- Hay dos lockfiles (`package-lock.json` y `pnpm-lock.yaml`); usa `npm` como indica `package.json`.

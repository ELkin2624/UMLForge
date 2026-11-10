This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## UMLForge Mobile — visor de solo lectura

App Expo (SDK 58, expo-router, React Compiler) que consume la API de UMLForge. **Nunca edita diagramas**: no hay crear/renombrar/borrar/compartir/restaurar. Lo único que escribe es estado de cuenta (marcar notificaciones, aceptar/rechazar invitaciones). La IA se consulta con `/ai/collaborate`, pero los parches que devuelve solo se muestran como sugerencias.

Estilo: el de `frontend/DESIGN.md` (crema, bordes de tinta, sombra dura). Tokens en `src/shared/theme/tokens.ts`; no añadas hex sueltos. Componentes base en `src/shared/ui` (`Card`, `Button`, `Input`, `Chip`, `Screen`…). Destinos táctiles >= 44px.

```bash
cp .env.example .env        # EXPO_PUBLIC_API_URL = IP del PC en la red (no localhost en un teléfono)
npx expo start              # Expo Go / emulador
pnpm test                   # vitest (lógica pura: layout, formato, cliente)
npx tsc --noEmit && npx eslint src
```

El backend debe escuchar en la red: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.

Estructura (Feature-Sliced, como el frontend):

```
src/app/            # solo rutas: (auth), (tabs) [proyectos, avisos, perfil], project/[id] [diagram, versions, analyze, ai]
src/features/       # auth, projects, diagram, versions, analysis, ai, notifications
src/shared/         # api (client con JWT + refresh), theme, ui, format, useAsync
src/types/          # canonical-model.ts (espejo de frontend/src/types/canonical-model.ts) y api.ts
```

- Todas las llamadas HTTP pasan por `src/shared/api/client.ts` (`request`): añade el JWT, refresca con la cookie HttpOnly y reintenta una vez en 401. El token vive en `expo-secure-store`.
- El modelo guardado no trae posiciones: `features/diagram/scene.ts` calcula el layout con dagre (igual que el frontend). El lienzo (`DiagramCanvas`) usa `react-native-svg` y `PanResponder` (pan, pinch, doble toque), con la lógica de gestos en `canvas-controller.ts`.
- Si cambias `canonical-model` en el backend o el frontend, actualiza `src/types/canonical-model.ts` (y `analysis/backend-dto.ts`, espejo de `frontend/src/api/models-api.ts`).
- `useAsync` es el único hook de carga; mantiene deps explícitas a propósito (ver el comentario del archivo).
- Textos de UI en español. Tests junto al código (`*.test.ts`).

### Notación de los diagramas (UML 2.5)

Los diagramas se dibujan con la notación estándar, no con el estilo de la UI: cajas blancas, línea de tinta de 1.5 px, sin sombra ni colores de relleno. Está en `features/diagram/draw.ts` (primitivas `DrawOp`); `SceneSvg.tsx` las pinta con react-native-svg y `to-svg-string.ts` las convierte a SVG de texto.

- **Clase**: 3 compartimentos siempre (nombre, atributos, operaciones). Abstracta = nombre en cursiva; estático = subrayado. Atributo `+ nombre : tipo [mult] = valor {id}`; operación `+ nombre(out p : tipo) : retorno` (`: void` se omite).
- **Relaciones**, siempre con el marcador en el extremo **destino** (igual que el editor web/Apollon): generalización = triángulo hueco; realización = discontinua + triángulo hueco; dependencia = discontinua + flecha abierta en V; agregación = rombo hueco; composición = rombo relleno; asociación = línea sin flecha (el canónico no guarda navegabilidad). Multiplicidades junto a cada extremo, evitando cajas. Clase de asociación = línea discontinua al punto medio de su asociación.
- **Componentes**: «component» con icono, interfaces como círculo (lollipop), `provided` = línea sólida al círculo, `required` = dependencia; puertos como cuadrados sobre el borde; conector entre un puerto provisto y uno requerido de la misma interfaz = bola-y-socket.
- **Diagrama de BD** (`features/analysis/tables-scene.ts`): Perfil UML de datos: clase «Table» con `«PK»`/`«FK»`, `{NOT NULL}` y asociaciones `0..*` — `1`.
- Revisión visual: `UML_PREVIEW_DIR=/tmp/uml npx vitest run draw` escribe SVG; conviértelos con `magick -density 150 x.svg x.png`.
- Posible inconsistencia previa del repo: el exportador XMI (`backend/app/modules/xmi/profiles/ea.py`) marca `aggregation` en el extremo destino de la asociación, mientras el editor dibuja el rombo en el destino. Si el rombo sale invertido respecto a un XMI importado, revisar ahí.

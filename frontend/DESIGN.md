# UMLForge — Sistema de diseño del frontend

Estilo: **Bauhaus / Neo-brutalista de estudio**. Fondo crema cálido, superficies blancas, tinta negra y sombras duras sin desenfoque. Es la identidad de `AuthPage`, `TopMenuBar` y `AIAssistantSidebar`, y los demás paneles deben alinearse con ella. Los tokens viven en `src/style.css` (`:root` y `@theme`).

## Principios

1. **Contorno de tinta**: todo elemento elevado lleva borde `#1a1a1a` y sombra dura desplazada. Nunca sombras difusas en componentes nuevos.
2. **Color como acento**: lo neutro (crema, blanco, tinta) domina; amarillo, durazno y pasteles marcan estado o énfasis.
3. **Flotante**: barra superior y paneles laterales son tarjetas que flotan con margen sobre el lienzo, no barras pegadas al borde.
4. **Táctil**: hover = se levanta 1px y gana sombra dura; activo = fondo durazno.
5. **El lienzo manda**: el editor Apollon ocupa todo el espacio restante; la UI no le roba área sin necesidad.

## Color

### Base
| Token | Valor | Uso |
|---|---|---|
| `--bg-cream` | `#f8f6f0` | Fondo de la app, hover de ítems |
| `--bg-cream-alt` | `#f3efe6` | Fondo secundario |
| `--bg-card` / blanco | `#ffffff` | Tarjetas, barra, paneles |
| `--ink-black` | `#1a1a1a` | Texto, bordes, sombras |
| `--ink-gray` | `#666666` | Texto secundario, iconos inactivos |

### Acento
| Token | Valor | Uso |
|---|---|---|
| `--shape-yellow` | `#f7d273` | Formas decorativas, acento principal |
| `--shape-peach` | `#fcb580` | Formas decorativas |
| `--btn-peach` | `#f7c58c` | Botón primario, estado activo |
| `--btn-peach-hover` | `#f5b974` | Hover del primario |
| `--holst-100…900` | `#FFF3D8` a `#5A4A0D` | Escala ocre (también `--color-holst-*` en Tailwind) |

### Pasteles (etiquetas, estados, avatares)
`--pastel-mint #a7f3d0` · `--pastel-sky #bae6fd` · `--pastel-lilac #e9d5ff` · `--pastel-yellow #fde68a` · `--pastel-peach #fed7aa`

### Semántico (ya en uso)
- Error: fondo `#fee2e2`, texto `#991b1b`, acento `#dc2626`
- Éxito: texto `#166534`, acento `#86efac`
- Neutros de apoyo (paneles de datos): `#64748b`, `#94a3b8`, `#334155`, `#e2e8f0`, `#f1f5f9`
- Colaboración: violeta `#7c3aed` para presencia/cursores

> Regla: no añadas un hex nuevo si hay token. Si hace falta un color, defínelo primero en `:root`.

## Tipografía

- Sans: `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` (`--sans`). Base **14px**.
- Mono: `ui-monospace, Consolas, 'SF Mono', monospace` (`--mono`), para código, IDs, salidas E2E y logs.
- Pesos: 600 en botones y menús, 700 en activos y etiquetas de panel, 800 en marca y titulares.
- `-webkit-font-smoothing: antialiased`.
- Inter no se importa por `@font-face` en el repo (cae a la fuente del sistema). Si quieres fidelidad exacta, agrégala en `index.html`.

## Forma

### Bordes
- `--border-ink: 2px solid #1a1a1a`: tarjetas, barra, paneles, diálogos.
- `--border-ink-thin: 1.5px solid #1a1a1a`: botones, inputs, chips.

### Sombras duras
- `--shadow-hard-sm: 2px 2px 0 #1a1a1a` (botones en hover/activo)
- `--shadow-hard: 3px 3px 0 #1a1a1a` (barra superior, botones flotantes)
- `--shadow-hard-lg: 4px 4px 0 #1a1a1a` (paneles laterales, diálogos)

### Radios
| Radio | Uso |
|---|---|
| 16px | Barra superior, paneles laterales, diálogos |
| 12px | Botones flotantes, tarjetas internas |
| 10px | Botones de menú, inputs |
| 8px / 6px | Chips, ítems de lista, badges pequeños |
| 9999px | Avatares y pastillas de estado |

## Layout

- Raíz `.case-app`: columna a pantalla completa, `overflow: hidden`.
- `--toolbar-height: 56px`. La `TopMenuBar` flota con `margin: 8px 14px`.
- Zona principal `.case-main`: `flex: 1`, `position: relative`; el editor se ancla con `inset: 0`.
- Panel de IA: `position: fixed; top: 72px; right: 14px; bottom: 14px; width: 390px` (máx. `100vw - 28px`). Colapsado: `translateX(calc(100% + 28px))`, opacidad 0, transición `0.28s cubic-bezier(0.16, 1, 0.3, 1)`.
- Capas (z-index): barra 1000, panel de IA 999, barra de herramientas heredada 100.
- Responsive: punto de corte principal **768px** (la barra pasa a `MobileDrawer`); secundario 640px. Fondo de `html/body` sin scroll.

## Componentes

### Botón de menú (`.top-menu-btn`)
Transparente con borde transparente → hover: fondo crema, borde tinta, `translateY(-1px)`, sombra `2px`. Activo: fondo `--btn-peach`, borde tinta, sombra `2px`, peso 700. Tamaño 13px, padding `6px 12px`, radio 10px, transición `0.15s ease`.

### Botón primario
Fondo `--btn-peach`, texto tinta, borde `--border-ink-thin`, sombra `--shadow-hard-sm`; hover `--btn-peach-hover` + levantar 1px.

### Botón secundario / fantasma
Blanco o transparente con borde tinta fino; hover crema.

### Botón de peligro
Fondo `#fee2e2`, texto `#991b1b`, mismo borde de tinta.

### Tarjeta / panel
Blanco, `--border-ink`, radio 16px, `--shadow-hard-lg`, `overflow: hidden`.

### Input
Blanco, `--border-ink-thin`, radio 10px, foco con borde tinta + sombra `2px`. Etiqueta arriba en 12px/600 `--ink-gray`.

### Diálogo (Compartir)
Telón oscuro translúcido, tarjeta blanca centrada, cabecera con título 800, cuerpo con secciones, pie con acción "Listo". Roles con `RoleSelector`: `OWNER`, `EDITOR`, `READER`. Insignias de estado: activo (verde pastel) y pendiente (amarillo pastel).

### Notificación / toast
Tarjeta pequeña con borde tinta y sombra dura; variante error (rojo suave) y éxito (verde suave). Contenedor `.case-notifications`.

### Presencia colaborativa
Avatares circulares con color por usuario, punto de estado en la lista de pares, cursores y selecciones superpuestos al lienzo (`CursorOverlay`, `SelectionOverlay`) y toasts de entrada/salida. Iconos de conexión: `idle`, `connecting`, `connected`, `synced`, `disconnected`, `error`.

### Paneles de resultado (validación, E2E, despliegue)
Tarjetas con cabecera de estado, lista de etapas y estadísticas de aserciones. Salidas técnicas en `--mono`. Colores semánticos para pasa/falla.

### AuthPage
Fondo crema con formas decorativas (rectángulos amarillo y durazno con patrón de puntos `radial-gradient(#000 2px, transparent 2px)` a 15px, borde tinta, sombra `4px`, inclinados). Marca en la esquina superior izquierda, tarjeta de formulario blanca al centro.

## Iconografía

`lucide-react`: trazo fino, tamaño 14–18px, color `--ink-black` (activo) o `--ink-gray` (inactivo).

## Movimiento

- Microinteracciones: `0.15s ease` (hover) y `0.2s ease` (cambios de estado).
- Paneles: `0.28s cubic-bezier(0.16, 1, 0.3, 1)`.
- Solo `transform` y `opacity`. Respeta `prefers-reduced-motion` en animaciones nuevas (hoy no hay reglas).

## Accesibilidad

- Contraste: tinta `#1a1a1a` sobre blanco/crema supera AA con holgura; `--ink-gray #666` sobre crema pasa AA para texto normal. Evita texto gris sobre amarillo o durazno.
- Todo botón de solo icono lleva `aria-label` y `title`.
- El foco visible debe ser claro: usa borde tinta + sombra dura, no quites `outline` sin sustituirlo.
- No comuniques estado solo con color: acompáñalo con icono o texto (ej. pasa/falla en E2E).
- Destinos táctiles >= 40px en móvil.

## Hallazgos del análisis (a corregir)

1. **Valores sueltos**: `#1a1a1a` aparece 371 veces, casi siempre con el fallback `var(--ink-black, #1a1a1a)`. Los blancos y los neutros slate (`#64748b`, `#e2e8f0`…) están hardcodeados; conviene tokenizarlos (`--surface`, `--border-subtle`, `--text-muted`).
2. **Dos lenguajes visuales**: `style.css` conserva piezas del estilo anterior (`.case-toolbar` con borde gris `#e2e8f0` y sombra difusa) junto al neo-brutalista. Migra lo que quede a este sistema.
3. **Radios dispersos**: se usan 5, 6, 7, 8, 10, 12 y 16px. Reduce a la escala de arriba (6, 8, 10, 12, 16, pastilla).
4. **Sin modo oscuro** ni `prefers-reduced-motion`. Si se añade modo oscuro, define los tokens por tema en `:root[data-theme]`.
5. **Responsive limitado**: solo 4 `@media` en `style.css` y 1 en `UserMenu.css`. El panel de IA y los diálogos necesitan revisión en <= 640px.
6. **Inter no se carga**: depende de la fuente del sistema.
7. **CSS disperso**: los estilos de `.collab-panel__*` y `.gdocs-*` están en `style.css`, no junto a su feature (ver "Deuda técnica" en `AGENTS.md`).
8. **Paleta de Apollon**: el lienzo de diagramas usa su propio tema (`@tumaet/apollon/style.css`). Si quieres coherencia total, sobrescribe sus variables CSS con los tokens de este documento.

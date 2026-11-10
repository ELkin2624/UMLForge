/** Tokens de frontend/DESIGN.md (Bauhaus / neo-brutalista). No añadas hex sueltos: defínelos aquí. */
export const colors = {
  cream: '#f8f6f0',
  creamAlt: '#f3efe6',
  card: '#ffffff',
  ink: '#1a1a1a',
  gray: '#666666',
  yellow: '#f7d273',
  peach: '#fcb580',
  btnPeach: '#f7c58c',
  btnPeachPressed: '#f5b974',
  mint: '#a7f3d0',
  sky: '#bae6fd',
  lilac: '#e9d5ff',
  pastelYellow: '#fde68a',
  pastelPeach: '#fed7aa',
  errorBg: '#fee2e2',
  errorText: '#991b1b',
  error: '#dc2626',
  successText: '#166534',
  success: '#86efac',
  slate: '#64748b',
  slateLight: '#e2e8f0',
  slateBg: '#f1f5f9',
  violet: '#7c3aed',
} as const;

export const radius = { xs: 6, sm: 8, md: 10, lg: 12, xl: 16, pill: 9999 } as const;
export const border = { thick: 2, thin: 1.5 } as const;
/** Desplazamiento de la sombra dura (sin desenfoque). */
export const shadow = { sm: 2, md: 3, lg: 4 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Destino táctil mínimo (DESIGN.md: >= 40px en móvil). */
export const MIN_TOUCH = 44;

export const font = {
  sans: undefined, // fuente del sistema, como en el frontend (Inter no se carga)
  mono: 'monospace',
  size: { xs: 11, sm: 12, base: 14, md: 16, lg: 18, xl: 22, xxl: 28 },
} as const;

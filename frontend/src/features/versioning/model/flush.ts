/**
 * Puente para forzar el guardado pendiente desde fuera del hook de autoguardado.
 * Lo usa la IA: el backend lee el diagrama del almacén, así que antes de preguntar hay que
 * asegurarse de que lo que el usuario ve ya está guardado.
 */
type FlushHandler = () => Promise<void>;

let handler: FlushHandler | null = null;

/** Lo registra `useAutosave` mientras hay un diagrama activo editable (y lo retira al salir). */
export function registerFlushHandler(next: FlushHandler | null): void {
  handler = next;
}

/** Espera confirmación; los errores impiden consultar o reemplazar un contexto sin guardar. */
export async function flushPendingSave(timeoutMs = 5000): Promise<void> {
  if (!handler) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      handler(),
      new Promise<void>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Todavía hay cambios pendientes de guardar.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

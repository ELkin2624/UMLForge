/**
 * `crypto.randomUUID` solo existe en contextos seguros (HTTPS o localhost).
 * Servida por HTTP en una IP, el navegador lo oculta y la app falla.
 * `crypto.getRandomValues` sí está disponible en cualquier contexto.
 */
function installRandomUUIDPolyfill(): void {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID === 'function') return;
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    writable: true,
    value: (): `${string}-${string}-${string}-${string}-${string}` => {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
      const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
    },
  });
}

installRandomUUIDPolyfill();

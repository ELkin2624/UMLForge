/**
 * Los lectores (rol READER) pueden recibir el documento y compartir presencia,
 * pero sus cambios al documento se descartan en el servidor.
 *
 * Protocolo y-websocket: el primer byte es el tipo de mensaje (0 = sync, 1 = awareness)
 * y, dentro de sync, el segundo es el subtipo (0 = step1 -pedir estado-, 1 = step2, 2 = update).
 * Step2 y update son escrituras.
 */
const MESSAGE_SYNC = 0;
const SYNC_STEP2 = 1;
const SYNC_UPDATE = 2;

function isWriteMessage(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return bytes[0] === MESSAGE_SYNC && (bytes[1] === SYNC_STEP2 || bytes[1] === SYNC_UPDATE);
}

/** Debe llamarse ANTES de setupWSConnection para filtrar los listeners que registre. */
function restrictToReadOnly(conn) {
  const on = conn.on.bind(conn);
  conn.on = (event, listener) =>
    event === 'message'
      ? on(event, (data, ...rest) => {
          if (!isWriteMessage(data)) listener(data, ...rest);
        })
      : on(event, listener);
}

module.exports = { isWriteMessage, restrictToReadOnly };

const decoding = require("lib0/decoding");
const encoding = require("lib0/encoding");

/** Un navegador solo publica presencia humana, nunca la identidad del agente. */
function protectAgentPresence(conn, serverClientId) {
  const on = conn.on.bind(conn);
  let ownClientId;
  conn.on = (event, listener) =>
    event !== "message"
      ? on(event, listener)
      : on(event, (data, ...rest) => {
          try {
            const decoder = decoding.createDecoder(new Uint8Array(data));
            if (decoding.readVarUint(decoder) !== 1)
              return listener(data, ...rest);
            const update = decoding.createDecoder(
              decoding.readVarUint8Array(decoder),
            );
            const count = decoding.readVarUint(update);
            if (count > 1000) return;
            const states = [];
            for (let i = 0; i < count; i++) {
              const id = decoding.readVarUint(update),
                clock = decoding.readVarUint(update);
              const state = JSON.parse(decoding.readVarString(update));
              if (id === serverClientId) continue;
              if (ownClientId === undefined && state) ownClientId = id;
              if (id !== ownClientId) continue;
              if (state) {
                state.user = { ...(state.user || {}), isAgent: false };
                delete state.agent;
                if (
                  state.cursor &&
                  (!Number.isFinite(state.cursor.x) ||
                    !Number.isFinite(state.cursor.y))
                )
                  delete state.cursor;
              }
              states.push({ id, clock, state });
            }
            const sanitized = encoding.createEncoder();
            encoding.writeVarUint(sanitized, states.length);
            for (const { id, clock, state } of states) {
              encoding.writeVarUint(sanitized, id);
              encoding.writeVarUint(sanitized, clock);
              encoding.writeVarString(sanitized, JSON.stringify(state));
            }
            const message = encoding.createEncoder();
            encoding.writeVarUint(message, 1);
            encoding.writeVarUint8Array(
              message,
              encoding.toUint8Array(sanitized),
            );
            listener(encoding.toUint8Array(message), ...rest);
          } catch {
            conn.close(1007, "Invalid awareness");
          }
        });
}
module.exports = { protectAgentPresence };

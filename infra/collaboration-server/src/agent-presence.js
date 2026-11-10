const yUtils = require('y-websocket/bin/utils');

/** Identidad visible del agente de IA en la sala (la ven todos los clientes). */
const AGENT_USER = { name: 'Asistente IA', color: '#8B5CF6', isAgent: true };

/**
 * Muestra u oculta al agente como un participante más de la sala (awareness de Yjs).
 * Es solo presencia: el agente no escribe en el documento desde aquí.
 */
function applyAgentPresence(docName, enabled) {
  const doc = yUtils.getYDoc(docName);
  doc.getMap('room').set('agent_enabled', enabled);
  const { awareness } = doc;
  const present = awareness.getLocalState() !== null;
  if (enabled && !present) awareness.setLocalState({ user: { ...AGENT_USER }, agent: {status:'idle', timestamp:Date.now()} });
  if (!enabled && present) awareness.setLocalState(null);
}

module.exports = { AGENT_USER, applyAgentPresence };

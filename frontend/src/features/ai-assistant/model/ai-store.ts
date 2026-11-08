import { create } from 'zustand';
import * as Y from 'yjs';
import { AIPatch, AIPresenceState, AuditLogEntry, ChatMessage } from '../types';
import {
  collaborateWithAI,
  fetchPrivateHistory,
  clearPrivateHistory,
  fetchAuditFeed,
  logAuditEvent,
} from '../api/ai-api';
import { useModelStore } from '../../../store/model-store';
import { flushPendingSave, markAiChange } from '../../versioning';
import { UMLModel } from '../../../types/canonical-model';
import { useCommandHistory } from '../../uml-commands';
import { getModelJson, setModelJson, LOCAL_ORIGIN } from '../../collaboration';
import { useShareStore } from '../../sharing/model/share-store';
import { canEdit } from '../../sharing/model/capabilities';
import { captureBase } from './patch-to-commands';
import { approveBatch } from './approval';

function generateRandomId(): string {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
}

const emptyModel = (): UMLModel => ({
  classes: [],
  relationships: [],
  components: [],
  interfaces: [],
  diagrams: [],
});

/** Estado MÁS reciente: el del Y.Doc si hay sala (no el del store, que puede ir un paso atrás). */
function readLatestModel(ydoc: Y.Doc | null): UMLModel {
  if (ydoc) {
    const json = getModelJson(ydoc);
    if (json) {
      try {
        return JSON.parse(json) as UMLModel;
      } catch {
        console.warn('[IA] JSON inválido en el Y.Doc; se usa el modelo del store.');
      }
    }
  }
  return structuredClone(useModelStore.getState().model ?? emptyModel());
}

interface AIAssistantState {
  // Estado privado del usuario
  privateHistory: ChatMessage[];
  activeTab: 'chat' | 'audit' | 'suggestions';
  isThinking: boolean;
  error: string | null;

  // Estado compartido (Yjs + NoSQL)
  aiPresence: AIPresenceState;
  suggestions: Record<string, AIPatch>;
  auditFeed: AuditLogEntry[];

  // Acciones
  setActiveTab: (tab: 'chat' | 'audit' | 'suggestions') => void;
  loadHistory: (diagramId: string, userId: string) => Promise<void>;
  clearHistory: (diagramId: string, userId: string) => Promise<void>;
  loadAuditFeed: (diagramId: string) => Promise<void>;
  sendMessage: (params: {
    diagramId: string;
    userId: string;
    userName: string;
    prompt: string;
    imageBase64?: string;
    ydoc: Y.Doc | null;
  }) => Promise<void>;
  approvePatch: (params: {
    diagramId: string;
    patchId: string;
    userName: string;
    ydoc: Y.Doc | null;
  }) => Promise<void>;
  /** Aprueba varias sugerencias como un lote atómico (todas o ninguna). */
  approvePatches: (params: {
    diagramId: string;
    patchIds: string[];
    ydoc: Y.Doc | null;
  }) => Promise<void>;
  /** Aprueba todas las sugerencias vigentes (no obsoletas). */
  approveAll: (params: { diagramId: string; ydoc: Y.Doc | null }) => Promise<void>;
  /** Pide al agente que vuelva a proponer una sugerencia obsoleta sobre el estado actual. */
  reproposePatch: (params: {
    diagramId: string;
    patchId: string;
    userId: string;
    userName: string;
    ydoc: Y.Doc | null;
  }) => Promise<void>;
  rejectPatch: (params: {
    diagramId: string;
    patchId: string;
    userName: string;
    ydoc: Y.Doc | null;
  }) => Promise<void>;
  syncWithYjs: (doc: Y.Doc | null) => () => void;
}

export const useAIAssistantStore = create<AIAssistantState>((set, get) => ({
  privateHistory: [
    {
      id: 'welcome',
      role: 'system',
      content:
        '👋 Hola. Soy tu Arquitecto Central de Software. Este chat es completamente privado para ti, pero conozco todo el diseño y las decisiones del equipo en el lienzo.',
      patches: [],
      timestamp: new Date().toISOString(),
    },
  ],
  activeTab: 'chat',
  isThinking: false,
  error: null,

  aiPresence: {
    status: 'observing',
    consultingWith: null,
    color: '#8B5CF6',
    timestamp: Date.now(),
  },
  suggestions: {},
  auditFeed: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadHistory: async (diagramId, _userId) => {
    try {
      const history = await fetchPrivateHistory(diagramId);
      if (history && history.length > 0) {
        set({ privateHistory: history });
      }
    } catch (err: any) {
      console.warn('No se pudo cargar historial privado de IA:', err);
    }
  },

  clearHistory: async (diagramId, _userId) => {
    try {
      await clearPrivateHistory(diagramId);
      set({
        privateHistory: [
          {
            id: 'welcome-' + Date.now(),
            role: 'system',
            content: 'Historial privado limpiado. Puedes iniciar una nueva conversación.',
            patches: [],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (err: any) {
      console.error('Error al limpiar historial:', err);
    }
  },

  loadAuditFeed: async (diagramId) => {
    try {
      const feed = await fetchAuditFeed(diagramId);
      set({ auditFeed: feed || [] });
    } catch (err) {
      console.warn('Error al cargar feed de auditoría:', err);
    }
  },

  sendMessage: async ({ diagramId, userName, prompt, imageBase64, ydoc }) => {
    if ((!prompt.trim() && !imageBase64) || get().isThinking) return;

    // 1. Mensaje temporal del usuario en el chat privado local
    const userMsgId = 'user-' + Date.now();
    const newMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: prompt || (imageBase64 ? '📸 Imagen/Boceto adjuntado' : ''),
      image: imageBase64,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      privateHistory: [...state.privateHistory, newMsg],
      isThinking: true,
      error: null,
    }));

    // 2. Notificar Presencia de la IA a todos los colaboradores mediante Yjs
    const presenceState: AIPresenceState = {
      status: 'thinking',
      consultingWith: userName,
      color: '#8B5CF6',
      timestamp: Date.now(),
    };

    if (ydoc) {
      const aiPresenceMap = ydoc.getMap<AIPresenceState>('ai_presence');
      aiPresenceMap.set('state', presenceState);
    }
    set({ aiPresence: presenceState });

    try {
      // 3. Capturar snapshot actual del lienzo
      const currentModel: UMLModel = useModelStore.getState().model || {
        classes: [],
        relationships: [],
        components: [],
        interfaces: [],
        diagrams: [],
      };

      // 3b. El backend lee el diagrama del almacén: guardar antes lo que el usuario ve ahora
      await flushPendingSave();
      const selectedId = useModelStore.getState().selectedNodeId;

      // 4. Enviar interacción privada al backend con memoria compartida NoSQL
      const res = await collaborateWithAI({
        diagramId,
        prompt: prompt.trim() || 'Por favor analiza este boceto/diagrama adjunto e incorpora las entidades y relaciones correspondientes al lienzo.',
        imageBase64,
        currentCanvasSnapshot: currentModel,
        selection: selectedId ? [selectedId] : [],
      });

      // 5. Insertar sugerencias generadas en el mapa compartido de Yjs
      // Las huellas se capturan contra el snapshot que se ENVIÓ a la IA: si alguien toca esos
      // elementos antes de aprobar, el motor detecta el conflicto en lugar de pisar su cambio.
      const rawPatches: AIPatch[] = (res.patches || []).map((patch: AIPatch) => ({
        ...patch,
        base: captureBase(currentModel, patch),
      }));
      if (rawPatches.length > 0) {
        if (ydoc) {
          const ySuggestions = ydoc.getMap<AIPatch>('ai_suggestions');
          ydoc.transact(() => {
            rawPatches.forEach((patch) => {
              ySuggestions.set(patch.patch_id, patch);
            });
          }, 'ai-assistant-patch');
        } else {
          // Modo local sin Yjs activo
          const newSuggestions = { ...get().suggestions };
          rawPatches.forEach((patch) => {
            newSuggestions[patch.patch_id] = patch;
          });
          set({ suggestions: newSuggestions });
        }
      }

      // Las eliminaciones siempre requieren aprobación explícita, incluso en modo directo.
      const direct = !res.simulated && res.execution_mode === 'DIRECT'
        ? rawPatches.filter((p) => !p.operation.startsWith('DELETE_'))
        : [];
      if (direct.length && ydoc) {
        set({ suggestions: ydoc.getMap<AIPatch>('ai_suggestions').toJSON() });
      }
      if (direct.length) {
        await get().approvePatches({ diagramId, patchIds: direct.map((p) => p.patch_id), ydoc });
      }
      const applyError = direct.length ? get().error : null;
      const pendingCount = rawPatches.length - (applyError ? 0 : direct.length);
      const outcome = [
        direct.length && !applyError ? `Se aplicaron ${direct.length} cambios.` : '',
        pendingCount ? `${pendingCount} cambios quedan pendientes de aprobación.` : '',
        applyError ? `No se aplicaron los cambios: ${applyError}` : '',
      ].filter(Boolean).join(' ');

      // 6. Agregar respuesta de la IA al historial privado del usuario
      const assistantMsg: ChatMessage = {
        id: 'model-' + Date.now(),
        role: 'model',
        content: res.simulated
          ? `⚠️ Respuesta simulada: no se pudo contactar al modelo de IA.\n\n${res.reply}`
          : `${res.reply}${outcome ? `\n\n${outcome}` : ''}`,
        patches: rawPatches,
        timestamp: new Date().toISOString(),
      };

      // Avisar si la IA vio solo una parte del diagrama
      const contextNotice: ChatMessage[] = res.context?.truncated
        ? [
            {
              id: 'ctx-' + Date.now(),
              role: 'system',
              content: `ℹ️ El diagrama es grande (${res.context.classes} clases): la IA vio un resumen de ~${res.context.approx_tokens} tokens y parte quedó omitida. Selecciona un elemento para darle más detalle.`,
              timestamp: new Date().toISOString(),
            },
          ]
        : [];

      set((state) => ({
        privateHistory: [...state.privateHistory, assistantMsg, ...contextNotice],
        isThinking: false,
      }));

      // 7. Refrescar auditoría si hubo decisiones de diseño
      if (res.shared_decision_note) {
        get().loadAuditFeed(diagramId);
      }
    } catch (err: any) {
      console.error('Error al colaborar con la IA:', err);
      set((state) => ({
        error: err.message || 'Error al comunicarse con la IA',
        isThinking: false,
        privateHistory: [
          ...state.privateHistory,
          {
            id: 'err-' + Date.now(),
            role: 'system',
            content: `⚠️ Error: ${err.message || 'No se pudo contactar a la IA'}`,
            timestamp: new Date().toISOString(),
          },
        ],
      }));
    } finally {
      // Restaurar presencia de la IA a 'observing'
      const finalPresence: AIPresenceState = {
        status: 'observing',
        consultingWith: null,
        color: '#8B5CF6',
        timestamp: Date.now(),
      };
      if (get().aiPresence.status !== 'editing_canvas') {
        if (ydoc) {
          const aiPresenceMap = ydoc.getMap<AIPresenceState>('ai_presence');
          aiPresenceMap.set('state', finalPresence);
        }
        set({ aiPresence: finalPresence });
      }
    }
  },

  approvePatch: async ({ diagramId, patchId, ydoc }) => {
    await get().approvePatches({ diagramId, patchIds: [patchId], ydoc });
  },

  approveAll: async ({ diagramId, ydoc }) => {
    const ids = Object.values(get().suggestions)
      .filter((p) => p.status !== 'stale')
      .map((p) => p.patch_id);
    await get().approvePatches({ diagramId, patchIds: ids, ydoc });
  },

  approvePatches: async ({ diagramId, patchIds, ydoc }) => {
    const patches = patchIds
      .map((id) => get().suggestions[id])
      .filter((p): p is AIPatch => Boolean(p) && p.status !== 'stale');
    if (patches.length === 0) return;

    // Solo OWNER/EDITOR pueden aplicar cambios (el servidor Yjs también descarta los de un lector)
    if (!canEdit(useShareStore.getState().localRole)) {
      set({ error: 'Tu rol es de solo lectura: no puedes aprobar cambios.' });
      return;
    }

    // Todo ocurre de forma síncrona (sin await entre leer y escribir): ningún cambio remoto
    // puede colarse entre la lectura del estado y la escritura del resultado.
    const result = approveBatch(readLatestModel(ydoc), patches, generateRandomId);

    if (!result.ok) {
      if (result.code === 'STALE') {
        // Obsoletas: se conservan marcadas para poder re-proponerlas o descartarlas
        const markStale = (p: AIPatch): AIPatch => ({ ...p, status: 'stale', stale_reason: result.message });
        if (ydoc) {
          const ySuggestions = ydoc.getMap<AIPatch>('ai_suggestions');
          ydoc.transact(() => {
            result.staleIds.forEach((id) => {
              const p = ySuggestions.get(id);
              if (p) ySuggestions.set(id, markStale(p));
            });
          }, 'ai-assistant-stale');
        } else {
          const updated = { ...get().suggestions };
          result.staleIds.forEach((id) => {
            if (updated[id]) updated[id] = markStale(updated[id]);
          });
          set({ suggestions: updated });
        }
      }
      set({ error: result.message });
      return;
    }
    set({ error: null });

    // Escritura única: el modelo nuevo y la retirada de las sugerencias van en UNA transacción
    // Yjs, de modo que ningún cliente ve el modelo cambiado con la sugerencia aún pendiente.
    markAiChange(); // el autoguardado atribuirá la versión a la IA
    const store = useModelStore.getState();
    if (ydoc) {
      ydoc.transact(() => {
        setModelJson(ydoc, JSON.stringify(result.model), LOCAL_ORIGIN);
        const ySuggestions = ydoc.getMap<AIPatch>('ai_suggestions');
        patchIds.forEach((id) => ySuggestions.delete(id));
      }, LOCAL_ORIGIN);
      store.setModel(result.model); // el binding ve el mismo JSON y no lo vuelve a publicar
    } else {
      store.setModel(result.model);
      const updated = { ...get().suggestions };
      patchIds.forEach((id) => delete updated[id]);
      set({ suggestions: updated });
    }

    useCommandHistory.getState().record(
      diagramId,
      {
        id: patchIds.join('+'),
        label:
          patches.length === 1
            ? `${patches[0].operation} ${patches[0].target}`
            : `${patches.length} cambios de la IA`,
        author: 'ai',
        forward: result.forward,
        inverse: result.inverse,
        touched: result.touched,
      },
      result.model,
    );

    // Anunciar los elementos realmente afectados; cada cliente dibuja su propio cursor.
    const targets = result.touched.filter((id) => result.model.classes.some((cls) => cls.id === id));
    targets.forEach((targetId, index) => {
      setTimeout(() => {
        const presence: AIPresenceState = {
          status: 'editing_canvas', consultingWith: null, color: '#8B5CF6',
          timestamp: Date.now(), targetId, expiresAt: Date.now() + 2500,
        };
        if (ydoc) ydoc.getMap<AIPresenceState>('ai_presence').set('state', presence);
        set({ aiPresence: presence });
      }, index * 700);
    });

    // Registrar en auditoría (una entrada por sugerencia aprobada)
    try {
      for (const patch of patches) {
        await logAuditEvent(
          diagramId,
          `Aprobó sugerencia de IA: ${patch.operation} en ${patch.target || patch.data?.source} (${patch.reason})`,
        );
      }
      get().loadAuditFeed(diagramId);
    } catch (e) {
      console.warn('Error registrando auditoría:', e);
    }
  },

  reproposePatch: async ({ diagramId, patchId, userId, userName, ydoc }) => {
    const patch = get().suggestions[patchId];
    if (!patch) return;
    const details = JSON.stringify(patch.data ?? {}).slice(0, 1500);
    await get().sendMessage({
      diagramId,
      userId,
      userName,
      ydoc,
      prompt:
        `Tu sugerencia anterior quedó obsoleta porque el diagrama cambió. Vuelve a proponerla ` +
        `sobre el estado ACTUAL: ${patch.operation} ${patch.target} (${patch.reason}). Datos previos: ${details}`,
    });
    if (ydoc) {
      ydoc.getMap<AIPatch>('ai_suggestions').delete(patchId);
    } else {
      const updated = { ...get().suggestions };
      delete updated[patchId];
      set({ suggestions: updated });
    }
  },

  rejectPatch: async ({ diagramId, patchId, ydoc }) => {
    const patch = get().suggestions[patchId];
    if (ydoc) {
      const ySuggestions = ydoc.getMap<AIPatch>('ai_suggestions');
      ySuggestions.delete(patchId);
    } else {
      const updated = { ...get().suggestions };
      delete updated[patchId];
      set({ suggestions: updated });
    }

    if (patch) {
      try {
        await logAuditEvent(
          diagramId,
          `Rechazó sugerencia de IA: ${patch.operation} en ${patch.target}`
        );
        get().loadAuditFeed(diagramId);
      } catch (e) {
        console.warn('Error registrando auditoría:', e);
      }
    }
  },

  syncWithYjs: (doc: Y.Doc | null) => {
    if (!doc) return () => {};

    const aiPresenceMap = doc.getMap<AIPresenceState>('ai_presence');
    const ySuggestions = doc.getMap<AIPatch>('ai_suggestions');

    // Inicializar estado de presencia si existe en Yjs
    const currentPresence = aiPresenceMap.get('state');
    if (currentPresence) {
      set({ aiPresence: currentPresence });
    }

    // Inicializar sugerencias si existen en Yjs
    set({ suggestions: ySuggestions.toJSON() });

    // Observar presencia de la IA en tiempo real
    const onPresenceChange = () => {
      const val = aiPresenceMap.get('state');
      if (val) {
        set({ aiPresence: val });
      }
    };
    aiPresenceMap.observe(onPresenceChange);

    // Observar sugerencias compartidas en tiempo real
    const onSuggestionsChange = () => {
      set({ suggestions: ySuggestions.toJSON() });
    };
    ySuggestions.observe(onSuggestionsChange);

    return () => {
      aiPresenceMap.unobserve(onPresenceChange);
      ySuggestions.unobserve(onSuggestionsChange);
    };
  },
}));

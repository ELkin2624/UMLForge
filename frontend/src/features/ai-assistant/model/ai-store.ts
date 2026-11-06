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
import { markAiChange } from '../../versioning';
import { UMLModel } from '../../../types/canonical-model';
import { applyCommands } from '../../uml-commands';
import { useShareStore } from '../../sharing/model/share-store';
import { canEdit } from '../../sharing/model/capabilities';
import { patchToCommands } from './patch-to-commands';

function generateRandomId(): string {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
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

  loadHistory: async (diagramId, userId) => {
    try {
      const history = await fetchPrivateHistory(diagramId, userId);
      if (history && history.length > 0) {
        set({ privateHistory: history });
      }
    } catch (err: any) {
      console.warn('No se pudo cargar historial privado de IA:', err);
    }
  },

  clearHistory: async (diagramId, userId) => {
    try {
      await clearPrivateHistory(diagramId, userId);
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

  sendMessage: async ({ diagramId, userId, userName, prompt, imageBase64, ydoc }) => {
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

      // 4. Enviar interacción privada al backend con memoria compartida NoSQL
      const res = await collaborateWithAI({
        diagramId,
        userId,
        userName,
        prompt: prompt.trim() || 'Por favor analiza este boceto/diagrama adjunto e incorpora las entidades y relaciones correspondientes al lienzo.',
        imageBase64,
        currentCanvasSnapshot: currentModel,
      });

      // 5. Insertar sugerencias generadas en el mapa compartido de Yjs
      const rawPatches: AIPatch[] = res.patches || [];
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

      // 6. Agregar respuesta de la IA al historial privado del usuario
      const assistantMsg: ChatMessage = {
        id: 'model-' + Date.now(),
        role: 'model',
        content: res.reply,
        patches: rawPatches,
        timestamp: new Date().toISOString(),
      };

      set((state) => ({
        privateHistory: [...state.privateHistory, assistantMsg],
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
      if (ydoc) {
        const aiPresenceMap = ydoc.getMap<AIPresenceState>('ai_presence');
        aiPresenceMap.set('state', finalPresence);
      }
      set({ aiPresence: finalPresence });
    }
  },

  approvePatch: async ({ diagramId, patchId, userName, ydoc }) => {
    const patch = get().suggestions[patchId];
    if (!patch) return;

    // Solo OWNER/EDITOR pueden aplicar cambios (el servidor Yjs también descarta los de un lector)
    if (!canEdit(useShareStore.getState().localRole)) {
      set({ error: 'Tu rol es de solo lectura: no puedes aprobar cambios.' });
      return;
    }

    // Aplicar patch al modelo UML en Zustand
    const currentModel: UMLModel = JSON.parse(
      JSON.stringify(
        useModelStore.getState().model || {
          classes: [],
          relationships: [],
          components: [],
          interfaces: [],
          diagrams: [],
        }
      )
    );

    // La traducción (nombres -> ids) y la validación viven en el motor de comandos
    const translation = patchToCommands(currentModel, patch, generateRandomId);
    if (!translation.ok) {
      set({ error: translation.message });
      return;
    }
    const result = applyCommands(currentModel, translation.commands);
    if (!result.ok) {
      set({ error: result.message });
      return;
    }
    set({ error: null });

    // Actualizar el lienzo definitivo (el autoguardado atribuirá la versión a la IA)
    markAiChange();
    useModelStore.getState().setModel(result.model);

    // Quitar sugerencia de Yjs o store local
    if (ydoc) {
      const ySuggestions = ydoc.getMap<AIPatch>('ai_suggestions');
      ySuggestions.delete(patchId);
    } else {
      const updated = { ...get().suggestions };
      delete updated[patchId];
      set({ suggestions: updated });
    }

    // Registrar en auditoría
    try {
      await logAuditEvent(
        diagramId,
        userName,
        `Aprobó sugerencia de IA: ${patch.operation} en ${patch.target} (${patch.reason})`
      );
      get().loadAuditFeed(diagramId);
    } catch (e) {
      console.warn('Error registrando auditoría:', e);
    }
  },

  rejectPatch: async ({ diagramId, patchId, userName, ydoc }) => {
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
          userName,
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

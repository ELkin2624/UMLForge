import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { UMLModel } from '../types/canonical-model';
import { E2EResult, E2EUiState } from '../types/api-responses';
import type { CollaborationStatus, CollaborationUiState, PeerInfo } from '../features/collaboration';

export type DiagramViewType = 'class' | 'component';

const DEFAULT_COLLABORATION: CollaborationUiState = {
  status: 'idle',
  roomName: null,
  peersCount: 0,
  peers: [],
  localClientId: null,
  displayName: '',
  error: null,
};

interface ModelStore {
  model: UMLModel | null;
  diagramType: DiagramViewType;
  selectedNodeId: string | null;
  setModel: (model: UMLModel | null) => void;
  setDiagramType: (diagramType: DiagramViewType) => void;
  setSelectedNodeId: (id: string | null) => void;
  clearModel: () => void;

  // E2E UI State
  e2eState: E2EUiState;
  e2eResult: E2EResult | null;
  e2eError: string | null;
  e2eStartedAt: number | null;
  e2eCompletedAt: number | null;

  // Setters (pure actions)
  setE2EState: (state: E2EUiState) => void;
  setE2EResult: (result: E2EResult | null) => void;
  setE2EError: (error: string | null) => void;
  setE2EStartedAt: (time: number | null) => void;
  setE2ECompletedAt: (time: number | null) => void;
  resetE2E: () => void;

  // ── Colaboración ──────────────────────────────────────────────────────────
  // NOTA: Solo estado de UI observable. Y.Doc, WebsocketProvider y Awareness
  // NO se almacenan aquí; viven en CollaborationManager.
  collaboration: CollaborationUiState;

  /**
   * Aviso que se muestra cuando el modelo local fue reemplazado por el modelo
   * de la sala al conectarse. Solo se setea cuando hay un reemplazo real.
   * Se limpia manualmente o al desconectar.
   */
  roomNameWarning: string | null;

  setCollaborationStatus: (status: CollaborationStatus) => void;
  setCollaborationRoom: (roomName: string | null) => void;
  setPeersCount: (count: number) => void;
  setPeers: (peers: PeerInfo[]) => void;
  setLocalClientId: (id: number | null) => void;
  setCollaborationDisplayName: (name: string) => void;
  setCollaborationError: (error: string | null) => void;
  setRoomNameWarning: (warning: string | null) => void;
  resetCollaboration: () => void;
}

export const useModelStore = create<ModelStore>()(
  subscribeWithSelector((set) => ({
    model: null,
    diagramType: 'class',
    selectedNodeId: null,
    setModel: (model) => set({ model }),
    setDiagramType: (diagramType) => set({ diagramType }),
    setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
    clearModel: () => set({ model: null, selectedNodeId: null }),

    // E2E UI State defaults
    e2eState: 'idle',
    e2eResult: null,
    e2eError: null,
    e2eStartedAt: null,
    e2eCompletedAt: null,

    setE2EState: (e2eState) => set({ e2eState }),
    setE2EResult: (e2eResult) => set({ e2eResult }),
    setE2EError: (e2eError) => set({ e2eError }),
    setE2EStartedAt: (e2eStartedAt) => set({ e2eStartedAt }),
    setE2ECompletedAt: (e2eCompletedAt) => set({ e2eCompletedAt }),
    resetE2E: () =>
      set({
        e2eState: 'idle',
        e2eResult: null,
        e2eError: null,
        e2eStartedAt: null,
        e2eCompletedAt: null,
      }),

    // ── Colaboración ────────────────────────────────────────────────────────
    collaboration: {
      status: 'idle',
      roomName: null,
      peersCount: 0,
      peers: [],
      localClientId: null,
      displayName: '',
      error: null,
    },
    roomNameWarning: null,

    // Acciones Colaborativas (UI)
    setCollaborationStatus: (status) =>
      set((s) => ({ collaboration: { ...s.collaboration, status } })),

    setCollaborationRoom: (roomName) =>
      set((s) => ({ collaboration: { ...s.collaboration, roomName } })),

    setPeersCount: (peersCount) =>
      set((s) => ({ collaboration: { ...s.collaboration, peersCount } })),

    setPeers: (peers) =>
      set((s) => ({ collaboration: { ...s.collaboration, peers } })),

    setLocalClientId: (localClientId) =>
      set((s) => ({ collaboration: { ...s.collaboration, localClientId } })),
    setCollaborationDisplayName: (displayName) =>
      set((s) => ({ collaboration: { ...s.collaboration, displayName } })),

    setCollaborationError: (error) =>
      set((s) => ({ collaboration: { ...s.collaboration, error } })),

    setRoomNameWarning: (roomNameWarning) => set({ roomNameWarning }),

    resetCollaboration: () =>
      set({ collaboration: { ...DEFAULT_COLLABORATION }, roomNameWarning: null }),
  }))
);

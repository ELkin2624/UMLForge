// UI
export { CollaborationPanel } from './ui/CollaborationPanel';
export { CursorOverlay } from './ui/CursorOverlay';
export { SelectionOverlay } from './ui/SelectionOverlay';
export { PresenceToasts } from './ui/PresenceToasts';
export { StatusIcon } from './ui/StatusIcon';

// Hooks
export { useCollaboration } from './model/use-collaboration';
export { usePresence } from './model/use-presence';

// Model & Managers
export { CollaborationManager } from './model/collaboration-manager';
export { getOrCreateLocalIdentity, setupAwareness } from './model/awareness';
export {
  extractVisualStateFromModel,
  getVisualStateDelta,
  getVisualStateDeletions,
  applyVisualStateToModel,
} from './model/visual-state-manager';
export { bindYjsToStore, LOCAL_ORIGIN } from './model/yjs-bindings';
export {
  createYjsDocument,
  getModelMap,
  getModelJson,
  setModelJson,
} from './model/yjs-document';

// API
export { YWebSocketProvider } from './api/websocket-provider';
export type { ICollaborationProvider } from './api/provider';

// Types
export type {
  CollaborationStatus,
  PeerInfo,
  LocalIdentity,
  CollaborationUiState,
} from './model/types';

import { useState, useEffect } from 'react';
import { ApollonEditor } from './components/ApollonEditor';
import { TopMenuBar } from './components/TopMenuBar';
import { ValidationPanel } from './components/ValidationPanel';
import { DeploymentResultPanel } from './components/DeploymentResultPanel';
import { E2EResultPanel } from './components/E2EResultPanel';
import { LoadingOverlay } from './components/LoadingOverlay';
import { Notification } from './components/Notification';
import { CollaborationPanel } from './components/CollaborationPanel';
import { PresenceToasts } from './components/presence/PresenceToasts';
import { VoiceAssistantChat } from './components/VoiceAssistantChat';
import { ShareDialog } from './features/sharing/ui/ShareDialog';
import { ValidationResult, DeploymentResult } from './types/api-responses';
import { useModelStore } from './store/model-store';
import { parseInviteFromUrl, clearInviteParamsFromUrl } from './features/sharing/model/invite-utils';
import { useShareStore } from './features/sharing/model/share-store';
import { useCollaboration } from './hooks/use-collaboration';
import { useAuthStore } from './features/auth/store';
import { AuthPage } from './features/auth/ui/AuthPage';
import './style.css';

function App() {
  const [validationRes, setValidationRes] = useState<ValidationResult | null>(null);
  const [deploymentRes, setDeploymentRes] = useState<DeploymentResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const e2eResult = useModelStore(s => s.e2eResult);
  const e2eError = useModelStore(s => s.e2eError);
  const setE2EResult = useModelStore(s => s.setE2EResult);
  const setE2EError = useModelStore(s => s.setE2EError);

  const { connect } = useCollaboration();
  const { joinSession } = useShareStore();

  const token = useAuthStore(s => s.token);

  useEffect(() => {
    const invite = parseInviteFromUrl();
    if (invite) {
      joinSession(invite.roomId, 'EDITOR');
      connect(invite.roomId);
      clearInviteParamsFromUrl();
    } else if (token) {
      const loadDiagrams = async () => {
        try {
          const { request } = await import('./api/client');
          const diagrams = await request<any[]>('/diagrams');
          if (diagrams && diagrams.length > 0) {
            const first = diagrams[0];
            const role = first.owner_id === useAuthStore.getState().user?.id ? 'OWNER' : 'EDITOR';
            joinSession(first.id.toString(), role as any);
            
            if (first.data && Object.keys(first.data).length > 0) {
               useModelStore.getState().setModel(first.data as any);
            }
          }
        } catch (e) {
          console.error('Error loading diagrams:', e);
        }
      };
      loadDiagrams();
    }
  }, [token]);

  if (!token) {
    return <AuthPage />;
  }

  return (
    <div className="case-app">

      {/* ── Barra de Menús Superior (Estilo IDE / StarUML) ── */}
      <TopMenuBar
        onValidation={setValidationRes}
        onDeploy={setDeploymentRes}
        onError={setErrorMsg}
      />

      {/* ── Área Principal con Lienzo Apollon ── */}
      <div className="case-main">
        <ApollonEditor />

        {/* Paneles flotantes validación/deploy — position:absolute top-right */}
        <div className="case-side-panels">
          <ValidationPanel result={validationRes} onClose={() => setValidationRes(null)} />
          <DeploymentResultPanel result={deploymentRes} onClose={() => setDeploymentRes(null)} />
        </div>
      </div>

      {/* ── Overlays globales: position fixed, fuera del flujo ── */}

      {/* LoadingOverlay */}
      <LoadingOverlay />

      {/* Notificaciones flotantes top-right */}
      <div className="case-notifications">
        <PresenceToasts />
        {errorMsg && (
          <Notification
            type="error"
            message={errorMsg}
            onClose={() => setErrorMsg(null)}
          />
        )}
        {e2eError && (
          <Notification
            type="error"
            message={e2eError}
            onClose={() => setE2EError(null)}
          />
        )}
      </div>

      {/* Panel E2E — position:fixed bottom, clase case-result-panel */}
      {/* No toca el layout del editor Apollon en absoluto */}
      <E2EResultPanel result={e2eResult} onClose={() => setE2EResult(null)} />

      {/* ── Colaboración — position:fixed inferior-izquierda ── */}
      {/* No modifica el layout del lienzo. No provoca resize/reflow del editor. */}
      <CollaborationPanel />

      {/* ── Asistente de Voz / Chat Sidebar ── */}
      <VoiceAssistantChat />

      {/* ── Diálogo de Compartir (Google Docs style) — portal modal ── */}
      <ShareDialog />

    </div>
  );
}

export default App;

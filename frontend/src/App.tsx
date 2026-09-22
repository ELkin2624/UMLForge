import { useState, useEffect } from 'react';
import { ApollonEditor } from './components/ApollonEditor';
import { TopMenuBar } from './components/TopMenuBar';
import { ValidationPanel, E2EResultPanel, LoadingOverlay } from './features/model-validation';
import { DeploymentResultPanel } from './features/project-deployment';
import { Notification } from './shared/ui';
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
  const { startSession, joinSession } = useShareStore();

  const token = useAuthStore(s => s.token);
  const [authChecked, setAuthChecked] = useState(false);

  // Inicialización de sesión: verificar cookies activas o hidratar perfil si token existe
  useEffect(() => {
    let isMounted = true;
    const initSession = async () => {
      const currentToken = useAuthStore.getState().token;
      const currentUser = useAuthStore.getState().user;
      if (!currentToken) {
        // Intentar refresco silencioso en segundo plano con la cookie HttpOnly
        try {
          const { refreshToken } = await import('./api/client');
          await refreshToken();
        } catch {}
      } else if (!currentUser || !currentUser.email) {
        try {
          const { request } = await import('./api/client');
          const userData = await request<any>('/auth/me');
          if (isMounted && userData?.id) {
            useAuthStore.getState().setUser(userData);
          }
        } catch {}
      }
      if (isMounted) {
        setAuthChecked(true);
      }
    };
    initSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const invite = parseInviteFromUrl();
    if (!token) {
      if (invite) {
        try {
          // Usar localStorage para persistir entre sesiones (no sessionStorage)
          localStorage.setItem('umlforge-pending-invite', JSON.stringify(invite));
        } catch {}
      }
      return;
    }

    let activeInvite = invite;
    if (!activeInvite) {
      try {
        const stored = localStorage.getItem('umlforge-pending-invite');
        if (stored) {
          activeInvite = JSON.parse(stored);
        }
      } catch {}
    }

    if (activeInvite) {
      try {
        localStorage.removeItem('umlforge-pending-invite');
      } catch {}

      // Formato deep-link: ?invite=<invitationId> → llamar API y unirse
      if (activeInvite.invitationId) {
        const acceptAndJoin = async () => {
          try {
            const { request } = await import('./api/client');
            const res = await request<{ success: boolean; diagram_id: number; diagram_name: string; role: string }>(
              `/invitations/${activeInvite!.invitationId}/accept`,
              { method: 'POST' }
            );
            if (res && res.diagram_id) {
              const roomStr = res.diagram_id.toString();
              try {
                sessionStorage.setItem('umlforge-active-diagram', roomStr);
                sessionStorage.setItem('umlforge-collab-active', 'true');
                const url = new URL(window.location.href);
                url.searchParams.set('diagram', roomStr);
                window.history.replaceState({}, '', url.toString());
              } catch {}

              joinSession(roomStr, res.role as any);
              connect(roomStr);
              // Cargar datos del diagrama
              try {
                const diagramData = await request<any>(`/diagrams/${res.diagram_id}`);
                if (diagramData?.data && (diagramData.data.classes?.length || diagramData.data.components?.length)) {
                  useModelStore.getState().setModel(diagramData.data);
                }
              } catch (e) {
                console.warn('Invitación aceptada pero no se pudo cargar el diagrama:', e);
              }
            }
          } catch (e: any) {
            console.warn('No se pudo aceptar la invitación automáticamente:', e.message);
          } finally {
            clearInviteParamsFromUrl();
          }
        };
        acceptAndJoin();
        return;
      }

      // Formato legacy: ?room=...&token=...
      if (activeInvite.roomId) {
        const assignedRole = activeInvite.role || 'EDITOR';
        try {
          sessionStorage.setItem('umlforge-active-diagram', activeInvite.roomId);
          sessionStorage.setItem('umlforge-collab-active', 'true');
        } catch {}
        joinSession(activeInvite.roomId, assignedRole);
        connect(activeInvite.roomId);
        clearInviteParamsFromUrl();
        return;
      }
    }

    // Sin invite pendiente: cargar diagrama del usuario respetando el activo y sin auto-conectar
    const loadDiagrams = async () => {
      try {
        const { request } = await import('./api/client');
        const diagrams = await request<any[]>('/diagrams');
        if (diagrams && diagrams.length > 0) {
          const currentUserId = useAuthStore.getState().user?.id;
          const urlParams = new URLSearchParams(window.location.search);
          const diagramParam = urlParams.get('diagram');
          const storedDiagramId = diagramParam || sessionStorage.getItem('umlforge-active-diagram');

          // Seleccionar diagrama:
          // 1. Si hay uno específico en URL o sessionStorage al que tenga acceso
          // 2. Si no, su propio diagrama (owner)
          // 3. Si no, el primero de la lista
          let target = diagrams.find(d => storedDiagramId && d.id.toString() === storedDiagramId);
          if (!target) {
            target = diagrams.find(d => d.owner_id === currentUserId) || diagrams[0];
          }

          const isOwner = target.owner_id === currentUserId;
          const role = isOwner ? 'OWNER' : (target.my_role || 'EDITOR');
          const roomStr = target.id.toString();

          try {
            sessionStorage.setItem('umlforge-active-diagram', roomStr);
          } catch {}

          useShareStore.getState().setRoomId(roomStr);
          useShareStore.getState().setLocalRole(role);

          // Cargar datos completos del diagrama en Zustand
          try {
            const fullDiagram = await request<any>(`/diagrams/${target.id}`);
            if (fullDiagram?.data && (fullDiagram.data.classes?.length || fullDiagram.data.components?.length)) {
              useModelStore.getState().setModel(fullDiagram.data as any);
            }
          } catch {
            if (target.data && (target.data.classes?.length || target.data.components?.length)) {
              useModelStore.getState().setModel(target.data as any);
            }
          }

          // Solo conectar WebSocket si el usuario estaba activamente en una sesión colaborativa
          const isCollabActive = sessionStorage.getItem('umlforge-collab-active') === 'true';
          if (isCollabActive) {
            if (isOwner) {
              startSession(roomStr);
            } else {
              joinSession(roomStr, role);
            }
            connect(roomStr);
          }
        } else {
          // Si el usuario no tiene ningún diagrama, inicializar uno en PostgreSQL
          const newDiag = await request<any>('/diagrams', {
            method: 'POST',
            body: JSON.stringify({ name: 'Parcial1-SW1', data: {} })
          });
          if (newDiag && newDiag.id) {
            const roomStr = newDiag.id.toString();
            try {
              sessionStorage.setItem('umlforge-active-diagram', roomStr);
            } catch {}
            useShareStore.getState().setRoomId(roomStr);
            useShareStore.getState().setLocalRole('OWNER');
          }
        }
      } catch (e) {
        console.error('Error loading diagrams:', e);
      }
    };
    loadDiagrams();
  }, [token]);

  if (!authChecked && !token) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0d14', color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#e8b84a', marginBottom: '8px' }}>UMLForge</div>
          <div style={{ fontSize: '13px' }}>Cargando sesión...</div>
        </div>
      </div>
    );
  }

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

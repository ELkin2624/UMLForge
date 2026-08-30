import { useState } from 'react';
import { ApollonEditor } from './components/ApollonEditor';
import { Toolbar } from './components/Toolbar';
import { ValidationPanel } from './components/ValidationPanel';
import { DeploymentResultPanel } from './components/DeploymentResultPanel';
import { E2EResultPanel } from './components/E2EResultPanel';
import { LoadingOverlay } from './components/LoadingOverlay';
import { Notification } from './components/Notification';
import { ValidationResult, DeploymentResult } from './types/api-responses';
import { useModelStore } from './store/model-store';
import './style.css';

function App() {
  const [validationRes, setValidationRes] = useState<ValidationResult | null>(null);
  const [deploymentRes, setDeploymentRes] = useState<DeploymentResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { e2eResult, e2eError, setE2EResult, setE2EError } = useModelStore();

  return (
    // .case-app: flex column, 100vw × 100vh
    <div className="case-app">

      {/* ── Toolbar: flex: 0 0 auto, altura fija (--toolbar-height) ── */}
      <Toolbar
        onValidation={setValidationRes}
        onDeploy={setDeploymentRes}
        onError={setErrorMsg}
      />

      {/* ── Área principal: flex: 1 1 auto, position: relative ── */}
      {/* El editor Apollon ocupa position:absolute inset:0 dentro */}
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

    </div>
  );
}

export default App;

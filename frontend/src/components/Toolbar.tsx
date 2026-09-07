import { useState } from 'react';
import { Play, Check, Download, Zap, Loader2, Network, Save } from 'lucide-react';
import { useModelStore } from '../store/model-store';
import { useE2EValidation } from '../hooks/use-e2e-validation';
import { validateModel, generateProject, deployProject } from '../api/models-api';
import { ValidationResult, DeploymentResult } from '../types/api-responses';
import { FileImportExport } from './FileImportExport';
import { ShareButton } from '../features/sharing/ui/ShareButton';
import { UserMenu } from '../features/auth/ui/UserMenu';
import { NotificationsMenu } from '../features/auth/ui/NotificationsMenu';
import { useShareStore } from '../features/sharing/model/share-store';
import { canEdit } from '../features/sharing/model/capabilities';
import { request } from '../api/client';

interface ToolbarProps {
  onValidation: (res: ValidationResult | null) => void;
  onDeploy: (res: DeploymentResult | null) => void;
  onError: (err: string | null) => void;
}

export const Toolbar = ({ onValidation, onDeploy, onError }: ToolbarProps) => {
  const { model } = useModelStore();
  const { e2eState, runE2EValidation } = useE2EValidation();
  const localRole = useShareStore(s => s.localRole);
  const [loading, setLoading] = useState(false);

  const isBusy = loading || e2eState === 'running' || !canEdit(localRole);

  const handleValidate = async () => {
    if (!model || isBusy) return;
    setLoading(true);
    onError(null);
    try {
      const res = await validateModel(model);
      onValidation(res);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!model || isBusy) return;
    setLoading(true);
    onError(null);
    try {
      const blob = await generateProject(model);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${model.name || 'project'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!model || isBusy) return;
    setLoading(true);
    onError(null);
    try {
      const res = await deployProject(model);
      onDeploy(res);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleE2E = async () => {
    if (!model || isBusy) return;
    onError(null);
    await runE2EValidation();
  };

  const handleSave = async () => {
    const roomId = useShareStore.getState().roomId;
    if (!model || isBusy || !roomId) return;
    setLoading(true);
    onError(null);
    try {
      await request(`/diagrams/${roomId}`, {
        method: 'PUT',
        body: JSON.stringify({ data: model })
      });
      // Mostrar toast opcional
    } catch (e: any) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="case-toolbar">
      {/* ── Indicador de Diagrama de Clases UML 2.5+ ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
        <Network size={15} color="#4f46e5" />
        <span>Diagrama de Clases UML 2.5+</span>
      </div>

      <div className="separator" />

      <button id="btn-save" disabled={!model || isBusy} onClick={handleSave}>
        <Save size={15} /> Guardar
      </button>

      <button id="btn-validate" disabled={!model || isBusy} onClick={handleValidate}>
        <Check size={15} /> Validar
      </button>

      <button id="btn-generate" disabled={!model || isBusy} onClick={handleGenerate}>
        <Download size={15} /> Generar ZIP
      </button>

      <button id="btn-deploy" disabled={!model || isBusy} onClick={handleDeploy}>
        <Play size={15} /> Deploy &amp; Test
      </button>

      {/* Botón primario E2E */}
      <button
        id="btn-e2e"
        className="primary"
        disabled={!model || isBusy}
        onClick={handleE2E}
      >
        {e2eState === 'running' ? (
          <>
            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Validando E2E...</span>
          </>
        ) : (
          <>
            <Zap size={15} />
            <span>Validación E2E</span>
          </>
        )}
      </button>

      <div className="separator" />

      <FileImportExport disabled={isBusy} />

      {loading && (
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          Procesando...
        </span>
      )}

      {/* ── ShareButton: siempre en el extremo derecho de la toolbar ── */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <NotificationsMenu />
        <ShareButton disabled={isBusy} />
        <div className="separator" style={{ margin: '0 5px' }} />
        <UserMenu />
      </div>
    </div>
  );
};

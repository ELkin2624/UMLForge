import { useState } from 'react';
import { Play, Check, Download, Zap, Loader2, Network, Box } from 'lucide-react';
import { useModelStore } from '../store/model-store';
import { useE2EValidation } from '../hooks/use-e2e-validation';
import { validateModel, generateProject, deployProject } from '../api/models-api';
import { ValidationResult, DeploymentResult } from '../types/api-responses';
import { FileImportExport } from './FileImportExport';

interface ToolbarProps {
  onValidation: (res: ValidationResult | null) => void;
  onDeploy: (res: DeploymentResult | null) => void;
  onError: (err: string | null) => void;
}

export const Toolbar = ({ onValidation, onDeploy, onError }: ToolbarProps) => {
  const { model, diagramType, setDiagramType } = useModelStore();
  const { e2eState, runE2EValidation } = useE2EValidation();
  const [loading, setLoading] = useState(false);

  const isBusy = loading || e2eState === 'running';

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

  return (
    <div className="case-toolbar">
      {/* ── Selector de Tipo de Diagrama ── */}
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
        <button
          id="btn-diagram-class"
          style={{
            background: diagramType === 'class' ? '#ffffff' : 'transparent',
            boxShadow: diagramType === 'class' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            fontWeight: diagramType === 'class' ? 600 : 400,
            color: diagramType === 'class' ? '#0f172a' : '#64748b',
          }}
          disabled={isBusy}
          onClick={() => setDiagramType('class')}
        >
          <Network size={14} /> Clases
        </button>
        <button
          id="btn-diagram-component"
          style={{
            background: diagramType === 'component' ? '#ffffff' : 'transparent',
            boxShadow: diagramType === 'component' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            fontWeight: diagramType === 'component' ? 600 : 400,
            color: diagramType === 'component' ? '#0f172a' : '#64748b',
          }}
          disabled={isBusy}
          onClick={() => setDiagramType('component')}
        >
          <Box size={14} /> Componentes
        </button>
      </div>

      <div className="separator" />

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
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b' }}>
          Procesando...
        </span>
      )}
    </div>
  );
};

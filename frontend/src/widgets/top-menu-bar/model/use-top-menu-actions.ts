import { useState, useRef } from 'react';
import { useModelStore } from '../../../store/model-store';
import { useE2EValidation } from '../../../hooks/use-e2e-validation';
import { useShareStore } from '../../../features/sharing/model/share-store';
import { canEdit } from '../../../features/sharing/model/capabilities';
import {
  saveDiagram,
  validateModel,
  generateProject,
  deployProject,
  importXMI,
  exportXMI,
} from '../api';
import {
  downloadBlob,
  calculateModelStats,
  buildGenerationPreviewMessage,
  promptLocalOutputPath,
} from './file-utils';
import { GenState, TopMenuBarProps } from './types';

interface UseTopMenuActionsOptions extends TopMenuBarProps {
  onBeforeAction?: () => void;
}

export function useTopMenuActions({
  onValidation,
  onDeploy,
  onError,
  onBeforeAction,
}: UseTopMenuActionsOptions) {
  const model = useModelStore(s => s.model);
  const setModel = useModelStore(s => s.setModel);
  const { e2eState, runE2EValidation } = useE2EValidation();
  const localRole = useShareStore(s => s.localRole);

  const [loading, setLoading] = useState(false);
  const [genState, setGenState] = useState<GenState>('READY');
  const [genMessage, setGenMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = loading || e2eState === 'running' || !canEdit(localRole);

  const handleSave = async () => {
    onBeforeAction?.();
    const roomId = useShareStore.getState().roomId;
    if (!model || isBusy || !roomId) return;

    setLoading(true);
    onError(null);
    try {
      await saveDiagram(roomId, model);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    onBeforeAction?.();
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

  const handleGenerate = async (isLocal = false) => {
    onBeforeAction?.();
    if (!model || isBusy) return;

    // Resumen previo de estadísticas
    const stats = calculateModelStats(model);
    const previewMsg = buildGenerationPreviewMessage(stats);
    if (!window.confirm(previewMsg)) return;

    let localPath: string | undefined = undefined;
    if (isLocal) {
      const selectedPath = promptLocalOutputPath();
      if (!selectedPath) return; // Cancelado por el usuario
      localPath = selectedPath;
    }

    setGenState('VALIDATING');
    setLoading(true);
    onError(null);

    try {
      // 1. Validar modelo primero
      const valRes = await validateModel(model);
      if (!valRes.is_valid) {
        setGenState('ERROR');
        setGenMessage('Error en validación');
        onValidation(valRes);
        setLoading(false);
        return;
      }

      // 2. Generar código
      setGenState('GENERATING');
      const response = await generateProject(model, localPath);

      if (isLocal) {
        setGenState('SUCCESS');
        setGenMessage(`¡Generado en ${localPath}!`);
      } else {
        downloadBlob(response as Blob, `${model.name || 'project'}.zip`);
        setGenState('SUCCESS');
        setGenMessage('¡Descarga exitosa!');
      }
    } catch (e: any) {
      setGenState('ERROR');
      setGenMessage(e.message);
      onError(e.message);
    } finally {
      setLoading(false);
      setTimeout(() => setGenState('READY'), 3000);
    }
  };

  const handleDeploy = async () => {
    onBeforeAction?.();
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
    onBeforeAction?.();
    if (!model || isBusy) return;

    onError(null);
    await runE2EValidation();
  };

  const handleExportXMI = async () => {
    onBeforeAction?.();
    if (!model) return;

    setLoading(true);
    try {
      const blob = await exportXMI(model);
      downloadBlob(blob, `${model.name || 'model'}.xmi`);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportXMIClick = () => {
    onBeforeAction?.();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const { model: importedModel, warnings } = await importXMI(file);
      setModel(importedModel);
      if (warnings && warnings.length > 0) {
        console.warn('XMI Warnings:', warnings);
      }
    } catch (err: any) {
      onError(err.message || 'Error al importar el archivo XMI');
    } finally {
      setLoading(false);
    }
    e.target.value = '';
  };

  return {
    model,
    loading,
    genState,
    genMessage,
    isBusy,
    localRole,
    fileInputRef,
    handleSave,
    handleValidate,
    handleGenerate,
    handleDeploy,
    handleE2E,
    handleExportXMI,
    handleImportXMIClick,
    handleFileChange,
  };
}

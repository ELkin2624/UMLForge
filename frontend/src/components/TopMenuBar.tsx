import React, { useState, useRef, useEffect } from 'react';
import { 
  Network, ChevronDown, Save, FileUp, FileDown, Download, Check, Zap, Play, 
  Loader2
} from 'lucide-react';
import { useModelStore } from '../store/model-store';
import { useE2EValidation } from '../hooks/use-e2e-validation';
import { validateModel, generateProject, deployProject, importXMI, exportXMI } from '../api/models-api';
import { ValidationResult, DeploymentResult } from '../types/api-responses';
import { ShareButton } from '../features/sharing/ui/ShareButton';
import { UserMenu } from '../features/auth/ui/UserMenu';
import { NotificationsMenu } from '../features/auth/ui/NotificationsMenu';
import { useShareStore } from '../features/sharing/model/share-store';
import { canEdit } from '../features/sharing/model/capabilities';
import { request } from '../api/client';
import './TopMenuBar.css';

interface TopMenuBarProps {
  onValidation: (res: ValidationResult | null) => void;
  onDeploy: (res: DeploymentResult | null) => void;
  onError: (err: string | null) => void;
}

export const TopMenuBar: React.FC<TopMenuBarProps> = ({
  onValidation,
  onDeploy,
  onError
}) => {
  const model = useModelStore(s => s.model);
  const setModel = useModelStore(s => s.setModel);
  const { e2eState, runE2EValidation } = useE2EValidation();
  const localRole = useShareStore(s => s.localRole);
  const [loading, setLoading] = useState(false);

  const [activeMenu, setActiveMenu] = useState<'file' | 'validate' | 'deploy' | 'share' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [genState, setGenState] = useState<'READY' | 'VALIDATING' | 'GENERATING' | 'SUCCESS' | 'ERROR'>('READY');
  const [genMessage, setGenMessage] = useState('');

  const isBusy = loading || e2eState === 'running' || !canEdit(localRole);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.top-menu-item-container')) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menu: 'file' | 'validate' | 'deploy' | 'share') => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleSave = async () => {
    setActiveMenu(null);
    const roomId = useShareStore.getState().roomId;
    if (!model || isBusy || !roomId) return;
    setLoading(true);
    onError(null);
    try {
      await request(`/diagrams/${roomId}`, {
        method: 'PUT',
        body: JSON.stringify({ data: model })
      });
    } catch (e: any) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setActiveMenu(null);
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
    setActiveMenu(null);
    if (!model || isBusy) return;

    // Preview
    const classCount = model.classes?.length || 0;
    const attrCount = model.classes?.reduce((sum, c) => sum + (c.attributes?.length || 0), 0) || 0;
    const opCount = model.classes?.reduce((sum, c) => sum + (c.operations?.length || 0), 0) || 0;
    const relCount = model.relationships?.length || 0;
    
    const previewMsg = `Resumen a generar:\nClases: ${classCount}\nAtributos: ${attrCount}\nOperaciones: ${opCount}\nRelaciones: ${relCount}\n\n¿Deseas continuar?`;
    if (!window.confirm(previewMsg)) return;

    setGenState('VALIDATING');
    setLoading(true);
    onError(null);
    
    try {
      // 1. Validar primero
      const valRes = await validateModel(model);
      if (!valRes.is_valid) {
        setGenState('ERROR');
        setGenMessage('Error en validación');
        onValidation(valRes);
        setLoading(false);
        return;
      }
      
      // 2. Generar
      setGenState('GENERATING');
      const blob = await generateProject(model);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${model.name || 'project'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setGenState('SUCCESS');
      setGenMessage('¡Descarga exitosa!');
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
    setActiveMenu(null);
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
    setActiveMenu(null);
    if (!model || isBusy) return;
    onError(null);
    await runE2EValidation();
  };

  const handleExportXMI = async () => {
    setActiveMenu(null);
    if (!model) return;
    setLoading(true);
    try {
      const blob = await exportXMI(model);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${model.name || 'model'}.xmi`;
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

  const handleImportXMIClick = () => {
    setActiveMenu(null);
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
        console.warn("XMI Warnings:", warnings);
        // You could also show a toast notification here
      }
    } catch (err: any) {
      onError(err.message || "Error al importar el archivo XMI");
    } finally {
      setLoading(false);
    }
    e.target.value = '';
  };

  return (
    <header className="top-menu-bar">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xmi,.xml" style={{ display: 'none' }} />

      <div className="top-menu-left">
        <div className="top-menu-brand">
          <Network size={18} color="#818cf8" />
          <span>UMLForge CASE Tool</span>
          <span className="top-menu-badge">UML 2.5+</span>
        </div>

        <nav className="top-menu-items">
          {/* Menu Archivo */}
          <div className="top-menu-item-container">
            <button 
              onClick={() => toggleMenu('file')} 
              className={`top-menu-btn ${activeMenu === 'file' ? 'active' : ''}`}
            >
              <span>Archivo</span>
              <ChevronDown size={14} />
            </button>

            {activeMenu === 'file' && (
              <div className="top-menu-dropdown">
                <button onClick={handleSave} disabled={!model || isBusy} className="top-dropdown-item">
                  <div className="top-dropdown-item-left">
                    <Save size={15} color="#4f46e5" />
                    <span>Guardar Modelo</span>
                  </div>
                  <span className="top-dropdown-shortcut">Ctrl+S</span>
                </button>

                <div className="top-dropdown-divider" />

                <button onClick={handleImportXMIClick} disabled={isBusy} className="top-dropdown-item">
                  <div className="top-dropdown-item-left">
                    <FileUp size={15} color="#16a34a" />
                    <span>Importar XMI</span>
                  </div>
                </button>

                <button onClick={handleExportXMI} disabled={!model || isBusy} className="top-dropdown-item">
                  <div className="top-dropdown-item-left">
                    <FileDown size={15} color="#0284c7" />
                    <span>Exportar XMI</span>
                  </div>
                </button>

                <div className="top-dropdown-divider" />

                <button onClick={handleGenerate} disabled={!model || isBusy} className="top-dropdown-item">
                  <div className="top-dropdown-item-left">
                    <Download size={15} color="#d97706" />
                    <span>Generar Proyecto SpringBoot (ZIP)</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Menu Validación */}
          <div className="top-menu-item-container">
            <button 
              onClick={() => toggleMenu('validate')} 
              className={`top-menu-btn ${activeMenu === 'validate' ? 'active' : ''}`}
            >
              <span>Validación</span>
              <ChevronDown size={14} />
            </button>

            {activeMenu === 'validate' && (
              <div className="top-menu-dropdown">
                <button onClick={handleValidate} disabled={!model || isBusy} className="top-dropdown-item">
                  <div className="top-dropdown-item-left">
                    <Check size={15} color="#16a34a" />
                    <span>Validar Sintaxis UML</span>
                  </div>
                </button>

                <button onClick={handleE2E} disabled={!model || isBusy} className="top-dropdown-item">
                  <div className="top-dropdown-item-left">
                    <Zap size={15} color="#4f46e5" />
                    <span>Validación E2E Completa</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Menu Despliegue */}
          <div className="top-menu-item-container">
            <button 
              onClick={() => toggleMenu('deploy')} 
              className={`top-menu-btn ${activeMenu === 'deploy' ? 'active' : ''}`}
            >
              <span>Despliegue</span>
              <ChevronDown size={14} />
            </button>

            {activeMenu === 'deploy' && (
              <div className="top-menu-dropdown">
                <button onClick={handleDeploy} disabled={!model || isBusy} className="top-dropdown-item">
                  <div className="top-dropdown-item-left">
                    <Play size={15} color="#d97706" />
                    <span>Deploy &amp; Test (Servidor Staging)</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Menu Compartir */}
          <div className="top-menu-item-container">
            <button 
              onClick={() => toggleMenu('share')} 
              className={`top-menu-btn ${activeMenu === 'share' ? 'active' : ''}`}
            >
              <span>Colaborar</span>
              <ChevronDown size={14} />
            </button>

            {activeMenu === 'share' && (
              <div className="top-menu-dropdown">
                <div style={{ padding: '6px' }}>
                  <ShareButton disabled={isBusy} />
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="top-menu-right">
        {genState !== 'READY' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: genState === 'ERROR' ? '#f87171' : genState === 'SUCCESS' ? '#4ade80' : '#a5b4fc' }}>
            {['VALIDATING', 'GENERATING'].includes(genState) && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {genState === 'SUCCESS' && <Check size={14} />}
            <span>{genState} {genMessage}</span>
          </div>
        )}
        {loading && genState === 'READY' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#a5b4fc' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Procesando...</span>
          </div>
        )}
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
};

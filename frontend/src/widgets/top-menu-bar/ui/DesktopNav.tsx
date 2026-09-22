import React from 'react';
import {
  ChevronDown,
  Save,
  FileUp,
  FileDown,
  Download,
  FolderSync,
  CheckCircle2,
  Sparkles,
  PlayCircle,
} from 'lucide-react';
import { ActiveMenuType } from '../model/types';

interface DesktopNavProps {
  activeMenu: ActiveMenuType;
  toggleMenu: (menu: 'file' | 'validate' | 'deploy' | 'share') => void;
  isBusy: boolean;
  hasModel: boolean;
  onSave: () => void;
  onImportXMI: () => void;
  onExportXMI: () => void;
  onGenerate: (isLocal: boolean) => void;
  onValidate: () => void;
  onE2E: () => void;
  onDeploy: () => void;
}

export const DesktopNav: React.FC<DesktopNavProps> = ({
  activeMenu,
  toggleMenu,
  isBusy,
  hasModel,
  onSave,
  onImportXMI,
  onExportXMI,
  onGenerate,
  onValidate,
  onE2E,
  onDeploy,
}) => {
  return (
    <nav className="top-menu-items">
      {/* Menú Archivo */}
      <div className="top-menu-item-container">
        <button
          onClick={() => toggleMenu('file')}
          className={`top-menu-btn ${activeMenu === 'file' ? 'active' : ''}`}
          aria-expanded={activeMenu === 'file'}
        >
          <span>Archivo</span>
          <ChevronDown size={13} className="menu-arrow-icon" />
        </button>

        {activeMenu === 'file' && (
          <div className="top-menu-dropdown">
            <div className="top-dropdown-header">Gestión de Diagrama</div>

            <button
              onClick={onSave}
              disabled={!hasModel || isBusy}
              className="top-dropdown-item"
            >
              <div className="top-dropdown-item-left">
                <div className="dropdown-icon-badge badge-yellow">
                  <Save size={14} color="#1a1a1a" />
                </div>
                <div className="dropdown-text-stack">
                  <span className="dropdown-item-title">Guardar Modelo</span>
                  <span className="dropdown-item-desc">Persistir cambios en PostgreSQL</span>
                </div>
              </div>
              <span className="top-dropdown-shortcut">Ctrl+S</span>
            </button>

            <button
              onClick={onImportXMI}
              disabled={isBusy}
              className="top-dropdown-item"
            >
              <div className="top-dropdown-item-left">
                <div className="dropdown-icon-badge badge-mint">
                  <FileUp size={14} color="#1a1a1a" />
                </div>
                <div className="dropdown-text-stack">
                  <span className="dropdown-item-title">Importar XMI</span>
                  <span className="dropdown-item-desc">Cargar estándar UML (.xmi, .xml)</span>
                </div>
              </div>
            </button>

            <button
              onClick={onExportXMI}
              disabled={!hasModel || isBusy}
              className="top-dropdown-item"
            >
              <div className="top-dropdown-item-left">
                <div className="dropdown-icon-badge badge-sky">
                  <FileDown size={14} color="#1a1a1a" />
                </div>
                <div className="dropdown-text-stack">
                  <span className="dropdown-item-title">Exportar XMI</span>
                  <span className="dropdown-item-desc">Descargar esquema interoperable</span>
                </div>
              </div>
            </button>

            <div className="top-dropdown-divider" />
            <div className="top-dropdown-header">Generación de Código</div>

            <button
              onClick={() => onGenerate(false)}
              disabled={!hasModel || isBusy}
              className="top-dropdown-item creative-featured-card"
            >
              <div className="top-dropdown-item-left">
                <div className="dropdown-icon-badge badge-peach">
                  <Download size={14} color="#1a1a1a" />
                </div>
                <div className="dropdown-text-stack">
                  <span className="dropdown-item-title">Generar SpringBoot (ZIP)</span>
                  <span className="dropdown-item-desc">Descarga directa del proyecto Java</span>
                </div>
              </div>
              <span className="dropdown-creative-pill">Recomendado</span>
            </button>

            <button
              onClick={() => onGenerate(true)}
              disabled={!hasModel || isBusy}
              className="top-dropdown-item"
            >
              <div className="top-dropdown-item-left">
                <div className="dropdown-icon-badge badge-lilac">
                  <FolderSync size={14} color="#1a1a1a" />
                </div>
                <div className="dropdown-text-stack">
                  <span className="dropdown-item-title">Generar a Carpeta Local</span>
                  <span className="dropdown-item-desc">Exportar código a directorio del sistema</span>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Menú Validación */}
      <div className="top-menu-item-container">
        <button
          onClick={() => toggleMenu('validate')}
          className={`top-menu-btn ${activeMenu === 'validate' ? 'active' : ''}`}
          aria-expanded={activeMenu === 'validate'}
        >
          <span>Validación</span>
          <ChevronDown size={13} className="menu-arrow-icon" />
        </button>

        {activeMenu === 'validate' && (
          <div className="top-menu-dropdown">
            <div className="top-dropdown-header">Calidad &amp; Arquitectura</div>

            <button
              onClick={onValidate}
              disabled={!hasModel || isBusy}
              className="top-dropdown-item"
            >
              <div className="top-dropdown-item-left">
                <div className="dropdown-icon-badge badge-mint">
                  <CheckCircle2 size={14} color="#1a1a1a" />
                </div>
                <div className="dropdown-text-stack">
                  <span className="dropdown-item-title">Validar Sintaxis UML</span>
                  <span className="dropdown-item-desc">Verificar clases, atributos y tipos</span>
                </div>
              </div>
            </button>

            <button
              onClick={onE2E}
              disabled={!hasModel || isBusy}
              className="top-dropdown-item creative-featured-card"
            >
              <div className="top-dropdown-item-left">
                <div className="dropdown-icon-badge badge-yellow">
                  <Sparkles size={14} color="#1a1a1a" />
                </div>
                <div className="dropdown-text-stack">
                  <span className="dropdown-item-title">Validación E2E Completa</span>
                  <span className="dropdown-item-desc">Pipeline integral con assertions automáticos</span>
                </div>
              </div>
              <span className="dropdown-creative-pill yellow">E2E</span>
            </button>
          </div>
        )}
      </div>

      {/* Menú Despliegue */}
      <div className="top-menu-item-container">
        <button
          onClick={() => toggleMenu('deploy')}
          className={`top-menu-btn ${activeMenu === 'deploy' ? 'active' : ''}`}
          aria-expanded={activeMenu === 'deploy'}
        >
          <span>Despliegue</span>
          <ChevronDown size={13} className="menu-arrow-icon" />
        </button>

        {activeMenu === 'deploy' && (
          <div className="top-menu-dropdown">
            <div className="top-dropdown-header">Servidores &amp; Staging</div>

            <button
              onClick={onDeploy}
              disabled={!hasModel || isBusy}
              className="top-dropdown-item"
            >
              <div className="top-dropdown-item-left">
                <div className="dropdown-icon-badge badge-peach">
                  <PlayCircle size={14} color="#1a1a1a" />
                </div>
                <div className="dropdown-text-stack">
                  <span className="dropdown-item-title">Deploy &amp; Test (Staging)</span>
                  <span className="dropdown-item-desc">Desplegar contenedor y testear endpoints</span>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};



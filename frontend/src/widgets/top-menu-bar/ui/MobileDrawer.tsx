import React, { useState } from 'react';
import {
  Menu,
  X,
  Save,
  FileUp,
  FileDown,
  Download,
  FolderSync,
  CheckCircle2,
  Sparkles,
  PlayCircle,
  Share2,
  Users,
  LogOut,
  Layers,
  ShieldCheck,
  Eye,
  Crown,
  FileCode,
  Cpu,
  CheckSquare,
  Cloud,
} from 'lucide-react';
import { useAuthStore, getUserFallbackFromToken } from '../../../features/auth/store';
import { useShareStore } from '../../../features/sharing/model/share-store';
import { request } from '../../../api/client';

interface MobileToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const MobileToggle: React.FC<MobileToggleProps> = ({ isOpen, onToggle }) => {
  return (
    <button
      className="top-menu-mobile-toggle"
      onClick={onToggle}
      aria-label={isOpen ? "Cerrar menú" : "Abrir menú de herramientas"}
      title="Menú de herramientas"
    >
      {isOpen ? <X size={20} /> : <Menu size={20} />}
    </button>
  );
};

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
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

type TabCategory = 'all' | 'file' | 'gen' | 'val' | 'devops';

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
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
  const [activeTab, setActiveTab] = useState<TabCategory>('all');
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const clearAuth = useAuthStore(s => s.clearAuth);
  const { localRole, collaborators, roomId, openShareDialog } = useShareStore();

  if (!isOpen) return null;

  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  const handleLogout = async () => {
    onClose();
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      clearAuth();
    }
  };

  const handleOpenShare = () => {
    onClose();
    openShareDialog();
  };

  const fallbackUser = token ? getUserFallbackFromToken(token) : null;
  const effectiveUser = user || fallbackUser;

  const displayName = effectiveUser?.display_name || effectiveUser?.username || 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <div 
        className="top-menu-mobile-overlay" 
        onClick={onClose}
        aria-hidden="true" 
      />
      <aside className="top-menu-mobile-drawer" aria-label="Panel de Herramientas">
        {/* Header del Drawer */}
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-brand">
            <div className="brand-shape-box">
              <Layers size={16} className="brand-logo-icon" />
            </div>
            <div className="brand-text-group">
              <span className="brand-name">
                UML<span className="brand-highlight">Forge</span>
              </span>
            </div>
            <span className="top-menu-badge">Studio</span>
          </div>

          <button 
            className="mobile-drawer-close-btn" 
            onClick={onClose}
            aria-label="Cerrar panel lateral"
          >
            <X size={18} color="#1a1a1a" />
          </button>
        </div>

        {/* Tarjeta de Perfil de Usuario */}
        {effectiveUser && (

          <div className="mobile-user-card">
            <div className="mobile-user-avatar">
              <span>{initial}</span>
            </div>
            <div className="mobile-user-info">
              <span className="mobile-user-name">{displayName}</span>
              <div className="mobile-role-pill">
                {localRole === 'OWNER' && (
                  <>
                    <Crown size={12} className="role-icon-owner" />
                    <span>Propietario</span>
                  </>
                )}
                {localRole === 'EDITOR' && (
                  <>
                    <ShieldCheck size={12} className="role-icon-editor" />
                    <span>Editor</span>
                  </>
                )}
                {localRole === 'READER' && (
                  <>
                    <Eye size={12} className="role-icon-reader" />
                    <span>Lector</span>
                  </>
                )}
              </div>
            </div>
            <button 
              className="mobile-user-logout" 
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}

        {/* Acceso Rápido Colaboración */}
        <div className="mobile-collab-quick-banner" onClick={handleOpenShare}>
          <div className="mobile-collab-left">
            <div className="collab-pulse-indicator" />
            <div className="mobile-collab-text">
              <span className="collab-title">Colaboración en Vivo</span>
              <span className="collab-subtitle">
                {collaborators.length > 0 
                  ? `${collaborators.length + 1} participantes activos`
                  : 'Invitar con enlace'}
              </span>
            </div>
          </div>
          <div className="mobile-collab-btn">
            {collaborators.length > 0 ? <Users size={13} /> : <Share2 size={13} />}
            <span>Compartir</span>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="mobile-drawer-tabs">
          <button 
            className={`drawer-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Todas
          </button>
          <button 
            className={`drawer-tab-btn ${activeTab === 'file' ? 'active' : ''}`}
            onClick={() => setActiveTab('file')}
          >
            <FileCode size={12} />
            Archivo
          </button>
          <button 
            className={`drawer-tab-btn ${activeTab === 'gen' ? 'active' : ''}`}
            onClick={() => setActiveTab('gen')}
          >
            <Cpu size={12} />
            Generar
          </button>
          <button 
            className={`drawer-tab-btn ${activeTab === 'val' ? 'active' : ''}`}
            onClick={() => setActiveTab('val')}
          >
            <CheckSquare size={12} />
            Validar
          </button>
          <button 
            className={`drawer-tab-btn ${activeTab === 'devops' ? 'active' : ''}`}
            onClick={() => setActiveTab('devops')}
          >
            <Cloud size={12} />
            DevOps
          </button>
        </div>

        {/* Contenido con Scroll de Acciones */}
        <div className="mobile-drawer-scroll">
          {/* Sección 1: Archivo y Código */}
          {(activeTab === 'all' || activeTab === 'file') && (
            <div className="mobile-drawer-section">
              <div className="mobile-drawer-title">
                <span>Archivo &amp; Modelo</span>
              </div>
              <div className="mobile-drawer-items">
                <button
                  onClick={() => handleAction(onSave)}
                  disabled={!hasModel || isBusy}
                  className="mobile-drawer-btn"
                >
                  <div className="drawer-btn-icon badge-yellow">
                    <Save size={16} color="#1a1a1a" />
                  </div>
                  <div className="drawer-btn-content">
                    <span className="drawer-btn-label">Guardar Modelo</span>
                  </div>
                  <span className="drawer-btn-chip">Ctrl+S</span>
                </button>

                <button
                  onClick={() => handleAction(onImportXMI)}
                  disabled={isBusy}
                  className="mobile-drawer-btn"
                >
                  <div className="drawer-btn-icon badge-mint">
                    <FileUp size={16} color="#1a1a1a" />
                  </div>
                  <div className="drawer-btn-content">
                    <span className="drawer-btn-label">Importar XMI</span>
                  </div>
                  <span className="drawer-btn-tag mint">XML</span>
                </button>

                <button
                  onClick={() => handleAction(onExportXMI)}
                  disabled={!hasModel || isBusy}
                  className="mobile-drawer-btn"
                >
                  <div className="drawer-btn-icon badge-sky">
                    <FileDown size={16} color="#1a1a1a" />
                  </div>
                  <div className="drawer-btn-content">
                    <span className="drawer-btn-label">Exportar XMI</span>
                  </div>
                  <span className="drawer-btn-tag sky">XMI</span>
                </button>
              </div>
            </div>
          )}

          {/* Sección 2: Generación */}
          {(activeTab === 'all' || activeTab === 'gen') && (
            <div className="mobile-drawer-section">
              <div className="mobile-drawer-title">
                <span>Generación de Código</span>
              </div>
              <div className="mobile-drawer-items">
                <button
                  onClick={() => handleAction(() => onGenerate(false))}
                  disabled={!hasModel || isBusy}
                  className="mobile-drawer-btn creative-featured-card"
                >
                  <div className="drawer-btn-icon badge-peach">
                    <Download size={16} color="#1a1a1a" />
                  </div>
                  <div className="drawer-btn-content">
                    <span className="drawer-btn-label">Generar SpringBoot</span>
                  </div>
                  <span className="drawer-btn-tag peach">ZIP</span>
                </button>

                <button
                  onClick={() => handleAction(() => onGenerate(true))}
                  disabled={!hasModel || isBusy}
                  className="mobile-drawer-btn"
                >
                  <div className="drawer-btn-icon badge-lilac">
                    <FolderSync size={16} color="#1a1a1a" />
                  </div>
                  <div className="drawer-btn-content">
                    <span className="drawer-btn-label">Generar a Carpeta</span>
                  </div>
                  <span className="drawer-btn-tag lilac">Local</span>
                </button>
              </div>
            </div>
          )}

          {/* Sección 3: Validación */}
          {(activeTab === 'all' || activeTab === 'val') && (
            <div className="mobile-drawer-section">
              <div className="mobile-drawer-title">
                <span>Validación &amp; Calidad</span>
              </div>
              <div className="mobile-drawer-items">
                <button
                  onClick={() => handleAction(onValidate)}
                  disabled={!hasModel || isBusy}
                  className="mobile-drawer-btn"
                >
                  <div className="drawer-btn-icon badge-mint">
                    <CheckCircle2 size={16} color="#1a1a1a" />
                  </div>
                  <div className="drawer-btn-content">
                    <span className="drawer-btn-label">Validar Sintaxis UML</span>
                  </div>
                  <span className="drawer-btn-tag mint">Sintaxis</span>
                </button>

                <button
                  onClick={() => handleAction(onE2E)}
                  disabled={!hasModel || isBusy}
                  className="mobile-drawer-btn creative-featured-card"
                >
                  <div className="drawer-btn-icon badge-yellow">
                    <Sparkles size={16} color="#1a1a1a" />
                  </div>
                  <div className="drawer-btn-content">
                    <span className="drawer-btn-label">Validación E2E</span>
                  </div>
                  <span className="drawer-btn-tag yellow">E2E</span>
                </button>
              </div>
            </div>
          )}

          {/* Sección 4: Despliegue */}
          {(activeTab === 'all' || activeTab === 'devops') && (
            <div className="mobile-drawer-section">
              <div className="mobile-drawer-title">
                <span>Despliegue &amp; Nube</span>
              </div>
              <div className="mobile-drawer-items">
                <button
                  onClick={() => handleAction(onDeploy)}
                  disabled={!hasModel || isBusy}
                  className="mobile-drawer-btn"
                >
                  <div className="drawer-btn-icon badge-peach">
                    <PlayCircle size={16} color="#1a1a1a" />
                  </div>
                  <div className="drawer-btn-content">
                    <span className="drawer-btn-label">Deploy &amp; Test (Staging)</span>
                  </div>
                  <span className="drawer-btn-tag peach">Cloud</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer del Drawer */}
        <div className="mobile-drawer-footer">
          <div className="drawer-footer-status">
            <span className="status-indicator-dot" />
            <span>{roomId ? `Sala #${roomId}` : 'Modo Local'} • Listo</span>
          </div>
          <span className="drawer-version-tag">Creative Studio</span>
        </div>
      </aside>
    </>
  );
};



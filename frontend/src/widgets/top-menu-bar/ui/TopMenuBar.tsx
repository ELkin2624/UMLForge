import React, { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { SqlGenerationDialog } from '../../../features/sql-generation';
import type { UMLModel } from '../../../types/canonical-model';
import { Brand } from './Brand';
import { DesktopNav } from './DesktopNav';
import { MobileToggle, MobileDrawer } from './MobileDrawer';
import { StatusIndicators } from './StatusIndicators';
import { useTopMenuState } from '../model/use-top-menu-state';
import { useTopMenuActions } from '../model/use-top-menu-actions';
import { TopMenuBarProps } from '../model/types';
import { useVersioningStore } from '../../../features/versioning';
import { useDashboardStore } from '../../../features/projects-dashboard';
import { useDataDesignStore } from '../../../features/data-design';
import './TopMenuBar.css';

export const TopMenuBar: React.FC<TopMenuBarProps> = props => {
  const {
    activeMenu,
    toggleMenu,
    closeMenu,
    mobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
  } = useTopMenuState();

  const actions = useTopMenuActions({
    ...props,
    onBeforeAction: closeMenu,
  });

  const [sqlModel, setSqlModel] = useState<UMLModel | null>(null);
  const openSql = () => {
    closeMenu();
    setSqlModel(actions.model);
  };
  const hasModel = Boolean(actions.model);
  const openDataDesign = () => {
    closeMenu();
    void useDataDesignStore.getState().openDialog();
  };
  const openDiagrams = () => {
    closeMenu();
    useDashboardStore.getState().showDashboard();
  };
  const openHistory = () => {
    closeMenu();
    useVersioningStore.getState().openHistory();
  };

  return (
    <header className="top-menu-bar">
      <input
        type="file"
        ref={actions.fileInputRef}
        onChange={actions.handleFileChange}
        accept=".xmi,.xml"
        style={{ display: 'none' }}
      />

      <div className="top-menu-left">
        <MobileToggle isOpen={mobileMenuOpen} onToggle={toggleMobileMenu} />
        <Brand />
        <button
          className="top-menu-back"
          type="button"
          onClick={openDiagrams}
          aria-label="Salir del editor y volver a Mis proyectos"
          title="Volver a Mis proyectos"
        >
          <FolderOpen size={16} />
          <span>Mis proyectos</span>
        </button>
        <DesktopNav
          activeMenu={activeMenu}
          toggleMenu={toggleMenu}
          isBusy={actions.isBusy}
          hasModel={hasModel}
          onSave={actions.handleSave}
          onDiagrams={openDiagrams}
          onHistory={openHistory}
          onDataDesign={openDataDesign}
          onImportXMI={actions.handleImportXMIClick}
          onExportXMI={actions.handleExportXMI}
          onGenerateSql={openSql}
          onGenerate={actions.handleGenerate}
          onValidate={actions.handleValidate}
          onE2E={actions.handleE2E}
          onDeploy={actions.handleDeploy}
        />
      </div>

      <StatusIndicators
        genState={actions.genState}
        genMessage={actions.genMessage}
        loading={actions.loading}
        isBusy={actions.isBusy}
        localRole={actions.localRole}
      />

      <MobileDrawer
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
        isBusy={actions.isBusy}
        hasModel={hasModel}
        onSave={actions.handleSave}
        onDiagrams={openDiagrams}
        onHistory={openHistory}
        onDataDesign={openDataDesign}
        onImportXMI={actions.handleImportXMIClick}
        onExportXMI={actions.handleExportXMI}
        onGenerateSql={openSql}
        onGenerate={actions.handleGenerate}
        onValidate={actions.handleValidate}
        onE2E={actions.handleE2E}
        onDeploy={actions.handleDeploy}
      />
      {sqlModel && <SqlGenerationDialog model={sqlModel} onClose={() => setSqlModel(null)} />}
    </header>
  );
};

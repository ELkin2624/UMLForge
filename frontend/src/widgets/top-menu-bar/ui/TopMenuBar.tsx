import React from 'react';
import { Brand } from './Brand';
import { DesktopNav } from './DesktopNav';
import { MobileToggle, MobileDrawer } from './MobileDrawer';
import { StatusIndicators } from './StatusIndicators';
import { useTopMenuState } from '../model/use-top-menu-state';
import { useTopMenuActions } from '../model/use-top-menu-actions';
import { TopMenuBarProps } from '../model/types';
import { useVersioningStore } from '../../../features/versioning';
import { useDiagramManagerStore } from '../../../features/diagram-manager';
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

  const hasModel = Boolean(actions.model);
  const openDataDesign = () => {
    closeMenu();
    void useDataDesignStore.getState().openDialog();
  };
  const openDiagrams = () => {
    closeMenu();
    useDiagramManagerStore.getState().openManager();
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
        onGenerate={actions.handleGenerate}
        onValidate={actions.handleValidate}
        onE2E={actions.handleE2E}
        onDeploy={actions.handleDeploy}
      />
    </header>
  );
};

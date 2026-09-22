import React from 'react';
import { Loader2, Check, Eye, AlertCircle } from 'lucide-react';
import { ShareButton } from '../../../features/sharing/ui/ShareButton';
import { UserMenu } from '../../../features/auth/ui/UserMenu';
import { NotificationsMenu } from '../../../features/auth/ui/NotificationsMenu';
import { GenState } from '../model/types';

interface StatusIndicatorsProps {
  genState: GenState;
  genMessage: string;
  loading: boolean;
  isBusy: boolean;
  localRole: string;
}

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
  genState,
  genMessage,
  loading,
  isBusy,
  localRole,
}) => {
  return (
    <div className="top-menu-right">
      {/* Estado Activo de Generación / Validación */}
      {genState !== 'READY' && (
        <div className={`status-pill status-pill--${genState.toLowerCase()}`}>
          {['VALIDATING', 'GENERATING'].includes(genState) && (
            <Loader2 size={13} className="status-spinner" />
          )}
          {genState === 'SUCCESS' && <Check size={13} />}
          {genState === 'ERROR' && <AlertCircle size={13} />}
          <span className="status-pill-text">
            {genMessage || genState}
          </span>
        </div>
      )}

      {/* Spinner genérico cuando loading = true */}
      {loading && genState === 'READY' && (
        <div className="status-pill status-pill--loading">
          <Loader2 size={13} className="status-spinner" />
          <span className="status-pill-text">Procesando...</span>
        </div>
      )}

      {/* Badge Modo Lector */}
      {localRole === 'READER' && (
        <div
          className="reader-mode-badge"
          title="Modo solo lectura: no tienes permisos de edición en este diagrama."
        >
          <Eye size={13} />
          <span className="reader-badge-text">Lector</span>
        </div>
      )}

      <ShareButton disabled={isBusy && localRole !== 'READER'} />
      <NotificationsMenu />
      <UserMenu />
    </div>
  );
};


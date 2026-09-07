/**
 * features/sharing/ui/ShareButton.tsx
 * 
 * Botón de "Compartir" que aparece en la esquina superior derecha de la Toolbar.
 * Solo visible si el usuario tiene permiso (canShare).
 * Muestra badge con el número de colaboradores si hay sesión activa.
 */

import { Share2, Users } from 'lucide-react';
import { useShareStore } from '../model/share-store';
import { canShare } from '../model/capabilities';

interface ShareButtonProps {
  disabled?: boolean;
}

export function ShareButton({ disabled = false }: ShareButtonProps) {
  const { localRole, collaborators, roomId, openShareDialog } = useShareStore();

  const collaboratorCount = collaborators.length;
  const hasSession = roomId !== null;
  // Solo OWNER puede abrir el diálogo de compartir completamente
  // EDITOR y READER ven el botón pero con capacidades reducidas (solo ver)
  const canFullShare = canShare(localRole);

  return (
    <button
      id="btn-share"
      className={`share-button ${hasSession ? 'share-button--active' : ''} ${canFullShare ? '' : 'share-button--viewer'}`}
      onClick={openShareDialog}
      disabled={disabled}
      aria-label={
        hasSession
          ? `Compartir diagrama — ${collaboratorCount + 1} usuario${collaboratorCount !== 0 ? 's' : ''}`
          : 'Compartir diagrama'
      }
      title={hasSession ? `${collaboratorCount + 1} participante${collaboratorCount !== 0 ? 's' : ''}` : 'Compartir'}
    >
      {hasSession && collaboratorCount > 0 ? (
        <span className="share-button__avatars">
          <Users size={15} />
          <span className="share-button__badge">{collaboratorCount + 1}</span>
        </span>
      ) : (
        <Share2 size={15} />
      )}
      <span>Compartir</span>
    </button>
  );
}

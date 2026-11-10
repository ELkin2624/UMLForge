import { Shield } from 'lucide-react';
import type { AgentPermission } from '../../collaboration/api/agent-presence-api';
import './AgentPermissionControl.css';

const OPTIONS: Record<AgentPermission, { label: string; description: string }> = {
  ask: {
    label: 'Pedir aprobación',
    description: 'Todos los cambios propuestos por la IA requieren aprobación.',
  },
  safe: {
    label: 'Permitir cambios',
    description: 'Autoriza cambios directos; las eliminaciones requieren aprobación.',
  },
  full: {
    label: 'Acceso completo',
    description: 'Autoriza cambios directos, incluidas las eliminaciones.',
  },
};

interface AgentPermissionControlProps {
  permission: AgentPermission;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  onChange: (permission: AgentPermission) => void;
}

/** Preferencia privada de ejecución para las solicitudes del usuario actual. */
export function AgentPermissionControl({
  permission, loading, loaded, error, onChange,
}: AgentPermissionControlProps) {
  return (
    <section className="ai-permission-card" aria-label="Permisos de la IA">
      <div className="ai-permission-card__heading">
        <span className="ai-permission-card__icon"><Shield size={15} aria-hidden="true" /></span>
        <div>
          <strong>Permisos de la IA</strong>
          <small>Solo tus solicitudes</small>
        </div>
      </div>
      {loaded && (
        <select
          aria-label="Nivel de acceso"
          title={`${OPTIONS[permission].description} Tu rol en el diagrama limita qué cambios puedes aplicar.`}
          value={permission}
          disabled={loading}
          onChange={(event) => onChange(event.target.value as AgentPermission)}
        >
          {Object.entries(OPTIONS).map(([value, option]) => (
            <option key={value} value={value}>{option.label}</option>
          ))}
        </select>
      )}
      {!loaded && error ? (
        <p className="ai-permission-card__error" role="alert">No se pudieron cargar tus permisos. {error}</p>
      ) : !loaded ? (
        <p className="ai-permission-card__hint">Cargando…</p>
      ) : null}
      {loading && <span className="ai-permission-card__hint" role="status">Guardando…</span>}
      {error && loaded && <p className="ai-permission-card__error" role="alert">No se pudo guardar. {error}</p>}
    </section>
  );
}

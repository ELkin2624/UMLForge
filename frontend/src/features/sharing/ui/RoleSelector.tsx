/**
 * features/sharing/ui/RoleSelector.tsx
 * 
 * Selector de rol para colaboradores en el diálogo de compartir.
 * Solo OWNER puede cambiar roles.
 */

import type { Role } from '../model/types';

const ROLE_LABELS: Record<Exclude<Role, 'OWNER'>, string> = {
  EDITOR: 'Editor',
  READER: 'Lector',
};

interface RoleSelectorProps {
  value: Exclude<Role, 'OWNER'>;
  onChange: (role: Exclude<Role, 'OWNER'>) => void;
  disabled?: boolean;
  id?: string;
}

export function RoleSelector({ value, onChange, disabled = false, id }: RoleSelectorProps) {
  return (
    <select
      id={id}
      className="role-selector"
      value={value}
      onChange={(e) => onChange(e.target.value as Exclude<Role, 'OWNER'>)}
      disabled={disabled}
      aria-label="Seleccionar rol"
    >
      {Object.entries(ROLE_LABELS).map(([role, label]) => (
        <option key={role} value={role}>
          {label}
        </option>
      ))}
    </select>
  );
}

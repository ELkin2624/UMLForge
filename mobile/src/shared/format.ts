/** "hace 5 min", "hace 2 h", "hace 3 d" o la fecha corta. Las fechas del backend vienen en UTC sin zona. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const t = new Date(hasZone ? iso : `${iso}Z`).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(t).toLocaleDateString('es');
}

export const roleLabel: Record<string, string> = {
  OWNER: 'Propietario',
  EDITOR: 'Editor',
  READER: 'Lector',
  VIEWER: 'Lector',
};

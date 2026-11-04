import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import {
  createDiagram,
  deleteDiagram,
  renameDiagram,
  type DiagramSummary,
} from '../../../api/diagrams-api';
import { useAuthStore } from '../../auth/store';
import { useShareStore } from '../../sharing/model/share-store';
import { canDeleteDiagram, canEdit } from '../../sharing/model/capabilities';
import { formatWhen } from '../../versioning';
import { useDiagramManagerStore } from '../model/diagram-manager-store';
import { switchToDiagram } from '../model/switch-diagram';
import { emptyModel, filterDiagrams, toRole, type DiagramFilter } from '../model/diagram-utils';
import './DiagramManagerDialog.css';

const FILTERS: { id: DiagramFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'own', label: 'Propios' },
  { id: 'shared', label: 'Compartidos' },
];

const ROLE_LABEL = { OWNER: 'Propietario', EDITOR: 'Editor', READER: 'Lector' } as const;
const DEFAULT_NAME = 'Parcial1-SW1';

/** Administrador de diagramas: listar, abrir, crear, renombrar y eliminar. */
export const DiagramManagerDialog: React.FC = () => {
  const open = useDiagramManagerStore((s) => s.open);
  const close = useDiagramManagerStore((s) => s.closeManager);
  const diagrams = useDiagramManagerStore((s) => s.diagrams);
  const loading = useDiagramManagerStore((s) => s.loading);
  const error = useDiagramManagerStore((s) => s.error);
  const setError = useDiagramManagerStore((s) => s.setError);
  const refresh = useDiagramManagerStore((s) => s.refresh);

  const activeId = useShareStore((s) => s.roomId);
  const userId = useAuthStore((s) => s.user?.id);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DiagramFilter>('all');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (open) void refresh();
    else {
      setQuery('');
      setFilter('all');
      setNewName('');
      setRenamingId(null);
    }
  }, [open, refresh]);

  const visible = useMemo(
    () => filterDiagrams(diagrams, query, filter, userId),
    [diagrams, query, filter, userId]
  );

  if (!open) return null;

  /** Ejecuta una acción bloqueando la UI y mostrando su error si falla. */
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error');
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = (d: DiagramSummary) =>
    run(async () => {
      if (String(d.id) !== activeId) await switchToDiagram(d.id);
      close();
    });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim() || 'Diagrama sin título';
    void run(async () => {
      const created = await createDiagram(name, emptyModel(name));
      await switchToDiagram(created.id);
      close();
    });
  };

  const startRename = (d: DiagramSummary) => {
    setRenamingId(d.id);
    setRenameValue(d.name);
  };

  const handleRename = (d: DiagramSummary) => {
    const name = renameValue.trim();
    if (!name || name === d.name) {
      setRenamingId(null);
      return;
    }
    void run(async () => {
      await renameDiagram(d.id, name);
      setRenamingId(null);
      await refresh();
    });
  };

  const handleDelete = (d: DiagramSummary) => {
    if (!window.confirm(`¿Eliminar "${d.name}" y todo su historial? No se puede deshacer.`)) return;
    void run(async () => {
      await deleteDiagram(d.id);
      if (String(d.id) === activeId) {
        // Pasar a otro diagrama; si no queda ninguno, crear el de arranque.
        const rest = diagrams.filter((x) => x.id !== d.id);
        const next =
          rest.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ??
          (await createDiagram(DEFAULT_NAME, emptyModel(DEFAULT_NAME)));
        await switchToDiagram(next.id);
      }
      await refresh();
    });
  };

  return createPortal(
    <div className="dm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dm-dialog" role="dialog" aria-modal="true" aria-label="Mis diagramas">
        <header className="dm-header">
          <div className="dm-title">
            <FolderOpen size={18} />
            <h2>Mis diagramas</h2>
          </div>
          <button className="dm-icon-btn" onClick={close} aria-label="Cerrar" title="Cerrar">
            <X size={16} />
          </button>
        </header>

        {error && (
          <div className="dm-error" role="alert">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form className="dm-create" onSubmit={handleCreate}>
          <input
            className="dm-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del nuevo diagrama"
            aria-label="Nombre del nuevo diagrama"
            maxLength={120}
            disabled={busy}
          />
          <button className="dm-btn dm-btn--primary" type="submit" disabled={busy}>
            <Plus size={14} /> Nuevo diagrama
          </button>
        </form>

        <div className="dm-toolbar">
          <label className="dm-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre"
              aria-label="Buscar diagramas"
            />
          </label>
          <div className="dm-filters" role="group" aria-label="Filtrar">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`dm-chip-btn${filter === f.id ? ' is-active' : ''}`}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dm-body">
          {loading && diagrams.length === 0 && (
            <p className="dm-muted"><Loader2 size={14} className="dm-spin" /> Cargando…</p>
          )}
          {!loading && visible.length === 0 && (
            <p className="dm-muted">
              {diagrams.length === 0
                ? 'Todavía no tienes diagramas. Crea el primero arriba.'
                : 'Ningún diagrama coincide con la búsqueda.'}
            </p>
          )}
          <ul className="dm-list">
            {visible.map((d) => {
              const role = toRole(d.my_role);
              const isActive = String(d.id) === activeId;
              const isOwn = d.owner_id === userId;
              const renaming = renamingId === d.id;
              return (
                <li key={d.id} className={`dm-item${isActive ? ' is-active' : ''}`}>
                  <div className="dm-item-main">
                    {renaming ? (
                      <form
                        className="dm-rename"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleRename(d);
                        }}
                      >
                        <input
                          className="dm-input"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          aria-label={`Nuevo nombre para ${d.name}`}
                          maxLength={120}
                          autoFocus
                        />
                        <button className="dm-icon-btn" type="submit" aria-label="Guardar nombre" title="Guardar" disabled={busy}>
                          <Check size={14} />
                        </button>
                        <button className="dm-icon-btn" type="button" onClick={() => setRenamingId(null)} aria-label="Cancelar" title="Cancelar">
                          <X size={14} />
                        </button>
                      </form>
                    ) : (
                      <span className="dm-item-name">{d.name}</span>
                    )}
                    <span className="dm-item-meta">
                      {isActive && <span className="dm-chip dm-chip--active">Abierto</span>}
                      <span className="dm-chip">{ROLE_LABEL[role]}</span>
                      <span className="dm-chip">{isOwn ? 'Propio' : 'Compartido'}</span>
                      <span className="dm-muted">Modificado {formatWhen(d.updated_at)}</span>
                    </span>
                  </div>

                  <div className="dm-item-actions">
                    <button
                      className="dm-btn dm-btn--primary"
                      onClick={() => handleOpen(d)}
                      disabled={busy || isActive}
                    >
                      {isActive ? 'Abierto' : 'Abrir'}
                    </button>
                    {canEdit(role) && !renaming && (
                      <button
                        className="dm-icon-btn"
                        onClick={() => startRename(d)}
                        aria-label={`Renombrar ${d.name}`}
                        title="Renombrar"
                        disabled={busy}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {canDeleteDiagram(role) && (
                      <button
                        className="dm-icon-btn dm-icon-btn--danger"
                        onClick={() => handleDelete(d)}
                        aria-label={`Eliminar ${d.name}`}
                        title="Eliminar"
                        disabled={busy}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
};

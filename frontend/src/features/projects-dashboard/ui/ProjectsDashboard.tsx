import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, LogOut, Plus, Search, Shapes } from 'lucide-react';
import { createDiagram, deleteDiagram, renameDiagram, type DiagramSummary } from '../../../api/diagrams-api';
import { request } from '../../../api/client';
import { useAuthStore } from '../../auth/store';
import { NotificationsMenu } from '../../auth/ui/NotificationsMenu';
import { useShareStore } from '../../sharing/model/share-store';
import { useVersioningStore } from '../../versioning';
import {
  emptyModel, filterDiagrams, switchToDiagram, useDiagramManagerStore, type DiagramFilter,
} from '../../diagram-manager';
import { useDashboardStore } from '../model/dashboard-store';
import { ProjectCard } from './ProjectCard';
import './ProjectsDashboard.css';

const FILTERS: { id: DiagramFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'own', label: 'Propios' },
  { id: 'shared', label: 'Compartidos' },
];

/** Pantalla de inicio tras iniciar sesión: todos los proyectos del usuario. */
export const ProjectsDashboard: React.FC = () => {
  const diagrams = useDiagramManagerStore((s) => s.diagrams);
  const loading = useDiagramManagerStore((s) => s.loading);
  const error = useDiagramManagerStore((s) => s.error);
  const setError = useDiagramManagerStore((s) => s.setError);
  const refresh = useDiagramManagerStore((s) => s.refresh);

  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const activeId = useShareStore((s) => s.roomId);
  const shareOpen = useShareStore((s) => s.isDialogOpen);
  const historyOpen = useVersioningStore((s) => s.historyOpen);
  const showEditor = useDashboardStore((s) => s.showEditor);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DiagramFilter>('all');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { void refresh(); }, [refresh]);

  // Al cerrar Compartir o Historial pudo cambiar el enlace, las personas o las versiones.
  useEffect(() => {
    if (!shareOpen && !historyOpen) {
      setRefreshKey((k) => k + 1);
      void refresh();
    }
  }, [shareOpen, historyOpen, refresh]);

  const visible = useMemo(() => filterDiagrams(diagrams, query, filter, user?.id), [diagrams, query, filter, user?.id]);
  const ownCount = diagrams.filter((d) => d.owner_id === user?.id).length;
  const displayName = user?.display_name || user?.username || 'Usuario';

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

  const handleOpen = (d: DiagramSummary) => run(async () => { await switchToDiagram(d.id); showEditor(); });
  const handleHistory = (d: DiagramSummary) => run(async () => { await switchToDiagram(d.id); useVersioningStore.getState().openHistory(); });
  const handleShare = (d: DiagramSummary) => run(async () => { await switchToDiagram(d.id); useShareStore.getState().openShareDialog(); });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim() || 'Diagrama sin título';
    void run(async () => {
      const created = await createDiagram(name, emptyModel(name));
      await switchToDiagram(created.id);
      setNewName('');
      showEditor();
    });
  };

  const handleRename = (d: DiagramSummary, name: string) =>
    run(async () => { await renameDiagram(d.id, name); await refresh(); });

  const handleDelete = (d: DiagramSummary) => {
    if (!window.confirm(`¿Eliminar "${d.name}" y todo su historial? No se puede deshacer.`)) return;
    void run(async () => {
      await deleteDiagram(d.id);
      if (String(d.id) === activeId) useShareStore.getState().endSession();
      await refresh();
    });
  };

  const handleLogout = async () => {
    try { await request('/auth/logout', { method: 'POST' }); } catch { /* se cierra igual en el cliente */ }
    clearAuth();
  };

  return (
    <div className="pd-screen">
      <div className="pd-deco pd-deco--yellow" aria-hidden="true" />
      <div className="pd-deco pd-deco--peach" aria-hidden="true" />

      <header className="pd-topbar">
        <div className="pd-brand"><Shapes size={18} /> UMLForge</div>
        <div className="pd-user">
          <NotificationsMenu />
          <span className="pd-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
          <span className="pd-user__name" title={displayName}>{displayName}</span>
          <button className="pd-icon-btn" onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={14} /></button>
        </div>
      </header>

      <main className="pd-main">
        <section className="pd-hero">
          <div>
            <h1>Mis proyectos</h1>
            <p className="pd-muted">
              {diagrams.length === 0 ? 'Aún no tienes diagramas.' : `${diagrams.length} ${diagrams.length === 1 ? 'diagrama' : 'diagramas'} · ${ownCount} propios · ${diagrams.length - ownCount} compartidos contigo`}
            </p>
          </div>
          <form className="pd-create" onSubmit={handleCreate}>
            <input className="pd-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del nuevo diagrama" aria-label="Nombre del nuevo diagrama" maxLength={120} disabled={busy} />
            <button className="pd-btn pd-btn--primary" type="submit" disabled={busy}><Plus size={14} /> Nuevo diagrama</button>
          </form>
        </section>

        <div className="pd-toolbar">
          <label className="pd-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre" aria-label="Buscar diagramas" />
          </label>
          <div className="pd-filters" role="group" aria-label="Filtrar">
            {FILTERS.map((f) => (
              <button key={f.id} className={`pd-chip-btn${filter === f.id ? ' is-active' : ''}`} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}>{f.label}</button>
            ))}
          </div>
        </div>

        {error && <div className="pd-error" role="alert"><AlertCircle size={14} /> {error}</div>}

        {loading && diagrams.length === 0 && <p className="pd-muted"><Loader2 size={14} className="pd-spin" /> Cargando…</p>}
        {!loading && visible.length === 0 && (
          <div className="pd-empty">
            <h2>{diagrams.length === 0 ? 'Crea tu primer proyecto' : 'Nada coincide con tu búsqueda'}</h2>
            <p className="pd-muted">{diagrams.length === 0 ? 'Escribe un nombre arriba y pulsa «Nuevo diagrama».' : 'Prueba con otro nombre o cambia el filtro.'}</p>
          </div>
        )}

        <ul className="pd-grid">
          {visible.map((d) => (
            <ProjectCard
              key={d.id}
              diagram={d}
              isOwn={d.owner_id === user?.id}
              isActive={String(d.id) === activeId}
              busy={busy}
              refreshKey={refreshKey}
              onOpen={() => handleOpen(d)}
              onHistory={() => handleHistory(d)}
              onShare={() => handleShare(d)}
              onRename={(n) => handleRename(d, n)}
              onDelete={() => handleDelete(d)}
            />
          ))}
        </ul>
      </main>
    </div>
  );
};

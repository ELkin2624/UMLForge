import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Bot, History, Loader2, RotateCcw, User, X } from 'lucide-react';
import {
  getVersion,
  listVersions,
  restoreVersion,
  type VersionDetail,
  type VersionSummary,
} from '../../../api/diagrams-api';
import { useModelStore } from '../../../store/model-store';
import { useShareStore } from '../../sharing/model/share-store';
import { canEdit } from '../../sharing/model/capabilities';
import { useVersioningStore } from '../model/versioning-store';
import { VersionPreview } from './VersionPreview';
import './HistoryDialog.css';

const PAGE_SIZE = 30;

const OP_LABEL: Record<string, string> = {
  added: 'Agregó',
  removed: 'Eliminó',
  modified: 'Modificó',
};

function authorLabel(v: VersionSummary): string {
  if (v.author.type === 'ai') {
    const who = v.author.on_behalf_of?.name;
    return who ? `IA (a pedido de ${who})` : 'IA';
  }
  return v.author.name;
}

function sourceBadge(v: VersionSummary): string | null {
  if (v.source === 'restore') return `Restauración de v${v.restored_from}`;
  if (v.source === 'migration') return 'Importada';
  return null;
}

export function formatWhen(iso: string): string {
  // El backend devuelve UTC sin zona; se interpreta como UTC.
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Historial de versiones: quién hizo qué, vista previa y restauración. */
export const HistoryDialog: React.FC = () => {
  const open = useVersioningStore((s) => s.historyOpen);
  const close = useVersioningStore((s) => s.closeHistory);
  const refreshKey = useVersioningStore((s) => s.historyRefreshKey);
  const roomId = useShareStore((s) => s.roomId);
  const localRole = useShareStore((s) => s.localRole);

  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const loadFirstPage = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const page = await listVersions(roomId, { limit: PAGE_SIZE });
      setVersions(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (open) void loadFirstPage();
  }, [open, refreshKey, loadFirstPage]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setDetail(null);
      setConfirming(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !roomId || selected === null) return;
    let cancelled = false;
    setDetailLoading(true);
    setConfirming(false);
    getVersion(roomId, selected)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, roomId, selected]);

  const loadMore = async () => {
    if (!roomId || versions.length === 0) return;
    setLoading(true);
    try {
      const page = await listVersions(roomId, {
        limit: PAGE_SIZE,
        before: versions[versions.length - 1].version,
      });
      setVersions((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!roomId || selected === null) return;
    setRestoring(true);
    setError(null);
    try {
      const res = await restoreVersion(roomId, selected);
      // setModel (local) lo publica al Y.Doc: todos los conectados ven la restauración.
      useModelStore.getState().setModel(res.data);
      useVersioningStore.getState().markSaved(Boolean(res.version_created));
      setConfirming(false);
      setSelected(null);
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo restaurar');
    } finally {
      setRestoring(false);
    }
  };

  if (!open) return null;

  const latest = versions[0]?.version;
  const mayRestore = canEdit(localRole);

  return createPortal(
    <div className="vh-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="vh-dialog" role="dialog" aria-modal="true" aria-label="Historial de versiones">
        <header className="vh-header">
          <div className="vh-title">
            <History size={18} />
            <h2>Historial de versiones</h2>
          </div>
          <button className="vh-icon-btn" onClick={close} aria-label="Cerrar historial" title="Cerrar">
            <X size={16} />
          </button>
        </header>

        {error && (
          <div className="vh-error" role="alert">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="vh-body">
          <aside className="vh-list" aria-label="Versiones">
            {versions.length === 0 && !loading && (
              <p className="vh-muted">Todavía no hay versiones.</p>
            )}
            <ul>
              {versions.map((v) => (
                <li key={v.version}>
                  <button
                    className={`vh-item${selected === v.version ? ' is-active' : ''}`}
                    onClick={() => setSelected(v.version)}
                  >
                    <span className="vh-item-top">
                      <span className="vh-item-version">v{v.version}</span>
                      {v.version === latest && <span className="vh-chip vh-chip--current">Actual</span>}
                      {sourceBadge(v) && <span className="vh-chip">{sourceBadge(v)}</span>}
                    </span>
                    <span className="vh-item-author">
                      {v.author.type === 'ai' ? <Bot size={13} /> : <User size={13} />}
                      {authorLabel(v)}
                    </span>
                    <span className="vh-item-summary">{v.summary}</span>
                    <span className="vh-item-when">{formatWhen(v.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {loading && (
              <p className="vh-muted"><Loader2 size={14} className="vh-spin" /> Cargando…</p>
            )}
            {hasMore && !loading && (
              <button className="vh-btn" onClick={loadMore}>Cargar más</button>
            )}
          </aside>

          <section className="vh-detail">
            {selected === null && (
              <div className="vh-placeholder">
                Elige una versión para ver cómo estaba el diagrama y qué cambió.
              </div>
            )}
            {selected !== null && detailLoading && (
              <div className="vh-placeholder"><Loader2 size={18} className="vh-spin" /></div>
            )}
            {selected !== null && detail && !detailLoading && (
              <>
                <div className="vh-detail-head">
                  <div>
                    <strong>Versión {detail.version}</strong>
                    <span className="vh-muted">
                      {' '}· {authorLabel(detail)} · {formatWhen(detail.created_at)}
                    </span>
                  </div>
                  {mayRestore && detail.version !== latest && (
                    confirming ? (
                      <div className="vh-confirm">
                        <span>¿Restaurar? Se crea una versión nueva.</span>
                        <button className="vh-btn vh-btn--primary" onClick={handleRestore} disabled={restoring}>
                          {restoring ? <Loader2 size={13} className="vh-spin" /> : <RotateCcw size={13} />}
                          Confirmar
                        </button>
                        <button className="vh-btn" onClick={() => setConfirming(false)} disabled={restoring}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button className="vh-btn vh-btn--primary" onClick={() => setConfirming(true)}>
                        <RotateCcw size={13} /> Restaurar esta versión
                      </button>
                    )
                  )}
                </div>

                {detail.changes.length > 0 && (
                  <ul className="vh-changes" aria-label="Cambios de esta versión">
                    {detail.changes.map((c, i) => (
                      <li key={`${c.id}-${i}`} className={`vh-change vh-change--${c.op}`}>
                        <span className="vh-change-op">{OP_LABEL[c.op]}</span>{' '}
                        {c.kind}{' '}
                        <strong>{c.parent ? `${c.parent}.${c.name}` : c.name}</strong>
                        {c.detail && <span className="vh-muted"> ({c.detail})</span>}
                      </li>
                    ))}
                  </ul>
                )}

                <VersionPreview data={detail.data} versionKey={detail.version} />
              </>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
};

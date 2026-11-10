import React, { useState } from 'react';
import {
  Check, Copy, History, Link2, LinkIcon, Pencil, Share2, Trash2, Users, X, FolderOpen,
} from 'lucide-react';
import type { DiagramSummary } from '../../../api/diagrams-api';
import { canDeleteDiagram, canEdit, canShare } from '../../sharing/model/capabilities';
import { buildJoinUrl } from '../../sharing/model/invite-utils';
import { formatWhen } from '../../versioning';
import { toRole } from '../../diagram-manager';
import { useDiagramInsights } from '../model/use-diagram-insights';

const ROLE_LABEL = { OWNER: 'Propietario', EDITOR: 'Editor', READER: 'Lector' } as const;
const ACCENTS = ['yellow', 'peach', 'mint', 'sky', 'lilac'] as const;

interface Props {
  diagram: DiagramSummary;
  isOwn: boolean;
  isActive: boolean;
  busy: boolean;
  refreshKey: number;
  onOpen: () => void;
  onHistory: () => void;
  onShare: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

/** Tarjeta de un proyecto: estado, versionado, enlace de acceso y acciones. */
export const ProjectCard: React.FC<Props> = ({
  diagram, isOwn, isActive, busy, refreshKey, onOpen, onHistory, onShare, onRename, onDelete,
}) => {
  const role = toRole(diagram.my_role);
  const insights = useDiagramInsights(diagram, canShare(role), refreshKey);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(diagram.name);
  const [copied, setCopied] = useState(false);

  const accent = ACCENTS[diagram.id % ACCENTS.length];
  const { link, members } = insights;
  const joined = members.filter((m) => !m.is_pending);
  const pending = members.length - joined.length;

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    setRenaming(false);
    if (next && next !== diagram.name) onRename(next);
  };

  const copyLink = async () => {
    if (!link?.token) return;
    try {
      await navigator.clipboard.writeText(buildJoinUrl(link.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sin permiso de portapapeles: el enlace sigue disponible en Compartir */
    }
  };

  return (
    <li className={`pd-card${isActive ? ' is-active' : ''}`}>
      <div className={`pd-card__cover pd-card__cover--${accent}`}>
        <span className="pd-chip pd-chip--solid">{ROLE_LABEL[role]}</span>
        {insights.version != null && <span className="pd-chip pd-chip--solid pd-mono">v{insights.version}</span>}
      </div>

      <div className="pd-card__body">
        {renaming ? (
          <form className="pd-rename" onSubmit={submitRename}>
            <input
              className="pd-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={`Nuevo nombre para ${diagram.name}`}
              maxLength={120}
              autoFocus
            />
            <button className="pd-icon-btn" type="submit" aria-label="Guardar nombre" title="Guardar"><Check size={14} /></button>
            <button className="pd-icon-btn" type="button" aria-label="Cancelar" title="Cancelar" onClick={() => setRenaming(false)}><X size={14} /></button>
          </form>
        ) : (
          <h3 className="pd-card__title" title={diagram.name}>{diagram.name}</h3>
        )}

        <p className="pd-muted">
          {isOwn ? 'Tuyo' : 'Compartido contigo'} · Modificado {formatWhen(diagram.updated_at)}
        </p>

        <div className="pd-section">
          <span className="pd-section__label"><History size={13} /> Versionado</span>
          <span className="pd-section__value">
            {!insights.loaded
              ? 'Cargando…'
              : insights.version == null
                ? 'Sin versiones todavía'
                : `${insights.version} ${insights.version === 1 ? 'versión' : 'versiones'} · última por ${insights.lastAuthor}`}
          </span>
        </div>

        {canShare(role) && (
          <div className="pd-section">
            <span className="pd-section__label"><Link2 size={13} /> Enlace</span>
            <span className="pd-section__value">
              {!insights.loaded ? 'Cargando…' : link?.enabled ? (
                <>
                  <span className="pd-chip pd-chip--mint">Activo</span>{' '}
                  cualquiera {link.role === 'EDITOR' ? 'edita' : 'lee'}
                </>
              ) : (
                <><span className="pd-chip">Desactivado</span> solo invitados</>
              )}
            </span>
          </div>
        )}

        {canShare(role) && insights.loaded && (
          <div className="pd-section">
            <span className="pd-section__label"><Users size={13} /> Personas</span>
            <span className="pd-section__value">
              {joined.length === 0 && pending === 0
                ? 'Solo tú'
                : `${joined.length} ${joined.length === 1 ? 'colaborador' : 'colaboradores'}${pending ? ` · ${pending} pendiente${pending > 1 ? 's' : ''}` : ''}`}
            </span>
          </div>
        )}
      </div>

      <div className="pd-card__actions">
        <button className="pd-btn pd-btn--primary" onClick={onOpen} disabled={busy}>
          <FolderOpen size={14} /> Abrir
        </button>
        <button className="pd-btn" onClick={onHistory} disabled={busy}>
          <History size={14} /> Historial
        </button>
        {canShare(role) && (
          <button className="pd-btn" onClick={onShare} disabled={busy}>
            <Share2 size={14} /> Compartir
          </button>
        )}
        {canShare(role) && link?.enabled && link.token && (
          <button className="pd-icon-btn" onClick={copyLink} aria-label="Copiar enlace de acceso" title="Copiar enlace de acceso">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        {canEdit(role) && !renaming && (
          <button className="pd-icon-btn" onClick={() => { setName(diagram.name); setRenaming(true); }} aria-label={`Renombrar ${diagram.name}`} title="Renombrar" disabled={busy}>
            <Pencil size={14} />
          </button>
        )}
        {canDeleteDiagram(role) && (
          <button className="pd-icon-btn pd-icon-btn--danger" onClick={onDelete} aria-label={`Eliminar ${diagram.name}`} title="Eliminar" disabled={busy}>
            <Trash2 size={14} />
          </button>
        )}
        {copied && <span className="pd-copied" role="status"><LinkIcon size={12} /> Enlace copiado</span>}
      </div>
    </li>
  );
};

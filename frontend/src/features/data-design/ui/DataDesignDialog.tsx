import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Database, Loader2, RefreshCw, X } from 'lucide-react';
import { useShareStore } from '../../sharing/model/share-store';
import { canEdit } from '../../sharing/model/capabilities';
import { useDataDesignStore, type DataDesignTab } from '../model/data-design-store';
import { LogicalModelTab } from './LogicalModelTab';
import { NormalizationTab } from './NormalizationTab';
import { DbDiagramTab } from './DbDiagramTab';
import './DataDesignDialog.css';

const TABS: { id: DataDesignTab; label: string }[] = [
  { id: 'logical', label: 'Modelo lógico' },
  { id: 'normalization', label: 'Normalización' },
  { id: 'diagram', label: 'Diagrama BD' },
];

/** Diseño de datos: modelo lógico, normalización demostrable y diagrama de base de datos. */
export const DataDesignDialog: React.FC = () => {
  const open = useDataDesignStore((s) => s.open);
  const close = useDataDesignStore((s) => s.closeDialog);
  const tab = useDataDesignStore((s) => s.tab);
  const setTab = useDataDesignStore((s) => s.setTab);
  const loading = useDataDesignStore((s) => s.loading);
  const error = useDataDesignStore((s) => s.error);
  const result = useDataDesignStore((s) => s.result);
  const refresh = useDataDesignStore((s) => s.refresh);
  const localRole = useShareStore((s) => s.localRole);

  if (!open) return null;
  const editable = canEdit(localRole);

  return createPortal(
    <div className="dd-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dd-dialog" role="dialog" aria-modal="true" aria-label="Diseño de datos">
        <header className="dd-header">
          <div className="dd-title"><Database size={18} /><h2>Diseño de datos</h2></div>
          <nav className="dd-tabs" role="tablist" aria-label="Secciones">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`dd-tab${tab === t.id ? ' is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="dd-header-actions">
            <button className="dd-icon-btn" onClick={() => void refresh()} aria-label="Volver a analizar" title="Volver a analizar">
              {loading ? <Loader2 size={15} className="dd-spin" /> : <RefreshCw size={15} />}
            </button>
            <button className="dd-icon-btn" onClick={close} aria-label="Cerrar" title="Cerrar"><X size={16} /></button>
          </div>
        </header>

        {!editable && (
          <p className="dd-readonly" role="note">
            Modo lector: tus decisiones sobre dependencias se usan en esta sesión pero no se guardan.
          </p>
        )}
        {error && <div className="dd-error" role="alert"><AlertCircle size={14} /> {error}</div>}

        <div className="dd-body" role="tabpanel">
          {!result && loading && <p className="dd-empty"><Loader2 size={16} className="dd-spin" /> Analizando…</p>}
          {result && tab === 'logical' && <LogicalModelTab result={result} />}
          {result && tab === 'normalization' && <NormalizationTab result={result} />}
          {result && tab === 'diagram' && <DbDiagramTab result={result} />}
        </div>
      </div>
    </div>,
    document.body
  );
};

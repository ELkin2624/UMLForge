import React, { useState } from 'react';
import { AlertTriangle, Check, Plus, RotateCcw, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import type {
  DataDesignResult,
  FunctionalDependency,
  TableNormalization,
} from '../api/data-design-api';
import { useDataDesignStore } from '../model/data-design-store';

const NF_CLASS: Record<string, string> = {
  FNBC: 'good', '3FN': 'good', '2FN': 'warn', '1FN': 'bad', 'Sin 1FN': 'bad',
};

export const NfBadge: React.FC<{ form: string }> = ({ form }) => (
  <span className={`dd-nf dd-nf--${NF_CLASS[form] ?? 'warn'}`}>{form}</span>
);

const dep = (d: { lhs: string[]; rhs: string[] }) => `${d.lhs.join(', ')} → ${d.rhs.join(', ')}`;

const STATUS_LABEL: Record<FunctionalDependency['status'], string> = {
  confirmed: 'Confirmada',
  suggested: 'Sugerida',
  rejected: 'Rechazada',
};

const DependencyRow: React.FC<{ table: string; d: FunctionalDependency }> = ({ table, d }) => {
  const decide = useDataDesignStore((s) => s.decide);
  const undecide = useDataDesignStore((s) => s.undecide);
  const isKey = d.source === 'key';

  return (
    <li className={`dd-dep dd-dep--${d.status}`}>
      <div className="dd-dep-main">
        <code>{dep(d)}</code>
        <span className={`dd-chip dd-chip--${d.status}`}>{isKey ? 'Clave' : STATUS_LABEL[d.status]}</span>
        {d.source === 'custom' && <span className="dd-chip dd-chip--lilac">Declarada</span>}
        {d.source === 'inferred' && d.confidence === 'low' && <span className="dd-chip">Confianza baja</span>}
      </div>
      <p className="dd-muted dd-dep-reason">{d.reason}</p>
      {!isKey && (
        <div className="dd-dep-actions">
          {d.source === 'inferred' && d.status !== 'confirmed' && (
            <button className="dd-btn dd-btn--primary"
              onClick={() => decide(table, d.lhs, d.rhs, 'accepted')}>
              <ThumbsUp size={12} /> Aceptar
            </button>
          )}
          {d.source === 'inferred' && d.status !== 'rejected' && (
            <button className="dd-btn" onClick={() => decide(table, d.lhs, d.rhs, 'rejected')}>
              <ThumbsDown size={12} /> Rechazar
            </button>
          )}
          {d.source === 'inferred' && d.status !== 'suggested' && (
            <button className="dd-btn" onClick={() => undecide(table, d.lhs, d.rhs)}>
              <RotateCcw size={12} /> Deshacer
            </button>
          )}
          {d.source === 'custom' && (
            <button className="dd-btn" onClick={() => undecide(table, d.lhs, d.rhs)}>
              <X size={12} /> Quitar
            </button>
          )}
        </div>
      )}
    </li>
  );
};

const AttributeChips: React.FC<{
  label: string;
  attributes: string[];
  selected: string[];
  onToggle: (a: string) => void;
}> = ({ label, attributes, selected, onToggle }) => (
  <fieldset className="dd-chips">
    <legend>{label}</legend>
    {attributes.map((a) => (
      <button
        key={a}
        type="button"
        className={`dd-chip-btn${selected.includes(a) ? ' is-on' : ''}`}
        aria-pressed={selected.includes(a)}
        onClick={() => onToggle(a)}
      >
        {a}
      </button>
    ))}
  </fieldset>
);

const AddDependency: React.FC<{ t: TableNormalization }> = ({ t }) => {
  const decide = useDataDesignStore((s) => s.decide);
  const [lhs, setLhs] = useState<string[]>([]);
  const [rhs, setRhs] = useState<string[]>([]);
  const toggle = (list: string[], set: (v: string[]) => void) => (a: string) =>
    set(list.includes(a) ? list.filter((x) => x !== a) : [...list, a]);
  const valid = lhs.length > 0 && rhs.length > 0 && !rhs.every((a) => lhs.includes(a));

  return (
    <details className="dd-add">
      <summary><Plus size={13} /> Declarar una dependencia funcional</summary>
      <AttributeChips label="Determinante (lado izquierdo)" attributes={t.attributes}
        selected={lhs} onToggle={toggle(lhs, setLhs)} />
      <AttributeChips label="Determinados (lado derecho)" attributes={t.attributes}
        selected={rhs} onToggle={toggle(rhs, setRhs)} />
      <button
        className="dd-btn dd-btn--primary"
        disabled={!valid}
        onClick={async () => {
          await decide(t.table, lhs, rhs.filter((a) => !lhs.includes(a)), 'custom');
          setLhs([]);
          setRhs([]);
        }}
      >
        <Plus size={12} /> {valid ? `Agregar ${lhs.join(', ')} → ${rhs.join(', ')}` : 'Elige determinante y determinados'}
      </button>
    </details>
  );
};

const TableDetail: React.FC<{ t: TableNormalization }> = ({ t }) => {
  const differs = t.normal_form_if_suggestions_accepted !== t.normal_form;
  return (
    <div className="dd-detail">
      <header className="dd-detail-head">
        <h3 className="dd-h3">{t.table}</h3>
        <NfBadge form={t.normal_form} />
        {t.pending_suggestions > 0 && (
          <span className="dd-pending" role="status">
            <AlertTriangle size={13} /> {t.pending_suggestions} sugerencia{t.pending_suggestions > 1 ? 's' : ''} sin revisar
            {differs && <> · si las aceptas: <NfBadge form={t.normal_form_if_suggestions_accepted} /></>}
          </span>
        )}
      </header>

      <section aria-labelledby={`dd-fd-${t.table}`}>
        <h4 id={`dd-fd-${t.table}`} className="dd-h4">Dependencias funcionales</h4>
        <ul className="dd-deps">
          {t.dependencies.map((d) => <DependencyRow key={d.id} table={t.table} d={d} />)}
        </ul>
        <AddDependency t={t} />
      </section>

      <section aria-labelledby={`dd-chk-${t.table}`}>
        <h4 id={`dd-chk-${t.table}`} className="dd-h4">Verificación por forma normal</h4>
        <ul className="dd-checks">
          {t.checks.map((c) => (
            <li key={c.form} className={`dd-check dd-check--${c.ok ? 'ok' : 'fail'}`}>
              <span className="dd-check-form">
                {c.ok ? <Check size={14} aria-label="Cumple" /> : <X size={14} aria-label="No cumple" />} {c.form}
              </span>
              <span>{c.detail}</span>
              {c.evidence.map((e) => <code key={e} className="dd-evidence">{e}</code>)}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={`dd-key-${t.table}`}>
        <h4 id={`dd-key-${t.table}`} className="dd-h4">Claves candidatas</h4>
        <ul className="dd-proof">
          {t.proof.map((p) => <li key={p}><code>{p}</code></li>)}
        </ul>
      </section>

      {t.decomposition && (
        <section aria-labelledby={`dd-dec-${t.table}`} className="dd-decomp">
          <h4 id={`dd-dec-${t.table}`} className="dd-h4">Descomposición propuesta en 3FN</h4>
          <ol className="dd-steps">
            {t.decomposition.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <div className="dd-rel-grid">
            {t.decomposition.relations.map((r) => (
              <div key={r.name} className="dd-rel">
                <strong>{r.name}</strong>
                <span className="dd-mono">
                  ({r.attributes.map((a) => (r.primary_key.includes(a) ? <u key={a}>{a}</u> : a))
                    .reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ', ', el] : [el]), [])})
                </span>
              </div>
            ))}
          </div>
          <p className="dd-guarantees">
            <Check size={13} /> Sin pérdida de información · <Check size={13} /> Preserva las dependencias
          </p>
          <p className="dd-muted">{t.decomposition.explanation}</p>
        </section>
      )}

      {t.warnings.length > 0 && (
        <section aria-label="Advertencias">
          <ul className="dd-warnings">
            {t.warnings.map((w) => <li key={w}><AlertTriangle size={13} /> {w}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
};

export const NormalizationTab: React.FC<{ result: DataDesignResult }> = ({ result }) => {
  const selected = useDataDesignStore((s) => s.selectedTable);
  const select = useDataDesignStore((s) => s.selectTable);
  const { normalization, summary } = result;
  const current = normalization.find((t) => t.table === selected) ?? normalization[0];

  if (!current) return <p className="dd-empty">El modelo no tiene clases todavía.</p>;

  return (
    <div className="dd-norm">
      <aside className="dd-norm-list" aria-label="Tablas">
        <p className="dd-summary" role="status">
          {summary.all_in_3nf ? <Check size={14} /> : <AlertTriangle size={14} />}{' '}
          {summary.all_in_3nf ? 'Todas las tablas están en 3FN o mejor' : 'Hay tablas por debajo de 3FN'}
          {summary.pending_suggestions > 0 && ` · ${summary.pending_suggestions} sugerencias pendientes`}
        </p>
        <ul>
          {normalization.map((t) => (
            <li key={t.table}>
              <button
                className={`dd-list-item${t.table === current.table ? ' is-active' : ''}`}
                onClick={() => select(t.table)}
              >
                <span>{t.table}</span>
                <span className="dd-list-right">
                  {t.pending_suggestions > 0 && <span className="dd-dot" title="Sugerencias sin revisar" aria-label="Sugerencias sin revisar" />}
                  <NfBadge form={t.normal_form} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="dd-scroll"><TableDetail t={current} /></div>
    </div>
  );
};

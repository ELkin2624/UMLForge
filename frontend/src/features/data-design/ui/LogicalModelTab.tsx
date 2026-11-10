import React from 'react';
import { Key, Link2 } from 'lucide-react';
import type { DataDesignResult, LogicalTable } from '../api/data-design-api';

const KIND_LABEL: Record<string, string> = {
  class: 'Clase',
  relationship: 'Relación',
  inheritance: 'Herencia',
};

const TableCard: React.FC<{ table: LogicalTable }> = ({ table }) => (
  <article className="dd-table-card" aria-label={`Tabla ${table.name}`}>
    <header className="dd-table-head">
      <strong>{table.name}</strong>
      {table.class_name && <span className="dd-muted"> ← clase {table.class_name}</span>}
      {table.kind === 'join' && <span className="dd-chip dd-chip--lilac">Intermedia</span>}
    </header>
    <table className="dd-columns">
      <thead>
        <tr><th scope="col">Columna</th><th scope="col">Tipo</th><th scope="col">Restricciones</th></tr>
      </thead>
      <tbody>
        {table.columns.map((c) => (
          <tr key={c.name}>
            <td>
              {c.is_pk && <Key size={12} aria-label="Clave primaria" className="dd-icon-pk" />}
              {c.is_fk && <Link2 size={12} aria-label="Clave foránea" className="dd-icon-fk" />}{' '}
              {c.name}
            </td>
            <td className="dd-mono">{c.sql_type}</td>
            <td className="dd-muted">
              {[
                c.is_pk ? 'PK' : null,
                c.is_fk ? `FK → ${c.references}` : null,
                !c.nullable ? 'NOT NULL' : null,
              ].filter(Boolean).join(' · ') || '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {table.notes.map((n) => <p key={n} className="dd-note">{n}</p>)}
  </article>
);

export const LogicalModelTab: React.FC<{ result: DataDesignResult }> = ({ result }) => {
  const { logical } = result;
  if (logical.tables.length === 0) {
    return <p className="dd-empty">El modelo no tiene clases todavía.</p>;
  }
  return (
    <div className="dd-scroll">
      <section aria-labelledby="dd-map-title">
        <h3 id="dd-map-title" className="dd-h3">Del modelo conceptual al lógico</h3>
        <p className="dd-muted dd-intro">
          Cada clase es candidata a tabla. Así se transformó cada elemento del diagrama de clases:
        </p>
        <ul className="dd-mapping">
          {logical.mappings.map((m, i) => (
            <li key={`${m.element}-${i}`}>
              <span className="dd-chip">{KIND_LABEL[m.kind]}</span>
              <strong>{m.element}</strong>
              <span aria-hidden> → </span>
              <span>{m.result}</span>
              <span className="dd-muted dd-rule">{m.rule}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dd-tables-title">
        <h3 id="dd-tables-title" className="dd-h3">Tablas ({logical.tables.length})</h3>
        <div className="dd-table-grid">
          {logical.tables.map((t) => <TableCard key={t.name} table={t} />)}
        </div>
      </section>
    </div>
  );
};

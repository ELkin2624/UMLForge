import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { UMLModel } from '../../types/canonical-model';
import { generateSql, type SqlMode } from './api';
import './SqlGenerationDialog.css';

export function SqlGenerationDialog({ model, onClose }: { model: UMLModel; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<SqlMode>('both');
  const [rows, setRows] = useState('3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    dialog.current?.showModal();
    return () => { mounted.current = false; };
  }, []);

  async function download(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const count = Number(rows);
    if (mode !== 'schema' && (!Number.isInteger(count) || count < 1 || count > 1000)) {
      setError('Introduce una cantidad entera entre 1 y 1.000.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const blob = await generateSql(model, mode, mode === 'schema' ? 3 : count);
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = mode === 'both' ? 'database.zip' : `${mode}.sql`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess(true);
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : 'No se pudo generar el SQL.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <dialog ref={dialog} className="sql-dialog" aria-labelledby="sql-title" onCancel={onClose}>
      <form onSubmit={download} aria-busy={loading}>
        <h2 id="sql-title">Generar SQL PostgreSQL</h2>
        <p>Se exportará el modelo lógico del diagrama actual. Las propuestas de normalización no aplicadas quedan fuera.</p>
        <label htmlFor="sql-mode">Contenido</label>
        <select id="sql-mode" value={mode} disabled={loading} onChange={e => {
          setMode(e.target.value as SqlMode); setSuccess(false);
        }}>
          <option value="schema">Solo estructura (schema.sql)</option>
          <option value="data">Solo datos sintéticos (data.sql)</option>
          <option value="both">Estructura y datos (ZIP)</option>
        </select>
        {mode !== 'schema' && <>
          <label htmlFor="sql-rows">Registros por entidad</label>
          <input id="sql-rows" type="number" min="1" max="1000" step="1" required value={rows}
            disabled={loading} onChange={e => { setRows(e.target.value); setSuccess(false); }} />
          <p>Datos por reglas locales, sin IA. Respetan tipos y referencias; no infieren reglas comerciales ausentes.</p>
          <p>Ejecuta los datos sobre un esquema compatible y vacío.</p>
        </>}
        {error && <p role="alert">{error}</p>}
        <p role="status">{loading ? 'Generando SQL…' : success ? 'Descarga preparada.' : ''}</p>
        <footer>
          <button type="button" onClick={onClose}>Cerrar</button>
          <button type="submit" disabled={loading}>{loading ? 'Generando…' : 'Descargar SQL'}</button>
        </footer>
      </form>
    </dialog>
  );
}

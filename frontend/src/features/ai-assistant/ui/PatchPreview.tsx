import React, { useMemo } from 'react';
import { useModelStore } from '../../../store/model-store';
import { previewPatch, type PreviewLine } from '../model/preview';
import type { AIPatch } from '../types';

const SYMBOL: Record<PreviewLine['kind'], string> = { add: '+', change: '~', remove: '−' };
const TEXT_COLOR: Record<PreviewLine['kind'], string> = {
  add: '#166534',
  change: '#1a1a1a',
  remove: '#991b1b',
};
const BACKGROUND: Record<PreviewLine['kind'], string> = {
  add: 'var(--pastel-mint, #a7f3d0)',
  change: 'var(--pastel-yellow, #fde68a)',
  remove: '#fee2e2',
};

/**
 * Vista previa de una sugerencia: qué se añadiría, cambiaría o borraría, calculado con la misma
 * traducción que usa la aprobación y SIN tocar el modelo. El símbolo (+ ~ −) acompaña al color.
 * Si la sugerencia quedó obsoleta, muestra el motivo.
 */
export const PatchPreview: React.FC<{ patch: AIPatch }> = ({ patch }) => {
  const model = useModelStore((s) => s.model);
  const preview = useMemo(() => (model ? previewPatch(model, patch) : null), [model, patch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {patch.status === 'stale' && (
        <div
          role="alert"
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#991b1b',
            background: '#fee2e2',
            border: '1.5px solid #1a1a1a',
            borderRadius: '8px',
            padding: '5px 8px',
          }}
        >
          Obsoleta: {patch.stale_reason ?? 'otra persona modificó este elemento.'}
        </div>
      )}
      {preview && (
        <div
          aria-label="Vista previa del cambio"
          style={{
            border: '1.5px solid #1a1a1a',
            borderRadius: '8px',
            overflow: 'hidden',
            fontFamily: 'var(--mono, ui-monospace, Consolas, monospace)',
            fontSize: '11px',
            opacity: patch.status === 'stale' ? 0.6 : 1,
          }}
        >
          {preview.ok ? (
            preview.lines.map((line, i) => (
              <div
                key={i}
                style={{
                  background: BACKGROUND[line.kind],
                  color: TEXT_COLOR[line.kind],
                  padding: '2px 8px',
                  paddingLeft: line.depth === 1 ? '22px' : '8px',
                }}
              >
                <strong aria-hidden="true">{SYMBOL[line.kind]}</strong> {line.text}
              </div>
            ))
          ) : (
            <div style={{ padding: '4px 8px', color: '#991b1b', background: '#fee2e2' }}>{preview.message}</div>
          )}
        </div>
      )}
    </div>
  );
};

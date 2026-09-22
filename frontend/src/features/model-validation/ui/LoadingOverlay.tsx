import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useModelStore } from '../../../store/model-store';

export const LoadingOverlay: React.FC = () => {
  const { e2eState, e2eStartedAt } = useModelStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (e2eState !== 'running') {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      if (e2eStartedAt) {
        const seconds = Math.floor((Date.now() - e2eStartedAt) / 1000);
        setElapsedSeconds(seconds);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [e2eState, e2eStartedAt]);

  if (e2eState !== 'running') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center z-[9999] text-white font-sans p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full text-center">
        <Loader2 className="w-12 h-12 text-holst-500 animate-spin" />

        <div>
          <h3 className="m-0 mb-1.5 text-lg font-bold text-slate-100">
            Ejecutando validación E2E...
          </h3>
          <p className="m-0 text-xs text-slate-400">
            Esto puede tardar hasta 60 segundos
          </p>
        </div>

        <div className="mt-1 bg-slate-950 border border-slate-800 px-4 py-1.5 rounded-full text-xs text-holst-300 font-mono tabular-nums font-semibold shadow-inner">
          Tiempo transcurrido: {elapsedSeconds} s
        </div>

        <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80 w-full tracking-wide">
          Validación · Generación · PostgreSQL · Maven · Spring Boot · Newman
        </div>
      </div>
    </div>
  );
};

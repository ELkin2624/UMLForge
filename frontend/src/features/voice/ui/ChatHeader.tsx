import React from 'react';
import { Sparkles, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { VoiceStatus } from '../model/types';

interface ChatHeaderProps {
  status: VoiceStatus;
  onCollapse: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ status, onCollapse }) => {
  return (
    <div className="h-14 px-4 bg-white border-b border-holst-100 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-holst-600 to-holst-800 flex items-center justify-center text-white shadow-md shadow-holst-600/25">
          <Sparkles size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-holst-900 leading-tight">
            Asistente IA UML
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {status === 'recording' && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-rose-600 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Escuchando...
              </span>
            )}
            {status === 'processing' && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-holst-700">
                <Loader2 size={11} className="animate-spin" />
                Procesando...
              </span>
            )}
            {status === 'ready' && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                En línea
              </span>
            )}
            {status === 'initializing' && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-holst-700">
                <Loader2 size={11} className="animate-spin" />
                Iniciando...
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-rose-600">
                <AlertCircle size={11} />
                Error
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={onCollapse}
        className="p-1.5 rounded-md text-slate-400 hover:text-holst-800 hover:bg-holst-100 transition-colors"
        title="Ocultar asistente"
        aria-label="Colapsar chat"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

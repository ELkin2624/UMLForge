import React from 'react';
import { Send } from 'lucide-react';
import { VoiceStatus } from '../model/types';
import { MicButton } from './MicButton';

interface ChatInputBarProps {
  inputText: string;
  setInputText: (v: string) => void;
  onSend: (e?: React.FormEvent) => void;
  status: VoiceStatus;
  onMicToggle: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  inputText,
  setInputText,
  onSend,
  status,
  onMicToggle,
}) => {
  const isBusy = status === 'processing' || status === 'initializing';
  const canSend = Boolean(inputText.trim()) && !isBusy;

  return (
    <form
      onSubmit={onSend}
      className="p-3 bg-white border-t border-holst-100 flex items-center gap-2 shrink-0"
    >
      <MicButton status={status} onToggle={onMicToggle} />

      <input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder={
          status === 'recording' ? 'Escuchando audio...' : 'Escribe un comando UML...'
        }
        disabled={isBusy || status === 'recording'}
        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-holst-500 focus:border-holst-600 focus:bg-white transition-all disabled:opacity-50"
      />

      <button
        type="submit"
        disabled={!canSend}
        className="p-2 rounded-xl bg-holst-600 text-white hover:bg-holst-700 active:bg-holst-800 disabled:opacity-40 disabled:hover:bg-holst-600 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm shadow-holst-600/25"
        title="Enviar mensaje"
        aria-label="Enviar"
      >
        <Send size={15} />
      </button>
    </form>
  );
};

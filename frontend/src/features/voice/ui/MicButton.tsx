import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { VoiceStatus } from '../model/types';

interface MicButtonProps {
  status: VoiceStatus;
  onToggle: () => void;
}

export const MicButton: React.FC<MicButtonProps> = ({ status, onToggle }) => {
  const isRecording = status === 'recording';
  const isBusy = status === 'processing' || status === 'initializing';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isBusy}
      className={`relative p-2 rounded-xl border transition-all duration-200 flex items-center justify-center ${
        isRecording
          ? 'bg-rose-50 border-rose-400 text-rose-600 vac-pulse-glow'
          : 'bg-white border-holst-300 text-holst-700 hover:text-holst-900 hover:bg-holst-100 hover:border-holst-500'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
      title={isRecording ? 'Detener grabación y enviar' : 'Hablar por micrófono'}
      aria-label={isRecording ? 'Detener micrófono' : 'Iniciar micrófono'}
    >
      {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  );
};

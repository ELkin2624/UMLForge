import React from 'react';
import { Mic, Sparkles } from 'lucide-react';
import { ChatMessage } from '../model/types';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-2.5">
        <div className="max-w-[85%] bg-holst-600 text-white rounded-2xl rounded-br-xs px-3.5 py-2.5 text-xs leading-relaxed shadow-sm shadow-holst-600/20">
          <div className="flex items-center gap-1.5 mb-1 opacity-80 text-[10px] uppercase tracking-wider font-semibold">
            {message.type === 'voice' && <Mic size={10} />}
            <span>{message.type === 'voice' ? 'Voz' : 'Tú'}</span>
          </div>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-2.5">
      <div className="max-w-[90%] bg-holst-100 text-holst-900 border border-holst-300/80 rounded-2xl rounded-bl-xs px-3.5 py-2.5 text-xs leading-relaxed shadow-sm">
        <div className="flex items-center gap-1.5 mb-1 text-holst-700 text-[10px] uppercase tracking-wider font-semibold">
          <Sparkles size={11} className="text-holst-600" />
          <span>Asistente</span>
        </div>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};

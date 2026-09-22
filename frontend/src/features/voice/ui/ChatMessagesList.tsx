import React from 'react';
import { Loader2 } from 'lucide-react';
import { ChatMessage, VoiceStatus } from '../model/types';
import { ChatMessageItem } from './ChatMessageItem';

interface ChatMessagesListProps {
  chatHistory: ChatMessage[];
  status: VoiceStatus;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatMessagesList: React.FC<ChatMessagesListProps> = ({
  chatHistory,
  status,
  messagesEndRef,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1 vac-messages-scroll">
      {chatHistory.map((msg) => (
        <ChatMessageItem key={msg.id} message={msg} />
      ))}

      {status === 'processing' && (
        <div className="flex justify-start mb-2">
          <div className="bg-holst-100/60 border border-holst-300/40 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-holst-700">
            <Loader2 size={13} className="animate-spin text-holst-600" />
            <span>Interpretando comando...</span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

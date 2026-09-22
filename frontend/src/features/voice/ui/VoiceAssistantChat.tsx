import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Bot, Mic } from 'lucide-react';
import { useVoiceAssistant } from '../model/store';
import { ChatHeader } from './ChatHeader';
import { ChatMessagesList } from './ChatMessagesList';
import { ChatInputBar } from './ChatInputBar';
import './VoiceAssistantChat.css';

/**
 * Componente principal del sidebar del Asistente de Voz e IA (FSD Feature).
 * Responsabilidad: Orquestar el layout del sidebar, estados de colapso y delegar la UI.
 */
export const VoiceAssistantChat: React.FC = () => {
  const {
    status,
    chatHistory,
    initialize,
    startRecording,
    stopRecordingAndProcess,
    processText,
  } = useVoiceAssistant();

  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : true);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al final al recibir nuevos mensajes
  useEffect(() => {
    if (!collapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, collapsed]);

  // Inicializar modelo de audio al montar
  useEffect(() => {
    if (status === 'idle') {
      initialize();
    }
  }, [status, initialize]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputText.trim() && status !== 'processing') {
      processText(inputText);
      setInputText('');
    }
  };

  const handleMicToggle = () => {
    if (status === 'ready' || status === 'error') {
      if (collapsed) setCollapsed(false);
      startRecording();
    } else if (status === 'recording') {
      stopRecordingAndProcess();
    }
  };

  return (
    <aside className={`vac-sidebar ${collapsed ? 'vac-collapsed' : ''}`}>
      {/* Pestaña flotante lateral para expandir/colapsar */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`vac-toggle-btn ${status === 'recording' ? 'vac-recording' : ''}`}
        title={collapsed ? 'Abrir Asistente IA' : 'Colapsar Asistente'}
        aria-label="Toggle Asistente IA"
      >
        {status === 'recording' ? (
          <Mic size={16} />
        ) : collapsed ? (
          <ChevronLeft size={16} />
        ) : (
          <ChevronRight size={16} />
        )}
        <Bot size={13} className="opacity-70" />
      </button>

      {/* Cabecera */}
      <ChatHeader status={status} onCollapse={() => setCollapsed(true)} />

      {/* Lista de Mensajes */}
      <ChatMessagesList
        chatHistory={chatHistory}
        status={status}
        messagesEndRef={messagesEndRef}
      />

      {/* Barra de Entrada */}
      <ChatInputBar
        inputText={inputText}
        setInputText={setInputText}
        onSend={handleSend}
        status={status}
        onMicToggle={handleMicToggle}
      />
    </aside>
  );
};

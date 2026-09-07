import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Send, Loader2, Terminal, ChevronRight, ChevronLeft, AlertCircle, Bot, Sparkles } from 'lucide-react';
import { useVoiceAssistant, ChatMessage } from '../store/use-voice-assistant';
import './VoiceAssistantChat.css';

export const VoiceAssistantChat: React.FC = () => {
  const { 
    status, 
    chatHistory,
    initialize,
    startRecording,
    stopRecordingAndProcess,
    processText,
    error,
    progress
  } = useVoiceAssistant();

  const [collapsed, setCollapsed] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (!collapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, collapsed]);

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

  // ── Grabación por click (Toggle) ─────────────────────────────────────────
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
      {/* Floating Toggle Tab */}
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className={`vac-toggle-btn ${status === 'recording' ? 'vac-recording' : ''}`}
        title={collapsed ? "Abrir Asistente IA" : "Colapsar Asistente"}
      >
        {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        <Sparkles size={16} color="#6366f1" />
      </button>

      {/* Header */}
      <div className="vac-header">
        <div className="vac-header-brand">
          <div className="vac-avatar-icon">
            <Bot size={18} />
          </div>
          <div className="vac-header-titles">
            <span className="vac-title">Asistente UML IA</span>
          </div>
        </div>
      </div>

      {/* Body / Content */}
      {(status === 'idle' || status === 'initializing') ? (
        <div className="vac-loading-container">
          <Loader2 className="vac-spinner" />
          <div className="vac-loading-text">Conectando al servidor Whisper...</div>
          <div className="vac-progress-track">
            <div 
              className="vac-progress-bar" 
              style={{ width: `${Math.round(progress)}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Chat Messages */}
          <div className="vac-messages-container">
            {chatHistory.map((msg: ChatMessage) => (
              <div 
                key={msg.id} 
                className={`vac-message-wrapper ${msg.role} ${msg.type === 'system' && msg.content.includes('error') ? 'error' : ''}`}
              >
                <div className="vac-bubble">
                  {msg.type === 'voice' && (
                    <span className="vac-voice-badge">
                      <Mic size={12} />
                      Voz:
                    </span>
                  )}
                  {msg.role === 'assistant' && !msg.content.includes('error') && (
                    <Terminal size={14} style={{ display: 'inline', marginRight: '6px', color: '#6366f1' }} />
                  )}
                  {msg.content}
                </div>
              </div>
            ))}

            {error && (
              <div className="vac-error-banner">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {status === 'processing' && (
              <div className="vac-message-wrapper assistant">
                <div className="vac-typing-bubble">
                  <div className="vac-dot" />
                  <div className="vac-dot" />
                  <div className="vac-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Controls */}
          <div className="vac-footer">
            <form onSubmit={handleSend}>
              <div className="vac-input-group">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ej: 'Crea la clase Usuario con id entero...'"
                  disabled={status === 'processing' || status === 'recording'}
                  className="vac-input"
                />
                {inputText.trim() && (
                  <button 
                    type="submit" 
                    disabled={status === 'processing'}
                    className="vac-send-btn"
                    title="Enviar comando"
                  >
                    <Send size={15} />
                  </button>
                )}
              </div>
            </form>

            <button 
              type="button"
              onClick={handleMicToggle}
              disabled={status === 'processing'}
              className={`vac-mic-btn ${status === 'recording' ? 'recording' : ''}`}
              title={status === 'recording' ? "Hacer clic para detener y procesar" : "Hacer clic para grabar"}
            >
              {status === 'recording' ? (
                <>
                  <MicOff size={16} />
                  <span>Detener y procesar</span>
                </>
              ) : (
                <>
                  <Mic size={16} color="#6366f1" />
                  <span>Clic para hablar</span>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </aside>
  );
};


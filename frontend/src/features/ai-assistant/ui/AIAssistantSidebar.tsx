import React, { useEffect, useState, useRef } from 'react';
import {
  Bot,
  Send,
  MessageSquare,
  History,
  Layers,
  Trash2,
  Lock,
  Sparkles,
  Mic,
  MicOff,
  Image as ImageIcon,
  X,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useAIAssistantStore } from '../model/ai-store';
import { useAuthStore } from '../../auth/store';
import { useShareStore } from '../../sharing/model/share-store';
import { getSharedCollaborationManager } from '../../collaboration';
import { SpeechEngine } from '../../voice/api/speech-engine';
import { WhisperEngine } from '../../voice/api/whisper-engine';
import { AuditFeedTab } from './AuditFeedTab';
import './AIAssistantSidebar.css';

export const AIAssistantSidebar: React.FC = () => {
  const {
    privateHistory,
    activeTab,
    isThinking,
    suggestions,
    setActiveTab,
    loadHistory,
    clearHistory,
    sendMessage,
    approvePatch,
    rejectPatch,
    syncWithYjs,
  } = useAIAssistantStore();

  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 900 : true
  );
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const whisperEngineRef = useRef<WhisperEngine | null>(null);
  const recognitionRef = useRef<any>(null);

  const roomId = useShareStore((s) => s.roomId) || 'default-room';
  const currentUser = useAuthStore((s) => s.user);
  const userId = currentUser?.id ? String(currentUser.id) : 'guest_user';
  const userName = currentUser?.display_name || currentUser?.username || 'Usuario';

  const manager = getSharedCollaborationManager();
  const ydoc = manager.getDoc();

  // Inicializar motores de voz
  useEffect(() => {
    speechEngineRef.current = new SpeechEngine();
    whisperEngineRef.current = new WhisperEngine();
    return () => {
      speechEngineRef.current?.dispose();
    };
  }, []);

  // Sincronizar mapas de Yjs (presencia de IA y sugerencias compartidas)
  useEffect(() => {
    const unbind = syncWithYjs(ydoc);
    return () => unbind();
  }, [ydoc, syncWithYjs]);

  // Cargar historial privado del usuario al montar o cambiar de sala
  useEffect(() => {
    if (roomId && userId) {
      loadHistory(roomId, userId);
    }
  }, [roomId, userId, loadHistory]);

  // Auto-scroll al recibir mensajes
  useEffect(() => {
    if (!collapsed && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [privateHistory, collapsed, activeTab]);

  // Soporte para pegar imágenes directamente (Ctrl + V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setAttachedImage(event.target.result as string);
            }
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachedImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Manejo de grabación por voz (Micrófono dual: Web Speech API tiempo real + Whisper backend)
  const handleMicToggle = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsTranscribing(true);

      // Detener Web Speech API si estaba activo
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }

      try {
        const audioBlob = await speechEngineRef.current?.stopRecording();
        if (audioBlob && whisperEngineRef.current) {
          const text = await whisperEngineRef.current.transcribe(audioBlob);
          if (text.trim()) {
            setInputText(text.trim());
          }
        }
      } catch (err) {
        console.warn('Whisper backend advertencia (usando transcripción actual):', err);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Iniciar grabación de audio y reconocimiento simultáneo
      try {
        await speechEngineRef.current?.startRecording();
        setIsRecording(true);

        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          try {
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.onresult = (event: any) => {
              let transcript = '';
              for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
              }
              if (transcript.trim()) {
                setInputText(transcript.trim());
              }
            };
            recognition.onerror = () => {};
            recognition.start();
            recognitionRef.current = recognition;
          } catch {}
        }
      } catch (err) {
        console.error('No se pudo acceder al micrófono:', err);
      }
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && !attachedImage) || isThinking) return;

    sendMessage({
      diagramId: roomId,
      userId,
      userName,
      prompt: inputText.trim(),
      imageBase64: attachedImage || undefined,
      ydoc,
    });

    setInputText('');
    setAttachedImage(null);
  };

  const patchCount = Object.keys(suggestions).length;

  return (
    <>
      {/* Botón flotante para abrir cuando está colapsado */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="ai-toggle-btn"
          title="Abrir Arquitecto IA Colaborativo"
          aria-label="Abrir Arquitecto IA"
        >
          <Bot size={17} />
          <span>Arquitecto IA</span>
          {patchCount > 0 && <span className="ai-tab-badge">{patchCount}</span>}
        </button>
      )}

      <aside className={`ai-sidebar ${collapsed ? 'ai-collapsed' : ''}`} onPaste={handlePaste}>
        {/* Cabecera sincronizada con TopMenuBar */}
        <div className="ai-header">
          <div className="ai-header-left">
            <div className="ai-header-icon">
              <Bot size={18} />
            </div>
            <div>
              <div className="ai-header-title">
                Arquitecto IA
                <span className="ai-badge-private">
                  <Lock size={9} /> Privado
                </span>
              </div>
              <div className="ai-header-subtitle">Memoria Compartida Activa</div>
            </div>
          </div>

          <div className="ai-header-actions">
            {activeTab === 'chat' && (
              <button
                onClick={() => clearHistory(roomId, userId)}
                className="ai-action-btn"
                title="Limpiar chat privado"
                aria-label="Limpiar historial"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={() => setCollapsed(true)}
              className="ai-action-btn"
              title="Colapsar panel"
              aria-label="Cerrar panel"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Selector de Pestañas Bauhaus */}
        <div className="ai-tabs">
          <button
            className={`ai-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={13} /> Chat
          </button>
          <button
            className={`ai-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <History size={13} /> Muro Equipo
          </button>
          <button
            className={`ai-tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestions')}
          >
            <Layers size={13} /> Sugerencias
            {patchCount > 0 && <span className="ai-tab-badge">{patchCount}</span>}
          </button>
        </div>

        {/* Contenido según Pestaña */}
        {activeTab === 'chat' && (
          <>
            <div className="ai-messages-container">
              {privateHistory.map((msg) => (
                <div key={msg.id} className={`ai-msg ai-msg-${msg.role}`}>
                  <div className="ai-msg-bubble">
                    {/* Si el mensaje tiene imagen adjunta */}
                    {msg.image && (
                      <div className="ai-msg-image-thumb">
                        <img src={msg.image} alt="Boceto o diagrama adjuntado" />
                      </div>
                    )}

                    <div>{msg.content}</div>

                    {/* Si produjo parches UML */}
                    {msg.patches && msg.patches.length > 0 && (
                      <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #1a1a1a' }}>
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#7c3aed',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '4px',
                          }}
                        >
                          <Sparkles size={11} /> {msg.patches.length} sugerencia(s) generada(s)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {msg.patches.map((p) => (
                            <div
                              key={p.patch_id}
                              style={{
                                fontSize: '11px',
                                backgroundColor: '#faf5ff',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: '1.5px dashed #1a1a1a',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <span>
                                <strong>{p.operation}</strong>: {p.target}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="ai-msg ai-msg-model">
                  <div
                    className="ai-msg-bubble"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7c3aed', fontWeight: 600 }}
                  >
                    <Sparkles size={15} className="animate-spin" />
                    <span>Gemini analizando contexto, memoria y diseñando arquitectura...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Formulario de entrada Multimodal (Texto + Voz + Imágenes) */}
            <div className="ai-input-area">
              {/* Vista previa de imagen adjunta */}
              {attachedImage && (
                <div className="ai-attached-preview">
                  <img src={attachedImage} alt="Preview" className="ai-preview-thumb" />
                  <span className="ai-preview-info">Boceto/Imagen lista para análisis</span>
                  <button
                    type="button"
                    onClick={() => setAttachedImage(null)}
                    className="ai-preview-remove-btn"
                    title="Quitar imagen"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Input file invisible */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                style={{ display: 'none' }}
              />

              <form onSubmit={handleSend} className="ai-input-form">
                {/* Botón Imagen / Boceto */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isThinking || isRecording}
                  className="ai-btn-addon"
                  title="Subir imagen o boceto de diagrama (también puedes pegar con Ctrl+V)"
                >
                  <ImageIcon size={17} />
                </button>

                {/* Botón Micrófono / Voz */}
                <button
                  type="button"
                  onClick={handleMicToggle}
                  disabled={isThinking || isTranscribing}
                  className={`ai-btn-addon ${isRecording ? 'recording' : ''}`}
                  title={isRecording ? 'Detener grabación y transcribir' : 'Hablar por micrófono (Voz)'}
                >
                  {isTranscribing ? (
                    <Loader2 size={17} className="animate-spin text-purple-600" />
                  ) : isRecording ? (
                    <MicOff size={17} />
                  ) : (
                    <Mic size={17} />
                  )}
                </button>

                {/* Input de Texto */}
                <input
                  type="text"
                  placeholder={
                    isRecording
                      ? 'Escuchando audio...'
                      : isTranscribing
                      ? 'Transcribiendo con Whisper...'
                      : 'Escribe, habla o pega un boceto...'
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="ai-text-input"
                  disabled={isThinking || isRecording}
                />

                {/* Botón Enviar */}
                <button
                  type="submit"
                  disabled={(!inputText.trim() && !attachedImage) || isThinking || isRecording}
                  className="ai-send-btn"
                  title="Enviar a la IA"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          </>
        )}

        {activeTab === 'audit' && <AuditFeedTab />}

        {activeTab === 'suggestions' && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: '#fafaf9',
            }}
          >
            {patchCount === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', marginTop: '30px' }}>
                No hay sugerencias pendientes en el lienzo.
              </div>
            ) : (
              Object.values(suggestions).map((patch) => (
                <div key={patch.patch_id} className="ai-patch-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                    }}
                  >
                    <strong style={{ fontSize: '13px', color: '#1a1a1a' }}>{patch.target}</strong>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        background: '#fef08a',
                        border: '1.5px solid #1a1a1a',
                        borderRadius: '6px',
                      }}
                    >
                      {patch.operation}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', color: '#475569', lineHeight: 1.4 }}>
                    {patch.reason}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#7c3aed' }}>
                      Por: {patch.requested_by}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() =>
                          approvePatch({
                            diagramId: roomId,
                            patchId: patch.patch_id,
                            userName,
                            ydoc,
                          })
                        }
                        className="ai-patch-btn-approve"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() =>
                          rejectPatch({
                            diagramId: roomId,
                            patchId: patch.patch_id,
                            userName,
                            ydoc,
                          })
                        }
                        className="ai-patch-btn-reject"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </aside>
    </>
  );
};

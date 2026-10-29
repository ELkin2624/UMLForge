import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useApp } from '../../src/AppContext';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp?: string;
}

export default function ChatScreen() {
  const { manifest } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const flatListRef = useRef<any>(null);

  const API_URL = 'http://10.0.2.2:8000/api/v1'; // 10.0.2.2 para Android emulator
  const diagramId = manifest.id || '1';
  const userId = 'mobile_user';
  const userName = 'Desarrollador Móvil';

  // Cargar historial privado del usuario
  async function loadHistory() {
    try {
      const res = await fetch(`${API_URL}/ai/history/${diagramId}?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const mapped: ChatMessage[] = data.map((m: any, idx: number) => ({
            id: String(idx),
            sender: m.role === 'user' ? 'user' : 'assistant',
            text: m.content,
            timestamp: m.timestamp,
          }));
          setMessages(mapped);
          return;
        }
      }
    } catch (err) {
      console.warn('Error loading private history:', err);
    }

    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: `¡Hola! Soy tu Arquitecto IA Omnisciente en ${manifest.display_name}. Tu chat es privado, pero conozco las decisiones de arquitectura de todo el equipo en el lienzo.`,
      },
    ]);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleSend(textToSend?: string) {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    try {
      const res = await fetch(`${API_URL}/ai/collaborate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagram_id: String(diagramId),
          user_id: userId,
          user_name: userName,
          prompt: text,
          current_canvas_snapshot: {},
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: data.reply,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error('Respuesta no satisfactoria del servidor');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'system',
          text: `⚠️ Error al conectar con el Arquitecto IA: ${err.message || 'Servidor no disponible'}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.privacyBanner}>
        <Text style={styles.privacyText}>🔒 Chat Privado • Conectado a Memoria Cognitiva Compartida</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isUser = item.sender === 'user';
          const isSystem = item.sender === 'system';

          if (isSystem) {
            return (
              <View style={styles.systemBubble}>
                <Text style={styles.systemText}>{item.text}</Text>
              </View>
            );
          }

          return (
            <View style={[styles.bubbleWrapper, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
                  {item.text}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {isProcessing && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#8B5CF6" />
          <Text style={styles.typingText}>Arquitecto IA consultando memoria compartida...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Escribe tu consulta arquitectónica..."
          placeholderTextColor="#64748b"
          value={inputText}
          onChangeText={setInputText}
          editable={!isProcessing}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isProcessing) && styles.sendButtonDisabled]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || isProcessing}
        >
          <Text style={styles.sendButtonText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f131c',
  },
  privacyBanner: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  privacyText: {
    fontSize: 11,
    color: '#c4b5fd',
    fontWeight: '500',
  },
  messageList: {
    padding: 14,
    gap: 10,
  },
  bubbleWrapper: {
    marginBottom: 6,
    flexDirection: 'row',
  },
  bubbleRight: {
    justifyContent: 'flex-end',
  },
  bubbleLeft: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 14,
  },
  userBubble: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    backgroundColor: '#1a1f2e',
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderWidth: 1,
    borderBottomLeftRadius: 2,
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginVertical: 4,
  },
  systemText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  userText: {
    color: '#ffffff',
  },
  aiText: {
    color: '#f1f5f9',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 11,
    color: '#c4b5fd',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#141824',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#0b0e14',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  sendButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
});

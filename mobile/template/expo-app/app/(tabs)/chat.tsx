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
  ScrollView,
} from 'react-native';
import { HolstTheme } from '@umlforge/ui';
import { useApp } from '../../src/AppContext';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
}

export default function ChatScreen() {
  const { orchestrator, manifest, activeDriverName } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'assistant',
      text: `¡Hola! Soy el asistente inteligente de ${manifest.display_name}. Puedes preguntarme sobre los servicios, catálogo de cortes, citas o personal registrado.`,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const flatListRef = useRef<any>(null);

  const [pendingConfirmation, setPendingConfirmation] = useState<any | null>(null);

  const quickPrompts = [
    '¿Qué cortes de pelo tienen disponibles?',
    '¿Cuáles son los barberos del local?',
    '¿Qué citas están agendadas?',
  ];

  async function handleSend(textToSend?: string) {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text,
    };

    setMessages((prev: ChatMessage[]) => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);
    setCurrentStep('Iniciando inferencia...');

    try {
      const result = await orchestrator.processUserMessage(text, (step: string) => {
        setCurrentStep(step);
      });

      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: result.content,
      };

      setMessages((prev: ChatMessage[]) => [...prev, assistantMsg]);

      if (result.pendingConfirmation) {
        setPendingConfirmation(result.pendingConfirmation);
      } else {
        setPendingConfirmation(null);
      }
    } catch (err: any) {
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: `Hubo un inconveniente al procesar tu solicitud: ${err.message}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
    }
  }

  async function handleConfirmAction() {
    if (!pendingConfirmation || isProcessing) return;
    setIsProcessing(true);
    setCurrentStep('Ejecutando operación autorizada...');

    try {
      const result = await orchestrator.confirmPendingToolCall((step: string) => {
        setCurrentStep(step);
      });

      setPendingConfirmation(null);
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'assistant',
          text: result.content,
        },
      ]);
    } catch (err: any) {
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'assistant',
          text: `Error al ejecutar operación: ${err.message}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
    }
  }

  async function handleCancelAction() {
    if (!pendingConfirmation || isProcessing) return;
    setIsProcessing(true);

    try {
      const result = await orchestrator.cancelPendingToolCall('El usuario rechazó la confirmación en pantalla');
      setPendingConfirmation(null);
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'assistant',
          text: result.content,
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
      {/* Driver Indicator Banner */}
      <View style={styles.topBanner}>
        <Text style={styles.topBannerText}>
          ⚡ Motor On-Device: <Text style={styles.bold}>{activeDriverName}</Text>
        </Text>
      </View>

      {/* Mensajes */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item: ChatMessage) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }: { item: ChatMessage }) => {
          const isUser = item.sender === 'user';
          return (
            <View
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  isUser ? styles.userText : styles.assistantText,
                ]}
              >
                {item.text}
              </Text>
            </View>
          );
        }}
      />

      {/* Banner de Estado de Tool Calling */}
      {isProcessing && currentStep && (
        <View style={styles.stepBanner}>
          <ActivityIndicator size="small" color={HolstTheme.colors.primary700} />
          <Text style={styles.stepText}>{currentStep}</Text>
        </View>
      )}

      {/* Sugerencias Rápidas */}
      <View style={styles.quickPromptsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {quickPrompts.map((prompt, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.promptChip}
              onPress={() => handleSend(prompt)}
              disabled={isProcessing}
            >
              <Text style={styles.promptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tarjeta de Confirmación Humana Requerida (Human-In-The-Loop) */}
      {pendingConfirmation && (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>
            ⚠️ Confirmación Requerida ({pendingConfirmation.actionType})
          </Text>
          <Text style={styles.confirmDesc}>
            {pendingConfirmation.description}
          </Text>
          <Text style={styles.confirmParams}>
            Parámetros: {JSON.stringify(pendingConfirmation.arguments)}
          </Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.cancelBtn]}
              onPress={handleCancelAction}
              disabled={isProcessing}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.actionBtn]}
              onPress={handleConfirmAction}
              disabled={isProcessing}
            >
              <Text style={styles.actionBtnText}>Confirmar y Ejecutar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input de Mensaje */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Escribe una pregunta sobre el negocio..."
          placeholderTextColor={HolstTheme.colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSend()}
          editable={!isProcessing}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() || isProcessing ? styles.sendButtonDisabled : null]}
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
    backgroundColor: HolstTheme.colors.background,
  },
  topBanner: {
    backgroundColor: HolstTheme.colors.surfaceSubtle,
    paddingVertical: 6,
    paddingHorizontal: HolstTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: HolstTheme.colors.border,
    alignItems: 'center',
  },
  topBannerText: {
    fontSize: 11,
    color: HolstTheme.colors.primary900,
  },
  bold: {
    fontWeight: 'bold',
  },
  messagesList: {
    padding: HolstTheme.spacing.md,
    gap: HolstTheme.spacing.sm,
  },
  messageBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: HolstTheme.borderRadius.md,
    marginBottom: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: HolstTheme.colors.primary700,
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: HolstTheme.colors.surface,
    borderWidth: 1,
    borderColor: HolstTheme.colors.border,
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#FFF',
  },
  assistantText: {
    color: HolstTheme.colors.textMain,
  },
  stepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: HolstTheme.colors.primary100,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: HolstTheme.colors.primary300,
  },
  stepText: {
    fontSize: 12,
    color: HolstTheme.colors.primary900,
    fontWeight: '500',
  },
  quickPromptsContainer: {
    paddingHorizontal: HolstTheme.spacing.md,
    paddingVertical: 6,
    backgroundColor: HolstTheme.colors.background,
  },
  promptChip: {
    backgroundColor: HolstTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: HolstTheme.borderRadius.full,
    borderWidth: 1,
    borderColor: HolstTheme.colors.border,
    marginRight: 8,
  },
  promptText: {
    fontSize: 12,
    color: HolstTheme.colors.primary800,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: HolstTheme.spacing.sm,
    backgroundColor: HolstTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: HolstTheme.colors.border,
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: HolstTheme.colors.surfaceSubtle,
    borderRadius: HolstTheme.borderRadius.full,
    paddingHorizontal: 16,
    fontSize: 14,
    color: HolstTheme.colors.textMain,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: HolstTheme.colors.primary700,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: HolstTheme.borderRadius.full,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  confirmBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: HolstTheme.borderRadius.md,
    margin: HolstTheme.spacing.sm,
    padding: HolstTheme.spacing.md,
  },
  confirmTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4,
  },
  confirmDesc: {
    fontSize: 12,
    color: '#78350F',
    marginBottom: 4,
  },
  confirmParams: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#B45309',
    marginBottom: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  confirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelBtn: {
    backgroundColor: '#E5E7EB',
  },
  cancelBtnText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  actionBtn: {
    backgroundColor: HolstTheme.colors.primary700,
  },
  actionBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

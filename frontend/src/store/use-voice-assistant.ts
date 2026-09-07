import { create } from 'zustand';
import { WhisperEngine } from '../voice/whisper-engine';
import { SpeechEngine } from '../voice/speech-engine';
import { parseIntentStructured } from '../voice/intent-parser';
import { applyCommands } from '../voice/command-applier';
import { UMLCommand, CommandResult } from '../voice/types';
import { useModelStore } from './model-store';
import { UMLModel } from '../types/canonical-model';
import { canUseMutatingVoiceCommands, READER_VOICE_BLOCKED_MESSAGE } from '../features/sharing/model/capabilities';
import { useShareStore } from '../features/sharing/model/share-store';

export type VoiceStatus = 
  | 'idle' 
  | 'initializing' 
  | 'ready' 
  | 'recording' 
  | 'processing' 
  | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'voice' | 'system';
}

interface VoiceAssistantState {
  status: VoiceStatus;
  runtime: string | null;
  progress: number;
  transcription: string;
  lastCommands: UMLCommand[];
  lastResult: CommandResult | null;
  error: string | null;
  chatHistory: ChatMessage[];

  initialize: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecordingAndProcess: () => Promise<void>;
  processText: (text: string, isVoice?: boolean) => void;
  reset: () => void;
}

const speechEngine = new SpeechEngine();
const whisperEngine = new WhisperEngine();

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useVoiceAssistant = create<VoiceAssistantState>((set, get) => ({
  status: 'idle',
  runtime: null,
  progress: 0,
  transcription: '',
  lastCommands: [],
  lastResult: null,
  error: null,
  chatHistory: [{
    id: 'welcome',
    role: 'assistant',
    content: '¡Hola! Puedes hablarme por micrófono o escribirme comandos como: "Crea la clase Usuario con atributos nombre tipo string y edad tipo entero".',
    type: 'system'
  }],

  initialize: async () => {
    try {
      set({ status: 'initializing', error: null, progress: 0 });
      
      const { runtime } = await whisperEngine.initialize();
      set({ 
        status: 'ready', 
        runtime, 
        progress: 100 
      });
    } catch (err: any) {
      set({ status: 'error', error: err.message || 'Error inicializando el motor de voz' });
    }
  },

  startRecording: async () => {
    try {
      set({ status: 'recording', error: null, transcription: '' });
      await speechEngine.startRecording();
    } catch (err: any) {
      set({ status: 'error', error: err.message || 'Error al grabar audio' });
    }
  },

  stopRecordingAndProcess: async () => {
    try {
      set({ status: 'processing' });
      const audioBuffer = await speechEngine.stopRecording();
      if (audioBuffer && audioBuffer.size > 1000) { 
        const transcription = await whisperEngine.transcribe(audioBuffer);
        if (transcription && transcription.trim()) {
          set({ transcription });
          get().processText(transcription, true);
          return;
        }
      }
      set({ status: 'ready' });
    } catch (err: any) {
      set({ status: 'error', error: err.message || 'Error procesando audio final' });
    }
  },

  processText: async (text: string, isVoice = false) => {
    if (!text.trim()) {
      set({ status: 'ready' });
      return;
    }

    const { chatHistory } = get();
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      type: isVoice ? 'voice' : 'text'
    };

    set({ chatHistory: [...chatHistory, userMessage], status: 'processing' });

    // READER PROTECTION
    const { localRole } = useShareStore.getState();
    if (!canUseMutatingVoiceCommands(localRole)) {
      const errorResult = {
        success: false,
        model: useModelStore.getState().model,
        message: READER_VOICE_BLOCKED_MESSAGE,
        warnings: [],
        errors: [READER_VOICE_BLOCKED_MESSAGE],
      };
      
      set({
        status: 'ready',
        lastCommands: [],
        lastResult: errorResult,
        chatHistory: [...get().chatHistory, {
          id: generateId(),
          role: 'assistant',
          content: READER_VOICE_BLOCKED_MESSAGE,
          type: 'system'
        }]
      });
      return;
    }

    const currentModel: UMLModel = useModelStore.getState().model || { 
      classes: [], 
      relationships: [],
      components: [],
      interfaces: [],
      diagrams: []
    };

    let initialContext: string | undefined = undefined;
    const selectedId = useModelStore.getState().selectedNodeId;
    if (selectedId) {
      const selectedClass = currentModel.classes.find(c => c.id === selectedId);
      if (selectedClass) initialContext = selectedClass.name;
    }
    if (!initialContext && currentModel.classes.length > 0) {
      const lowerText = text.toLowerCase();
      // Buscar la clase con nombre más largo primero para evitar sub-matches
      const sortedClasses = [...currentModel.classes].sort((a, b) => b.name.length - a.name.length);
      for (const cls of sortedClasses) {
        if (lowerText.includes(cls.name.toLowerCase())) {
          initialContext = cls.name;
          break;
        }
      }
    }

    let commands: UMLCommand[] = [];
    let parseWarnings: string[] = [];
    let disambiguationPrompt: string | undefined = undefined;

    try {
      const response = await fetch('http://localhost:8000/api/v1/voice/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          current_model: currentModel,
          initial_context: initialContext
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      commands = data.commands || [];
      console.log("[use-voice-assistant] LLM Commands parsed:", commands);
    } catch (err) {
      console.error("[use-voice-assistant] Backend LLM parsing failed, falling back to deterministic parser.", err);
      // Fallback al parser determinista local
      const parseResult = parseIntentStructured(text, initialContext);
      commands = parseResult.commands;
      parseWarnings = parseResult.warnings;
      disambiguationPrompt = parseResult.disambiguationPrompt;
    }

    let result: CommandResult | null = null;
    let assistantMessageContent = '';

    if (disambiguationPrompt) {
      assistantMessageContent = `❓ ${disambiguationPrompt}`;
    } else if (commands.length > 0) {
      result = applyCommands(currentModel, commands);
      // Adjuntar warnings de parseo (ej: truncado de >3 cláusulas)
      if (parseWarnings.length > 0) {
        result.warnings.push(...parseWarnings);
      }

      if (result.success && result.model) {
        useModelStore.getState().setModel(result.model);
        const warningSuffix = result.warnings.length > 0 ? `\n ${result.warnings.join('\n')}` : '';
        assistantMessageContent = (result.message || `Se ejecutaron ${commands.length} comandos correctamente.`) + warningSuffix;
      } else {
        assistantMessageContent = 'Ocurrió un error al aplicar los comandos: ' + result.errors.join(', ');
      }
    } else if (parseWarnings.length > 0) {
      assistantMessageContent = parseWarnings.join('\n');
    } else {
      assistantMessageContent = 'No entendí ningún comando válido en tu mensaje.';
    }

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: assistantMessageContent,
      type: 'system'
    };

    set({ 
      status: 'ready', 
      lastCommands: commands,
      lastResult: result,
      chatHistory: [...get().chatHistory, assistantMessage]
    });
  },

  reset: () => {
    set({
      transcription: '',
      lastCommands: [],
      lastResult: null,
      error: null,
      status: 'ready',
      chatHistory: [{
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola! Puedes hablarme o escribirme comandos.',
        type: 'system'
      }]
    });
  }
}));

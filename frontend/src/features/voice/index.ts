export { VoiceAssistantChat } from './ui/VoiceAssistantChat';
export { useVoiceAssistant } from './model/store';
export { WhisperEngine } from './api/whisper-engine';
export { SpeechEngine } from './api/speech-engine';
export { parseIntentRemote } from './api/voice-api';
export { parseIntentStructured } from './model/intent-parser';
export { applyCommands } from './model/command-applier';
export { normalizeCommandText, capitalizeClassName } from './model/normalization';
export { mapTypeToUML } from './model/type-mapper';
export { parseAttributeList } from './model/attribute-parser';

export type {
  ChatMessage,
  VoiceStatus,
  UMLCommand,
  CommandResult,
  VoiceAssistantState,
} from './model/types';

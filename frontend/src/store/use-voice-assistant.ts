/**
 * Voice Assistant Store Entry Point
 * Refactored to follow Feature-Sliced Design (FSD).
 * Canonical implementation now lives in `src/features/voice`.
 */
export { useVoiceAssistant } from '../features/voice';
export type { VoiceStatus, ChatMessage, VoiceAssistantState } from '../features/voice';

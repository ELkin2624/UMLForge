export class WhisperEngine {
  constructor() {}

  async initialize(): Promise<{ runtime: string; model: string }> {
    return { runtime: 'backend', model: 'faster-whisper-base-int8' };
  }

  async transcribe(audio: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('audio', audio, 'audio.webm');

    try {
      const response = await fetch('/api/v1/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error del backend al transcribir: ${response.statusText}`);
      }

      const data = await response.json();
      return data.text || '';
    } catch (error) {
      console.error('Error al comunicarse con el backend de transcripción:', error);
      throw error;
    }
  }

  dispose() {
    // Nada que limpiar aquí
  }
}

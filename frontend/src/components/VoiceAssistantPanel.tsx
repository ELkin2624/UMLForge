import React, { useEffect } from 'react';
import { Mic, MicOff, Loader2, AlertCircle, CheckCircle, Terminal } from 'lucide-react';
import { useVoiceAssistant } from '../store/use-voice-assistant';

export const VoiceAssistantPanel: React.FC = () => {
  const { 
    status, 
    runtime, 
    progress, 
    transcription, 
    lastCommands, 
    lastResult, 
    error,
    initialize,
    startRecording,
    stopRecordingAndProcess
  } = useVoiceAssistant();


  useEffect(() => {
    // Inicializar modelo al montar el componente
    if (status === 'idle') {
      initialize();
    }
  }, [status, initialize]);

  const handleMicClick = () => {
    if (status === 'ready') {
      startRecording();
    } else if (status === 'recording') {
      stopRecordingAndProcess();
    }
  };

  if (status === 'idle' || status === 'initializing') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 w-80">
        <div className="flex items-center space-x-3 text-blue-600 dark:text-blue-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium text-sm">Conectando a Whisper...</span>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
          <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.round(progress)}%` }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 w-80 flex flex-col max-h-[400px]">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">Asistente UML Local</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-[10px] uppercase font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">
            Backend
          </span>
          <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {runtime || 'WASM'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Transcription Feedback */}
        {transcription && (
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded-md text-sm italic">
            "{transcription}"
          </div>
        )}

        {/* Status / Errors */}
        {error && (
          <div className="flex items-start space-x-2 text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/10 p-2 rounded">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {status === 'processing' && (
          <div className="flex items-center space-x-2 text-gray-500 text-sm justify-center py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Enviando audio al servidor...</span>
          </div>
        )}

        {/* Results */}
        {lastResult && (
          <div className="space-y-2">
            <div className={`flex items-center space-x-2 text-xs font-medium p-2 rounded ${
              lastResult.success ? 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {lastResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{lastResult.message}</span>
            </div>
            
            {lastCommands.length > 0 && (
              <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs font-mono text-gray-700 dark:text-gray-300 space-y-1">
                <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Comandos Parseados:</div>
                {lastCommands.map((c, i) => (
                  <div key={i} className="truncate">
                    <span className="text-blue-600 dark:text-blue-400">{c.type}</span> 
                    {c.type === 'CREATE_CLASS' && ` ${c.className}`}
                    {c.type === 'CREATE_RELATIONSHIP' && ` ${c.sourceClass} -> ${c.targetClass}`}
                  </div>
                ))}
              </div>
            )}
            
            {lastResult.warnings.length > 0 && (
              <div className="text-yellow-600 dark:text-yellow-500 text-xs mt-2 space-y-1">
                {lastResult.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
              </div>
            )}
          </div>
        )}

        {status === 'ready' && !transcription && !error && !lastResult && (
          <div className="text-center text-gray-500 text-xs py-4">
            Presiona el micrófono y habla para generar UML. Ej: "Crea la clase Usuario y añádele el atributo email de tipo String".
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-center bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
        <button
          onClick={handleMicClick}
          disabled={status === 'processing'}
          className={`relative p-4 rounded-full flex items-center justify-center transition-all ${
            status === 'recording'
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/30'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={status === 'recording' ? 'Detener grabación' : 'Empezar a hablar'}
        >
          {status === 'recording' ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiClient } from '@umlforge/api-client';
import { SchemaEngine, MobileSchemaInfo, ManifestInfo } from '@umlforge/schema-runtime';
import {
  ToolRegistry,
  ToolCallOrchestrator,
  MockDriver,
  OllamaHttpDriver,
  LlamaNativeDriver,
  ToolsManifest,
  BaseAIDriver,
  ModelManager,
} from '@umlforge/ai-runtime';

// Cargar el proyecto activo generado por UMLForge
import defaultManifest from '../../../apps/current/manifest.json';
import defaultSchema from '../../../apps/current/schema.json';
import defaultTools from '../../../apps/current/ai-tools.json';

interface AppContextValue {
  manifest: ManifestInfo;
  schemaEngine: SchemaEngine;
  apiClient: ApiClient;
  orchestrator: ToolCallOrchestrator;
  activeDriverName: string;
  isReady: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider = ({ children }: { children: any }) => {
  const [contextValue, setContextValue] = useState<AppContextValue | null>(null);

  useEffect(() => {
    async function initApp() {
      const manifest = defaultManifest as ManifestInfo;
      const schema = defaultSchema as unknown as MobileSchemaInfo;
      const toolsManifest = defaultTools as unknown as ToolsManifest;

      // 1. Instanciar ApiClient con la URL del backend del manifest
      const apiClient = new ApiClient({
        baseUrl: manifest.backend.base_url || 'http://localhost:8000',
      });

      // 2. Instanciar SchemaEngine para CRUD dinámico
      const schemaEngine = new SchemaEngine(schema);

      // 3. Registrar herramientas de IA
      const toolRegistry = new ToolRegistry();
      toolRegistry.registerTools(toolsManifest.tools);

      // 4. Seleccionar Driver de IA según configuración y disponibilidad
      let driver: BaseAIDriver = new MockDriver();
      let activeDriverName = 'Mock (Modo Pruebas Inmediatas)';

      if (manifest.ai.driver === 'ollama-http') {
        const ollamaDriver = new OllamaHttpDriver({
          baseUrl: 'http://localhost:11434',
          modelName: 'qwen2.5:0.5b',
        });
        if (await ollamaDriver.isAvailable()) {
          driver = ollamaDriver;
          activeDriverName = 'Ollama HTTP (Edge/Dev)';
        }
      } else if (manifest.ai.driver === 'llama-native') {
        const modelPath = ModelManager.getModelLocalPath(manifest.ai.model || 'qwen2.5-0.5b-instruct');
        const nativeDriver = new LlamaNativeDriver(modelPath);
        if (await nativeDriver.isAvailable()) {
          driver = nativeDriver;
          activeDriverName = `Llama.rn Nativo (${manifest.ai.model})`;
        } else {
          // Fallback a Mock si estamos en web/preview sin native build
          driver = new MockDriver();
          activeDriverName = 'Mock Driver (Fallback sin build nativo)';
        }
      }

      await driver.initialize();

      // 5. Instanciar Orquestador de Tool Calling
      const orchestrator = new ToolCallOrchestrator({
        driver,
        apiClient,
        toolRegistry,
        promptContext: {
          projectName: manifest.display_name,
          domain: manifest.domain,
          tools: toolsManifest.tools,
        },
      });

      setContextValue({
        manifest,
        schemaEngine,
        apiClient,
        orchestrator,
        activeDriverName,
        isReady: true,
      });
    }

    initApp();
  }, []);

  if (!contextValue) {
    return null;
  }

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp debe usarse dentro de un AppProvider');
  }
  return ctx;
}

import { ModelInfo, InstalledModelInfo } from './types';

export interface FileSystemAdapter {
  exists(path: string): Promise<boolean>;
  getFileSize(path: string): Promise<number>;
  deleteFile(path: string): Promise<void>;
  downloadFile(
    url: string,
    destPath: string,
    onProgress?: (progress: { loaded: number; total: number }) => void
  ): Promise<void>;
}

// Adaptador para React Native / Expo
export class DefaultExpoFileSystemAdapter implements FileSystemAdapter {
  async exists(path: string): Promise<boolean> {
    try {
      // @ts-ignore
      const FileSystem = await import('expo-file-system');
      const info = await FileSystem.getInfoAsync(path);
      return info.exists;
    } catch {
      return false;
    }
  }

  async getFileSize(path: string): Promise<number> {
    try {
      // @ts-ignore
      const FileSystem = await import('expo-file-system');
      const info = await FileSystem.getInfoAsync(path);
      return info.exists && 'size' in info ? ((info as any).size || 0) : 0;
    } catch {
      return 0;
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      // @ts-ignore
      const FileSystem = await import('expo-file-system');
      await FileSystem.deleteAsync(path, { idempotent: true });
    } catch {
      // Si no existe, nada que borrar
    }
  }

  async downloadFile(
    url: string,
    destPath: string,
    onProgress?: (progress: { loaded: number; total: number }) => void
  ): Promise<void> {
    try {
      // @ts-ignore
      const FileSystem = await import('expo-file-system');
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        destPath,
        {},
        (downloadProgress: any) => {
          onProgress?.({
            loaded: downloadProgress.totalBytesWritten,
            total: downloadProgress.totalBytesExpectedToWrite,
          });
        }
      );
      await downloadResumable.downloadAsync();
    } catch (err: any) {
      throw new Error(`Error descargando modelo: ${err.message}`);
    }
  }
}

export class ModelManager {
  private static registry: ModelInfo[] = [
    {
      id: 'qwen2.5-0.5b-instruct',
      displayName: 'Qwen 2.5 (0.5B Instruct)',
      sizeBytes: 514850816, // ~491 MB
      sizeMB: 491,
      format: 'gguf',
      quantization: 'Q4_K_M',
      recommended: true,
      downloadUrl:
        'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    },
    {
      id: 'qwen2.5-1.5b-instruct',
      displayName: 'Qwen 2.5 (1.5B Instruct)',
      sizeBytes: 1033895936, // ~986 MB
      sizeMB: 986,
      format: 'gguf',
      quantization: 'Q4_K_M',
      recommended: false,
      downloadUrl:
        'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    },
    {
      id: 'smollm2-360m-instruct',
      displayName: 'SmolLM2 (360M Instruct)',
      sizeBytes: 240123904, // ~229 MB
      sizeMB: 229,
      format: 'gguf',
      quantization: 'Q4_K_M',
      recommended: false,
      downloadUrl:
        'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q4_k_m.gguf',
    },
  ];

  private static fsAdapter: FileSystemAdapter = new DefaultExpoFileSystemAdapter();
  private static storageDir = 'models';

  static setFileSystemAdapter(adapter: FileSystemAdapter) {
    this.fsAdapter = adapter;
  }

  static setStorageDir(dir: string) {
    this.storageDir = dir;
  }

  static getAvailableModels(): ModelInfo[] {
    return [...this.registry];
  }

  static getModel(id: string): ModelInfo | undefined {
    return this.registry.find((m) => m.id === id);
  }

  static getDefaultModel(): ModelInfo {
    return this.registry[0];
  }

  static getModelLocalPath(modelId: string): string {
    const model = this.getModel(modelId) || this.getDefaultModel();
    return `${this.storageDir}/${model.id}-${model.quantization.toLowerCase()}.gguf`;
  }

  static async isModelInstalled(modelId: string): Promise<boolean> {
    const path = this.getModelLocalPath(modelId);
    return await this.fsAdapter.exists(path);
  }

  static async getInstalledModels(): Promise<InstalledModelInfo[]> {
    const installed: InstalledModelInfo[] = [];
    for (const model of this.registry) {
      const isInst = await this.isModelInstalled(model.id);
      if (isInst) {
        const path = this.getModelLocalPath(model.id);
        const verification = await this.verifyModel(model.id);
        installed.push({
          ...model,
          localPath: path,
          installedAt: new Date().toISOString(),
          verified: verification.verified,
        });
      }
    }
    return installed;
  }

  static async verifyModel(
    modelId: string
  ): Promise<{ verified: boolean; actualBytes?: number; error?: string }> {
    const model = this.getModel(modelId);
    if (!model) {
      return { verified: false, error: `Modelo '${modelId}' no registrado en el catálogo.` };
    }

    const path = this.getModelLocalPath(modelId);
    const exists = await this.fsAdapter.exists(path);
    if (!exists) {
      return { verified: false, error: `El archivo GGUF no existe en la ruta: ${path}` };
    }

    const actualBytes = await this.fsAdapter.getFileSize(path);
    // Margen de tolerancia del 5% si el archivo fue descargado con padding o formato equivalente
    const tolerance = 0.05;
    const minBytes = model.sizeBytes * (1 - tolerance);

    if (actualBytes < minBytes) {
      return {
        verified: false,
        actualBytes,
        error: `Tamaño incompleto: esperado aprox. ${model.sizeBytes} bytes, actual ${actualBytes} bytes.`,
      };
    }

    return {
      verified: true,
      actualBytes,
    };
  }

  static async downloadModel(
    modelId: string,
    onProgress?: (percent: number, downloadedBytes: number) => void
  ): Promise<InstalledModelInfo> {
    const model = this.getModel(modelId);
    if (!model || !model.downloadUrl) {
      throw new Error(`El modelo '${modelId}' no tiene URL de descarga configurada.`);
    }

    const destPath = this.getModelLocalPath(modelId);

    await this.fsAdapter.downloadFile(model.downloadUrl, destPath, (p) => {
      const pct = p.total > 0 ? Math.round((p.loaded / p.total) * 100) : 0;
      onProgress?.(pct, p.loaded);
    });

    const verification = await this.verifyModel(modelId);
    if (!verification.verified) {
      throw new Error(`Verificación fallida tras descarga: ${verification.error}`);
    }

    return {
      ...model,
      localPath: destPath,
      installedAt: new Date().toISOString(),
      verified: true,
    };
  }

  static async deleteModel(modelId: string): Promise<boolean> {
    const path = this.getModelLocalPath(modelId);
    const exists = await this.fsAdapter.exists(path);
    if (exists) {
      await this.fsAdapter.deleteFile(path);
      return true;
    }
    return false;
  }
}

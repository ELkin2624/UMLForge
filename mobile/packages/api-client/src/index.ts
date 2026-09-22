export interface ApiClientConfig {
  baseUrl: string;
  authToken?: string;
  timeoutMs?: number;
}

export interface ToolCallExecution {
  method: string;
  path: string;
  arguments: Record<string, any>;
}

export class ApiClient {
  private baseUrl: string;
  private authToken?: string;
  private timeoutMs: number;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.authToken = config.authToken;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  clearAuthToken() {
    this.authToken = undefined;
  }

  private async request<T = any>(
    method: string,
    url: string,
    paramsOrData?: any
  ): Promise<T> {
    let fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const init: RequestInit = {
      method: method.toUpperCase(),
      headers,
    };

    if (method.toUpperCase() === 'GET' && paramsOrData) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(paramsOrData)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
      }
    } else if (paramsOrData && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      init.body = JSON.stringify(paramsOrData);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    init.signal = controller.signal;

    try {
      const response = await fetch(fullUrl, init);
      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`[Status ${response.status}] ${errorText || response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }
      return (await response.text()) as unknown as T;
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  async get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>('GET', url, params);
  }

  async post<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>('POST', url, data);
  }

  async put<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>('PUT', url, data);
  }

  async delete<T = any>(url: string): Promise<T> {
    return this.request<T>('DELETE', url);
  }

  /**
   * Ejecuta una llamada generada por Tool Calling de la IA
   * Mapea placeholders {id} de la ruta y envía los argumentos restantes en query o body.
   */
  async executeToolCall(tool: ToolCallExecution): Promise<{ success: boolean; data: any; error?: string }> {
    try {
      let resolvedPath = tool.path;
      const method = tool.method.toUpperCase();
      const args = { ...tool.arguments };

      // Resolver parámetros de path como {id}
      const pathParamMatches = resolvedPath.match(/\{([a-zA-Z0-9_]+)\}/g);
      if (pathParamMatches) {
        for (const match of pathParamMatches) {
          const paramName = match.replace(/[{}]/g, '');
          if (args[paramName] !== undefined) {
            resolvedPath = resolvedPath.replace(match, encodeURIComponent(String(args[paramName])));
            delete args[paramName];
          }
        }
      }

      let data: any;
      if (method === 'GET') {
        data = await this.get(resolvedPath, args);
      } else if (method === 'POST') {
        data = await this.post(resolvedPath, args);
      } else if (method === 'PUT') {
        data = await this.put(resolvedPath, args);
      } else if (method === 'DELETE') {
        data = await this.delete(resolvedPath);
      } else {
        throw new Error(`Método HTTP no soportado: ${method}`);
      }

      return { success: true, data };
    } catch (err: any) {
      const message = err.message || 'Error en ejecución de API';
      return {
        success: false,
        data: null,
        error: message,
      };
    }
  }
}

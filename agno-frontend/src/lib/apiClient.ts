// src/lib/apiClient.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status: number;
}

interface ApiError {
  message: string;
  status?: number;
  details?: any;
}

class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1') {
    this.baseURL = baseURL;

    this.client = axios.create({
      baseURL,
      timeout: 30000, // 30 segundos
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - adicionar token de auth se disponível
    this.client.interceptors.request.use(
      (config) => {
        // Adicionar token de autorização se disponível
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Log da requisição em desenvolvimento
        if (process.env.NODE_ENV === 'development') {
          console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            data: config.data,
            params: config.params
          });
        }

        return config;
      },
      (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - tratamento de erros global
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log da resposta em desenvolvimento
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            data: response.data
          });
        }

        return response;
      },
      (error: AxiosError) => {
        console.error('❌ API Error:', error);

        // Tratamento específico de erros
        if (error.response?.status === 401) {
          // Token expirado ou inválido
          this.handleAuthError();
        }

        const apiError: ApiError = {
          message: this.extractErrorMessage(error),
          status: error.response?.status,
          details: error.response?.data
        };

        return Promise.reject(apiError);
      }
    );
  }

  private getAuthToken(): string | null {
    // Implementar lógica de recuperação do token
    // Por exemplo, do localStorage ou context
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  private handleAuthError() {
    // Implementar lógica de tratamento de erro de auth
    // Por exemplo, redirecionar para login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
  }

  private extractErrorMessage(error: AxiosError): string {
    if (error.response?.data) {
      const data = error.response.data as any;
      if (data.detail) return data.detail;
      if (data.message) return data.message;
      if (data.error) return data.error;
    }

    if (error.code === 'ECONNABORTED') {
      return 'Timeout na requisição. Tente novamente.';
    }

    if (error.code === 'ERR_NETWORK') {
      return 'Erro de conexão. Verifique sua internet.';
    }

    return error.message || 'Erro desconhecido na API';
  }

  // Métodos HTTP
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get(url, config);
    return {
      data: response.data,
      status: response.status
    };
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post(url, data, config);
    return {
      data: response.data,
      status: response.status
    };
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put(url, data, config);
    return {
      data: response.data,
      status: response.status
    };
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.patch(url, data, config);
    return {
      data: response.data,
      status: response.status
    };
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete(url, config);
    return {
      data: response.data,
      status: response.status
    };
  }

  // Métodos utilitários
  setAuthToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearAuthToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  // Upload de arquivos
  async uploadFile<T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    };

    const response = await this.client.post(url, formData, config);
    return {
      data: response.data,
      status: response.status
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

// Instância singleton do cliente API
export const apiClient = new ApiClient();

// src/lib/validation.ts

import * as z from 'zod';

// Schema para validação de workflow
export const workflowSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().max(500, 'Descrição muito longa').optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number()
    }),
    config: z.record(z.any())
  })).min(2, 'Workflow deve ter pelo menos 2 nós'),
  connections: z.array(z.object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
    condition: z.string().optional()
  }))
});

// Schema para validação de team
export const teamSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  description: z.string().max(500, 'Descrição muito longa').optional(),
  team_type: z.enum(['collaborative', 'hierarchical', 'sequential']),
  agents: z.array(z.object({
    id: z.string(),
    role_in_team: z.string().optional(),
    priority: z.number().optional()
  })).min(1, 'Team deve ter pelo menos 1 agente'),
  supervisor_config: z.object({
    agentId: z.string(),
    instructions: z.array(z.string())
  }).optional()
});

// Schema para validação de agente
export const agentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  role: z.string().min(1, 'Role é obrigatório').max(100, 'Role muito longo'),
  description: z.string().max(500, 'Descrição muito longa').optional(),
  model_provider: z.enum(['openai', 'anthropic', 'groq']),
  model_id: z.string().min(1, 'Modelo é obrigatório'),
  instructions: z.array(z.string()).min(1, 'Pelo menos uma instrução é obrigatória'),
  tools: z.array(z.string()).default([]),
  memory_enabled: z.boolean().default(true),
  rag_enabled: z.boolean().default(false),
  rag_index_id: z.string().optional()
});

// Funções de validação
export const validateWorkflow = (data: any) => {
  try {
    return workflowSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validação falhou: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};

export const validateTeam = (data: any) => {
  try {
    return teamSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validação falhou: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};

export const validateAgent = (data: any) => {
  try {
    return agentSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validação falhou: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};

// src/lib/constants.ts

export const NODE_TYPES = {
  START: 'start',
  AGENT: 'agent',
  PARALLEL: 'parallel',
  CONDITION: 'condition',
  DELAY: 'delay',
  TRANSFORM: 'transform',
  NOTIFICATION: 'notification',
  END: 'end'
} as const;

export const TEAM_TYPES = {
  COLLABORATIVE: 'collaborative',
  HIERARCHICAL: 'hierarchical',
  SEQUENTIAL: 'sequential'
} as const;

export const MODEL_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GROQ: 'groq'
} as const;

export const EXECUTION_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export const WORKFLOW_CATEGORIES = {
  BUSINESS: 'business',
  DATA_ANALYSIS: 'data_analysis',
  CONTENT_CREATION: 'content_creation',
  RESEARCH: 'research',
  AUTOMATION: 'automation',
  CUSTOMER_SERVICE: 'customer_service'
} as const;

export const AVAILABLE_TOOLS = [
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo Search',
    description: 'Busca na web usando DuckDuckGo',
    category: 'search'
  },
  {
    id: 'yfinance',
    name: 'Yahoo Finance',
    description: 'Dados financeiros e de mercado',
    category: 'finance'
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Cálculos matemáticos básicos e avançados',
    category: 'math'
  },
  {
    id: 'reasoning',
    name: 'Reasoning Tools',
    description: 'Ferramentas de raciocínio e lógica',
    category: 'logic'
  },
  {
    id: 'code_interpreter',
    name: 'Code Interpreter',
    description: 'Execução e análise de código',
    category: 'development'
  },
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Busca geral na web',
    category: 'search'
  }
] as const;

export const DEFAULT_WORKFLOW_CONFIG = {
  name: 'Novo Workflow',
  description: '',
  version: '1.0.0',
  nodes: [],
  connections: [],
  metadata: {}
};

export const DEFAULT_TEAM_CONFIG = {
  name: 'Novo Team',
  description: '',
  team_type: 'collaborative' as const,
  agents: [],
  supervisor_config: null
};

// src/lib/utils.ts

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility para merge de classes CSS
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatação de data
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options
  });
}

// Formatação de tempo
export function formatTime(date: string | Date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Formatação de duração em milissegundos
export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

// Geração de ID único
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Validação de email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Truncar texto
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Capitalizar primeira letra
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Conversão de bytes para formato legível
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Validação de workflow (estrutural)
export function validateWorkflowStructure(nodes: any[], connections: any[]): string[] {
  const errors: string[] = [];

  // Verificar se há nó de início
  const startNodes = nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('Workflow deve ter um nó de início');
  } else if (startNodes.length > 1) {
    errors.push('Workflow deve ter apenas um nó de início');
  }

  // Verificar se há nó de fim
  const endNodes = nodes.filter(n => n.type === 'end');
  if (endNodes.length === 0) {
    errors.push('Workflow deve ter pelo menos um nó de fim');
  }

  // Verificar conexões válidas
  const nodeIds = new Set(nodes.map(n => n.id));
  const invalidConnections = connections.filter(
    c => !nodeIds.has(c.from) || !nodeIds.has(c.to)
  );

  if (invalidConnections.length > 0) {
    errors.push(`${invalidConnections.length} conexão(ões) inválida(s)`);
  }

  // Verificar nós órfãos (exceto start e end)
  const connectedNodes = new Set();
  connections.forEach(c => {
    connectedNodes.add(c.from);
    connectedNodes.add(c.to);
  });

  const orphanNodes = nodes.filter(n =>
    n.type !== 'start' &&
    n.type !== 'end' &&
    !connectedNodes.has(n.id)
  );

  if (orphanNodes.length > 0) {
    errors.push(`${orphanNodes.length} nó(s) não conectado(s)`);
  }

  return errors;
}

// Detecção de ciclos em workflow
export function detectCycles(nodes: any[], connections: any[]): boolean {
  const graph = new Map<string, string[]>();

  // Construir grafo
  nodes.forEach(node => graph.set(node.id, []));
  connections.forEach(conn => {
    const neighbors = graph.get(conn.from) || [];
    neighbors.push(conn.to);
    graph.set(conn.from, neighbors);
  });

  // DFS para detectar ciclos
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) return true;
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      if (hasCycle(nodeId)) return true;
    }
  }

  return false;
}

// Export de workflow para JSON
export function exportWorkflowToJSON(workflow: any): string {
  const exportData = {
    version: '1.0',
    workflow: {
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes,
      connections: workflow.connections,
      metadata: workflow.metadata
    },
    exportedAt: new Date().toISOString()
  };

  return JSON.stringify(exportData, null, 2);
}

// Import de workflow de JSON
export function importWorkflowFromJSON(jsonString: string): any {
  try {
    const data = JSON.parse(jsonString);

    if (!data.workflow) {
      throw new Error('Formato de arquivo inválido');
    }

    return data.workflow;
  } catch (error) {
    throw new Error('Erro ao processar arquivo JSON');
  }
}

// src/lib/storage.ts

// Interface para storage local
interface StorageManager {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
}

class LocalStorageManager implements StorageManager {
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Erro ao salvar no localStorage:', error);
    }
  }

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.clear();
  }
}

class SessionStorageManager implements StorageManager {
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Erro ao salvar no sessionStorage:', error);
    }
  }

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(key);
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.clear();
  }
}

// Exportar instâncias
export const localStorage = new LocalStorageManager();
export const sessionStorage = new SessionStorageManager();

// Storage específico para aplicação
export const appStorage = {
  // Workflows salvos localmente (rascunhos)
  saveDraftWorkflow: (id: string, workflow: any) => {
    localStorage.set(`draft_workflow_${id}`, workflow);
  },

  getDraftWorkflow: (id: string) => {
    return localStorage.get(`draft_workflow_${id}`);
  },

  removeDraftWorkflow: (id: string) => {
    localStorage.remove(`draft_workflow_${id}`);
  },

  // Teams salvos localmente (rascunhos)
  saveDraftTeam: (id: string, team: any) => {
    localStorage.set(`draft_team_${id}`, team);
  },

  getDraftTeam: (id: string) => {
    return localStorage.get(`draft_team_${id}`);
  },

  removeDraftTeam: (id: string) => {
    localStorage.remove(`draft_team_${id}`);
  },

  // Preferências do usuário
  setUserPreferences: (preferences: any) => {
    localStorage.set('user_preferences', preferences);
  },

  getUserPreferences: () => {
    return localStorage.get('user_preferences') || {
      theme: 'light',
      defaultModelProvider: 'openai',
      autoSave: true,
      notifications: true
    };
  },

  // Cache de dados
  setCacheData: (key: string, data: any, ttl = 3600000) => { // 1 hora por padrão
    const cacheItem = {
      data,
      timestamp: Date.now(),
      ttl
    };
    localStorage.set(`cache_${key}`, cacheItem);
  },

  getCacheData: (key: string) => {
    const cacheItem = localStorage.get(`cache_${key}`);
    if (!cacheItem) return null;

    const now = Date.now();
    if (now - cacheItem.timestamp > cacheItem.ttl) {
      localStorage.remove(`cache_${key}`);
      return null;
    }

    return cacheItem.data;
  },

  // Limpar todos os dados da aplicação
  clearAppData: () => {
    if (typeof window === 'undefined') return;

    const keys = Object.keys(window.localStorage);
    keys.forEach(key => {
      if (key.startsWith('draft_') || key.startsWith('cache_') || key === 'user_preferences') {
        localStorage.remove(key);
      }
    });
  }
};
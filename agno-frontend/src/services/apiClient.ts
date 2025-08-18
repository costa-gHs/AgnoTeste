// agno-frontend/src/services/apiClient.ts
// API Client com tipos corrigidos e tratamento de erros melhorado

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const DEFAULT_USER_ID = 1;

// ==================== INTERFACES ====================
export interface Agent {
  id: number;
  name: string;
  role: string;
  description?: string;
  model_provider: string;
  model_id: string;
  instructions: string[];
  tools: Array<{ tool_id: string; config: any }>;
  memory_enabled: boolean;
  rag_enabled: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Team {
  id: number;
  name: string;
  description: string;
  team_type: 'collaborative' | 'hierarchical' | 'sequential';
  agents: Array<{
    agent_id: number;
    role_in_team: string;
    priority: number;
  }>;
  supervisor_agent_id?: number;
  team_configuration: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  execution_count?: number;
}

export interface ChatRequest {
  message: string;
  stream?: boolean;
  context?: Record<string, any>;
}

export interface ChatResponse {
  response: string;
  execution_id?: string;
  metadata?: {
    model_used?: string;
    tokens_used?: number;
    execution_time?: number;
    tools_used?: string[];
  };
}

export interface TeamExecutionRequest {
  input_message: string;
  context?: Record<string, any>;
  timeout?: number;
}

export interface TeamExecutionResponse {
  execution_id: string;
  status: 'running' | 'completed' | 'failed';
  response: string;
  team_name: string;
  agents_used: number;
  execution_time_ms: number;
  agent_results?: Array<{
    agent_name: string;
    response: string;
    execution_time: number;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// ==================== ERROR HANDLING ====================
class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ==================== HELPER FUNCTIONS ====================
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      // Se não conseguir fazer parse do JSON, usa a mensagem padrão
    }

    throw new ApiError(errorMessage, response.status);
  }

  try {
    const data = await response.json();

    // Se a resposta tem uma estrutura wrapper, extrai os dados
    if (data.data !== undefined) {
      return data.data;
    }

    return data;
  } catch (error) {
    throw new ApiError('Invalid JSON response', response.status);
  }
}

// ==================== API CLIENT ====================
export const apiClient = {
  // ========== AGENTS ==========
  async fetchAgents(userId: number = DEFAULT_USER_ID): Promise<Agent[]> {
    const response = await fetch(`${API_BASE}/api/agents?user_id=${userId}`);
    return handleResponse<Agent[]>(response);
  },

  async getAgent(agentId: number, userId: number = DEFAULT_USER_ID): Promise<Agent> {
    const response = await fetch(`${API_BASE}/api/agents/${agentId}?user_id=${userId}`);
    return handleResponse<Agent>(response);
  },

  async createAgent(agent: Partial<Agent>, userId: number = DEFAULT_USER_ID): Promise<Agent> {
    const response = await fetch(`${API_BASE}/api/agents?user_id=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    });
    return handleResponse<Agent>(response);
  },

  async updateAgent(
    agentId: number,
    updates: Partial<Agent>,
    userId: number = DEFAULT_USER_ID
  ): Promise<Agent> {
    const response = await fetch(`${API_BASE}/api/agents/${agentId}?user_id=${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse<Agent>(response);
  },

  async deleteAgent(agentId: number, userId: number = DEFAULT_USER_ID): Promise<void> {
    const response = await fetch(`${API_BASE}/api/agents/${agentId}?user_id=${userId}`, {
      method: 'DELETE',
    });
    await handleResponse<void>(response);
  },

  async chatWithAgent(
    agentId: number,
    request: ChatRequest,
    userId: number = DEFAULT_USER_ID
  ): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE}/api/agents/${agentId}/chat?user_id=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleResponse<ChatResponse>(response);
  },

  async chatWithAgentStream(
    agentId: number,
    request: ChatRequest,
    onChunk: (chunk: string) => void,
    userId: number = DEFAULT_USER_ID
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/api/agents/${agentId}/chat?user_id=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                onChunk(parsed.content);
              }
            } catch {
              // Ignora linhas que não são JSON válido
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  // ========== TEAMS ==========
  async fetchTeams(userId: number = DEFAULT_USER_ID): Promise<Team[]> {
    const response = await fetch(`${API_BASE}/api/teams?user_id=${userId}`);
    return handleResponse<Team[]>(response);
  },

  async getTeam(teamId: number, userId: number = DEFAULT_USER_ID): Promise<Team> {
    const response = await fetch(`${API_BASE}/api/teams/${teamId}?user_id=${userId}`);
    return handleResponse<Team>(response);
  },

  async createTeam(team: Partial<Team>, userId: number = DEFAULT_USER_ID): Promise<Team> {
    const response = await fetch(`${API_BASE}/api/teams?user_id=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(team),
    });
    return handleResponse<Team>(response);
  },

  async updateTeam(
    teamId: number,
    updates: Partial<Team>,
    userId: number = DEFAULT_USER_ID
  ): Promise<Team> {
    const response = await fetch(`${API_BASE}/api/teams/${teamId}?user_id=${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse<Team>(response);
  },

  async deleteTeam(teamId: number, userId: number = DEFAULT_USER_ID): Promise<void> {
    const response = await fetch(`${API_BASE}/api/teams/${teamId}?user_id=${userId}`, {
      method: 'DELETE',
    });
    await handleResponse<void>(response);
  },

  async executeTeam(
    teamId: number,
    request: TeamExecutionRequest,
    userId: number = DEFAULT_USER_ID
  ): Promise<TeamExecutionResponse> {
    const response = await fetch(`${API_BASE}/api/teams/${teamId}/execute?user_id=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleResponse<TeamExecutionResponse>(response);
  },

  // ========== HEALTH & STATUS ==========
  async checkHealth(): Promise<{ status: string; version?: string }> {
    const response = await fetch(`${API_BASE}/api/health`);
    return handleResponse<{ status: string; version?: string }>(response);
  },

  async getStats(userId: number = DEFAULT_USER_ID): Promise<any> {
    const response = await fetch(`${API_BASE}/api/stats?user_id=${userId}`);
    return handleResponse<any>(response);
  },
};

// ==================== REACT HOOKS ====================
import { useState, useCallback, useEffect } from 'react';

export function useApi<T>(
  apiCall: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

export function useAgents(userId?: number) {
  return useApi(() => apiClient.fetchAgents(userId));
}

export function useTeams(userId?: number) {
  return useApi(() => apiClient.fetchTeams(userId));
}

export default apiClient;
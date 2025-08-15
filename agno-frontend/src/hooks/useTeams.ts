// agno-frontend/src/hooks/useTeams.ts

import { useState, useEffect, useCallback } from 'react';

// ==================== TYPES ====================

interface Agent {
  id: string;
  name: string;
  role: string;
  role_in_team?: string;
  priority?: number;
  model_provider: string;
  model_id: string;
  tools: string[];
  is_active: boolean;
}

interface Team {
  id: string;
  name: string;
  description: string;
  team_type: 'collaborative' | 'hierarchical' | 'sequential';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  team_configuration: Record<string, any>;
  agent_count: number;
  agents: Agent[];
  supervisor?: Agent;
  execution_count: number;
}

interface TeamCreateRequest {
  name: string;
  description: string;
  team_type: 'collaborative' | 'hierarchical' | 'sequential';
  agents: Array<{
    agent_id: string;
    role_in_team: string;
    priority: number;
  }>;
  supervisor_agent_id?: string;
  team_configuration?: Record<string, any>;
}

interface TeamExecution {
  execution_id: string;
  status: 'running' | 'completed' | 'failed';
  response: string;
  team_name: string;
  agents_used: number;
  execution_time_ms: number;
}

interface TeamAnalytics {
  team_id: string;
  team_name: string;
  total_executions: number;
  successful_executions: number;
  success_rate: number;
  avg_response_time_ms: number;
  last_execution?: string;
  agent_count: number;
  team_type: string;
}

interface ExecutionHistory {
  id: string;
  input_message: string;
  output_response: string;
  status: string;
  started_at: string;
  completed_at?: string;
  execution_time_ms?: number;
}

// ==================== API CLIENT ====================

class TeamsAPI {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:8000/api/teams') {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers: defaultHeaders,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }

  // CRUD Operations
  async createTeam(teamData: TeamCreateRequest): Promise<{ team: Team }> {
    return this.request('/', {
      method: 'POST',
      body: JSON.stringify(teamData),
    });
  }

  async getTeams(activeOnly: boolean = true): Promise<Team[]> {
    return this.request(`/?active_only=${activeOnly}`);
  }

  async getTeam(teamId: string): Promise<Team> {
    return this.request(`/${teamId}`);
  }

  async updateTeam(teamId: string, updates: Partial<TeamCreateRequest>): Promise<{ team: Team }> {
    return this.request(`/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTeam(teamId: string): Promise<{ success: boolean }> {
    return this.request(`/${teamId}`, {
      method: 'DELETE',
    });
  }

  // Execution
  async executeTeam(teamId: string, message: string, context?: any): Promise<TeamExecution> {
    return this.request(`/${teamId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    });
  }

  // History & Analytics
  async getExecutionHistory(teamId: string): Promise<ExecutionHistory[]> {
    return this.request(`/${teamId}/history`);
  }

  async getTeamAnalytics(teamId: string): Promise<TeamAnalytics> {
    return this.request(`/${teamId}/analytics`);
  }

  async getAllAnalytics(): Promise<TeamAnalytics[]> {
    return this.request('/analytics');
  }
}

// ==================== CUSTOM HOOK ====================

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<TeamAnalytics[]>([]);

  const api = new TeamsAPI();

  // Fetch all teams
  const fetchTeams = useCallback(async (activeOnly: boolean = true) => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getTeams(activeOnly);
      setTeams(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching teams:', err);
      // Return empty array on error for development
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new team
  const createTeam = useCallback(async (teamData: TeamCreateRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.createTeam(teamData);
      await fetchTeams(); // Refresh teams list
      return response.team;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTeams]);

  // Update existing team
  const updateTeam = useCallback(async (teamId: string, updates: Partial<TeamCreateRequest>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.updateTeam(teamId, updates);
      await fetchTeams(); // Refresh teams list
      return response.team;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTeams]);

  // Delete team
  const deleteTeam = useCallback(async (teamId: string) => {
    setLoading(true);
    setError(null);

    try {
      await api.deleteTeam(teamId);
      await fetchTeams(); // Refresh teams list
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTeams]);

  // Execute team
  const executeTeam = useCallback(async (teamId: string, message: string, context?: any) => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.executeTeam(teamId, message, context);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get execution history
  const getExecutionHistory = useCallback(async (teamId: string) => {
    try {
      const history = await api.getExecutionHistory(teamId);
      return history;
    } catch (err: any) {
      console.error('Error fetching execution history:', err);
      return [];
    }
  }, []);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await api.getAllAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setAnalytics([]);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    fetchTeams();
  }, []);

  return {
    teams,
    loading,
    error,
    analytics,
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    executeTeam,
    getExecutionHistory,
    fetchAnalytics,
  };
};

// ==================== AGENTS HOOK ====================

interface AgentCreateRequest {
  name: string;
  role: string;
  description?: string;
  model_provider: string;
  model_id: string;
  instructions: string[];
  tools: string[];
  memory_enabled: boolean;
  rag_enabled: boolean;
  rag_config?: {
    enabled: boolean;
    chunk_size?: number;
    chunk_overlap?: number;
  };
}

class AgentsAPI {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:8000/api/agents') {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers: defaultHeaders,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }

  async getAgents(): Promise<Agent[]> {
    return this.request('/');
  }

  async createAgent(agentData: AgentCreateRequest): Promise<Agent> {
    return this.request('/', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  async updateAgent(agentId: string, updates: Partial<AgentCreateRequest>): Promise<Agent> {
    return this.request(`/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteAgent(agentId: string): Promise<{ message: string }> {
    return this.request(`/${agentId}`, {
      method: 'DELETE',
    });
  }

  async testAgent(agentId: string, prompt: string): Promise<any> {
    return this.request(`/${agentId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ prompt, stream: false }),
    });
  }
}

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = new AgentsAPI();

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getAgents();
      setAgents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching agents:', err);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createAgent = useCallback(async (agentData: AgentCreateRequest) => {
    setLoading(true);
    setError(null);

    try {
      const agent = await api.createAgent(agentData);
      await fetchAgents();
      return agent;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAgents]);

  const updateAgent = useCallback(async (agentId: string, updates: Partial<AgentCreateRequest>) => {
    setLoading(true);
    setError(null);

    try {
      const agent = await api.updateAgent(agentId, updates);
      await fetchAgents();
      return agent;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAgents]);

  const deleteAgent = useCallback(async (agentId: string) => {
    setLoading(true);
    setError(null);

    try {
      await api.deleteAgent(agentId);
      await fetchAgents();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAgents]);

  const testAgent = useCallback(async (agentId: string, prompt: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.testAgent(agentId, prompt);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, []);

  return {
    agents,
    loading,
    error,
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    testAgent,
  };
};

// Export types for use in components
export type { Team, Agent, TeamCreateRequest, AgentCreateRequest, TeamExecution, TeamAnalytics, ExecutionHistory };
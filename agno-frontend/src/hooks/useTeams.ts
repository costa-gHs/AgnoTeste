// agno-frontend/src/hooks/useTeams.ts - HOOK FUNCIONAL CONECTADO COM BACKEND

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
    return this.request('/');
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
  async executeTeam(teamId: string, message: string, context?: Record<string, any>): Promise<TeamExecution> {
    return this.request(`/${teamId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    });
  }

  // Analytics
  async getTeamAnalytics(teamId: string): Promise<TeamAnalytics> {
    return this.request(`/${teamId}/analytics`);
  }

  async getTeamExecutions(teamId: string, limit: number = 20): Promise<ExecutionHistory[]> {
    return this.request(`/${teamId}/executions?limit=${limit}`);
  }
}

// ==================== HOOK ====================

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<Set<string>>(new Set());

  const api = new TeamsAPI();

  // Fetch teams
  const fetchTeams = useCallback(async (activeOnly: boolean = true) => {
    try {
      setLoading(true);
      setError(null);
      const teamsData = await api.getTeams(activeOnly);
      setTeams(teamsData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get specific team
  const getTeam = useCallback(async (teamId: string): Promise<Team | null> => {
    try {
      setError(null);
      return await api.getTeam(teamId);
    } catch (err: any) {
      setError(err.message);
      console.error(`Error fetching team ${teamId}:`, err);
      return null;
    }
  }, []);

  // Create team
  const createTeam = useCallback(async (teamData: TeamCreateRequest): Promise<Team | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.createTeam(teamData);

      // Refresh teams list
      await fetchTeams();

      return response.team;
    } catch (err: any) {
      setError(err.message);
      console.error('Error creating team:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchTeams]);

  // Update team
  const updateTeam = useCallback(async (
    teamId: string,
    updates: Partial<TeamCreateRequest>
  ): Promise<Team | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.updateTeam(teamId, updates);

      // Update local state
      setTeams(prev => prev.map(team =>
        team.id === teamId ? response.team : team
      ));

      return response.team;
    } catch (err: any) {
      setError(err.message);
      console.error(`Error updating team ${teamId}:`, err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete team
  const deleteTeam = useCallback(async (teamId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      await api.deleteTeam(teamId);

      // Remove from local state
      setTeams(prev => prev.filter(team => team.id !== teamId));

      return true;
    } catch (err: any) {
      setError(err.message);
      console.error(`Error deleting team ${teamId}:`, err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Execute team
  const executeTeam = useCallback(async (
    teamId: string,
    message: string,
    context?: Record<string, any>
  ): Promise<TeamExecution | null> => {
    try {
      setExecuting(prev => new Set([...prev, teamId]));
      setError(null);

      const execution = await api.executeTeam(teamId, message, context);

      return execution;
    } catch (err: any) {
      setError(err.message);
      console.error(`Error executing team ${teamId}:`, err);
      return null;
    } finally {
      setExecuting(prev => {
        const newSet = new Set(prev);
        newSet.delete(teamId);
        return newSet;
      });
    }
  }, []);

  // Get team analytics
  const getTeamAnalytics = useCallback(async (teamId: string): Promise<TeamAnalytics | null> => {
    try {
      setError(null);
      return await api.getTeamAnalytics(teamId);
    } catch (err: any) {
      setError(err.message);
      console.error(`Error fetching analytics for team ${teamId}:`, err);
      return null;
    }
  }, []);

  // Get team execution history
  const getTeamExecutions = useCallback(async (
    teamId: string,
    limit: number = 20
  ): Promise<ExecutionHistory[]> => {
    try {
      setError(null);
      return await api.getTeamExecutions(teamId, limit);
    } catch (err: any) {
      setError(err.message);
      console.error(`Error fetching executions for team ${teamId}:`, err);
      return [];
    }
  }, []);

  // Utility functions
  const isExecuting = useCallback((teamId: string): boolean => {
    return executing.has(teamId);
  }, [executing]);

  const getTeamById = useCallback((teamId: string): Team | undefined => {
    return teams.find(team => team.id === teamId);
  }, [teams]);

  const getTeamsByType = useCallback((teamType: string): Team[] => {
    return teams.filter(team => team.team_type === teamType);
  }, [teams]);

  // Initialize
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return {
    // Data
    teams,
    loading,
    error,
    executing,

    // Operations
    fetchTeams,
    getTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    executeTeam,
    getTeamAnalytics,
    getTeamExecutions,

    // Utilities
    isExecuting,
    getTeamById,
    getTeamsByType,
    refresh: fetchTeams,

    // State helpers
    hasTeams: teams.length > 0,
    teamCount: teams.length,
    activeTeamCount: teams.filter(t => t.is_active).length,
  };
};

// ==================== AGENTS HOOK ====================

interface AgentListItem {
  id: string;
  name: string;
  role: string;
  description?: string;
  model_provider: string;
  model_id: string;
  tools: string[];
  is_active: boolean;
  created_at: string;
}

export const useAgents = () => {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:8000/api/agents');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const agentsData = await response.json();
      setAgents(agentsData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return {
    agents,
    loading,
    error,
    fetchAgents,
    activeAgents: agents.filter(a => a.is_active),
    refresh: fetchAgents,
  };
};

// Export types for use in components
export type {
  Team,
  Agent,
  TeamCreateRequest,
  TeamExecution,
  TeamAnalytics,
  ExecutionHistory
};
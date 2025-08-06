// src/hooks/useWorkflows.ts

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';

interface Workflow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  visual_definition?: any;
  execution_count?: number;
  last_execution?: {
    status: string;
    completed_at: string;
  };
}

interface WorkflowExecution {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  input_data: any;
  output_data?: any;
  error_message?: string;
  steps: any[];
}

export const useWorkflows = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar workflows
  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/workflows');
      setWorkflows(response.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar workflows');
      console.error('Erro ao carregar workflows:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar workflow específico
  const getWorkflow = useCallback(async (workflowId: string): Promise<Workflow> => {
    try {
      const response = await apiClient.get(`/workflows/${workflowId}`);
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao carregar workflow');
    }
  }, []);

  // Salvar workflow
  const saveWorkflow = useCallback(async (workflowData: Partial<Workflow>): Promise<Workflow> => {
    try {
      const response = await apiClient.post('/workflows/visual', workflowData);
      await fetchWorkflows(); // Recarregar lista
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao salvar workflow');
    }
  }, [fetchWorkflows]);

  // Atualizar workflow
  const updateWorkflow = useCallback(async (workflowId: string, workflowData: Partial<Workflow>): Promise<Workflow> => {
    try {
      const response = await apiClient.put(`/workflows/${workflowId}`, workflowData);
      await fetchWorkflows(); // Recarregar lista
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao atualizar workflow');
    }
  }, [fetchWorkflows]);

  // Deletar workflow
  const deleteWorkflow = useCallback(async (workflowId: string): Promise<void> => {
    try {
      await apiClient.delete(`/workflows/${workflowId}`);
      await fetchWorkflows(); // Recarregar lista
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao deletar workflow');
    }
  }, [fetchWorkflows]);

  // Duplicar workflow
  const duplicateWorkflow = useCallback(async (workflowId: string): Promise<string> => {
    try {
      const originalWorkflow = await getWorkflow(workflowId);
      const duplicatedData = {
        ...originalWorkflow,
        name: `${originalWorkflow.name} (Cópia)`,
        id: undefined // Remove ID para criar novo
      };

      const response = await saveWorkflow(duplicatedData);
      return response.id;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao duplicar workflow');
    }
  }, [getWorkflow, saveWorkflow]);

  // Executar workflow
  const executeWorkflow = useCallback(async (workflowId: string, inputData: any): Promise<string> => {
    try {
      const response = await apiClient.post(`/workflows/${workflowId}/execute`, {
        workflow_id: workflowId,
        input_data: inputData
      });
      return response.data.execution_id;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao executar workflow');
    }
  }, []);

  // Buscar status de execução
  const getExecutionStatus = useCallback(async (executionId: string): Promise<WorkflowExecution> => {
    try {
      const response = await apiClient.get(`/workflows/executions/${executionId}`);
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao buscar status de execução');
    }
  }, []);

  // Buscar steps de execução
  const getExecutionSteps = useCallback(async (executionId: string): Promise<any[]> => {
    try {
      const response = await apiClient.get(`/workflows/executions/${executionId}/steps`);
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao buscar steps de execução');
    }
  }, []);

  // Analytics de workflows
  const getWorkflowAnalytics = useCallback(async () => {
    try {
      const response = await apiClient.get('/analytics/workflows');
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao carregar analytics');
    }
  }, []);

  // Carregar workflows ao montar o hook
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  return {
    workflows,
    loading,
    error,
    fetchWorkflows,
    getWorkflow,
    saveWorkflow,
    updateWorkflow,
    deleteWorkflow,
    duplicateWorkflow,
    executeWorkflow,
    getExecutionStatus,
    getExecutionSteps,
    getWorkflowAnalytics,
    refresh: fetchWorkflows
  };
};

// src/hooks/useTeams.ts

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';

interface Team {
  id: string;
  name: string;
  description: string;
  team_type: 'collaborative' | 'hierarchical' | 'sequential';
  created_at: string;
  updated_at: string;
  is_active: boolean;
  agents: Array<{
    id: string;
    name: string;
    role: string;
    role_in_team: string;
    priority?: number;
  }>;
  supervisor_agent_id?: string;
  team_configuration?: any;
}

interface TeamExecution {
  team_id: string;
  response: string;
  metadata: {
    execution_time: number;
    agents_used: string[];
  };
}

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar teams
  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/teams');
      setTeams(response.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar teams');
      console.error('Erro ao carregar teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar team específico
  const getTeam = useCallback(async (teamId: string): Promise<Team> => {
    try {
      const response = await apiClient.get(`/teams/${teamId}`);
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao carregar team');
    }
  }, []);

  // Salvar team
  const saveTeam = useCallback(async (teamData: Partial<Team>): Promise<Team> => {
    try {
      const response = await apiClient.post('/teams', teamData);
      await fetchTeams(); // Recarregar lista
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao salvar team');
    }
  }, [fetchTeams]);

  // Atualizar team
  const updateTeam = useCallback(async (teamId: string, teamData: Partial<Team>): Promise<Team> => {
    try {
      const response = await apiClient.put(`/teams/${teamId}`, teamData);
      await fetchTeams(); // Recarregar lista
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao atualizar team');
    }
  }, [fetchTeams]);

  // Deletar team
  const deleteTeam = useCallback(async (teamId: string): Promise<void> => {
    try {
      await apiClient.delete(`/teams/${teamId}`);
      await fetchTeams(); // Recarregar lista
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao deletar team');
    }
  }, [fetchTeams]);

  // Executar team
  const executeTeam = useCallback(async (teamId: string, message: string): Promise<TeamExecution> => {
    try {
      const response = await apiClient.post(`/teams/${teamId}/execute`, {
        team_id: teamId,
        message: message
      });
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao executar team');
    }
  }, []);

  // Analytics de teams
  const getTeamAnalytics = useCallback(async () => {
    try {
      const response = await apiClient.get('/analytics/teams');
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao carregar analytics');
    }
  }, []);

  // Carregar teams ao montar o hook
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return {
    teams,
    loading,
    error,
    fetchTeams,
    getTeam,
    saveTeam,
    updateTeam,
    deleteTeam,
    executeTeam,
    getTeamAnalytics,
    refresh: fetchTeams
  };
};

// src/hooks/useAgents.ts

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';

interface Agent {
  id: string;
  name: string;
  role: string;
  description?: string;
  model_provider: string;
  model_id: string;
  instructions: string[];
  tools: string[];
  configuration: any;
  is_active: boolean;
  memory_enabled: boolean;
  rag_enabled: boolean;
  rag_index_id?: string;
  created_at: string;
  updated_at: string;
}

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar agentes
  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/agents');
      setAgents(response.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar agentes');
      console.error('Erro ao carregar agentes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar agente específico
  const getAgent = useCallback(async (agentId: string): Promise<Agent> => {
    try {
      const response = await apiClient.get(`/agents/${agentId}`);
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao carregar agente');
    }
  }, []);

  // Carregar agentes ao montar o hook
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return {
    agents,
    loading,
    error,
    fetchAgents,
    getAgent,
    refresh: fetchAgents
  };
};

// src/hooks/useTemplates.ts

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  template_definition: any;
  preview_image?: string;
  tags: string[];
  usage_count: number;
  is_public: boolean;
  created_at: string;
}

export const useTemplates = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/workflows/templates');
      setTemplates(response.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar templates');
      console.error('Erro ao carregar templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar template específico
  const getTemplate = useCallback(async (templateId: string): Promise<Template> => {
    try {
      const response = await apiClient.get(`/workflows/templates/${templateId}`);
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao carregar template');
    }
  }, []);

  // Criar workflow a partir de template
  const createFromTemplate = useCallback(async (templateId: string, name: string, customizations?: any): Promise<string> => {
    try {
      const response = await apiClient.post('/workflows/from-template', {
        template_id: parseInt(templateId),
        name: name,
        customizations: customizations
      });
      return response.data.workflow_id;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao criar workflow do template');
    }
  }, []);

  // Simular carregamento de template (para demo)
  const loadTemplate = useCallback(async (templateId: string) => {
    try {
      const template = await getTemplate(templateId);
      // Simular aplicação do template
      console.log('Template carregado:', template);
      return template;
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao carregar template');
    }
  }, [getTemplate]);

  // Carregar templates ao montar o hook
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    getTemplate,
    createFromTemplate,
    loadTemplate,
    refresh: fetchTemplates
  };
};

// src/hooks/useTools.ts

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  provider?: string;
  configuration?: any;
}

export const useTools = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar tools disponíveis
  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/tools');
      setTools(response.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar tools');
      console.error('Erro ao carregar tools:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar tools ao montar o hook
  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return {
    tools,
    loading,
    error,
    fetchTools,
    refresh: fetchTools
  };
};

// src/hooks/useModels.ts

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';

interface Model {
  id: string;
  name: string;
  description: string;
  provider: string;
  capabilities?: string[];
  pricing?: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface ModelProvider {
  provider: string;
  models: Model[];
}

export const useModels = () => {
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar modelos disponíveis
  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/models');
      setModelProviders(response.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar modelos');
      console.error('Erro ao carregar modelos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Obter todos os modelos em array plano
  const getAllModels = useCallback((): Model[] => {
    return modelProviders.flatMap(provider =>
      provider.models.map(model => ({
        ...model,
        provider: provider.provider
      }))
    );
  }, [modelProviders]);

  // Carregar modelos ao montar o hook
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    modelProviders,
    allModels: getAllModels(),
    loading,
    error,
    fetchModels,
    refresh: fetchModels
  };
};

// src/hooks/useRealTimeExecution.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkflows } from './useWorkflows';

interface ExecutionUpdate {
  execution_id: string;
  status: string;
  step_updates?: any[];
  completed_at?: string;
  error_message?: string;
}

export const useRealTimeExecution = (executionId: string | null) => {
  const [executionStatus, setExecutionStatus] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);
  const { getExecutionStatus, getExecutionSteps } = useWorkflows();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Polling para atualizações de execução
  const startPolling = useCallback(async () => {
    if (!executionId || isPolling) return;

    setIsPolling(true);

    const poll = async () => {
      try {
        const [status, steps] = await Promise.all([
          getExecutionStatus(executionId),
          getExecutionSteps(executionId)
        ]);

        setExecutionStatus({
          ...status,
          steps
        });

        // Parar polling se execução terminou
        if (['completed', 'failed', 'cancelled'].includes(status.execution_status)) {
          stopPolling();
        }
      } catch (error) {
        console.error('Erro ao buscar status de execução:', error);
        stopPolling();
      }
    };

    // Poll inicial
    await poll();

    // Configurar polling regular
    intervalRef.current = setInterval(poll, 2000); // Poll a cada 2 segundos
  }, [executionId, isPolling, getExecutionStatus, getExecutionSteps]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Iniciar polling quando executionId mudar
  useEffect(() => {
    if (executionId) {
      startPolling();
    } else {
      stopPolling();
      setExecutionStatus(null);
    }
  }, [executionId, startPolling, stopPolling]);

  return {
    executionStatus,
    isPolling,
    startPolling,
    stopPolling
  };
};
// src/hooks/useAgents.ts - Hook atualizado para criação de agentes

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';

// =====================================================
// INTERFACES
// =====================================================

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'data' | 'communication' | 'productivity' | 'development' | 'media' | 'integration';
  config?: Record<string, any>;
  icon_name?: string;
  requires_auth?: boolean;
  requires_setup?: boolean;
  is_premium?: boolean;
}

export interface RAGConfig {
  enabled: boolean;
  index_name?: string;
  embedding_model: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  threshold: number;
  status?: 'creating' | 'ready' | 'error' | 'updating';
  document_count?: number;
  error_message?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description?: string;
  model_provider: 'openai' | 'anthropic' | 'groq' | 'ollama';
  model_id: string;
  instructions: string[];
  tools: Tool[];
  memory_enabled: boolean;
  rag_config: RAGConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  roleInTeam?: string;
  priority?: number;
}

export interface CreateAgentRequest {
  name: string;
  role: string;
  description?: string;
  model_provider: 'openai' | 'anthropic' | 'groq' | 'ollama';
  model_id: string;
  instructions: string[];
  tools: Array<{
    tool_id: string;
    config?: Record<string, any>;
  }>;
  memory_enabled: boolean;
  rag_config: {
    enabled: boolean;
    index_name?: string;
    embedding_model: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';
    chunk_size: number;
    chunk_overlap: number;
    top_k: number;
    threshold: number;
  };
  configuration?: Record<string, any>;
}

export interface AgentTestResponse {
  agent_id: string;
  message: string;
  response: string;
  tools_used: string[];
  rag_used: boolean;
  execution_time: number;
}

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =====================================================
  // FUNÇÕES DE CARREGAR DADOS
  // =====================================================

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/agents');
      setAgents(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar agentes');
      console.error('Erro ao carregar agentes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableTools = useCallback(async () => {
    try {
      const response = await apiClient.get('/agents/tools/available');
      setAvailableTools(response.data);
    } catch (err: any) {
      console.error('Erro ao carregar ferramentas:', err);
    }
  }, []);

  // =====================================================
  // FUNÇÕES CRUD DE AGENTES
  // =====================================================

  const getAgent = useCallback(async (agentId: string): Promise<Agent> => {
    try {
      const response = await apiClient.get(`/agents/${agentId}`);
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Erro ao carregar agente');
    }
  }, []);

  const createAgent = useCallback(async (
    agentData: CreateAgentRequest,
    documents?: FileList
  ): Promise<Agent> => {
    try {
      setLoading(true);

      // 1. Criar o agente
      const response = await apiClient.post('/agents', agentData);
      const newAgent = response.data;

      // 2. Se há documentos e RAG habilitado, fazer upload
      if (documents && documents.length > 0 && agentData.rag_config.enabled) {
        await uploadRAGDocuments(newAgent.id, documents);
      }

      // 3. Recarregar lista de agentes
      await fetchAgents();

      return newAgent;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Erro ao criar agente');
    } finally {
      setLoading(false);
    }
  }, [fetchAgents]);

  const updateAgent = useCallback(async (
    agentId: string,
    updateData: Partial<CreateAgentRequest>
  ): Promise<Agent> => {
    try {
      setLoading(true);
      const response = await apiClient.put(`/agents/${agentId}`, updateData);

      // Atualizar na lista local
      setAgents(prev =>
        prev.map(agent =>
          agent.id === agentId ? { ...agent, ...response.data } : agent
        )
      );

      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Erro ao atualizar agente');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAgent = useCallback(async (agentId: string): Promise<void> => {
    try {
      setLoading(true);
      await apiClient.delete(`/agents/${agentId}`);

      // Remover da lista local
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Erro ao deletar agente');
    } finally {
      setLoading(false);
    }
  }, []);

  // =====================================================
  // FUNÇÕES RAG
  // =====================================================

  const uploadRAGDocuments = useCallback(async (
    agentId: string,
    files: FileList
  ): Promise<void> => {
    try {
      const formData = new FormData();

      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      await apiClient.post(`/agents/${agentId}/upload-documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Erro no upload de documentos');
    }
  }, []);

  const getRAGStatus = useCallback(async (agentId: string) => {
    try {
      const response = await apiClient.get(`/agents/${agentId}/rag/status`);
      return response.data;
    } catch (err: any) {
      console.error('Erro ao obter status RAG:', err);
      return null;
    }
  }, []);

  // =====================================================
  // FUNÇÕES DE TESTE
  // =====================================================

  const testAgent = useCallback(async (
    agentId: string,
    message: string
  ): Promise<AgentTestResponse> => {
    try {
      const formData = new FormData();
      formData.append('message', message);

      const response = await apiClient.post(`/agents/${agentId}/test`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Erro ao testar agente');
    }
  }, []);

  // =====================================================
  // EFEITOS
  // =====================================================

  useEffect(() => {
    fetchAgents();
    fetchAvailableTools();
  }, [fetchAgents, fetchAvailableTools]);

  // =====================================================
  // RETORNO DO HOOK
  // =====================================================

  return {
    // Estado
    agents,
    availableTools,
    loading,
    error,

    // Funções CRUD
    fetchAgents,
    getAgent,
    createAgent,
    updateAgent,
    deleteAgent,

    // Funções RAG
    uploadRAGDocuments,
    getRAGStatus,

    // Funções de teste
    testAgent,

    // Utilitários
    refresh: fetchAgents,
  };
};

// =====================================================
// HOOK PARA TEAMS
// =====================================================

export const useTeams = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/teams');
      setTeams(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar teams');
      console.error('Erro ao carregar teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTeam = useCallback(async (teamData: {
    name: string;
    description: string;
    team_type: 'collaborative' | 'hierarchical' | 'sequential';
    agents: Array<{
      agent_id: string;
      role_in_team?: string;
      priority?: number;
    }>;
    supervisor_agent_id?: string;
  }) => {
    try {
      setLoading(true);
      const response = await apiClient.post('/teams', teamData);
      await fetchTeams(); // Recarregar lista
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Erro ao criar team');
    } finally {
      setLoading(false);
    }
  }, [fetchTeams]);

  const executeTeam = useCallback(async (teamId: string, message: string) => {
    try {
      const response = await apiClient.post(`/teams/${teamId}/execute`, {
        message
      });
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Erro ao executar team');
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return {
    teams,
    loading,
    error,
    fetchTeams,
    createTeam,
    executeTeam,
    refresh: fetchTeams,
  };
};

// =====================================================
// HOOK PARA CONFIGURAÇÕES DE MODELOS
// =====================================================

export const useModelConfigs = () => {
  const modelOptions = {
    openai: [
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Modelo mais avançado para tarefas complexas' },
      { id: 'gpt-4', name: 'GPT-4', description: 'Excelente para raciocínio e análise' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Rápido e eficiente para tarefas gerais' }
    ],
    anthropic: [
      { id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Máximo desempenho para tarefas críticas' },
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', description: 'Balance entre performance e velocidade' },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Rápido para interações simples' }
    ],
    groq: [
      { id: 'llama2-70b-4096', name: 'Llama 2 70B', description: 'Modelo open-source de alta performance' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Expertise em múltiplos domínios' }
    ],
    ollama: [
      { id: 'llama2', name: 'Llama 2', description: 'Modelo local de alta qualidade' },
      { id: 'mistral', name: 'Mistral', description: 'Modelo eficiente para uso geral' }
    ]
  };

  const embeddingOptions = [
    {
      id: 'text-embedding-3-small',
      name: 'Text Embedding 3 Small',
      description: 'Rápido e eficiente',
      dimensions: 1536
    },
    {
      id: 'text-embedding-3-large',
      name: 'Text Embedding 3 Large',
      description: 'Máxima precisão',
      dimensions: 3072
    },
    {
      id: 'text-embedding-ada-002',
      name: 'Ada 002',
      description: 'Econômico e confiável',
      dimensions: 1536
    }
  ];

  const getModelIcon = (provider: string): string => {
    const icons: Record<string, string> = {
      'openai': '🤖',
      'anthropic': '🧠',
      'groq': '⚡',
      'ollama': '🦙'
    };
    return icons[provider] || '🤖';
  };

  const getProviderName = (provider: string): string => {
    const names: Record<string, string> = {
      'openai': 'OpenAI',
      'anthropic': 'Anthropic',
      'groq': 'Groq',
      'ollama': 'Ollama'
    };
    return names[provider] || provider;
  };

  return {
    modelOptions,
    embeddingOptions,
    getModelIcon,
    getProviderName,
  };
};

// =====================================================
// HOOK PARA CATEGORIAS DE FERRAMENTAS
// =====================================================

export const useToolCategories = () => {
  const categories = [
    {
      id: 'data',
      name: 'Dados',
      description: 'Busca e processamento de informações',
      icon: '📊',
      color: 'blue'
    },
    {
      id: 'communication',
      name: 'Comunicação',
      description: 'Email, chat e notificações',
      icon: '💬',
      color: 'green'
    },
    {
      id: 'productivity',
      name: 'Produtividade',
      description: 'Calendários, documentos e tarefas',
      icon: '📋',
      color: 'purple'
    },
    {
      id: 'development',
      name: 'Desenvolvimento',
      description: 'Geração de código e APIs',
      icon: '💻',
      color: 'orange'
    },
    {
      id: 'media',
      name: 'Mídia',
      description: 'Imagens, áudio e vídeo',
      icon: '🎨',
      color: 'pink'
    },
    {
      id: 'integration',
      name: 'Integração',
      description: 'APIs externas e webhooks',
      icon: '🔌',
      color: 'indigo'
    }
  ];

  const getCategoryInfo = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId);
  };

  const getCategoryColor = (categoryId: string): string => {
    const category = getCategoryInfo(categoryId);
    return category?.color || 'gray';
  };

  return {
    categories,
    getCategoryInfo,
    getCategoryColor,
  };
};
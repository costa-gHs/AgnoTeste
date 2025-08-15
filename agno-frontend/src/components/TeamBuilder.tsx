import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Settings, Play, Bot, MessageSquare, Save, AlertCircle,
  CheckCircle, Loader, Search, Trash2, Edit, Copy, BarChart3, Clock,
  Target, Zap, Send, Eye, Filter, X, FileText, Database, Globe,
  Code, Brain, TestTube, Activity, ChevronRight, ArrowRight, Sparkles
} from 'lucide-react';

// ==================== TYPES CORRIGIDOS ====================
interface Agent {
  id: number;  // Corrigido para number
  name: string;
  role: string;
  description?: string;
  model_provider: string;
  model_id: string;
  instructions: string[]; // Corrigido para array
  tools: Array<{ tool_id: string; config: any }>; // Corrigido para formato do backend
  memory_enabled: boolean;
  rag_enabled: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Team {
  id: number; // Corrigido para number
  name: string;
  description: string;
  team_type: 'collaborative' | 'hierarchical' | 'sequential';
  agents: Array<{
    agent_id: number; // Corrigido para number
    role_in_team: string;
    priority: number;
  }>;
  supervisor_agent_id?: number; // Corrigido para number
  team_configuration: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  execution_count?: number;
}

interface ExecutionLog {
  id: string;
  timestamp: string;
  type: 'info' | 'error' | 'success' | 'warning';
  message: string;
  agent?: string;
  duration?: number;
}

// ==================== MODAL COMPONENT ====================
const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== API CLIENT CORRIGIDO ====================
const API_BASE_URL = 'http://localhost:8000/api';

const apiClient = {
  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },

  // Teams API - CORRIGIDO
  async getTeams(): Promise<Team[]> {
    return this.request('/teams?user_id=1');
  },

  async createTeam(data: any): Promise<Team> {
    // Formato correto para o backend
    const teamData = {
      name: data.name,
      description: data.description,
      team_type: data.team_type,
      agents: data.agents.map((agent: any) => ({
        agent_id: parseInt(agent.agent_id), // Conversão para int
        role_in_team: agent.role_in_team,
        priority: agent.priority
      })),
      supervisor_agent_id: data.supervisor_agent_id ? parseInt(data.supervisor_agent_id) : null,
      team_configuration: data.team_configuration || {}
    };

    return this.request('/teams', {
      method: 'POST',
      body: JSON.stringify(teamData),
    });
  },

  async updateTeam(id: number, data: any): Promise<Team> {
    return this.request(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTeam(id: number): Promise<void> {
    return this.request(`/teams/${id}?user_id=1`, {
      method: 'DELETE',
    });
  },

  async executeTeam(id: number, message: string): Promise<any> {
    return this.request(`/teams/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        context: {}
      }),
    });
  },

  // Agents API - CORRIGIDO
  async getAgents(): Promise<Agent[]> {
    return this.request('/agents?user_id=1');
  },

  async createAgent(data: any): Promise<Agent> {
    // Formato correto para o backend
    const agentData = {
      name: data.name,
      role: data.role,
      description: data.description || '',
      model_provider: data.model_provider,
      model_id: data.model_id,
      instructions: data.instructions ? [data.instructions] : [], // Array de strings
      tools: data.tools.map((toolId: string) => ({
        tool_id: toolId,
        config: {}
      })), // Formato correto
      memory_enabled: data.memory_enabled,
      rag_config: {
        enabled: data.rag_enabled,
        index_name: null,
        embedding_model: "text-embedding-ada-002",
        chunk_size: 1000,
        chunk_overlap: 200,
        top_k: 5,
        threshold: 0.7
      }, // Formato correto para RAG
      configuration: {},
      user_id: 1
    };

    return this.request('/agents', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  },

  async updateAgent(id: number, data: any): Promise<Agent> {
    return this.request(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAgent(id: number): Promise<void> {
    return this.request(`/agents/${id}?user_id=1`, {
      method: 'DELETE',
    });
  },

  async testAgent(id: number, prompt: string): Promise<any> {
    // ENDPOINT CORRIGIDO: /chat ao invés de /run
    return this.request(`/agents/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        prompt, // Campo correto
        stream: false
      }),
    });
  },
};

// ==================== TEAM CREATION MODAL ====================
const TeamCreationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  selectedTeam?: Team | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onTeamSaved: () => void;
}> = ({ isOpen, onClose, agents, selectedTeam, onSuccess, onError, onTeamSaved }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    team_type: 'collaborative' as Team['team_type'],
    agents: [] as Array<{ agent_id: number; role_in_team: string; priority: number }>,
    supervisor_agent_id: undefined as number | undefined,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (selectedTeam) {
        setFormData({
          name: selectedTeam.name,
          description: selectedTeam.description,
          team_type: selectedTeam.team_type,
          agents: selectedTeam.agents || [],
          supervisor_agent_id: selectedTeam.supervisor_agent_id,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          team_type: 'collaborative',
          agents: [],
          supervisor_agent_id: undefined,
        });
      }
    }
  }, [isOpen, selectedTeam]);

  const handleSave = async () => {
    if (!formData.name || formData.agents.length === 0) return;

    setSaving(true);
    try {
      if (selectedTeam) {
        await apiClient.updateTeam(selectedTeam.id, formData);
        onSuccess('Time atualizado com sucesso!');
      } else {
        await apiClient.createTeam(formData);
        onSuccess('Time criado com sucesso!');
      }
      onTeamSaved();
      onClose();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addAgentToTeam = (agentId: number) => {
    if (!formData.agents.find(a => a.agent_id === agentId)) {
      setFormData(prev => ({
        ...prev,
        agents: [...prev.agents, {
          agent_id: agentId,
          role_in_team: 'member',
          priority: prev.agents.length + 1
        }]
      }));
    }
  };

  const removeAgentFromTeam = (agentId: number) => {
    setFormData(prev => ({
      ...prev,
      agents: prev.agents.filter(a => a.agent_id !== agentId)
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedTeam ? 'Editar Time' : 'Criar Novo Time'}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome do Time *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nome do time..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Time *
            </label>
            <select
              value={formData.team_type}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                team_type: e.target.value as Team['team_type']
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="collaborative">Colaborativo</option>
              <option value="hierarchical">Hierárquico</option>
              <option value="sequential">Sequencial</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descrição
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Descrição do time..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Agentes do Time
          </label>
          <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
            {agents.map(agent => {
              const isSelected = formData.agents.some(a => a.agent_id === agent.id);
              return (
                <div
                  key={agent.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() =>
                    isSelected
                      ? removeAgentFromTeam(agent.id)
                      : addAgentToTeam(agent.id)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{agent.name}</p>
                      <p className="text-xs text-gray-600">{agent.role}</p>
                    </div>
                    {isSelected && <CheckCircle className="w-4 h-4 text-blue-600" />}
                  </div>
                </div>
              );
            })}

            {agents.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                Nenhum agente disponível. Crie agentes primeiro.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.name || formData.agents.length === 0 || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <span>{selectedTeam ? 'Salvar Alterações' : 'Criar Time'}</span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ==================== AGENT CREATION MODAL ====================
const AgentCreationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onAgentSaved: () => void;
}> = ({ isOpen, onClose, onSuccess, onError, onAgentSaved }) => {
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    description: '',
    model_provider: 'openai',
    model_id: 'gpt-4o',
    instructions: '',
    tools: [] as string[],
    memory_enabled: true,
    rag_enabled: false,
  });
  const [saving, setSaving] = useState(false);

  const availableTools = [
    { id: 'duckduckgo', name: 'Busca Web (DuckDuckGo)', icon: Globe },
    { id: 'yfinance', name: 'Yahoo Finance', icon: Database },
    { id: 'calculator', name: 'Calculadora', icon: Code },
    { id: 'reasoning', name: 'Raciocínio Avançado', icon: Brain },
  ];

  const modelProviders = [
    {
      value: 'openai',
      label: 'OpenAI',
      models: ['gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
    },
    {
      value: 'anthropic',
      label: 'Anthropic',
      models: ['claude-3-5-sonnet-20241022', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
    },
    {
      value: 'groq',
      label: 'Groq',
      models: ['llama-3-70b', 'mixtral-8x7b']
    },
  ];

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        role: '',
        description: '',
        model_provider: 'openai',
        model_id: 'gpt-4o',
        instructions: '',
        tools: [],
        memory_enabled: true,
        rag_enabled: false,
      });
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!formData.name || !formData.role) return;

    setSaving(true);
    try {
      await apiClient.createAgent({
        ...formData,
        configuration: {},
        is_active: true,
      });
      onSuccess('Agente criado com sucesso!');
      onAgentSaved();
      onClose();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (toolId: string) => {
    setFormData(prev => ({
      ...prev,
      tools: prev.tools.includes(toolId)
        ? prev.tools.filter(t => t !== toolId)
        : [...prev.tools, toolId]
    }));
  };

  const selectedProvider = modelProviders.find(p => p.value === formData.model_provider);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Criar Novo Agente"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome do Agente *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Nome do agente..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Função/Papel *
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Ex: Analista de Dados, Assistente..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descrição
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={3}
            placeholder="Descrição do agente..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provedor do Modelo
            </label>
            <select
              value={formData.model_provider}
              onChange={(e) => {
                const provider = e.target.value;
                const providerData = modelProviders.find(p => p.value === provider);
                setFormData(prev => ({
                  ...prev,
                  model_provider: provider,
                  model_id: providerData?.models[0] || ''
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {modelProviders.map(provider => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modelo
            </label>
            <select
              value={formData.model_id}
              onChange={(e) => setFormData(prev => ({ ...prev, model_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {selectedProvider?.models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instruções
          </label>
          <textarea
            value={formData.instructions}
            onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={4}
            placeholder="Instruções específicas para o agente..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Ferramentas Disponíveis
          </label>
          <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto border rounded-lg p-3">
            {availableTools.map(tool => {
              const Icon = tool.icon;
              const isSelected = formData.tools.includes(tool.id);
              return (
                <div
                  key={tool.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => toggleTool(tool.id)}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-green-600' : 'text-gray-600'}`} />
                    <span className={`text-sm ${isSelected ? 'text-green-900' : 'text-gray-700'}`}>
                      {tool.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.memory_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, memory_enabled: e.target.checked }))}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">Habilitar Memória</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.rag_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, rag_enabled: e.target.checked }))}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">Habilitar RAG</span>
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.name || !formData.role || saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Criando...</span>
              </>
            ) : (
              <span>Criar Agente</span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ==================== MAIN COMPONENT ====================
const TeamBuilder: React.FC = () => {
  // States
  const [activeZone, setActiveZone] = useState<'teams' | 'agents' | 'test-agent' | 'test-team'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Load data function - CORRIGIDO PARA EVITAR LOOPS
  const loadData = useCallback(async () => {
    try {
      const [teamsData, agentsData] = await Promise.all([
        apiClient.getTeams(),
        apiClient.getAgents()
      ]);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
      setAgents(Array.isArray(agentsData) ? agentsData : []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading data:', err);
    }
  }, []); // VAZIO para evitar re-criação da função

  // Load data on mount ONLY - CORRIGIDO
  useEffect(() => {
    let mounted = true; // Flag para evitar updates após unmount

    const initialLoad = async () => {
      if (!mounted) return;
      setLoading(true);
      await loadData();
      if (mounted) {
        setLoading(false);
      }
    };

    initialLoad();

    return () => {
      mounted = false; // Cleanup
    };
  }, []); // DEPENDENCY ARRAY VAZIO - só executa uma vez

  // Clear messages after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Handlers
  const handleOpenTeamModal = (team?: Team) => {
    setSelectedTeam(team || null);
    setShowTeamModal(true);
  };

  const handleCloseTeamModal = () => {
    setShowTeamModal(false);
    setSelectedTeam(null);
  };

  const handleTeamSaved = () => {
    loadData();
  };

  const handleAgentSaved = () => {
    loadData();
  };

  const handleDeleteTeam = useCallback(async (teamId: number) => {
    if (window.confirm('Tem certeza que deseja deletar este time?')) {
      try {
        await apiClient.deleteTeam(teamId);
        setSuccess('Time deletado com sucesso!');
        loadData();
      } catch (err: any) {
        setError(err.message);
      }
    }
  }, [loadData]);

  // ==================== ZONA 1: TIMES ====================
  const TeamsZone: React.FC = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Users className="w-7 h-7 text-blue-600 mr-3" />
            Gestão de Times
          </h2>
          <p className="text-gray-600 mt-1">Configure e gerencie seus times de agentes</p>
        </div>
        <button
          onClick={() => handleOpenTeamModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Time</span>
        </button>
      </div>

      <div className="grid gap-4">
        {teams.map(team => (
          <div key={team.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    team.team_type === 'collaborative' ? 'bg-blue-100 text-blue-800' :
                    team.team_type === 'hierarchical' ? 'bg-purple-100 text-purple-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {team.team_type}
                  </span>
                </div>
                <p className="text-gray-600 mb-3">{team.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <Bot className="w-4 h-4 mr-1" />
                    {team.agents?.length || 0} agentes
                  </span>
                  <span className="flex items-center">
                    <Activity className="w-4 h-4 mr-1" />
                    {team.execution_count || 0} execuções
                  </span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {new Date(team.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleOpenTeamModal(team)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Deletar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {teams.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>Nenhum time encontrado. Crie seu primeiro time!</p>
          </div>
        )}
      </div>
    </div>
  );

  // ==================== ZONA 2: AGENTES ====================
  const AgentsZone: React.FC = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Bot className="w-7 h-7 text-green-600 mr-3" />
            Gestão de Agentes
          </h2>
          <p className="text-gray-600 mt-1">Configure e gerencie seus agentes de IA</p>
        </div>
        <button
          onClick={() => setShowAgentModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Agente</span>
        </button>
      </div>

      <div className="grid gap-4">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                    {agent.role}
                  </span>
                </div>
                <p className="text-gray-600 mb-3">{agent.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span>{agent.model_provider}/{agent.model_id}</span>
                  <span className="flex items-center">
                    <Brain className="w-4 h-4 mr-1" />
                    Memória: {agent.memory_enabled ? 'Sim' : 'Não'}
                  </span>
                  <span className="flex items-center">
                    <Database className="w-4 h-4 mr-1" />
                    RAG: {agent.rag_enabled ? 'Sim' : 'Não'}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveZone('test-agent')}
                  className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Testar"
                >
                  <TestTube className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {agents.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>Nenhum agente encontrado. Crie seu primeiro agente!</p>
          </div>
        )}
      </div>
    </div>
  );

  // ==================== ZONA 3: TESTE DE AGENTE - CORRIGIDA ====================
  const AgentTestZone: React.FC = () => {
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [testPrompt, setTestPrompt] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Debounce para evitar muitas chamadas
    const handleTestAgent = useCallback(async () => {
      if (!selectedAgent || !testPrompt.trim() || isLoading) return;

      setIsLoading(true);
      try {
        const result = await apiClient.testAgent(parseInt(selectedAgent), testPrompt);
        setTestResult(result);
      } catch (err: any) {
        setTestResult({ error: err.message });
      } finally {
        setIsLoading(false);
      }
    }, [selectedAgent, testPrompt, isLoading]);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <TestTube className="w-7 h-7 text-purple-600 mr-3" />
            Teste de Agente
          </h2>
          <p className="text-gray-600 mt-1">Teste individual de agentes com prompts personalizados</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Configuração do Teste</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecionar Agente
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Escolha um agente...</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} - {agent.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt de Teste
                </label>
                <textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={6}
                  placeholder="Digite o prompt para testar o agente..."
                />
              </div>

              <button
                onClick={handleTestAgent}
                disabled={!selectedAgent || !testPrompt.trim() || isLoading}
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Testando...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Executar Teste</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Resultado do Teste</h3>

            {testResult ? (
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap text-gray-800">
                  {testResult.error
                    ? `Erro: ${testResult.error}`
                    : JSON.stringify(testResult, null, 2)
                  }
                </pre>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <TestTube className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>Execute um teste para ver os resultados aqui</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== ZONA 4: TESTE DE TIME - CORRIGIDA ====================
  const TeamTestZone: React.FC = () => {
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [testMessage, setTestMessage] = useState('');
    const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);

    const handleExecuteTeam = useCallback(async () => {
      if (!selectedTeam || !testMessage.trim() || isExecuting) return;

      setIsExecuting(true);
      setExecutionLogs([{
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: 'info',
        message: 'Iniciando execução do time...'
      }]);

      try {
        const result = await apiClient.executeTeam(parseInt(selectedTeam), testMessage);

        setExecutionLogs(prev => [...prev, {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'success',
          message: `Execução concluída com sucesso!`,
          duration: result?.metadata?.execution_time || 0
        }]);

        if (result?.response) {
          setExecutionLogs(prev => [...prev, {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            type: 'info',
            message: `Resposta: ${result.response}`
          }]);
        }

      } catch (err: any) {
        setExecutionLogs(prev => [...prev, {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'error',
          message: `Erro na execução: ${err.message}`
        }]);
      } finally {
        setIsExecuting(false);
      }
    }, [selectedTeam, testMessage, isExecuting]);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Activity className="w-7 h-7 text-orange-600 mr-3" />
            Teste de Time
          </h2>
          <p className="text-gray-600 mt-1">Execute tasks completas com times de agentes</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Configuração da Execução</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecionar Time
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Escolha um time...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.agents?.length || 0} agentes)
                    </option>
                  ))}
                </select>
              </div>

              {selectedTeam && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Preview do Time</h4>
                  {(() => {
                    const team = teams.find(t => t.id === parseInt(selectedTeam));
                    if (!team) return null;

                    return (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">{team.description}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Tipo: {team.team_type}</span>
                          <span>Agentes: {team.agents?.length || 0}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem para o Time
                </label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={6}
                  placeholder="Digite a tarefa que você quer que o time execute..."
                />
              </div>

              <button
                onClick={handleExecuteTeam}
                disabled={!selectedTeam || !testMessage.trim() || isExecuting}
                className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {isExecuting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Executando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Executar Time</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Logs de Execução</h3>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {executionLogs.length > 0 ? (
                executionLogs.map(log => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg text-sm border-l-4 ${
                      log.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' :
                      log.type === 'success' ? 'bg-green-50 border-green-500 text-green-700' :
                      log.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' :
                      'bg-blue-50 border-blue-500 text-blue-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="flex-1">{log.message}</p>
                      <span className="text-xs opacity-70 ml-2">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.duration && (
                      <p className="text-xs opacity-70 mt-1">
                        Duração: {log.duration}ms
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>Execute um time para ver os logs aqui</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Team Builder</h1>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-1">
              {[
                { key: 'teams', label: 'Times', icon: Users, color: 'blue' },
                { key: 'agents', label: 'Agentes', icon: Bot, color: 'green' },
                { key: 'test-agent', label: 'Teste Agente', icon: TestTube, color: 'purple' },
                { key: 'test-team', label: 'Teste Time', icon: Activity, color: 'orange' },
              ].map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => setActiveZone(key as any)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    activeZone === key
                      ? `bg-${color}-100 text-${color}-700`
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </nav>

            {/* Mobile Navigation */}
            <div className="md:hidden">
              <select
                value={activeZone}
                onChange={(e) => setActiveZone(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="teams">Times</option>
                <option value="agents">Agentes</option>
                <option value="test-agent">Teste Agente</option>
                <option value="test-team">Teste Time</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <Loader className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-gray-600">Carregando dados...</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-700">{success}</span>
              </div>
              <button
                onClick={() => setSuccess(null)}
                className="text-green-600 hover:text-green-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Zone Content */}
        {!loading && (
          <>
            {activeZone === 'teams' && <TeamsZone />}
            {activeZone === 'agents' && <AgentsZone />}
            {activeZone === 'test-agent' && <AgentTestZone />}
            {activeZone === 'test-team' && <TeamTestZone />}
          </>
        )}
      </div>

      {/* Modals */}
      <TeamCreationModal
        isOpen={showTeamModal}
        onClose={handleCloseTeamModal}
        agents={agents}
        selectedTeam={selectedTeam}
        onSuccess={setSuccess}
        onError={setError}
        onTeamSaved={handleTeamSaved}
      />

      <AgentCreationModal
        isOpen={showAgentModal}
        onClose={() => setShowAgentModal(false)}
        onSuccess={setSuccess}
        onError={setError}
        onAgentSaved={handleAgentSaved}
      />
    </div>
  );
};

export default TeamBuilder;
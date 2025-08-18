import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Settings, Play, Bot, MessageSquare, Save, AlertCircle,
  CheckCircle, Loader, Search, Trash2, Edit, Copy, BarChart3, Clock,
  Target, Zap, Send, Eye, Filter, X, FileText, Database, Globe,
  Code, Brain, TestTube, Activity, ChevronRight, ArrowRight, Sparkles,
  RefreshCw, User, Shield, Layers
} from 'lucide-react';

// ==================== TYPES CORRIGIDOS ====================
interface Agent {
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

interface Team {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {children}
        </div>
      </div>
    </div>
  );
};

// ==================== API CLIENT ====================
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = {
  async request(endpoint: string, options?: RequestInit) {
    const url = `${API_BASE}/api${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || data;
  },

  async getTeams(): Promise<Team[]> {
    return this.request('/teams?user_id=1');
  },

  async createTeam(data: any): Promise<Team> {
    const teamData = {
      name: data.name,
      description: data.description,
      team_type: data.team_type,
      agents: data.agents.map((a: any) => ({
        agent_id: parseInt(a.agent_id),
        role_in_team: a.role_in_team,
        priority: parseInt(a.priority) || 1
      })),
      supervisor_agent_id: data.supervisor_agent_id ? parseInt(data.supervisor_agent_id) : null,
      team_configuration: data.team_configuration || {},
      is_active: true
    };

    return this.request('/teams?user_id=1', {
      method: 'POST',
      body: JSON.stringify(teamData),
    });
  },

  async deleteTeam(id: number): Promise<void> {
    return this.request(`/teams/${id}?user_id=1`, {
      method: 'DELETE',
    });
  },

  async executeTeam(id: number, message: string): Promise<any> {
    return this.request(`/teams/${id}/execute?user_id=1`, {
      method: 'POST',
      body: JSON.stringify({
        input_message: message,  // Campo correto: input_message
        context: {}
      }),
    });
  },

  async getAgents(): Promise<Agent[]> {
    return this.request('/agents?user_id=1');
  },

  async createAgent(data: any): Promise<Agent> {
    const agentData = {
      name: data.name,
      role: data.role,
      description: data.description || '',
      model_provider: data.model_provider,
      model_id: data.model_id,
      instructions: data.instructions ? [data.instructions] : [],
      tools: data.tools.map((toolId: string) => ({
        tool_id: toolId,
        config: {}
      })),
      memory_enabled: data.memory_enabled,
      rag_enabled: data.rag_enabled,
      rag_config: data.rag_enabled ? {
        enabled: true,
        index_name: null,
        embedding_model: "text-embedding-ada-002",
        chunk_size: 1000,
        chunk_overlap: 200,
        top_k: 5,
        threshold: 0.7
      } : null,
      configuration: {},
      is_active: true
    };

    return this.request('/agents?user_id=1', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  },

  async deleteAgent(id: number): Promise<void> {
    return this.request(`/agents/${id}?user_id=1`, {
      method: 'DELETE',
    });
  },

  async testAgent(id: number, prompt: string): Promise<any> {
    return this.request(`/agents/${id}/chat?user_id=1`, {
      method: 'POST',
      body: JSON.stringify({
        message: prompt,  // Campo correto: message
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
    team_type: 'collaborative' as const,
    agents: [] as Array<{ agent_id: string; role_in_team: string; priority: string }>,
    supervisor_agent_id: '',
    team_configuration: {},
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedTeam) {
      setFormData({
        name: selectedTeam.name,
        description: selectedTeam.description,
        team_type: selectedTeam.team_type,
        agents: selectedTeam.agents.map(a => ({
          agent_id: a.agent_id.toString(),
          role_in_team: a.role_in_team,
          priority: a.priority.toString()
        })),
        supervisor_agent_id: selectedTeam.supervisor_agent_id?.toString() || '',
        team_configuration: selectedTeam.team_configuration,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        team_type: 'collaborative',
        agents: [],
        supervisor_agent_id: '',
        team_configuration: {},
      });
    }
  }, [selectedTeam]);

  const handleAddAgent = () => {
    setFormData(prev => ({
      ...prev,
      agents: [...prev.agents, { agent_id: '', role_in_team: '', priority: '1' }]
    }));
  };

  const handleRemoveAgent = (index: number) => {
    setFormData(prev => ({
      ...prev,
      agents: prev.agents.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description || formData.agents.length === 0) {
      onError('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      await apiClient.createTeam(formData);
      onSuccess('Time criado com sucesso!');
      onTeamSaved();
      onClose();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={selectedTeam ? 'Editar Time' : 'Criar Novo Time'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Time</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ex: Time de Análise"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Descreva o objetivo do time..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Time</label>
          <select
            value={formData.team_type}
            onChange={(e) => setFormData(prev => ({ ...prev, team_type: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="collaborative">Colaborativo</option>
            <option value="hierarchical">Hierárquico</option>
            <option value="sequential">Sequencial</option>
          </select>
        </div>

        {formData.team_type === 'hierarchical' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Supervisor</label>
            <select
              value={formData.supervisor_agent_id}
              onChange={(e) => setFormData(prev => ({ ...prev, supervisor_agent_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecione um supervisor...</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} - {agent.role}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Agentes do Time</label>
            <button
              onClick={handleAddAgent}
              className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar Agente
            </button>
          </div>

          <div className="space-y-2">
            {formData.agents.map((teamAgent, index) => (
              <div key={index} className="flex items-center space-x-2">
                <select
                  value={teamAgent.agent_id}
                  onChange={(e) => {
                    const newAgents = [...formData.agents];
                    newAgents[index].agent_id = e.target.value;
                    setFormData(prev => ({ ...prev, agents: newAgents }));
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um agente...</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} - {agent.role}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={teamAgent.role_in_team}
                  onChange={(e) => {
                    const newAgents = [...formData.agents];
                    newAgents[index].role_in_team = e.target.value;
                    setFormData(prev => ({ ...prev, agents: newAgents }));
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Papel no time"
                />

                <button
                  onClick={() => handleRemoveAgent(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
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

  const handleSave = async () => {
    if (!formData.name || !formData.role) {
      onError('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      await apiClient.createAgent(formData);
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Criar Novo Agente">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Agente</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Ex: Assistente de Pesquisa"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Papel</label>
          <input
            type="text"
            value={formData.role}
            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Ex: Especialista em análise de dados"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={3}
            placeholder="Descreva as capacidades do agente..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Provedor</label>
            <select
              value={formData.model_provider}
              onChange={(e) => setFormData(prev => ({ ...prev, model_provider: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {modelProviders.map(provider => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
            <select
              value={formData.model_id}
              onChange={(e) => setFormData(prev => ({ ...prev, model_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {modelProviders
                .find(p => p.value === formData.model_provider)
                ?.models.map(model => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Instruções</label>
          <textarea
            value={formData.instructions}
            onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={4}
            placeholder="Instruções específicas para o agente..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ferramentas</label>
          <div className="grid grid-cols-2 gap-2">
            {availableTools.map(tool => {
              const Icon = tool.icon;
              const isSelected = formData.tools.includes(tool.id);
              return (
                <button
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{tool.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.memory_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, memory_enabled: e.target.checked }))}
              className="rounded text-green-600"
            />
            <span className="text-sm">Habilitar Memória</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.rag_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, rag_enabled: e.target.checked }))}
              className="rounded text-green-600"
            />
            <span className="text-sm">Habilitar RAG</span>
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
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
  const [teams, setTeams] = useState<Team[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeZone, setActiveZone] = useState<'teams' | 'agents' | 'test-agent' | 'test-team'>('teams');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsData, agentsData] = await Promise.all([
        apiClient.getTeams(),
        apiClient.getAgents(),
      ]);
      setTeams(teamsData);
      setAgents(agentsData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
  }, []);

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
                    <Users className="w-4 h-4 mr-1" />
                    {team.agents?.length || 0} agentes
                  </span>
                  <span className="flex items-center">
                    <BarChart3 className="w-4 h-4 mr-1" />
                    {team.execution_count || 0} execuções
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveZone('test-team')}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Testar"
                >
                  <Play className="w-4 h-4" />
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
                <button
                  onClick={() => apiClient.deleteAgent(agent.id).then(loadData)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Deletar"
                >
                  <Trash2 className="w-4 h-4" />
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

  // ==================== ZONA 3: TESTE DE AGENTE ====================
  const AgentTestZone: React.FC = () => {
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [testPrompt, setTestPrompt] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

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
                    : testResult.response || testResult.data?.response || testResult.message || JSON.stringify(testResult, null, 2)
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

  // ==================== ZONA 4: TESTE DE TIME ====================
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
          message: result.response || result.data?.response || result.message || 'Execução concluída!',
          duration: result?.metadata?.execution_time || result?.execution_time_ms || 0
        }]);

        if (result?.agent_results || result?.data?.agent_results) {
          const agentResults = result.agent_results || result.data?.agent_results;
          agentResults.forEach((agentResult: any) => {
            setExecutionLogs(prev => [...prev, {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              type: 'info',
              message: `${agentResult.agent_name}: ${agentResult.response}`,
              agent: agentResult.agent_name,
              duration: agentResult.execution_time
            }]);
          });
        }
      } catch (err: any) {
        setExecutionLogs(prev => [...prev, {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'error',
          message: `Erro: ${err.message}`
        }]);
      } finally {
        setIsExecuting(false);
      }
    }, [selectedTeam, testMessage, isExecuting]);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Play className="w-7 h-7 text-orange-600 mr-3" />
            Teste de Time
          </h2>
          <p className="text-gray-600 mt-1">Execute testes colaborativos com times de agentes</p>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem de Entrada
                </label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={6}
                  placeholder="Digite a mensagem para o time processar..."
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
                    <Play className="w-4 h-4" />
                    <span>Executar Time</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Logs de Execução</h3>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {executionLogs.length > 0 ? (
                executionLogs.map(log => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg ${
                      log.type === 'error' ? 'bg-red-50 text-red-800' :
                      log.type === 'success' ? 'bg-green-50 text-green-800' :
                      log.type === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                      'bg-gray-50 text-gray-800'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      <div className="flex-1">
                        <p className="text-sm">{log.message}</p>
                        {log.agent && (
                          <p className="text-xs mt-1 opacity-75">Agente: {log.agent}</p>
                        )}
                      </div>
                      {log.duration && (
                        <span className="text-xs opacity-75">
                          {(log.duration / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>
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

  // ==================== RENDER PRINCIPAL ====================
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Layers className="w-8 h-8 text-indigo-600 mr-3" />
          Team Builder
        </h1>
        <p className="text-gray-600 mt-2">Gerencie agentes, times e execute testes colaborativos</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveZone('teams')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeZone === 'teams'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Times</span>
            </div>
          </button>

          <button
            onClick={() => setActiveZone('agents')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeZone === 'agents'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4" />
              <span>Agentes</span>
            </div>
          </button>

          <button
            onClick={() => setActiveZone('test-agent')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeZone === 'test-agent'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <TestTube className="w-4 h-4" />
              <span>Teste de Agente</span>
            </div>
          </button>

          <button
            onClick={() => setActiveZone('test-team')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeZone === 'test-team'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Play className="w-4 h-4" />
              <span>Teste de Time</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <span className="text-green-700">{success}</span>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="text-green-600 hover:text-green-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Zone Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          {activeZone === 'teams' && <TeamsZone />}
          {activeZone === 'agents' && <AgentsZone />}
          {activeZone === 'test-agent' && <AgentTestZone />}
          {activeZone === 'test-team' && <TeamTestZone />}
        </>
      )}

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
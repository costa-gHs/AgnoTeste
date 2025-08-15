import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Settings, Play, Bot, MessageSquare, Save, AlertCircle,
  CheckCircle, Loader, Search, Trash2, Edit, Copy, BarChart3, Clock,
  Crown, Target, Zap, RefreshCw, Send, Eye, Filter, Download, X,
  FileText, Database, Globe, Code, Brain, Sparkles, TestTube,
  ListChecks, GitBranch, Activity, ChevronRight, ChevronDown,
  Package, Wrench, Terminal, History, ArrowRight
} from 'lucide-react';

// ==================== TYPES ====================
interface Agent {
  id: string;
  name: string;
  role: string;
  description?: string;
  model_provider: string;
  model_id: string;
  instructions: string[];
  tools: string[];
  memory_enabled: boolean;
  rag_enabled: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Team {
  id: string;
  name: string;
  description: string;
  team_type: 'collaborative' | 'hierarchical' | 'sequential';
  agents: Array<{
    agent_id: string;
    role_in_team: string;
    priority: number;
  }>;
  supervisor_agent_id?: string;
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

// ==================== API SERVICE ====================
class TeamBuilderAPI {
  private baseURL = 'http://localhost:8000/api';

  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Agents
  async getAgents() {
    return this.request('/agents/');
  }

  async createAgent(agent: Partial<Agent>) {
    return this.request('/agents/', {
      method: 'POST',
      body: JSON.stringify(agent),
    });
  }

  async updateAgent(id: string, updates: Partial<Agent>) {
    return this.request(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteAgent(id: string) {
    return this.request(`/agents/${id}`, {
      method: 'DELETE',
    });
  }

  async testAgent(id: string, prompt: string) {
    return this.request(`/agents/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ prompt, stream: false }),
    });
  }

  // Teams
  async getTeams() {
    return this.request('/teams/');
  }

  async createTeam(team: Partial<Team>) {
    return this.request('/teams/', {
      method: 'POST',
      body: JSON.stringify(team),
    });
  }

  async updateTeam(id: string, updates: Partial<Team>) {
    return this.request(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTeam(id: string) {
    return this.request(`/teams/${id}`, {
      method: 'DELETE',
    });
  }

  async executeTeam(id: string, message: string, context?: any) {
    return this.request(`/teams/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    });
  }

  async getTeamHistory(id: string) {
    return this.request(`/teams/${id}/history`);
  }
}

// ==================== MAIN COMPONENT ====================
const TeamBuilder: React.FC = () => {
  const api = new TeamBuilderAPI();

  // States
  const [activeZone, setActiveZone] = useState<'teams' | 'agents' | 'test-agent' | 'test-team'>('teams');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsData, teamsData] = await Promise.all([
        api.getAgents(),
        api.getTeams()
      ]);
      setAgents(Array.isArray(agentsData) ? agentsData : []);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
    } catch (err: any) {
      setError(err.message);
      // Use mock data in development
      setAgents([]);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  // ==================== ZONA 1: CRIAÇÃO DE TIMES ====================
  const TeamCreationZone: React.FC = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [formData, setFormData] = useState({
      name: '',
      description: '',
      team_type: 'collaborative' as Team['team_type'],
      agents: [] as Array<{ agent_id: string; role_in_team: string; priority: number }>,
      supervisor_agent_id: '',
    });

    const handleCreateTeam = async () => {
      try {
        setLoading(true);
        await api.createTeam(formData);
        await loadData();
        setIsCreating(false);
        setFormData({
          name: '',
          description: '',
          team_type: 'collaborative',
          agents: [],
          supervisor_agent_id: '',
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const addAgentToTeam = (agentId: string) => {
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

    const removeAgentFromTeam = (agentId: string) => {
      setFormData(prev => ({
        ...prev,
        agents: prev.agents.filter(a => a.agent_id !== agentId)
      }));
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold">Gerenciar Times</h2>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Time</span>
          </button>
        </div>

        {/* Teams List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => (
            <div key={team.id} className="bg-white rounded-lg border p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{team.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{team.description}</p>
                </div>
                {team.team_type === 'hierarchical' && (
                  <Crown className="w-5 h-5 text-yellow-500" />
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Tipo:</span>
                  <span className="font-medium capitalize">{team.team_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Agentes:</span>
                  <span className="font-medium">{team.agents?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Execuções:</span>
                  <span className="font-medium">{team.execution_count || 0}</span>
                </div>
              </div>

              <div className="flex space-x-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => setSelectedTeam(team)}
                  className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                >
                  <Edit className="w-3 h-3 inline mr-1" />
                  Editar
                </button>
                <button
                  onClick={() => api.deleteTeam(team.id).then(loadData)}
                  className="flex-1 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Create/Edit Modal */}
        {(isCreating || selectedTeam) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">
                  {selectedTeam ? 'Editar Time' : 'Criar Novo Time'}
                </h3>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome do Time</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Time de Vendas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Descrição</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Descreva o objetivo do time..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Colaboração</label>
                  <select
                    value={formData.team_type}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      team_type: e.target.value as Team['team_type']
                    }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="collaborative">Colaborativo</option>
                    <option value="hierarchical">Hierárquico</option>
                    <option value="sequential">Sequencial</option>
                  </select>
                </div>

                {formData.team_type === 'hierarchical' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Supervisor</label>
                    <select
                      value={formData.supervisor_agent_id}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        supervisor_agent_id: e.target.value
                      }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium mb-1">Agentes do Time</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {agents.map(agent => {
                      const isSelected = formData.agents.some(a => a.agent_id === agent.id);
                      return (
                        <div
                          key={agent.id}
                          className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                            isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => isSelected ? removeAgentFromTeam(agent.id) : addAgentToTeam(agent.id)}
                        >
                          <div className="flex items-center space-x-3">
                            <Bot className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="font-medium text-sm">{agent.name}</p>
                              <p className="text-xs text-gray-500">{agent.role}</p>
                            </div>
                          </div>
                          {isSelected && <CheckCircle className="w-4 h-4 text-blue-600" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {formData.agents.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Configurar Papéis</label>
                    <div className="space-y-2">
                      {formData.agents.map((teamAgent, index) => {
                        const agent = agents.find(a => a.id === teamAgent.agent_id);
                        return (
                          <div key={teamAgent.agent_id} className="flex items-center space-x-2">
                            <span className="text-sm w-32 truncate">{agent?.name}</span>
                            <input
                              type="text"
                              value={teamAgent.role_in_team}
                              onChange={(e) => {
                                const newAgents = [...formData.agents];
                                newAgents[index].role_in_team = e.target.value;
                                setFormData(prev => ({ ...prev, agents: newAgents }));
                              }}
                              className="flex-1 px-2 py-1 text-sm border rounded"
                              placeholder="Papel no time"
                            />
                            <input
                              type="number"
                              value={teamAgent.priority}
                              onChange={(e) => {
                                const newAgents = [...formData.agents];
                                newAgents[index].priority = parseInt(e.target.value);
                                setFormData(prev => ({ ...prev, agents: newAgents }));
                              }}
                              className="w-16 px-2 py-1 text-sm border rounded"
                              min="1"
                              placeholder="Pri."
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedTeam(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateTeam}
                  disabled={!formData.name || formData.agents.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {selectedTeam ? 'Salvar Alterações' : 'Criar Time'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== ZONA 2: CRIAÇÃO DE AGENTES ====================
  const AgentCreationZone: React.FC = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [formData, setFormData] = useState({
      name: '',
      role: '',
      description: '',
      model_provider: 'openai',
      model_id: 'gpt-4',
      instructions: [''],
      tools: [] as string[],
      memory_enabled: true,
      rag_enabled: false,
    });

    const availableTools = [
      { id: 'web_search', name: 'Busca Web', icon: Globe },
      { id: 'database', name: 'Banco de Dados', icon: Database },
      { id: 'code_interpreter', name: 'Interpretador de Código', icon: Code },
      { id: 'file_browser', name: 'Navegador de Arquivos', icon: FileText },
      { id: 'reasoning', name: 'Raciocínio', icon: Brain },
      { id: 'email', name: 'Email', icon: MessageSquare },
    ];

    const modelProviders = [
      { value: 'openai', label: 'OpenAI', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
      { value: 'anthropic', label: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
      { value: 'groq', label: 'Groq', models: ['llama-3-70b', 'mixtral-8x7b'] },
      { value: 'ollama', label: 'Ollama', models: ['llama2', 'mistral', 'codellama'] },
    ];

    const handleCreateAgent = async () => {
      try {
        setLoading(true);
        await api.createAgent(formData);
        await loadData();
        setIsCreating(false);
        setFormData({
          name: '',
          role: '',
          description: '',
          model_provider: 'openai',
          model_id: 'gpt-4',
          instructions: [''],
          tools: [],
          memory_enabled: true,
          rag_enabled: false,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
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

    const addInstruction = () => {
      setFormData(prev => ({
        ...prev,
        instructions: [...prev.instructions, '']
      }));
    };

    const updateInstruction = (index: number, value: string) => {
      const newInstructions = [...formData.instructions];
      newInstructions[index] = value;
      setFormData(prev => ({
        ...prev,
        instructions: newInstructions
      }));
    };

    const removeInstruction = (index: number) => {
      setFormData(prev => ({
        ...prev,
        instructions: prev.instructions.filter((_, i) => i !== index)
      }));
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bot className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold">Gerenciar Agentes</h2>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agente</span>
          </button>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <div key={agent.id} className="bg-white rounded-lg border p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{agent.role}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs ${
                  agent.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {agent.is_active ? 'Ativo' : 'Inativo'}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Modelo:</span>
                  <span className="font-medium">{agent.model_provider}/{agent.model_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Tools:</span>
                  <span className="font-medium">{agent.tools?.length || 0}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {agent.memory_enabled && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                      Memória
                    </span>
                  )}
                  {agent.rag_enabled && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                      RAG
                    </span>
                  )}
                </div>
              </div>

              <div className="flex space-x-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => {
                    setSelectedAgent(agent);
                    setFormData({
                      name: agent.name,
                      role: agent.role,
                      description: agent.description || '',
                      model_provider: agent.model_provider,
                      model_id: agent.model_id,
                      instructions: agent.instructions || [''],
                      tools: agent.tools || [],
                      memory_enabled: agent.memory_enabled,
                      rag_enabled: agent.rag_enabled,
                    });
                    setIsCreating(true);
                  }}
                  className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                >
                  <Edit className="w-3 h-3 inline mr-1" />
                  Editar
                </button>
                <button
                  onClick={() => api.deleteAgent(agent.id).then(loadData)}
                  className="flex-1 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Create/Edit Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">
                  {selectedAgent ? 'Editar Agente' : 'Criar Novo Agente'}
                </h3>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome do Agente</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Ex: Assistente de Vendas"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Papel/Função</label>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Ex: Especialista em Vendas B2B"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Descrição</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={2}
                    placeholder="Descreva as responsabilidades do agente..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Provedor do Modelo</label>
                    <select
                      value={formData.model_provider}
                      onChange={(e) => setFormData(prev => ({ ...prev, model_provider: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {modelProviders.map(provider => (
                        <option key={provider.value} value={provider.value}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Modelo</label>
                    <select
                      value={formData.model_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, model_id: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
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
                  <label className="block text-sm font-medium mb-1">
                    Instruções do Sistema
                    <button
                      onClick={addInstruction}
                      className="ml-2 text-purple-600 hover:text-purple-700"
                    >
                      <Plus className="w-4 h-4 inline" />
                    </button>
                  </label>
                  <div className="space-y-2">
                    {formData.instructions.map((instruction, index) => (
                      <div key={index} className="flex space-x-2">
                        <input
                          type="text"
                          value={instruction}
                          onChange={(e) => updateInstruction(index, e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Adicione uma instrução..."
                        />
                        {formData.instructions.length > 1 && (
                          <button
                            onClick={() => removeInstruction(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Ferramentas Disponíveis</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {availableTools.map(tool => {
                      const Icon = tool.icon;
                      const isSelected = formData.tools.includes(tool.id);
                      return (
                        <button
                          key={tool.id}
                          onClick={() => toggleTool(tool.id)}
                          className={`flex items-center space-x-2 p-2 rounded-lg border transition-colors ${
                            isSelected
                              ? 'bg-purple-50 border-purple-300 text-purple-700'
                              : 'hover:bg-gray-50 border-gray-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{tool.name}</span>
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
                      className="rounded text-purple-600"
                    />
                    <span className="text-sm">Habilitar Memória</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.rag_enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, rag_enabled: e.target.checked }))}
                      className="rounded text-purple-600"
                    />
                    <span className="text-sm">Habilitar RAG</span>
                  </label>
                </div>
              </div>

              <div className="p-6 border-t flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedAgent(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateAgent}
                  disabled={!formData.name || !formData.role}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {selectedAgent ? 'Salvar Alterações' : 'Criar Agente'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== ZONA 3: TESTE UNITÁRIO DE AGENTE ====================
  const AgentTestZone: React.FC = () => {
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [testPrompt, setTestPrompt] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [testHistory, setTestHistory] = useState<Array<{
      id: string;
      agent: string;
      prompt: string;
      response: string;
      timestamp: Date;
      duration: number;
    }>>([]);

    const handleTestAgent = async () => {
      if (!selectedAgent || !testPrompt) return;

      setIsLoading(true);
      const startTime = Date.now();

      try {
        const result = await api.testAgent(selectedAgent, testPrompt);
        const duration = Date.now() - startTime;

        const testEntry = {
          id: Date.now().toString(),
          agent: agents.find(a => a.id === selectedAgent)?.name || 'Unknown',
          prompt: testPrompt,
          response: result.response || JSON.stringify(result),
          timestamp: new Date(),
          duration,
        };

        setTestResult(result);
        setTestHistory(prev => [testEntry, ...prev]);
      } catch (err: any) {
        setTestResult({ error: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <TestTube className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold">Teste Unitário de Agente</h2>
        </div>

        {/* Test Configuration */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Selecionar Agente</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Escolha um agente...</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} - {agent.role}
                </option>
              ))}
            </select>
          </div>

          {selectedAgent && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Detalhes do Agente</h3>
              {(() => {
                const agent = agents.find(a => a.id === selectedAgent);
                return agent ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Modelo:</span>
                      <span className="ml-2 font-medium">{agent.model_provider}/{agent.model_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tools:</span>
                      <span className="ml-2 font-medium">{agent.tools?.join(', ') || 'Nenhuma'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Memória:</span>
                      <span className="ml-2 font-medium">{agent.memory_enabled ? 'Sim' : 'Não'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">RAG:</span>
                      <span className="ml-2 font-medium">{agent.rag_enabled ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Prompt de Teste</label>
            <textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              rows={4}
              placeholder="Digite aqui o prompt para testar o agente..."
            />
          </div>

          <button
            onClick={handleTestAgent}
            disabled={!selectedAgent || !testPrompt || isLoading}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Executando...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Executar Teste</span>
              </>
            )}
          </button>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-medium mb-3 flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <span>Resultado do Teste</span>
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-sm">
                {typeof testResult === 'string' ? testResult : JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Test History */}
        {testHistory.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-medium mb-3 flex items-center space-x-2">
              <History className="w-5 h-5 text-gray-600" />
              <span>Histórico de Testes</span>
            </h3>
            <div className="space-y-3">
              {testHistory.map(test => (
                <div key={test.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{test.agent}</p>
                      <p className="text-sm text-gray-600 mt-1">Prompt: {test.prompt}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {test.timestamp.toLocaleString()} - {test.duration}ms
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== ZONA 4: TESTE DE TIMES COM BACKLOG ====================
  const TeamTestZone: React.FC = () => {
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [testMessage, setTestMessage] = useState('');
    const [testContext, setTestContext] = useState('{}');
    const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionHistory, setExecutionHistory] = useState<any[]>([]);

    const handleExecuteTeam = async () => {
      if (!selectedTeam || !testMessage) return;

      setIsExecuting(true);
      setExecutionLogs([]);

      try {
        // Add initial log
        setExecutionLogs(prev => [...prev, {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'info',
          message: 'Iniciando execução do time...'
        }]);

        const context = JSON.parse(testContext || '{}');
        const result = await api.executeTeam(selectedTeam, testMessage, context);

        // Simulate execution logs
        const team = teams.find(t => t.id === selectedTeam);
        if (team) {
          team.agents.forEach((agent, index) => {
            setTimeout(() => {
              setExecutionLogs(prev => [...prev, {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                type: 'success',
                message: `Agente ${index + 1} processou com sucesso`,
                agent: agents.find(a => a.id === agent.agent_id)?.name,
                duration: Math.random() * 1000 + 500
              }]);
            }, (index + 1) * 1000);
          });
        }

        setExecutionHistory(prev => [{
          id: Date.now().toString(),
          team: teams.find(t => t.id === selectedTeam)?.name,
          message: testMessage,
          result,
          timestamp: new Date(),
        }, ...prev]);

        // Final log
        setExecutionLogs(prev => [...prev, {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'success',
          message: 'Execução concluída com sucesso!'
        }]);
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
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <Activity className="w-6 h-6 text-orange-600" />
          <h2 className="text-xl font-bold">Teste de Times com Backlog</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test Configuration */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h3 className="font-medium">Configuração do Teste</h3>

            <div>
              <label className="block text-sm font-medium mb-2">Selecionar Time</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
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
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Composição do Time</h4>
                {(() => {
                  const team = teams.find(t => t.id === selectedTeam);
                  return team ? (
                    <div className="space-y-1">
                      {team.agents.map((teamAgent, index) => {
                        const agent = agents.find(a => a.id === teamAgent.agent_id);
                        return agent ? (
                          <div key={teamAgent.agent_id} className="flex items-center space-x-2 text-sm">
                            <span className="w-5 h-5 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs">
                              {index + 1}
                            </span>
                            <span>{agent.name}</span>
                            <span className="text-gray-500">- {teamAgent.role_in_team}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Mensagem</label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                rows={3}
                placeholder="Digite a mensagem para o time processar..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Contexto (JSON)</label>
              <textarea
                value={testContext}
                onChange={(e) => setTestContext(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 font-mono text-sm"
                rows={3}
                placeholder='{"key": "value"}'
              />
            </div>

            <button
              onClick={handleExecuteTeam}
              disabled={!selectedTeam || !testMessage || isExecuting}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center space-x-2"
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

          {/* Execution Logs */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-medium mb-3 flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-gray-600" />
              <span>Logs de Execução</span>
            </h3>

            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
              {executionLogs.length === 0 ? (
                <div className="text-gray-500">Aguardando execução...</div>
              ) : (
                <div className="space-y-2">
                  {executionLogs.map(log => (
                    <div key={log.id} className="flex items-start space-x-2">
                      <span className="text-gray-500 text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`
                        ${log.type === 'error' ? 'text-red-400' : ''}
                        ${log.type === 'success' ? 'text-green-400' : ''}
                        ${log.type === 'warning' ? 'text-yellow-400' : ''}
                        ${log.type === 'info' ? 'text-blue-400' : ''}
                      `}>
                        [{log.type.toUpperCase()}]
                      </span>
                      <span>
                        {log.agent && <span className="text-purple-400">[{log.agent}]</span>}
                        {log.message}
                        {log.duration && <span className="text-gray-500"> ({log.duration.toFixed(0)}ms)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Execution History */}
        {executionHistory.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-medium mb-3 flex items-center space-x-2">
              <History className="w-5 h-5 text-gray-600" />
              <span>Histórico de Execuções</span>
            </h3>
            <div className="space-y-3">
              {executionHistory.map(execution => (
                <div key={execution.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{execution.team}</p>
                      <p className="text-sm text-gray-600 mt-1">Mensagem: {execution.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {execution.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <button className="text-blue-600 hover:text-blue-700">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'teams', label: 'Gerenciar Times', icon: Users, color: 'blue' },
              { id: 'agents', label: 'Criar Agentes', icon: Bot, color: 'purple' },
              { id: 'test-agent', label: 'Teste de Agente', icon: TestTube, color: 'green' },
              { id: 'test-team', label: 'Teste de Time', icon: Activity, color: 'orange' },
            ].map(zone => {
              const Icon = zone.icon;
              return (
                <button
                  key={zone.id}
                  onClick={() => setActiveZone(zone.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 transition-colors ${
                    activeZone === zone.id
                      ? `border-${zone.color}-600 text-${zone.color}-600`
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{zone.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 inline mr-2" />
            {error}
          </div>
        )}

        {!loading && (
          <>
            {activeZone === 'teams' && <TeamCreationZone />}
            {activeZone === 'agents' && <AgentCreationZone />}
            {activeZone === 'test-agent' && <AgentTestZone />}
            {activeZone === 'test-team' && <TeamTestZone />}
          </>
        )}
      </div>
    </div>
  );
};

export default TeamBuilder;
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Plus, Settings, Play, Bot, MessageSquare, Save, AlertCircle,
  CheckCircle, Loader, Search, Trash2, Edit, Copy, BarChart3, Clock,
  Target, Zap, Send, Eye, Filter, X, FileText, Database, Globe,
  Code, Brain, TestTube, Activity, ChevronRight, ArrowRight, Sparkles,
  RefreshCw, User, Shield, Layers, Minimize2, Maximize2
} from 'lucide-react';

// ==================== TYPES ====================
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

interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'team' | 'system';
  content: string;
  timestamp: Date;
  agentName?: string;
  teamName?: string;
  status: 'sending' | 'completed' | 'error';
  executionTime?: number;
}

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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `API Error: ${response.status} ${response.statusText}`
      );
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

  async updateTeam(id: number, data: any): Promise<Team> {
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

    return this.request(`/teams/${id}?user_id=1`, {
      method: 'PUT',
      body: JSON.stringify(teamData),
    });
  },

  async deleteTeam(id: number): Promise<void> {
    return this.request(`/teams/${id}?user_id=1`, {
      method: 'DELETE',
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

  async updateAgent(id: number, data: any): Promise<Agent> {
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

    return this.request(`/agents/${id}?user_id=1`, {
      method: 'PUT',
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
        prompt: prompt,
        stream: false
      }),
    });
  },

  async executeTeam(id: number, message: string): Promise<any> {
    return this.request(`/teams/${id}/execute?user_id=1`, {
      method: 'POST',
      body: JSON.stringify({
        message: message,
        context: {}
      }),
    });
  },
};

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

// ==================== CHAT INTERFACE ====================
const ChatInterface: React.FC<{
  type: 'agent' | 'team';
  agents: Agent[];
  teams: Team[];
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}> = ({ type, agents, teams, isMinimized = false, onToggleMinimize }) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString() + Math.random(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };

  const updateMessage = (id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedId || isLoading) return;

    const userMessage = addMessage({
      type: 'user',
      content: currentMessage,
      status: 'completed'
    });

    const selectedItem = type === 'agent'
      ? agents.find(a => a.id.toString() === selectedId)
      : teams.find(t => t.id.toString() === selectedId);

    const responseMessageId = addMessage({
      type: type,
      content: 'Processando...',
      status: 'sending',
      agentName: type === 'agent' ? selectedItem?.name : undefined,
      teamName: type === 'team' ? selectedItem?.name : undefined,
    });

    const currentMessageText = currentMessage;
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const startTime = Date.now();
      let result;

      if (type === 'agent') {
        result = await apiClient.testAgent(parseInt(selectedId), currentMessageText);
      } else {
        result = await apiClient.executeTeam(parseInt(selectedId), currentMessageText);
      }

      const executionTime = Date.now() - startTime;

      // ✅ CORREÇÃO: Melhor tratamento da resposta do team
      let responseContent = '';

      if (type === 'team') {
        // Para teams, verificar se tem a nova estrutura com responses
        if (result.responses && Array.isArray(result.responses)) {
          responseContent = result.responses
            .filter(agentResponse => agentResponse.response && agentResponse.response.trim() !== '')
            .map(agentResponse =>
              `**${agentResponse.agent}:**\n${agentResponse.response}`
            )
            .join('\n\n---\n\n');

          if (!responseContent) {
            responseContent = 'Nenhuma resposta foi gerada pelos agentes do time.';
          }
        } else if (Array.isArray(result)) {
          // Fallback para estrutura antiga
          responseContent = result
            .filter(agentResponse => agentResponse.response && agentResponse.response.trim() !== '')
            .map(agentResponse =>
              `**${agentResponse.agent}:**\n${agentResponse.response}`
            )
            .join('\n\n---\n\n');

          if (!responseContent) {
            responseContent = 'Nenhuma resposta foi gerada pelos agentes do time.';
          }
        } else if (result.response) {
          responseContent = result.response;
        } else {
          responseContent = JSON.stringify(result, null, 2);
        }
      } else {
        // Para agents individuais
        if (result.response) {
          responseContent = result.response;
        } else if (result.data?.response) {
          responseContent = result.data.response;
        } else if (result.message) {
          responseContent = result.message;
        } else {
          responseContent = JSON.stringify(result, null, 2);
        }
      }

      updateMessage(responseMessageId, {
        content: responseContent,
        status: 'completed',
        executionTime: executionTime
      });

    } catch (error: any) {
      updateMessage(responseMessageId, {
        content: `❌ Erro: ${error.message}`,
        status: 'error'
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-medium text-sm">
            Chat {type === 'agent' ? 'Agente' : 'Team'}
          </span>
          <button
            onClick={onToggleMinimize}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg shadow-lg h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {type === 'agent' ? (
            <Bot className="w-5 h-5 text-green-600" />
          ) : (
            <Users className="w-5 h-5 text-blue-600" />
          )}
          <h3 className="font-semibold">
            Chat com {type === 'agent' ? 'Agente' : 'Team'}
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Limpar chat"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Minimizar"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Selector */}
      <div className="p-4 border-b">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">
            Selecione um {type === 'agent' ? 'agente' : 'time'}...
          </option>
          {(type === 'agent' ? agents : teams).map(item => (
            <option key={item.id} value={item.id}>
              {item.name} - {type === 'agent' ? (item as Agent).role : `${(item as Team).agents?.length || 0} agentes`}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>Comece uma conversa!</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : ''}`}>
                {/* Message Header */}
                <div className={`flex items-center space-x-2 mb-1 ${
                  message.type === 'user' ? 'justify-end' : ''
                }`}>
                  {message.type === 'agent' && <Bot className="w-4 h-4 text-green-600" />}
                  {message.type === 'team' && <Users className="w-4 h-4 text-blue-600" />}
                  {message.type === 'user' && <User className="w-4 h-4 text-gray-600" />}
                  <span className="text-xs text-gray-500">
                    {message.type === 'user' ? 'Você' : message.agentName || message.teamName || 'Sistema'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>

                {/* Message Content */}
                <div className={`rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  {message.status === 'sending' ? (
                    <div className="flex items-center space-x-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                </div>

                {/* Message Footer */}
                {message.executionTime && message.status === 'completed' && (
                  <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{(message.executionTime / 1000).toFixed(2)}s</span>
                  </div>
                )}

                {message.status === 'error' && (
                  <div className="flex items-center space-x-2 mt-1 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>Erro no processamento</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex items-center space-x-3">
          <input
            ref={inputRef}
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={`Digite sua mensagem para ${selectedId ? (type === 'agent' ? 'o agente' : 'o time') : 'selecionar um ' + (type === 'agent' ? 'agente' : 'time')}...`}
            disabled={!selectedId || isLoading}
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={!currentMessage.trim() || !selectedId || isLoading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== AGENT CREATION/EDIT MODAL ====================
const AgentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onAgentSaved: () => void;
  agent?: Agent | null;
  isEdit?: boolean;
}> = ({ isOpen, onClose, onSuccess, onError, onAgentSaved, agent = null, isEdit = false }) => {
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

  // Populate form when editing
  useEffect(() => {
    if (isEdit && agent) {
      setFormData({
        name: agent.name,
        role: agent.role,
        description: agent.description || '',
        model_provider: agent.model_provider,
        model_id: agent.model_id,
        instructions: agent.instructions?.join('\n') || '',
        tools: agent.tools?.map(t => t.tool_id) || [],
        memory_enabled: agent.memory_enabled,
        rag_enabled: agent.rag_enabled,
      });
    } else {
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
  }, [isEdit, agent, isOpen]);

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
      if (isEdit && agent) {
        await apiClient.updateAgent(agent.id, formData);
        onSuccess('Agente atualizado com sucesso!');
      } else {
        await apiClient.createAgent(formData);
        onSuccess('Agente criado com sucesso!');
      }
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar Agente' : 'Criar Novo Agente'}
    >
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
                <span>{isEdit ? 'Atualizando...' : 'Salvando...'}</span>
              </>
            ) : (
              <span>{isEdit ? 'Atualizar Agente' : 'Criar Agente'}</span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ==================== TEAM CREATION/EDIT MODAL ====================
const TeamModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onTeamSaved: () => void;
  team?: Team | null;
  isEdit?: boolean;
}> = ({ isOpen, onClose, agents, onSuccess, onError, onTeamSaved, team = null, isEdit = false }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    team_type: 'collaborative' as const,
    agents: [] as Array<{ agent_id: string; role_in_team: string; priority: string }>,
    supervisor_agent_id: '',
    team_configuration: {},
  });
  const [saving, setSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (isEdit && team) {
      setFormData({
        name: team.name,
        description: team.description,
        team_type: team.team_type,
        agents: team.agents?.map(a => ({
          agent_id: a.agent_id.toString(),
          role_in_team: a.role_in_team,
          priority: a.priority.toString()
        })) || [],
        supervisor_agent_id: team.supervisor_agent_id?.toString() || '',
        team_configuration: team.team_configuration || {},
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
  }, [isEdit, team, isOpen]);

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
      if (isEdit && team) {
        await apiClient.updateTeam(team.id, formData);
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar Time' : 'Criar Novo Time'}
    >
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
                <span>{isEdit ? 'Atualizando...' : 'Salvando...'}</span>
              </>
            ) : (
              <span>{isEdit ? 'Atualizar Time' : 'Criar Time'}</span>
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
  const [activeTab, setActiveTab] = useState<'management' | 'chat-agent' | 'chat-team'>('management');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);

  // ✅ NOVOS ESTADOS PARA EDIÇÃO
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
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
  }, []);

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

  const handleDeleteAgent = useCallback(async (agentId: number) => {
    if (window.confirm('Tem certeza que deseja deletar este agente?')) {
      try {
        await apiClient.deleteAgent(agentId);
        setSuccess('Agente deletado com sucesso!');
        loadData();
      } catch (err: any) {
        setError(err.message);
      }
    }
  }, [loadData]);

  // ✅ FUNÇÕES PARA EDIÇÃO
  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setShowTeamModal(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setShowAgentModal(true);
  };

  const handleCloseTeamModal = () => {
    setShowTeamModal(false);
    setEditingTeam(null);
  };

  const handleCloseAgentModal = () => {
    setShowAgentModal(false);
    setEditingAgent(null);
  };

  const clearAlerts = () => {
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Layers className="w-8 h-8 text-indigo-600 mr-3" />
          Team Builder
        </h1>
        <p className="text-gray-600 mt-2">Gerencie agentes, times e converse com eles</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('management')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'management'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Gerenciamento</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('chat-agent')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'chat-agent'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4" />
              <span>Chat Agente</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('chat-team')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'chat-team'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Chat Team</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Alerts */}
      {(error || success) && (
        <div className="mb-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
              <button
                onClick={clearAlerts}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-700">{success}</span>
              </div>
              <button
                onClick={clearAlerts}
                className="text-green-600 hover:text-green-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {activeTab === 'management' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Teams Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Users className="w-6 h-6 text-blue-600 mr-2" />
                Times
              </h2>
              <button
                onClick={() => setShowTeamModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Time</span>
              </button>
            </div>

            <div className="space-y-3">
              {teams.map(team => (
                <div key={team.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{team.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{team.description}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {team.agents?.length || 0} agentes
                        </span>
                        <span className={`px-2 py-1 rounded-full ${
                          team.team_type === 'collaborative' ? 'bg-blue-100 text-blue-800' :
                          team.team_type === 'hierarchical' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {team.team_type}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* ✅ BOTÃO DE EDITAR */}
                      <button
                        onClick={() => handleEditTeam(team)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar time"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deletar time"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {teams.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>Nenhum time criado ainda</p>
                </div>
              )}
            </div>
          </div>

          {/* Agents Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Bot className="w-6 h-6 text-green-600 mr-2" />
                Agentes
              </h2>
              <button
                onClick={() => setShowAgentModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Agente</span>
              </button>
            </div>

            <div className="space-y-3">
              {agents.map(agent => (
                <div key={agent.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{agent.role}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>{agent.model_provider}/{agent.model_id}</span>
                        <span className="flex items-center">
                          <Brain className="w-3 h-3 mr-1" />
                          Mem: {agent.memory_enabled ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* ✅ BOTÃO DE EDITAR */}
                      <button
                        onClick={() => handleEditAgent(agent)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Editar agente"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deletar agente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {agents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>Nenhum agente criado ainda</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat-agent' && (
        <div className="h-[600px]">
          <ChatInterface
            type="agent"
            agents={agents}
            teams={teams}
            isMinimized={chatMinimized}
            onToggleMinimize={() => setChatMinimized(!chatMinimized)}
          />
        </div>
      )}

      {activeTab === 'chat-team' && (
        <div className="h-[600px]">
          <ChatInterface
            type="team"
            agents={agents}
            teams={teams}
            isMinimized={chatMinimized}
            onToggleMinimize={() => setChatMinimized(!chatMinimized)}
          />
        </div>
      )}

      {/* Modals */}
      <TeamModal
        isOpen={showTeamModal}
        onClose={handleCloseTeamModal}
        agents={agents}
        onSuccess={setSuccess}
        onError={setError}
        onTeamSaved={loadData}
        team={editingTeam}
        isEdit={!!editingTeam}
      />

      <AgentModal
        isOpen={showAgentModal}
        onClose={handleCloseAgentModal}
        onSuccess={setSuccess}
        onError={setError}
        onAgentSaved={loadData}
        agent={editingAgent}
        isEdit={!!editingAgent}
      />
    </div>
  );
};

export default TeamBuilder;
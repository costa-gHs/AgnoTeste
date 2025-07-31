import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Plus,
  Settings,
  MessageSquare,
  GitBranch,
  Activity,
  AlertCircle,
  CheckCircle,
  Loader,
  Send,
  User,
  Copy,
  Terminal,
  X,
  Wifi,
  WifiOff,
  RotateCcw,
  Download,
  Search,
  Edit,
  Eye,
  Save,
  Code,
  Globe,
  Database,
  FileText,
  Mail,
  Calendar
} from 'lucide-react';

// Cliente Agno CORRIGIDO
class AgnoClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
    this.userId = 1;
    this.eventListeners = new Map();
    this.debugMode = true;
  }

  log(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = {
      debug: '🔍',
      info: '📝',
      warn: '⚠️',
      error: '❌',
      success: '✅',
      stream: '🌊'
    }[level] || '📝';

    console.log(`${emoji} [${timestamp}] AgnoClient.${level.toUpperCase()}: ${message}`);
    if (data) console.log('📊 Data:', data);
    this.emit('log', { level, message, data, timestamp });
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  setLogCallback(callback) {
    if (!this.eventListeners.has('log')) {
      this.eventListeners.set('log', []);
    }
    this.eventListeners.get('log').push(callback);
  }

  removeLogCallback(callback) {
    if (this.eventListeners.has('log')) {
      const listeners = this.eventListeners.get('log');
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    try {
      this.log('info', `Fazendo requisição: ${options.method || 'GET'} ${url}`);

      const config = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        mode: 'cors',
        credentials: 'omit',
        ...options,
      };

      // Adicionar user_id como query parameter se não for POST com body
      const urlWithUser = new URL(url);
      if (!options.body) {
        urlWithUser.searchParams.append('user_id', this.userId);
      }

      const response = await fetch(urlWithUser.toString(), config);

      this.log('debug', `Resposta recebida: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          this.log('error', 'Erro na resposta:', errorData);
        } catch {
          errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      this.log('success', 'Requisição bem-sucedida');
      return data;

    } catch (error) {
      this.log('error', `Erro na requisição: ${error.message}`);
      throw error;
    }
  }

  async testConnection() {
    try {
      this.log('info', 'Testando conexão...');
      const response = await fetch(this.baseURL, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });

      if (response.ok) {
        const data = await response.json();
        this.log('success', 'Backend acessível:', data);
        return true;
      } else {
        this.log('warn', `Backend respondeu com erro: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.log('error', `Backend inacessível: ${error.message}`);
      return false;
    }
  }

  async listAgents() {
    this.log('info', 'Listando agentes...');
    return this.makeRequest('/api/agents');
  }

  async listWorkflows() {
    this.log('info', 'Listando workflows...');
    return this.makeRequest('/api/workflows');
  }

  async createAgent(agentData) {
    this.log('info', 'Criando agente:', agentData);

    if (!agentData.name || !agentData.role) {
      throw new Error('Nome e papel são obrigatórios');
    }

    // Garantir que instructions seja um array
    if (typeof agentData.instructions === 'string') {
      agentData.instructions = [agentData.instructions];
    }

    return this.makeRequest('/api/agents/create', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  async chatWithAgent(agentId, message, onChunk, onComplete, onError) {
    const url = `${this.baseURL}/api/agents/${agentId}/chat?user_id=${this.userId}`;

    try {
      this.log('stream', `Iniciando streaming para agente ${agentId}`);
      this.log('debug', `URL: ${url}`);
      this.log('debug', `Mensagem: ${message}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain, application/json',
          'Cache-Control': 'no-cache',
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify({ message: message.trim() })
      });

      this.log('stream', `Status do streaming: ${response.status}`);

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('Streaming não suportado - resposta sem body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;

      this.log('stream', 'Iniciando leitura do stream...');

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            this.log('stream', `Stream concluído após ${chunkCount} chunks`);
            break;
          }

          chunkCount++;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;

            if (line.startsWith('data: ')) {
              try {
                const jsonData = line.slice(6);
                const parsed = JSON.parse(jsonData);

                this.log('debug', `Chunk recebido:`, parsed);

                if (parsed.type === 'chunk' && parsed.content) {
                  onChunk(parsed.content);
                } else if (parsed.type === 'complete') {
                  this.log('success', 'Stream marcado como completo');
                  onComplete(parsed);
                  return;
                } else if (parsed.type === 'error') {
                  this.log('error', `Erro no stream: ${parsed.message}`);
                  onError(new Error(parsed.message));
                  return;
                }
              } catch (parseError) {
                this.log('warn', `Erro ao parsear chunk JSON: ${parseError.message}`);
                const content = line.startsWith('data: ') ? line.slice(6) : line;
                if (content.trim() && !content.includes('{')) {
                  onChunk(content);
                }
              }
            } else if (line.trim() && !line.startsWith(':')) {
              onChunk(line + '\n');
            }
          }
        }

        if (chunkCount > 0) {
          this.log('success', 'Stream finalizado implicitamente');
          onComplete({ session_id: `session_${Date.now()}`, total_chunks: chunkCount });
        } else {
          this.log('warn', 'Stream finalizado sem chunks recebidos');
          onError(new Error('Stream finalizado sem receber dados'));
        }

      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      this.log('error', `Erro no streaming: ${error.message}`);
      onError(error);
    }
  }
}

const AgnoManagementInterface = () => {
  // Estados principais
  const [activeTab, setActiveTab] = useState('agents');
  const [agents, setAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  // Estados do chat - SIMPLIFICADOS
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Estados de sistema
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateAgent, setShowCreateAgent] = useState(false);

  // Cliente Agno
  const [agnoClient] = useState(() => new AgnoClient());

  // Refs
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollLogsToBottom = useCallback(() => {
    if (showLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showLogs]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    scrollLogsToBottom();
  }, [logs, scrollLogsToBottom]);

  // Adicionar log
  const addLog = useCallback((type, message, data = null) => {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      data
    };
    setLogs(prev => [...prev.slice(-99), logEntry]);
  }, []);

  // Setup do cliente
  useEffect(() => {
    const handleClientLog = (logData) => {
      addLog(logData.level, logData.message, logData.data);
    };

    agnoClient.setLogCallback(handleClientLog);

    const checkInitialConnection = async () => {
      try {
        setConnectionStatus('connecting');
        const connected = await agnoClient.testConnection();
        setConnectionStatus(connected ? 'connected' : 'disconnected');

        if (connected) {
          await loadInitialData();
        }
      } catch (error) {
        setConnectionStatus('error');
        addLog('error', `Erro de conexão: ${error.message}`);
      }
    };

    checkInitialConnection();

    return () => {
      agnoClient.removeLogCallback(handleClientLog);
    };
  }, [agnoClient, addLog]);

  // Carregar dados iniciais
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      addLog('info', 'Carregando dados iniciais...');

      const [agentsList, workflowsList] = await Promise.all([
        agnoClient.listAgents(),
        agnoClient.listWorkflows()
      ]);

      setAgents(agentsList || []);
      setWorkflows(workflowsList || []);
      addLog('success', `Carregados ${agentsList?.length || 0} agentes e ${workflowsList?.length || 0} workflows`);
    } catch (error) {
      const errorMsg = `Erro ao carregar dados: ${error.message}`;
      setError(errorMsg);
      addLog('error', errorMsg);
    } finally {
      setLoading(false);
    }
  }, [agnoClient, addLog]);

  // FUNÇÃO DE ENVIAR MENSAGEM CORRIGIDA
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isStreaming || (!selectedAgent && !selectedWorkflow)) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setError(null);
    setIsStreaming(true);

    // Adicionar mensagem do usuário
    const newUserMessage = {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, newUserMessage]);
    addLog('info', `Enviando mensagem: "${userMessage.substring(0, 50)}..."`);

    // Preparar mensagem do agente
    const agentMessageId = Date.now() + 1;
    const agentMessage = {
      id: agentMessageId,
      type: 'agent',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
      agentName: selectedAgent?.name || selectedWorkflow?.name,
      isStreaming: true
    };
    setMessages(prev => [...prev, agentMessage]);

    try {
      if (selectedAgent) {
        await agnoClient.chatWithAgent(
          selectedAgent.id,
          userMessage,
          // onChunk - CORRIGIDO: Atualizar mensagem diretamente
          (chunk) => {
            setMessages(prev => prev.map(msg =>
              msg.id === agentMessageId
                ? { ...msg, content: msg.content + chunk }
                : msg
            ));
          },
          // onComplete - CORRIGIDO: Apenas marcar como finalizado
          (data) => {
            setMessages(prev => prev.map(msg =>
              msg.id === agentMessageId
                ? { ...msg, isStreaming: false }
                : msg
            ));
            setIsStreaming(false);
            setSessionId(data.session_id);
            addLog('success', `Chat concluído. Session: ${data.session_id}`);
          },
          // onError
          (error) => {
            setError(error.message);
            setIsStreaming(false);
            setMessages(prev => prev.filter(msg => msg.id !== agentMessageId));
            addLog('error', `Erro no chat: ${error.message}`);
          }
        );
      } else if (selectedWorkflow) {
        throw new Error('Chat com workflows ainda não implementado');
      }

    } catch (error) {
      setError(error.message);
      setIsStreaming(false);
      setMessages(prev => prev.filter(msg => msg.id !== agentMessageId));
      addLog('error', `Erro de conexão: ${error.message}`);
    }
  }, [inputMessage, isStreaming, selectedAgent, selectedWorkflow, agnoClient, addLog]);

  // Criar agente
  const handleCreateAgent = useCallback(async (agentData) => {
    try {
      setLoading(true);
      addLog('info', 'Criando novo agente...', agentData);

      const result = await agnoClient.createAgent(agentData);
      addLog('success', `Agente criado: ${result.agent_id}`);

      await loadInitialData();
      setShowCreateAgent(false);
    } catch (error) {
      const errorMsg = `Erro ao criar agente: ${error.message}`;
      setError(errorMsg);
      addLog('error', errorMsg);
    } finally {
      setLoading(false);
    }
  }, [agnoClient, addLog, loadInitialData]);

  // Funções auxiliares
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const copyMessage = useCallback((content) => {
    navigator.clipboard.writeText(content);
    addLog('info', 'Mensagem copiada para a área de transferência');
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('info', 'Logs limpos');
  }, [addLog]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    addLog('info', 'Chat limpo');
  }, [addLog]);

  const exportChat = useCallback(() => {
    const chatData = {
      agent: selectedAgent?.name || selectedWorkflow?.name,
      sessionId,
      timestamp: new Date().toISOString(),
      messages: messages.map(msg => ({
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${sessionId || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addLog('success', 'Chat exportado com sucesso');
  }, [messages, selectedAgent, selectedWorkflow, sessionId, addLog]);

  // Filtrar agentes/workflows
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredWorkflows = workflows.filter(workflow =>
    workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workflow.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Renderizar ícones e status
  const renderLogIcon = (type) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'stream': return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'warn': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'debug': return <Terminal className="w-4 h-4 text-purple-500" />;
      default: return <Terminal className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderConnectionStatus = () => {
    const statusConfig = {
      connecting: { icon: Loader, color: 'text-yellow-500', text: 'Conectando...', spin: true },
      connected: { icon: Wifi, color: 'text-green-500', text: 'Conectado', spin: false },
      disconnected: { icon: WifiOff, color: 'text-red-500', text: 'Desconectado', spin: false },
      error: { icon: AlertCircle, color: 'text-red-500', text: 'Erro de Conexão', spin: false }
    };

    const config = statusConfig[connectionStatus];
    const IconComponent = config.icon;

    return (
      <div className={`flex items-center gap-2 ${config.color}`}>
        <IconComponent className={`w-4 h-4 ${config.spin ? 'animate-spin' : ''}`} />
        <span className="text-sm font-medium">{config.text}</span>
      </div>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Formulário de criação de agente SIMPLIFICADO
  const CreateAgentForm = () => {
    const [formData, setFormData] = useState({
      name: '',
      role: '',
      model_provider: 'openai',
      model_id: 'gpt-4o-mini',
      instructions: '',
      tools: [],
      memory_enabled: true,
      rag_enabled: false
    });

    const handleSubmit = async () => {
      if (!formData.name || !formData.role) {
        setError('Nome e papel são obrigatórios');
        return;
      }

      await handleCreateAgent({
        ...formData,
        instructions: formData.instructions.split('\n').filter(line => line.trim())
      });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-500" />
            Criar Novo Agente
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                placeholder="Ex: Assistente de Vendas"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Papel/Função *</label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                placeholder="Ex: Especialista em vendas e atendimento"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={formData.model_provider}
                  onChange={(e) => setFormData(prev => ({ ...prev, model_provider: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                <select
                  value={formData.model_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, model_id: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {formData.model_provider === 'openai' ? (
                    <>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    </>
                  ) : (
                    <>
                      <option value="claude-3-haiku">Claude 3 Haiku</option>
                      <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                      <option value="claude-3-opus">Claude 3 Opus</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instruções (uma por linha)</label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                rows={4}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Você é um assistente útil especializado em..."
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.memory_enabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, memory_enabled: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Memória</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.rag_enabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, rag_enabled: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">RAG</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateAgent(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Criar Agente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Agno Platform</h1>
            {renderConnectionStatus()}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar agentes ou workflows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'agents'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Bot className="w-4 h-4 inline mr-2" />
              Agentes
            </button>
            <button
              onClick={() => setActiveTab('workflows')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'workflows'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <GitBranch className="w-4 h-4 inline mr-2" />
              Workflows
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'agents' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  Agentes ({filteredAgents.length})
                </h2>
                <button
                  onClick={() => setShowCreateAgent(true)}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  title="Criar novo agente"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>
                    {searchTerm ? 'Nenhum agente encontrado' : 'Nenhum agente disponível'}
                  </p>
                  <p className="text-sm">
                    {searchTerm ? 'Tente outro termo de busca' : 'Crie seu primeiro agente'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAgents.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        selectedAgent?.id === agent.id
                          ? 'border-blue-300 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900">{agent.name}</h3>
                            <span className={`w-2 h-2 rounded-full ${
                              agent.status === 'active' ? 'bg-green-400' : 'bg-gray-400'
                            }`} />
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{agent.role}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              {agent.modelProvider}
                            </span>
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              {agent.modelId}
                            </span>
                          </div>
                          {agent.tools && agent.tools.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {agent.tools.slice(0, 3).map((tool, index) => (
                                <span
                                  key={index}
                                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                                >
                                  {tool}
                                </span>
                              ))}
                              {agent.tools.length > 3 && (
                                <span className="text-xs text-gray-500">
                                  +{agent.tools.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            Última utilização: {formatDate(agent.lastUsed)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'workflows' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  Workflows ({filteredWorkflows.length})
                </h2>
                <button className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {filteredWorkflows.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <GitBranch className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>
                    {searchTerm ? 'Nenhum workflow encontrado' : 'Nenhum workflow disponível'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredWorkflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      onClick={() => setSelectedWorkflow(workflow)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        selectedWorkflow?.id === workflow.id
                          ? 'border-blue-300 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900">{workflow.name}</h3>
                            <span className={`w-2 h-2 rounded-full ${
                              workflow.status === 'active' ? 'bg-green-400' : 'bg-gray-400'
                            }`} />
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{workflow.description}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              {workflow.agentCount} agentes
                            </span>
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              {workflow.flowType}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            Última utilização: {formatDate(workflow.lastUsed)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedAgent || selectedWorkflow ? (
                  <>
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      {selectedAgent ? <Bot className="w-6 h-6 text-white" /> : <GitBranch className="w-6 h-6 text-white" />}
                    </div>
                    <div>
                      <h1 className="text-lg font-semibold text-gray-900">
                        {selectedAgent?.name || selectedWorkflow?.name}
                      </h1>
                      <p className="text-sm text-gray-500">
                        {selectedAgent && `${selectedAgent.modelId} • ${selectedAgent.modelProvider}`}
                        {selectedWorkflow && `${selectedWorkflow.agentCount} agentes • ${selectedWorkflow.flowType}`}
                        {sessionId && ` • Session: ${sessionId.slice(-8)}`}
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">Selecione um Agente ou Workflow</h1>
                    <p className="text-sm text-gray-500">Escolha na sidebar para iniciar o chat</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(selectedAgent || selectedWorkflow) && messages.length > 0 && (
                  <>
                    <button
                      onClick={exportChat}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Exportar chat"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={clearChat}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Limpar chat"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showLogs 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  Logs ({logs.length})
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mt-4 rounded-r-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                  <p className="text-red-700">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!selectedAgent && !selectedWorkflow ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Bem-vindo ao Agno Chat</h2>
                <p className="text-center max-w-md">
                  Selecione um agente ou workflow na sidebar para iniciar uma conversa.
                  O sistema suporta streaming em tempo real e logs detalhados.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Inicie uma Conversa</h2>
                <p className="text-center max-w-md">
                  Digite sua mensagem abaixo para começar a interagir com {selectedAgent?.name || selectedWorkflow?.name}.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'user' 
                      ? 'bg-blue-500' 
                      : 'bg-gray-600'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Message */}
                  <div className={`flex-1 max-w-[80%] ${message.type === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block p-3 rounded-lg shadow-sm ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-800 border border-gray-200'
                    }`}>
                      <div className="whitespace-pre-wrap break-words">
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-5 bg-gray-400 ml-1 animate-pulse" />
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${
                      message.type === 'user' ? 'justify-end' : ''
                    }`}>
                      <span>{message.timestamp}</span>
                      {message.agentName && <span>• {message.agentName}</span>}
                      {message.content && (
                        <button
                          onClick={() => copyMessage(message.content)}
                          className="hover:text-gray-700 transition-colors"
                          title="Copiar mensagem"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {(selectedAgent || selectedWorkflow) && (
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={1}
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                    disabled={isStreaming}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isStreaming}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {isStreaming ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logs Panel */}
        {showLogs && (
          <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
            {/* Logs Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Logs de Execução
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearLogs}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Limpar
                </button>
                <button
                  onClick={() => setShowLogs(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {logs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum log ainda</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 bg-gray-50 rounded-lg text-xs border border-gray-100"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {renderLogIcon(log.type)}
                      <span className="font-medium text-gray-600">{log.timestamp}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        log.type === 'error' ? 'bg-red-100 text-red-700' :
                        log.type === 'success' ? 'bg-green-100 text-green-700' :
                        log.type === 'stream' ? 'bg-blue-100 text-blue-700' :
                        log.type === 'warn' ? 'bg-yellow-100 text-yellow-700' :
                        log.type === 'debug' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {log.type}
                      </span>
                    </div>
                    <div className="text-gray-700 ml-6">
                      {log.message}
                      {log.data && (
                        <pre className="mt-1 text-xs bg-gray-100 p-1 rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Create Agent Modal */}
      {showCreateAgent && <CreateAgentForm />}
    </div>
  );
};

export default AgnoManagementInterface;
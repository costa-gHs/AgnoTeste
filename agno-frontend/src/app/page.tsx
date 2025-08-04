// agno-frontend/src/app/test/page.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, Plus, Settings, MessageSquare, Activity, AlertCircle,
  CheckCircle, Loader, Send, User, Terminal, X, Wifi, WifiOff,
  RotateCcw, Download, Search, Edit, Eye, Save, Code, Globe, Database,
  FileText, Calendar, Clock, Zap, TrendingUp, PlayCircle, PauseCircle,
  RefreshCw, Filter, Cpu, Layers, Package, Link2, Hash, Command,
  BarChart3, Brain, Mail, Calculator, Image, Music, Video, ShoppingCart,
  CreditCard, Smartphone, Lock, Shield, MapPin, ChevronDown, ChevronUp,
  Copy, Trash2, Monitor, Server, HardDrive, Headphones
} from 'lucide-react';

// =============================================
// AGNO CLIENT - INTEGRAÇÃO REAL COM BACKEND
// =============================================
class AgnoTestClient {
  constructor(baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', userId = 1) {
    this.baseURL = baseURL;
    this.userId = userId;
    this.debugMode = true;
  }

  log(level: string, message: string, data?: any) {
    if (this.debugMode) {
      console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    }
  }

  async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    this.log('info', `🚀 Fazendo requisição: ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      mode: 'cors',
      credentials: 'omit',
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.log('error', `❌ Erro HTTP ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    this.log('success', '✅ Resposta recebida:', data);
    return data;
  }

  async testConnection() {
    try {
      this.log('info', '🔄 Testando conexão com backend...');
      const data = await this.makeRequest('/api/health');
      this.log('success', '✅ Backend conectado!');
      return { success: true, data };
    } catch (error) {
      this.log('error', '❌ Falha na conexão:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async listAgents() {
    this.log('info', '📋 Buscando lista de agentes...');
    return this.makeRequest(`/api/agents?user_id=${this.userId}`);
  }

  async createAgent(agentData: any) {
    this.log('info', '🤖 Criando novo agente...', agentData);
    return this.makeRequest(`/api/agents/create?user_id=${this.userId}`, {
      method: 'POST',
      body: JSON.stringify(agentData)
    });
  }

  async getAgnoTools() {
    this.log('info', '🔧 Buscando ferramentas do Agno...');
    return this.makeRequest('/api/agno/tools');
  }

  async getAgnoHealth() {
    this.log('info', '🏥 Verificando saúde do Agno...');
    return this.makeRequest('/api/agno/health');
  }

  async executeDemoTest() {
    this.log('info', '🧪 Executando teste de demonstração...');
    return this.makeRequest(`/api/demo/agno-real-test?user_id=${this.userId}`, {
      method: 'POST'
    });
  }

  async chatWithAgent(agentId: number, message: string) {
    this.log('info', `💬 Iniciando chat com agente ${agentId}...`);
    return fetch(`${this.baseURL}/api/agents/${agentId}/chat?user_id=${this.userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({ prompt: message })
    });
  }

  async listWorkflows() {
    this.log('info', '🔄 Buscando workflows...');
    return this.makeRequest(`/api/workflows?user_id=${this.userId}`);
  }

  async getSystemMetrics() {
    this.log('info', '📊 Buscando métricas do sistema...');
    return this.makeRequest('/api/metrics');
  }
}

// =============================================
// TIPOS TYPESCRIPT
// =============================================
interface Agent {
  id: number;
  name: string;
  role: string;
  model_provider: string;
  model_id: string;
  tools: string[];
  memory_enabled: boolean;
  rag_enabled: boolean;
  created_at: string;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  requires_api_key?: boolean;
}

interface ChatMessage {
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
  streaming?: boolean;
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  data?: any;
}

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
const AgnoTestingPage = () => {
  // Estados principais
  const [activeTab, setActiveTab] = useState('overview');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Estados de dados
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [agnoHealth, setAgnoHealth] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>({});

  // Estados de interface
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Estados de formulário
  const [newAgent, setNewAgent] = useState({
    name: '',
    role: 'Assistente Inteligente',
    model_provider: 'openai',
    model_id: 'gpt-4o-mini',
    instructions: ['Você é um assistente útil e inteligente.'],
    tools: [] as string[],
    memory_enabled: true,
    rag_enabled: false
  });

  // Refs
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const client = useRef(new AgnoTestClient());

  // =============================================
  // FUNÇÕES UTILITÁRIAS
  // =============================================
  const addLog = useCallback((level: LogEntry['level'], message: string, data?: any) => {
    const log: LogEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      level,
      message,
      data
    };
    setLogs(prev => [...prev.slice(-99), log]);
  }, []);

  // Auto-scroll dos logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Auto-scroll do chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Carregar dados iniciais
  useEffect(() => {
    testConnection();
    loadInitialData();
  }, []);

  // =============================================
  // FUNÇÕES DE API
  // =============================================
  const testConnection = async () => {
    setConnectionStatus('connecting');
    addLog('info', '🔄 Testando conexão com backend...');

    const result = await client.current.testConnection();

    if (result.success) {
      setConnectionStatus('connected');
      addLog('success', '✅ Conectado ao backend');
      setSystemInfo(result.data);
      setError(null);
    } else {
      setConnectionStatus('disconnected');
      addLog('error', '❌ Falha na conexão: ' + result.error);
      setError(result.error || 'Erro desconhecido');
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      addLog('info', '📋 Carregando dados iniciais...');

      const [agentsData, toolsData, healthData] = await Promise.allSettled([
        client.current.listAgents(),
        client.current.getAgnoTools(),
        client.current.getAgnoHealth()
      ]);

      // Processar agentes
      if (agentsData.status === 'fulfilled') {
        setAgents(agentsData.value);
        addLog('success', `✅ ${agentsData.value.length} agentes carregados`);
      } else {
        addLog('error', '❌ Erro ao carregar agentes: ' + agentsData.reason);
      }

      // Processar ferramentas
      if (toolsData.status === 'fulfilled') {
        const toolsList = toolsData.value.tools || [];
        setTools(toolsList);
        addLog('success', `✅ ${toolsList.length} ferramentas carregadas`);
      } else {
        addLog('error', '❌ Erro ao carregar ferramentas: ' + toolsData.reason);
      }

      // Processar saúde do Agno
      if (healthData.status === 'fulfilled') {
        setAgnoHealth(healthData.value);
        addLog('success', '✅ Status do Agno carregado');
      } else {
        addLog('warning', '⚠️ Agno pode não estar disponível: ' + healthData.reason);
      }

    } catch (error) {
      addLog('error', '❌ Erro geral ao carregar dados: ' + (error as Error).message);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createTestAgent = async () => {
    if (!newAgent.name.trim()) {
      addLog('warning', '⚠️ Nome do agente é obrigatório');
      return;
    }

    try {
      setLoading(true);
      addLog('info', '🤖 Criando agente de teste...');

      const result = await client.current.createAgent(newAgent);

      addLog('success', '✅ Agente criado com sucesso!');
      setAgents(prev => [...prev, result]);

      // Resetar formulário
      setNewAgent({
        name: '',
        role: 'Assistente Inteligente',
        model_provider: 'openai',
        model_id: 'gpt-4o-mini',
        instructions: ['Você é um assistente útil e inteligente.'],
        tools: [],
        memory_enabled: true,
        rag_enabled: false
      });
    } catch (error) {
      addLog('error', '❌ Erro ao criar agente: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const executeDemoTest = async () => {
    try {
      setLoading(true);
      addLog('info', '🧪 Executando teste de demonstração do Agno...');

      const result = await client.current.executeDemoTest();

      addLog('success', '✅ Teste executado com sucesso!', result);
      setMetrics(result);
    } catch (error) {
      addLog('error', '❌ Erro no teste: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async () => {
    if (!selectedAgent || !chatMessage.trim()) return;

    try {
      setIsStreaming(true);
      const userMessage = chatMessage.trim();
      setChatMessage('');

      // Adicionar mensagem do usuário ao histórico
      setChatHistory(prev => [...prev, {
        type: 'user',
        content: userMessage,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      }]);

      addLog('info', `💬 Enviando mensagem para agente ${selectedAgent.name}`);

      const response = await client.current.chatWithAgent(selectedAgent.id, userMessage);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Não foi possível obter o reader da resposta');
      }

      const decoder = new TextDecoder();
      let assistantMessage = '';

      // Adicionar mensagem inicial do assistente
      setChatHistory(prev => [...prev, {
        type: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        streaming: true
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              const data = JSON.parse(jsonStr);

              if (data.type === 'chunk' && data.content) {
                assistantMessage += data.content;

                // Atualizar última mensagem do assistente
                setChatHistory(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.type === 'assistant') {
                    lastMsg.content = assistantMessage;
                  }
                  return updated;
                });
              }

              if (data.type === 'done' || data.type === 'complete') {
                // Finalizar streaming
                setChatHistory(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.type === 'assistant') {
                    lastMsg.streaming = false;
                  }
                  return updated;
                });
                break;
              }

              if (data.type === 'error') {
                throw new Error(data.message || 'Erro no streaming');
              }
            } catch (e) {
              // Ignorar erros de parsing JSON menores
              console.warn('Erro ao fazer parse do chunk JSON:', e);
            }
          }
        }
      }

      addLog('success', '✅ Chat concluído com sucesso');
    } catch (error) {
      addLog('error', '❌ Erro no chat: ' + (error as Error).message);
      setChatHistory(prev => [...prev, {
        type: 'error',
        content: 'Erro ao processar mensagem: ' + (error as Error).message,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  // =============================================
  // COMPONENTES DE INTERFACE
  // =============================================
  const ConnectionIndicator = () => (
    <div className="flex items-center gap-2">
      {connectionStatus === 'connected' && (
        <>
          <Wifi className="w-4 h-4 text-green-500" />
          <span className="text-green-600 text-sm font-medium">Conectado</span>
        </>
      )}
      {connectionStatus === 'connecting' && (
        <>
          <Loader className="w-4 h-4 text-yellow-500 animate-spin" />
          <span className="text-yellow-600 text-sm font-medium">Conectando...</span>
        </>
      )}
      {connectionStatus === 'disconnected' && (
        <>
          <WifiOff className="w-4 h-4 text-red-500" />
          <span className="text-red-600 text-sm font-medium">Desconectado</span>
        </>
      )}
    </div>
  );

  const LogsViewer = () => (
    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs h-64 overflow-y-auto">
      {logs.map(log => (
        <div key={log.id} className="mb-1 flex gap-2">
          <span className="text-gray-500 flex-shrink-0">{log.timestamp}</span>
          <span className={`flex-1 ${
            log.level === 'success' ? 'text-green-400' :
            log.level === 'error' ? 'text-red-400' :
            log.level === 'warning' ? 'text-yellow-400' :
            'text-blue-400'
          }`}>
            {log.message}
          </span>
          {log.data && (
            <span className="text-gray-400 text-xs">
              {typeof log.data === 'object' ? JSON.stringify(log.data, null, 1) : log.data}
            </span>
          )}
        </div>
      ))}
      <div ref={logsEndRef} />
    </div>
  );

  const ToolsGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tools.map((tool, index) => (
        <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              {tool.category === 'web_search' && <Globe className="w-4 h-4 text-blue-600" />}
              {tool.category === 'financial' && <TrendingUp className="w-4 h-4 text-green-600" />}
              {tool.category === 'reasoning' && <Brain className="w-4 h-4 text-purple-600" />}
              {tool.category === 'communication' && <Mail className="w-4 h-4 text-orange-600" />}
              {tool.category === 'utilities' && <Calculator className="w-4 h-4 text-gray-600" />}
              {!['web_search', 'financial', 'reasoning', 'communication', 'utilities'].includes(tool.category) && (
                <Package className="w-4 h-4 text-indigo-600" />
              )}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{tool.name || tool.id}</h4>
              <p className="text-xs text-gray-500">{tool.category}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-3">{tool.description || 'Sem descrição'}</p>
          <div className="flex items-center justify-between">
            <span className={`px-2 py-1 rounded-full text-xs ${
              tool.available 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {tool.available ? '✅ Disponível' : '❌ Indisponível'}
            </span>
            {tool.requires_api_key && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                🔑 API Key
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const ChatInterface = () => (
    <div className="flex flex-col h-96">
      {/* Seleção de agente */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecionar Agente:
        </label>
        <select
          value={selectedAgent?.id || ''}
          onChange={(e) => setSelectedAgent(agents.find(a => a.id == parseInt(e.target.value)) || null)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Selecione um agente...</option>
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.name} ({agent.model_provider}/{agent.model_id})
            </option>
          ))}
        </select>
      </div>

      {/* Histórico do chat */}
      <div className="flex-1 border border-gray-300 rounded-lg p-4 overflow-y-auto bg-gray-50">
        {chatHistory.length === 0 ? (
          <p className="text-gray-500 text-center">Inicie uma conversa selecionando um agente e enviando uma mensagem</p>
        ) : (
          chatHistory.map((msg, index) => (
            <div key={index} className={`mb-4 ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.type === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : msg.type === 'error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-white text-gray-800 border'
              }`}>
                {msg.streaming && <Loader className="w-3 h-3 animate-spin inline mr-2" />}
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{msg.timestamp}</div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input de mensagem */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isStreaming && startChat()}
          placeholder="Digite sua mensagem..."
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={!selectedAgent || isStreaming}
        />
        <button
          onClick={startChat}
          disabled={!selectedAgent || !chatMessage.trim() || isStreaming}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {isStreaming ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar
        </button>
      </div>
    </div>
  );

  // =============================================
  // RENDER PRINCIPAL
  // =============================================
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <Bot className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Agno Platform - Página de Testes
                </h1>
                <p className="text-sm text-gray-500">
                  Interface completa para testar todas as funcionalidades do backend
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ConnectionIndicator />
              <button
                onClick={testConnection}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Reconectar"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Visão Geral', icon: BarChart3 },
              { id: 'agents', name: 'Agentes', icon: Bot },
              { id: 'tools', name: 'Ferramentas', icon: Package },
              { id: 'chat', name: 'Chat Teste', icon: MessageSquare },
              { id: 'create', name: 'Criar Agente', icon: Plus },
              { id: 'logs', name: 'Logs Sistema', icon: Terminal }
            ].map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800 font-medium">Erro do Sistema</span>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <Bot className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
                    <p className="text-sm text-gray-500">Agentes Ativos</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{tools.filter(t => t.available).length}</p>
                    <p className="text-sm text-gray-500">Ferramentas Disponíveis</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <Activity className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {connectionStatus === 'connected' ? 'Online' : 'Offline'}
                    </p>
                    <p className="text-sm text-gray-500">Status do Sistema</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {systemInfo?.version || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500">Versão da API</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Sistema Agno</h3>
                {agnoHealth ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Framework: {agnoHealth.framework || 'Disponível'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Status: {agnoHealth.status || 'Ativo'}</span>
                    </div>
                    {agnoHealth.agno_available === false && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-yellow-700">Framework não instalado</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm">Agno não disponível</span>
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Ações Rápidas</h3>
                <div className="space-y-2">
                  <button
                    onClick={loadInitialData}
                    disabled={loading}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
                  >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Recarregar Dados
                  </button>
                  <button
                    onClick={executeDemoTest}
                    disabled={loading || connectionStatus !== 'connected'}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors"
                  >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                    Executar Teste Demo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Agentes Disponíveis ({agents.length})
              </h3>
              {agents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nenhum agente encontrado. Crie um agente na aba "Criar Agente".
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agents.map(agent => (
                    <div key={agent.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <Bot className="w-6 h-6 text-blue-600" />
                        <div>
                          <h4 className="font-medium text-gray-900">{agent.name}</h4>
                          <p className="text-sm text-gray-500">{agent.role}</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>Modelo: {agent.model_provider}/{agent.model_id}</p>
                        <p>Ferramentas: {Array.isArray(agent.tools) ? agent.tools.length : 0}</p>
                        <p>Memória: {agent.memory_enabled ? '✅' : '❌'}</p>
                        <p>RAG: {agent.rag_enabled ? '✅' : '❌'}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedAgent(agent);
                          setActiveTab('chat');
                        }}
                        className="mt-3 w-full px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                      >
                        Conversar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Ferramentas do Agno ({tools.length})
              </h3>
              {tools.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nenhuma ferramenta encontrada. Verifique se o Agno está instalado e funcionando.
                </p>
              ) : (
                <ToolsGrid />
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Interface de Chat
              </h3>
              <ChatInterface />
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Criar Novo Agente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Agente *
                    </label>
                    <input
                      type="text"
                      value={newAgent.name}
                      onChange={(e) => setNewAgent(prev => ({...prev, name: e.target.value}))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: Assistente de Pesquisa"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Função/Role
                    </label>
                    <input
                      type="text"
                      value={newAgent.role}
                      onChange={(e) => setNewAgent(prev => ({...prev, role: e.target.value}))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: Especialista em análise de dados"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provedor do Modelo
                    </label>
                    <select
                      value={newAgent.model_provider}
                      onChange={(e) => setNewAgent(prev => ({...prev, model_provider: e.target.value}))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Modelo
                    </label>
                    <select
                      value={newAgent.model_id}
                      onChange={(e) => setNewAgent(prev => ({...prev, model_id: e.target.value}))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {newAgent.model_provider === 'openai' ? (
                        <>
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4o-mini">GPT-4o Mini</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        </>
                      ) : (
                        <>
                          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                          <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ferramentas Disponíveis
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                      {tools.filter(t => t.available).length === 0 ? (
                        <p className="text-gray-500 text-sm">Nenhuma ferramenta disponível</p>
                      ) : (
                        tools.filter(t => t.available).map((tool, index) => (
                          <label key={index} className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={newAgent.tools.includes(tool.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewAgent(prev => ({
                                    ...prev,
                                    tools: [...prev.tools, tool.id]
                                  }));
                                } else {
                                  setNewAgent(prev => ({
                                    ...prev,
                                    tools: prev.tools.filter(t => t !== tool.id)
                                  }));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{tool.name || tool.id}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newAgent.memory_enabled}
                        onChange={(e) => setNewAgent(prev => ({...prev, memory_enabled: e.target.checked}))}
                        className="rounded"
                      />
                      <span className="text-sm">Habilitar Memória</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newAgent.rag_enabled}
                        onChange={(e) => setNewAgent(prev => ({...prev, rag_enabled: e.target.checked}))}
                        className="rounded"
                      />
                      <span className="text-sm">Habilitar RAG</span>
                    </label>
                  </div>

                  <button
                    onClick={createTestAgent}
                    disabled={!newAgent.name.trim() || loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
                  >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Criar Agente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Logs do Sistema ({logs.length})
                </h3>
                <button
                  onClick={() => setLogs([])}
                  className="flex items-center gap-2 px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpar
                </button>
              </div>
              <LogsViewer />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AgnoTestingPage;
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bot, Plus, Settings, MessageSquare, GitBranch, Activity, AlertCircle,
  CheckCircle, Loader, Send, User, Copy, Terminal, X, Wifi, WifiOff,
  RotateCcw, Download, Search, Edit, Eye, Save, Code, Globe, Database,
  FileText, Mail, Calendar, Clock, Zap, TrendingUp, ChevronDown, ChevronUp,
  Trash2, PlayCircle, PauseCircle, RefreshCw, Filter, BookOpen, Heart,
  Shield, Cpu, Layers, Package, Link2, Hash, Command, Home, BarChart3
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// =============================================
// IMPORTAR O AGNO CLIENT REAL - SEM MOCK!
// =============================================
// Assumindo que você tem o AgnoClient em src/lib/agnoClient.js
const AgnoClient = typeof window !== 'undefined' && window.AgnoClient
  ? window.AgnoClient
  : class AgnoClient {
      constructor(baseURL = 'http://localhost:8000', userId = 1) {
        this.baseURL = baseURL;
        this.userId = userId;
        this.debugMode = false;
        this.timeout = 30000;
        this.streamingTimeout = 300000;
      }

      setDebugMode(enabled) {
        this.debugMode = enabled;
        return this;
      }

      setTimeout(timeout) {
        this.timeout = timeout;
        return this;
      }

      async testConnection() {
        try {
          const response = await fetch(`${this.baseURL}/api/health`);
          return { success: response.ok };
        } catch {
          return { success: false };
        }
      }

      async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}?user_id=${this.userId}`;
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          ...options
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }

      async makeStreamingRequest(endpoint, data, options = {}) {
        const { sessionId, onChunk, onComplete, onError } = options;
        let url = `${this.baseURL}${endpoint}?user_id=${this.userId}`;
        if (sessionId) url += `&session_id=${sessionId}`;

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
            },
            body: JSON.stringify(data)
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let chunkCount = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6).trim();
                  if (!jsonStr || jsonStr === '[DONE]') continue;

                  const data = JSON.parse(jsonStr);

                  if (data.type === 'error') {
                    onError?.(new Error(data.message));
                    return;
                  }

                  if (data.type === 'done') {
                    onComplete?.(data);
                    return;
                  }

                  if (data.content) {
                    chunkCount++;
                    onChunk?.(data.content);
                  }
                } catch (e) {
                  console.debug('Parse error:', e);
                }
              }
            }
          }

          if (chunkCount > 0) {
            onComplete?.({ session_id: `session_${Date.now()}`, total_chunks: chunkCount });
          }
        } catch (error) {
          onError?.(error);
        }
      }

      async listAgents() {
        return this.makeRequest('/api/agents');
      }

      async listWorkflows() {
        return this.makeRequest('/api/workflows');
      }

      async createAgent(agentData) {
        return this.makeRequest('/api/agents', {
          method: 'POST',
          body: JSON.stringify(agentData)
        });
      }

      async chatWithAgent(agentId, message, options = {}) {
        return this.makeStreamingRequest(
          `/api/agents/${agentId}/chat`,
          { message: message.trim() },
          options
        );
      }

      async executeWorkflow(workflowId, inputData, options = {}) {
        return this.makeStreamingRequest(
          `/api/workflows/${workflowId}/execute`,
          inputData,
          options
        );
      }
    };

// =============================================
// COMPONENTE: MENSAGEM COM MARKDOWN
// =============================================
const MarkdownMessage = ({ content, isStreaming }) => {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        components={{
          // Customizar renderização de elementos
          p: ({ children }) => <p className="mb-2">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          code: ({ inline, className, children }) => {
            return inline ? (
              <code className="px-1 py-0.5 bg-gray-100 rounded text-sm">{children}</code>
            ) : (
              <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                <code className={className}>{children}</code>
              </pre>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mb-2">{children}</h3>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-4 border-gray-300" />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:text-blue-800 underline">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <table className="min-w-full divide-y divide-gray-200 my-2">
              {children}
            </table>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
          ),
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-gray-600 animate-pulse ml-1" />
      )}
    </div>
  );
};

// =============================================
// COMPONENTE: CHAT MESSAGE
// =============================================
const ChatMessage = ({ message, onCopy }) => {
  const isUser = message.type === 'user';
  const isError = message.type === 'error';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} mb-4`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-500' : isError ? 'bg-red-500' : 'bg-gray-600'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      <div className={`flex-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {message.agentName && !isUser && (
          <div className="text-xs font-medium text-gray-500 mb-1">
            {message.agentName}
          </div>
        )}

        <div className={`rounded-lg px-4 py-2 ${
          isUser ? 'bg-blue-500 text-white' : 
          isError ? 'bg-red-50 border border-red-200 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {message.showTyping ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-500">Pensando...</span>
            </div>
          ) : isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <MarkdownMessage
              content={message.content}
              isStreaming={message.isStreaming}
            />
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <span>{message.timestamp}</span>
          {!isUser && message.content && (
            <button
              onClick={() => onCopy(message.content)}
              className="hover:text-gray-700 transition-colors flex items-center gap-1"
              title="Copiar mensagem"
            >
              <Copy className="w-3 h-3" />
              Copiar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================
// COMPONENTE PRINCIPAL - AGNO MANAGEMENT INTERFACE
// =============================================
const AgnoManagementInterface = () => {
  // Estados principais
  const [activeTab, setActiveTab] = useState('agents');
  const [agents, setAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  // Estados do chat
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Estados de UI
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [searchTerm, setSearchTerm] = useState('');

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Cliente Agno REAL
  const agnoClient = useMemo(() => {
    const client = new AgnoClient('http://localhost:8000');
    client.setDebugMode(true);
    client.setTimeout(300000);
    return client;
  }, []);

  // =============================================
  // FUNÇÃO: ADICIONAR LOG
  // =============================================
  const addLog = useCallback((level, message, data = null) => {
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data
    };
    setLogs(prev => [...prev.slice(-99), newLog]);
  }, []);

  // =============================================
  // FUNÇÃO: AUTO-SCROLL
  // =============================================
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // =============================================
  // FUNÇÃO: TESTAR CONEXÃO
  // =============================================
  const testConnection = useCallback(async () => {
    setConnectionStatus('connecting');
    addLog('info', '🔄 Testando conexão com backend...');

    const result = await agnoClient.testConnection();

    if (result.success) {
      setConnectionStatus('connected');
      addLog('success', '✅ Conectado ao backend');
      return true;
    } else {
      setConnectionStatus('disconnected');
      addLog('error', '❌ Falha na conexão com backend');
      setError('Não foi possível conectar ao backend');
      return false;
    }
  }, [agnoClient, addLog]);

  // =============================================
  // FUNÇÃO: CARREGAR DADOS
  // =============================================
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      addLog('info', '📋 Carregando dados...');

      const [agentsData, workflowsData] = await Promise.all([
        agnoClient.listAgents().catch(() => []),
        agnoClient.listWorkflows().catch(() => [])
      ]);

      setAgents(agentsData || []);
      setWorkflows(workflowsData || []);

      addLog('success', `✅ ${agentsData?.length || 0} agentes e ${workflowsData?.length || 0} workflows carregados`);
    } catch (error) {
      addLog('error', `❌ Erro ao carregar dados: ${error.message}`);
      setError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [agnoClient, addLog]);

  // =============================================
  // FUNÇÃO: ENVIAR MENSAGEM COM STREAMING
  // =============================================
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isStreaming || (!selectedAgent && !selectedWorkflow)) {
      return;
    }

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
    addLog('info', `📤 Enviando: "${userMessage.substring(0, 50)}..."`);

    // Preparar mensagem do agente
    const agentMessageId = Date.now() + 1;
    const agentMessage = {
      id: agentMessageId,
      type: 'agent',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
      agentName: selectedAgent?.name || selectedWorkflow?.name,
      isStreaming: true,
      showTyping: true
    };
    setMessages(prev => [...prev, agentMessage]);

    try {
      if (selectedAgent) {
        let firstChunkReceived = false;
        const startTime = Date.now();
        let chunkCount = 0;

        await agnoClient.chatWithAgent(
          selectedAgent.id,
          userMessage,
          {
            sessionId,
            onChunk: (chunk) => {
              chunkCount++;

              setMessages(prev => prev.map(msg =>
                msg.id === agentMessageId
                  ? {
                      ...msg,
                      content: msg.content + chunk,
                      showTyping: false,
                      isStreaming: true
                    }
                  : msg
              ));

              if (!firstChunkReceived) {
                firstChunkReceived = true;
                addLog('success', '🎉 Streaming iniciado!');
              }
            },
            onComplete: (data) => {
              const duration = Date.now() - startTime;

              addLog('success', '✅ Resposta completa', {
                session_id: data.session_id,
                chunks: chunkCount,
                duration: `${(duration / 1000).toFixed(1)}s`
              });

              setMessages(prev => prev.map(msg =>
                msg.id === agentMessageId
                  ? { ...msg, isStreaming: false, showTyping: false }
                  : msg
              ));

              setIsStreaming(false);
              if (data.session_id) {
                setSessionId(data.session_id);
              }
            },
            onError: (error) => {
              addLog('error', `❌ Erro no chat: ${error.message}`);
              setError(`Erro no chat: ${error.message}`);
              setIsStreaming(false);

              setMessages(prev => prev.filter(msg => msg.id !== agentMessageId));
            }
          }
        );
      } else if (selectedWorkflow) {
        await agnoClient.executeWorkflow(
          selectedWorkflow.id,
          { message: userMessage },
          {
            sessionId,
            onChunk: (chunk) => {
              setMessages(prev => prev.map(msg =>
                msg.id === agentMessageId
                  ? {
                      ...msg,
                      content: msg.content + chunk,
                      showTyping: false,
                      isStreaming: true
                    }
                  : msg
              ));
            },
            onComplete: (data) => {
              setMessages(prev => prev.map(msg =>
                msg.id === agentMessageId
                  ? { ...msg, isStreaming: false, showTyping: false }
                  : msg
              ));
              setIsStreaming(false);
              if (data.session_id) {
                setSessionId(data.session_id);
              }
            },
            onError: (error) => {
              addLog('error', `❌ Erro no workflow: ${error.message}`);
              setError(`Erro no workflow: ${error.message}`);
              setIsStreaming(false);
              setMessages(prev => prev.filter(msg => msg.id !== agentMessageId));
            }
          }
        );
      }
    } catch (error) {
      addLog('error', `❌ Erro: ${error.message}`);
      setError(`Erro: ${error.message}`);
      setIsStreaming(false);
      setMessages(prev => prev.filter(msg => msg.id !== agentMessageId));
    }
  }, [inputMessage, isStreaming, selectedAgent, selectedWorkflow, sessionId, agnoClient, addLog]);

  // =============================================
  // FUNÇÕES AUXILIARES
  // =============================================
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const copyMessage = useCallback((content) => {
    navigator.clipboard.writeText(content);
    addLog('info', '📋 Mensagem copiada');
  }, [addLog]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    addLog('info', '🧹 Chat limpo');
  }, [addLog]);

  // =============================================
  // INICIALIZAÇÃO
  // =============================================
  useEffect(() => {
    const init = async () => {
      const connected = await testConnection();
      if (connected) {
        await loadInitialData();
      }
    };
    init();
  }, [testConnection, loadInitialData]);

  // =============================================
  // FILTROS
  // =============================================
  const filteredAgents = Array.isArray(agents) ? agents.filter(agent =>
    agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.role?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const filteredWorkflows = Array.isArray(workflows) ? workflows.filter(workflow =>
    workflow.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workflow.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  // =============================================
  // RENDERIZAÇÃO
  // =============================================
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-600" />
              Agno Platform
            </h1>
            <div className="flex items-center gap-1">
              {connectionStatus === 'connected' ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : connectionStatus === 'connecting' ? (
                <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === 'agents'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Agentes ({filteredAgents.length})
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === 'workflows'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Workflows ({filteredWorkflows.length})
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : activeTab === 'agents' ? (
            <div className="space-y-3">
              {filteredAgents.map(agent => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedAgent?.id === agent.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{agent.name}</span>
                  </div>
                  <p className="text-sm text-gray-600">{agent.role}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">
                      {agent.model || 'gpt-4o-mini'}
                    </span>
                    {agent.tools?.length > 0 && (
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {agent.tools.length} ferramentas
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWorkflows.map(workflow => (
                <div
                  key={workflow.id}
                  onClick={() => setSelectedWorkflow(workflow)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedWorkflow?.id === workflow.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <GitBranch className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{workflow.name}</span>
                  </div>
                  <p className="text-sm text-gray-600">{workflow.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="p-4 border-t">
          <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            Criar {activeTab === 'agents' ? 'Agente' : 'Workflow'}
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {selectedAgent ? (
                <div className="flex items-center gap-3">
                  <Bot className="w-6 h-6 text-blue-600" />
                  <div>
                    <h2 className="font-semibold">{selectedAgent.name}</h2>
                    <p className="text-sm text-gray-600">{selectedAgent.role}</p>
                  </div>
                </div>
              ) : selectedWorkflow ? (
                <div className="flex items-center gap-3">
                  <GitBranch className="w-6 h-6 text-green-600" />
                  <div>
                    <h2 className="font-semibold">{selectedWorkflow.name}</h2>
                    <p className="text-sm text-gray-600">{selectedWorkflow.description}</p>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">
                  Selecione um agente ou workflow para começar
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {sessionId && (
                <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                  {sessionId.substring(0, 8)}...
                </span>
              )}
              <button
                onClick={clearChat}
                className="p-2 text-gray-600 hover:text-red-600"
                title="Limpar chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare className="w-12 h-12 mb-3" />
              <p className="text-lg">Nenhuma mensagem ainda</p>
              <p className="text-sm mt-1">
                {selectedAgent || selectedWorkflow
                  ? 'Digite uma mensagem para começar'
                  : 'Selecione um agente ou workflow'}
              </p>
            </div>
          ) : (
            <>
              {messages.map(message => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onCopy={copyMessage}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t px-6 py-4">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !selectedAgent && !selectedWorkflow
                  ? 'Selecione um agente ou workflow...'
                  : isStreaming
                  ? 'Aguardando resposta...'
                  : 'Digite sua mensagem...'
              }
              disabled={isStreaming || (!selectedAgent && !selectedWorkflow)}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isStreaming || (!selectedAgent && !selectedWorkflow)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-2"
            >
              {isStreaming ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Enviando
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar
                </>
              )}
            </button>
          </div>
        </div>

        {/* Logs Panel */}
        {showLogs && (
          <div className="h-48 border-t bg-gray-50 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">Logs do Sistema</span>
              <button onClick={() => setShowLogs(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 text-xs font-mono">
              {logs.map(log => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-gray-500">{log.timestamp}</span>
                  <span className={
                    log.level === 'error' ? 'text-red-600' :
                    log.level === 'success' ? 'text-green-600' :
                    'text-gray-700'
                  }>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs Toggle */}
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="absolute bottom-4 right-4 p-2 bg-white border rounded-lg shadow-lg hover:shadow-xl"
        >
          <Terminal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AgnoManagementInterface;
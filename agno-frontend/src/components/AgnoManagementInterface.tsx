import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Plus,
  Play,
  Settings,
  Brain,
  Zap,
  MessageSquare,
  Save,
  GitBranch,
  Activity,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';

// Importar o cliente Agno
import AgnoClient from './agnoClient';

const AgnoManagementReal = () => {
  const [activeTab, setActiveTab] = useState('agents');
  const [agents, setAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cliente Agno
  const [agnoClient] = useState(() => new AgnoClient());
  const chatEndRef = useRef(null);

  const checkHealth = useCallback(async () => {
    try {
      const health = await agnoClient.healthCheck();
      console.log('Backend conectado:', health);
      setError(null);
    } catch (err) {
      setError('Erro ao conectar com o backend. Verifique se está rodando na porta 8000.');
      console.error('Erro de conexão:', err);
    }
  }, [agnoClient]);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await agnoClient.listAgents();
      console.log('Dados recebidos do backend:', data);

      const formattedAgents = data.map(agent => {
        // Parsing seguro dos JSONs
        let instructions = [];
        let tools = [];
        let langchainConfig = {};

        try {
          if (agent.instructions && typeof agent.instructions === 'string') {
            instructions = JSON.parse(agent.instructions);
          } else if (Array.isArray(agent.instructions)) {
            instructions = agent.instructions;
          }
        } catch (e) {
          console.warn('Erro ao parsear instructions:', e);
          instructions = ['Assistente útil'];
        }

        try {
          if (agent.langchain_config && typeof agent.langchain_config === 'string') {
            langchainConfig = JSON.parse(agent.langchain_config);
            tools = langchainConfig.tools || [];
          } else if (agent.langchain_config && typeof agent.langchain_config === 'object') {
            langchainConfig = agent.langchain_config;
            tools = langchainConfig.tools || [];
          }
        } catch (e) {
          console.warn('Erro ao parsear langchain_config:', e);
          tools = [];
        }

        return {
          id: agent.id,
          name: agent.nome || 'Agente sem nome',
          role: agent.agent_role || 'Assistant',
          modelProvider: agent.empresa || 'openai',
          modelId: agent.modelo || 'gpt-4o',
          tools: tools,
          status: agent.is_active_agent ? 'active' : 'inactive',
          lastUsed: agent.created_at ? new Date(agent.created_at).toLocaleDateString('pt-BR') : 'Não disponível',
          instructions: instructions
        };
      });

      setAgents(formattedAgents);
      console.log('Agentes formatados:', formattedAgents);
    } catch (err) {
      console.error('Erro ao carregar agentes:', err);
      setError('Erro ao carregar agentes: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [agnoClient]);

  const loadWorkflows = useCallback(async () => {
    try {
      const data = await agnoClient.listWorkflows();
      console.log('Workflows recebidos:', data);

      const formattedWorkflows = data.map(workflow => {
        let workflowConfig = {};

        try {
          if (workflow.workflow_config && typeof workflow.workflow_config === 'string') {
            workflowConfig = JSON.parse(workflow.workflow_config);
          } else if (workflow.workflow_config && typeof workflow.workflow_config === 'object') {
            workflowConfig = workflow.workflow_config;
          }
        } catch (e) {
          console.warn('Erro ao parsear workflow_config:', e);
          workflowConfig = {};
        }

        return {
          id: workflow.id,
          name: workflow.nome || 'Workflow sem nome',
          description: workflow.descricao || 'Sem descrição',
          flowType: workflowConfig.flow_type || 'sequential',
          agentCount: workflowConfig.agents?.length || 0,
          status: workflow.is_active ? 'active' : 'inactive',
          lastUsed: workflow.created_at ? new Date(workflow.created_at).toLocaleDateString('pt-BR') : 'Não disponível'
        };
      });

      setWorkflows(formattedWorkflows);
      console.log('Workflows formatados:', formattedWorkflows);
    } catch (err) {
      console.error('Erro ao carregar workflows:', err);
      setError('Erro ao carregar workflows: ' + err.message);
    }
  }, [agnoClient]);

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        checkHealth(),
        loadAgents(),
        loadWorkflows()
      ]);
    };
    loadData();
  }, [checkHealth, loadAgents, loadWorkflows]);

  // Auto-scroll do chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, currentResponse]);

  const CreateAgentModal = () => {
    const [formData, setFormData] = useState({
      name: '',
      role: '',
      model_provider: 'openai',
      model_id: 'gpt-4o',
      instructions: [''],
      tools: [],
      memory_enabled: true,
      rag_enabled: false
    });
    const [creating, setCreating] = useState(false);

    const availableTools = [
      { id: 'duckduckgo', name: 'DuckDuckGo Search', description: 'Pesquisa na web' },
      { id: 'yfinance', name: 'Yahoo Finance', description: 'Dados financeiros' },
      { id: 'reasoning', name: 'Reasoning Tools', description: 'Capacidades de raciocínio' }
    ];

    const modelOptions = {
      openai: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
      ],
      anthropic: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
      ]
    };

    const handleSubmit = async () => {
      if (!formData.name || !formData.role || !formData.instructions[0]) {
        setError('Preencha todos os campos obrigatórios');
        return;
      }

      try {
        setCreating(true);
        console.log('Criando agente com dados:', formData);
        const result = await agnoClient.createAgent(formData);
        console.log('Agente criado:', result);
        setShowCreateAgent(false);
        await loadAgents(); // Recarrega a lista
        setError(null);
      } catch (err) {
        console.error('Erro ao criar agente:', err);
        setError(`Erro ao criar agente: ${err.message}`);
      } finally {
        setCreating(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Bot className="w-6 h-6" />
            Criar Novo Agente
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Agente *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Assistente de Marketing"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Papel/Função *
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Marketing Specialist"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provedor do Modelo
                </label>
                <select
                  value={formData.model_provider}
                  onChange={(e) => setFormData({
                    ...formData,
                    model_provider: e.target.value,
                    model_id: modelOptions[e.target.value][0].id
                  })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo
                </label>
                <select
                  value={formData.model_id}
                  onChange={(e) => setFormData({...formData, model_id: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {modelOptions[formData.model_provider].map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instruções do Agente *
              </label>
              <textarea
                value={formData.instructions[0]}
                onChange={(e) => setFormData({
                  ...formData,
                  instructions: [e.target.value]
                })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="4"
                placeholder="Descreva como o agente deve se comportar..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ferramentas Disponíveis
              </label>
              <div className="grid grid-cols-1 gap-2">
                {availableTools.map(tool => (
                  <label key={tool.id} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.tools.includes(tool.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({...formData, tools: [...formData.tools, tool.id]});
                        } else {
                          setFormData({...formData, tools: formData.tools.filter(t => t !== tool.id)});
                        }
                      }}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-sm text-gray-500">{tool.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.memory_enabled}
                  onChange={(e) => setFormData({...formData, memory_enabled: e.target.checked})}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Habilitar Memória</span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.rag_enabled}
                  onChange={(e) => setFormData({...formData, rag_enabled: e.target.checked})}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Habilitar RAG</span>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateAgent(false);
                  setError(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={creating}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {creating ? (
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

  const ChatInterface = ({ agent, workflow }) => {
    const handleSendMessage = async () => {
      if (!message.trim() || isRunning) return;

      const userMessage = message;
      setMessage('');
      setIsRunning(true);
      setCurrentResponse('');

      // Adiciona mensagem do usuário
      const newUserMessage = {
        type: 'user',
        content: userMessage,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatHistory(prev => [...prev, newUserMessage]);

      // Prepara resposta do agente
      const agentMessage = {
        type: 'agent',
        content: '',
        timestamp: new Date().toLocaleTimeString(),
        agentName: agent ? agent.name : workflow.name
      };
      setChatHistory(prev => [...prev, agentMessage]);

      try {
        const onChunk = (chunk) => {
          setCurrentResponse(prev => prev + chunk);
        };

        const onComplete = () => {
          setChatHistory(prev => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            lastMessage.content = currentResponse;
            lastMessage.completed = true;
            return updated;
          });
          setCurrentResponse('');
          setIsRunning(false);
          setError(null);
        };

        const onError = (error) => {
          console.error('Erro no chat:', error);
          setError(`Erro: ${error.message}`);
          setIsRunning(false);
          setCurrentResponse('');

          // Remove a mensagem de resposta vazia em caso de erro
          setChatHistory(prev => prev.slice(0, -1));
        };

        if (agent) {
          await agnoClient.chatWithAgent(agent.id, userMessage, onChunk, onComplete, onError);
        } else if (workflow) {
          // Temporariamente desabilitado até implementarmos o endpoint
          onError(new Error('Chat com workflows ainda não implementado. Use a aba de agentes.'));
        }

      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        setError(`Erro ao enviar mensagem: ${error.message}`);
        setIsRunning(false);
        setCurrentResponse('');

        // Remove a mensagem de resposta vazia em caso de erro
        setChatHistory(prev => prev.slice(0, -1));
      }
    };

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {agent ? <Bot className="w-5 h-5" /> : <GitBranch className="w-5 h-5" />}
            Chat com {agent ? agent.name : workflow.name}
          </h3>
          {agent && (
            <div className="text-sm text-gray-500 mt-1">
              Modelo: {agent.modelId} | Provider: {agent.modelProvider} | Tools: {agent.tools.join(', ') || 'Nenhuma'}
            </div>
          )}
          {workflow && (
            <div className="text-sm text-orange-600 mt-1 p-2 bg-orange-50 rounded">
              ⚠️ Chat com workflows será implementado em breve. Use agentes individuais por enquanto.
            </div>
          )}
          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}
        </div>

        <div className="h-96 border border-gray-200 rounded-lg p-4 overflow-y-auto mb-4 bg-gray-50">
          {chatHistory.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Inicie uma conversa com {agent ? 'o agente' : 'o workflow'}</p>
              <p className="text-xs mt-1">Este chat usa o Agno real conectado ao backend!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`${
                    msg.type === 'user' 
                      ? 'ml-auto bg-blue-500 text-white' 
                      : 'mr-auto bg-white text-gray-800 border border-gray-200'
                  } max-w-[80%] p-3 rounded-lg shadow-sm`}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {msg.content || (msg.type === 'agent' && !msg.completed ? currentResponse : '')}
                  </div>
                  {msg.type === 'agent' && !msg.completed && isRunning && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <Loader className="w-3 h-3 animate-spin" />
                      <span>Digitando...</span>
                    </div>
                  )}
                  <div className="text-xs mt-1 opacity-70">
                    {msg.agentName && `${msg.agentName} • `}{msg.timestamp}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Digite sua mensagem..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isRunning || (workflow && !agent)}
          />
          <button
            onClick={handleSendMessage}
            disabled={isRunning || !message.trim() || (workflow && !agent)}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isRunning ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Enviar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Agno Management</h1>
                <p className="text-sm text-gray-500">
                  Plataforma real com Agno funcionando • {agents.length} agentes • {workflows.length} workflows
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowCreateAgent(true);
                  setError(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Novo Agente
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-800">Erro</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('agents')}
              className={`${
                activeTab === 'agents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Bot className="w-4 h-4" />
              Agentes ({agents.length})
            </button>
            <button
              onClick={() => setActiveTab('workflows')}
              className={`${
                activeTab === 'workflows'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <GitBranch className="w-4 h-4" />
              Workflows ({workflows.length})
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`${
                activeTab === 'chat'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <MessageSquare className="w-4 h-4" />
              Testar
            </button>
          </nav>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Carregando dados...</span>
          </div>
        ) : (
          <>
            {/* Agents Tab */}
            {activeTab === 'agents' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map(agent => (
                  <div key={agent.id} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Bot className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                          <p className="text-sm text-gray-500">{agent.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          agent.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Brain className="w-4 h-4" />
                        <span>{agent.modelProvider} - {agent.modelId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Settings className="w-4 h-4" />
                        <span>{agent.tools.length} ferramentas</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Activity className="w-4 h-4" />
                        <span>Criado: {agent.lastUsed}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedAgent(agent);
                          setSelectedWorkflow(null);
                          setActiveTab('chat');
                          setChatHistory([]);
                          setError(null);
                        }}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Testar
                      </button>
                      <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Config
                      </button>
                    </div>
                  </div>
                ))}

                {agents.length === 0 && !loading && (
                  <div className="col-span-full text-center py-12">
                    <Bot className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhum agente criado
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Crie seu primeiro agente para começar a usar o Agno.
                    </p>
                    <button
                      onClick={() => setShowCreateAgent(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Criar Primeiro Agente
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Workflows Tab */}
            {activeTab === 'workflows' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflows.map(workflow => (
                  <div key={workflow.id} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <GitBranch className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
                          <p className="text-sm text-gray-500">{workflow.description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Bot className="w-4 h-4" />
                        <span>{workflow.agentCount} agentes</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <GitBranch className="w-4 h-4" />
                        <span>Tipo: {workflow.flowType}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Activity className="w-4 h-4" />
                        <span>Criado: {workflow.lastUsed}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedWorkflow(workflow);
                          setSelectedAgent(null);
                          setActiveTab('chat');
                          setChatHistory([]);
                          setError(null);
                        }}
                        className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Executar
                      </button>
                      <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Config
                      </button>
                    </div>
                  </div>
                ))}

                {workflows.length === 0 && !loading && (
                  <div className="col-span-full text-center py-12">
                    <GitBranch className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhum workflow criado
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Workflows permitem coordenar múltiplos agentes. Em breve!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <div className="max-w-4xl mx-auto">
                {selectedAgent || selectedWorkflow ? (
                  <ChatInterface agent={selectedAgent} workflow={selectedWorkflow} />
                ) : (
                  <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Selecione um Agente
                    </h3>
                    <p className="text-gray-500 mb-6">
                      Escolha um agente para iniciar um chat com o Agno real.
                    </p>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={() => setActiveTab('agents')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <Bot className="w-4 h-4" />
                        Ver Agentes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showCreateAgent && <CreateAgentModal />}
    </div>
  );
};

export default AgnoManagementReal;
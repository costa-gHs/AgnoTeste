import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Settings,
  Play,
  Crown,
  Bot,
  ChevronRight,
  ChevronDown,
  Zap,
  Brain,
  MessageSquare,
  Save,
  AlertCircle,
  CheckCircle,
  Loader,
  User,
  Shield,
  Target,
  X,
  Search,
  Database,
  Globe,
  Code,
  Mail,
  Calendar,
  FileText,
  Image,
  Mic,
  Cpu,
  Layers,
  Eye,
  Edit,
  Copy,
  Wand2,
  HelpCircle,
  Upload,
  Link
} from 'lucide-react';

// Interfaces
interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'data' | 'communication' | 'productivity' | 'development' | 'media' | 'integration';
  icon: React.ReactNode;
  config?: Record<string, any>;
}

interface RAGConfig {
  enabled: boolean;
  indexId?: string;
  indexName?: string;
  embeddingModel: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  threshold: number;
  documents?: string[];
}

interface Agent {
  id: string;
  name: string;
  role: string;
  description?: string;
  model_provider: 'openai' | 'anthropic' | 'groq' | 'ollama';
  model_id: string;
  instructions: string[];
  tools: Tool[];
  configuration: any;
  is_active: boolean;
  memory_enabled: boolean;
  rag_config: RAGConfig;
  roleInTeam?: string;
  priority?: number;
}

interface Team {
  id?: string;
  name: string;
  description: string;
  teamType: 'collaborative' | 'hierarchical' | 'sequential';
  agents: Agent[];
  supervisorConfig?: {
    agentId: string;
    instructions: string[];
  };
}

// Dados mockados
const AVAILABLE_TOOLS: Tool[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Busca em tempo real na internet com múltiplos provedores',
    category: 'data',
    icon: <Search className="w-4 h-4" />
  },
  {
    id: 'database_query',
    name: 'Database Query',
    description: 'Executa consultas SQL em bancos de dados conectados',
    category: 'data',
    icon: <Database className="w-4 h-4" />
  },
  {
    id: 'api_integration',
    name: 'API Integration',
    description: 'Integração com APIs REST e GraphQL externas',
    category: 'integration',
    icon: <Globe className="w-4 h-4" />
  },
  {
    id: 'code_generation',
    name: 'Code Generation',
    description: 'Gera código em Python, JavaScript, SQL e outras linguagens',
    category: 'development',
    icon: <Code className="w-4 h-4" />
  },
  {
    id: 'email_processing',
    name: 'Email Processing',
    description: 'Análise, classificação e resposta automática de emails',
    category: 'communication',
    icon: <Mail className="w-4 h-4" />
  },
  {
    id: 'calendar_management',
    name: 'Calendar Management',
    description: 'Agendamento inteligente e gestão de calendários',
    category: 'productivity',
    icon: <Calendar className="w-4 h-4" />
  },
  {
    id: 'document_processing',
    name: 'Document Processing',
    description: 'Processamento de PDFs, DOCs e outros documentos',
    category: 'productivity',
    icon: <FileText className="w-4 h-4" />
  },
  {
    id: 'image_analysis',
    name: 'Image Analysis',
    description: 'Análise de imagens com visão computacional',
    category: 'media',
    icon: <Image className="w-4 h-4" />
  },
  {
    id: 'voice_processing',
    name: 'Voice Processing',
    description: 'Transcrição de áudio e síntese de voz',
    category: 'media',
    icon: <Mic className="w-4 h-4" />
  }
];

const MODEL_OPTIONS = {
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
  ]
};

const AdvancedTeamBuilder = () => {
  // Estados principais
  const [team, setTeam] = useState<Team>({
    name: '',
    description: '',
    teamType: 'collaborative',
    agents: []
  });

  // Estados de UI
  const [showAgentCreator, setShowAgentCreator] = useState(false);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);

  // Estados do Agent Creator
  const [newAgent, setNewAgent] = useState<Partial<Agent>>({
    name: '',
    role: '',
    description: '',
    model_provider: 'openai',
    model_id: 'gpt-4-turbo',
    instructions: [''],
    tools: [],
    memory_enabled: true,
    rag_config: {
      enabled: false,
      embeddingModel: 'text-embedding-3-small',
      chunkSize: 1000,
      chunkOverlap: 200,
      topK: 5,
      threshold: 0.7,
      documents: []
    }
  });

  // Estados de controle
  const [activeTab, setActiveTab] = useState<'basic' | 'tools' | 'rag' | 'advanced'>('basic');
  const [toolSearch, setToolSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Carregar agentes disponíveis (mock)
  useEffect(() => {
    const mockAgents: Agent[] = [
      {
        id: '1',
        name: 'Assistente de Vendas',
        role: 'Especialista em conversão de leads',
        model_provider: 'openai',
        model_id: 'gpt-4-turbo',
        instructions: ['Sempre seja consultivo', 'Foque na necessidade do cliente'],
        tools: [AVAILABLE_TOOLS[0], AVAILABLE_TOOLS[4]],
        configuration: {},
        is_active: true,
        memory_enabled: true,
        rag_config: { enabled: false, embeddingModel: 'text-embedding-3-small', chunkSize: 1000, chunkOverlap: 200, topK: 5, threshold: 0.7 }
      },
      {
        id: '2',
        name: 'Analista de Dados',
        role: 'Processamento e análise de informações',
        model_provider: 'anthropic',
        model_id: 'claude-3-sonnet',
        instructions: ['Use dados para embasar conclusões', 'Seja preciso nos cálculos'],
        tools: [AVAILABLE_TOOLS[1], AVAILABLE_TOOLS[3]],
        configuration: {},
        is_active: true,
        memory_enabled: true,
        rag_config: { enabled: true, embeddingModel: 'text-embedding-3-large', chunkSize: 1500, chunkOverlap: 300, topK: 7, threshold: 0.8 }
      }
    ];
    setAvailableAgents(mockAgents);
  }, []);

  // Filtrar ferramentas
  const filteredTools = AVAILABLE_TOOLS.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
                         tool.description.toLowerCase().includes(toolSearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Função para criar novo agente
  const handleCreateAgent = async () => {
    if (!newAgent.name || !newAgent.role || !newAgent.model_provider) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    setIsCreating(true);

    try {
      // Simular criação no backend
      await new Promise(resolve => setTimeout(resolve, 1500));

      const agent: Agent = {
        id: `agent_${Date.now()}`,
        name: newAgent.name!,
        role: newAgent.role!,
        description: newAgent.description || '',
        model_provider: newAgent.model_provider!,
        model_id: newAgent.model_id!,
        instructions: newAgent.instructions?.filter(i => i.trim()) || [],
        tools: newAgent.tools || [],
        configuration: {},
        is_active: true,
        memory_enabled: newAgent.memory_enabled || false,
        rag_config: newAgent.rag_config || {
          enabled: false,
          embeddingModel: 'text-embedding-3-small',
          chunkSize: 1000,
          chunkOverlap: 200,
          topK: 5,
          threshold: 0.7
        }
      };

      // Adicionar ao time atual
      setSelectedAgents([...selectedAgents, agent]);

      // Adicionar aos agentes disponíveis
      setAvailableAgents([...availableAgents, agent]);

      // Reset form
      setNewAgent({
        name: '',
        role: '',
        description: '',
        model_provider: 'openai',
        model_id: 'gpt-4-turbo',
        instructions: [''],
        tools: [],
        memory_enabled: true,
        rag_config: {
          enabled: false,
          embeddingModel: 'text-embedding-3-small',
          chunkSize: 1000,
          chunkOverlap: 200,
          topK: 5,
          threshold: 0.7,
          documents: []
        }
      });

      setShowAgentCreator(false);
      setActiveTab('basic');

    } catch (error) {
      console.error('Erro ao criar agente:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Função para salvar team
  const handleSaveTeam = async () => {
    if (!team.name || selectedAgents.length === 0) {
      alert('Preencha o nome do team e adicione pelo menos um agente');
      return;
    }

    setIsSaving(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Team salvo:', { ...team, agents: selectedAgents });
      alert('Team salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar team:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Função para adicionar instrução
  const addInstruction = () => {
    setNewAgent({
      ...newAgent,
      instructions: [...(newAgent.instructions || []), '']
    });
  };

  // Função para remover instrução
  const removeInstruction = (index: number) => {
    const instructions = newAgent.instructions || [];
    instructions.splice(index, 1);
    setNewAgent({ ...newAgent, instructions });
  };

  // Função para alternar ferramenta
  const toggleTool = (tool: Tool) => {
    const currentTools = newAgent.tools || [];
    const isSelected = currentTools.some(t => t.id === tool.id);

    if (isSelected) {
      setNewAgent({
        ...newAgent,
        tools: currentTools.filter(t => t.id !== tool.id)
      });
    } else {
      setNewAgent({
        ...newAgent,
        tools: [...currentTools, tool]
      });
    }
  };

  const getModelIcon = (provider: string) => {
    const icons: Record<string, string> = {
      'openai': '🤖',
      'anthropic': '🧠',
      'groq': '⚡',
      'ollama': '🦙'
    };
    return icons[provider] || '🤖';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      'data': <Database className="w-4 h-4" />,
      'communication': <Mail className="w-4 h-4" />,
      'productivity': <Calendar className="w-4 h-4" />,
      'development': <Code className="w-4 h-4" />,
      'media': <Image className="w-4 h-4" />,
      'integration': <Globe className="w-4 h-4" />
    };
    return icons[category] || <Cpu className="w-4 h-4" />;
  };

  return (
    <div className="h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Team Builder Avançado
            </h1>
            <p className="text-gray-600 mt-1">
              Crie times de agentes especializados com ferramentas personalizadas e RAG integrado
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowAgentCreator(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Criar Assistente
            </button>

            <button
              onClick={() => setShowAgentSelector(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Bot className="w-4 h-4" />
              Adicionar Existente
            </button>

            <button
              onClick={handleSaveTeam}
              disabled={isSaving}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Team
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        {/* Team Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuração do Team</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Team *
                </label>
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => setTeam({ ...team, name: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Time de Customer Success"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={team.description}
                  onChange={(e) => setTeam({ ...team, description: e.target.value })}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Descreva o propósito e objetivos deste team..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Tipo de Colaboração
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { value: 'collaborative', label: 'Colaborativo', desc: 'Trabalham juntos', icon: Users },
                    { value: 'hierarchical', label: 'Hierárquico', desc: 'Com supervisor', icon: Crown },
                    { value: 'sequential', label: 'Sequencial', desc: 'Em cadeia', icon: ChevronRight }
                  ].map((type) => {
                    const Icon = type.icon;
                    return (
                      <label
                        key={type.value}
                        className={`relative flex p-3 border rounded-lg cursor-pointer transition-colors ${
                          team.teamType === type.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="radio"
                          value={type.value}
                          checked={team.teamType === type.value}
                          onChange={(e) => setTeam({ ...team, teamType: e.target.value as any })}
                          className="sr-only"
                        />
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-gray-600" />
                          <div>
                            <div className="font-medium text-gray-900">{type.label}</div>
                            <div className="text-xs text-gray-600">{type.desc}</div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Agentes no Team</h2>

            {selectedAgents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhum agente adicionado</p>
                <p className="text-sm">Crie ou adicione agentes ao seu team</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedAgents.map((agent, index) => (
                  <div key={agent.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getModelIcon(agent.model_provider)}</span>
                      <div>
                        <div className="font-medium text-gray-900">{agent.name}</div>
                        <div className="text-sm text-gray-600">{agent.role}</div>
                        <div className="flex gap-1 mt-1">
                          {agent.tools.slice(0, 2).map(tool => (
                            <span key={tool.id} className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                              {tool.name}
                            </span>
                          ))}
                          {agent.tools.length > 2 && (
                            <span className="text-xs text-gray-500">+{agent.tools.length - 2}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedAgents(selectedAgents.filter(a => a.id !== agent.id))}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Criador de Agente */}
      {showAgentCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Criar Novo Assistente</h2>
                <p className="text-sm text-gray-600">Configure um assistente especializado com ferramentas e RAG</p>
              </div>
              <button
                onClick={() => setShowAgentCreator(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex gap-8 px-6">
                {[
                  { id: 'basic', label: 'Básico', icon: User },
                  { id: 'tools', label: 'Ferramentas', icon: Zap },
                  { id: 'rag', label: 'RAG', icon: Database },
                  { id: 'advanced', label: 'Avançado', icon: Settings }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome do Assistente *
                      </label>
                      <input
                        type="text"
                        value={newAgent.name || ''}
                        onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Assistente de Vendas"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Função/Especialidade *
                      </label>
                      <input
                        type="text"
                        value={newAgent.role || ''}
                        onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Especialista em qualificação de leads"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descrição
                    </label>
                    <textarea
                      value={newAgent.description || ''}
                      onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Descreva as responsabilidades e contexto deste assistente..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Provedor do Modelo *
                      </label>
                      <select
                        value={newAgent.model_provider || 'openai'}
                        onChange={(e) => {
                          const provider = e.target.value as 'openai' | 'anthropic' | 'groq';
                          const firstModel = MODEL_OPTIONS[provider][0].id;
                          setNewAgent({
                            ...newAgent,
                            model_provider: provider,
                            model_id: firstModel
                          });
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="groq">Groq</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Modelo Específico *
                      </label>
                      <select
                        value={newAgent.model_id || ''}
                        onChange={(e) => setNewAgent({ ...newAgent, model_id: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {MODEL_OPTIONS[newAgent.model_provider as keyof typeof MODEL_OPTIONS]?.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name} - {model.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instruções do Sistema
                    </label>
                    <div className="space-y-3">
                      {(newAgent.instructions || ['']).map((instruction, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={instruction}
                            onChange={(e) => {
                              const instructions = [...(newAgent.instructions || [])];
                              instructions[index] = e.target.value;
                              setNewAgent({ ...newAgent, instructions });
                            }}
                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder={`Instrução ${index + 1}`}
                          />
                          {(newAgent.instructions || []).length > 1 && (
                            <button
                              onClick={() => removeInstruction(index)}
                              className="p-3 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={addInstruction}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Instrução
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="memory_enabled"
                      checked={newAgent.memory_enabled || false}
                      onChange={(e) => setNewAgent({ ...newAgent, memory_enabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="memory_enabled" className="text-sm font-medium text-gray-700">
                      Habilitar memória persistente
                    </label>
                    <HelpCircle className="w-4 h-4 text-gray-400" title="Permite que o assistente lembre de conversas anteriores" />
                  </div>
                </div>
              )}

              {activeTab === 'tools' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Ferramentas Disponíveis</h3>
                      <p className="text-sm text-gray-600">Selecione as ferramentas que este assistente poderá usar</p>
                    </div>
                    <div className="text-sm text-gray-600">
                      {(newAgent.tools || []).length} selecionadas
                    </div>
                  </div>

                  {/* Filtros */}
                  <div className="flex gap-4">
                    <div className="flex-1 relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={toolSearch}
                        onChange={(e) => setToolSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Buscar ferramentas..."
                      />
                    </div>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Todas as categorias</option>
                      <option value="data">Dados</option>
                      <option value="communication">Comunicação</option>
                      <option value="productivity">Produtividade</option>
                      <option value="development">Desenvolvimento</option>
                      <option value="media">Mídia</option>
                      <option value="integration">Integração</option>
                    </select>
                  </div>

                  {/* Grid de Ferramentas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTools.map(tool => {
                      const isSelected = (newAgent.tools || []).some(t => t.id === tool.id);
                      return (
                        <div
                          key={tool.id}
                          onClick={() => toggleTool(tool)}
                          className={`p-4 border rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(tool.category)}
                              <span className="font-medium text-gray-900">{tool.name}</span>
                            </div>
                            {isSelected && <CheckCircle className="w-5 h-5 text-blue-600" />}
                          </div>
                          <p className="text-sm text-gray-600">{tool.description}</p>
                          <div className="mt-2">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full capitalize">
                              {tool.category}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredTools.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>Nenhuma ferramenta encontrada</p>
                      <p className="text-sm">Tente ajustar os filtros de busca</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'rag' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Configuração RAG</h3>
                      <p className="text-sm text-gray-600">Configure a recuperação aumentada de geração para este assistente</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAgent.rag_config?.enabled || false}
                        onChange={(e) => setNewAgent({
                          ...newAgent,
                          rag_config: { ...(newAgent.rag_config || {}), enabled: e.target.checked } as RAGConfig
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        {newAgent.rag_config?.enabled ? 'Habilitado' : 'Desabilitado'}
                      </span>
                    </label>
                  </div>

                  {newAgent.rag_config?.enabled && (
                    <div className="space-y-6 p-6 bg-gray-50 rounded-xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Modelo de Embedding
                          </label>
                          <select
                            value={newAgent.rag_config?.embeddingModel || 'text-embedding-3-small'}
                            onChange={(e) => setNewAgent({
                              ...newAgent,
                              rag_config: {
                                ...(newAgent.rag_config || {}),
                                embeddingModel: e.target.value as any
                              } as RAGConfig
                            })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="text-embedding-3-small">Text Embedding 3 Small (Rápido)</option>
                            <option value="text-embedding-3-large">Text Embedding 3 Large (Precisão)</option>
                            <option value="text-embedding-ada-002">Ada 002 (Econômico)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nome do Índice
                          </label>
                          <input
                            type="text"
                            value={newAgent.rag_config?.indexName || ''}
                            onChange={(e) => setNewAgent({
                              ...newAgent,
                              rag_config: {
                                ...(newAgent.rag_config || {}),
                                indexName: e.target.value
                              } as RAGConfig
                            })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: knowledge_base_vendas"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tamanho do Chunk
                          </label>
                          <input
                            type="number"
                            value={newAgent.rag_config?.chunkSize || 1000}
                            onChange={(e) => setNewAgent({
                              ...newAgent,
                              rag_config: {
                                ...(newAgent.rag_config || {}),
                                chunkSize: parseInt(e.target.value)
                              } as RAGConfig
                            })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            min="100"
                            max="4000"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sobreposição
                          </label>
                          <input
                            type="number"
                            value={newAgent.rag_config?.chunkOverlap || 200}
                            onChange={(e) => setNewAgent({
                              ...newAgent,
                              rag_config: {
                                ...(newAgent.rag_config || {}),
                                chunkOverlap: parseInt(e.target.value)
                              } as RAGConfig
                            })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            min="0"
                            max="1000"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Top K Resultados
                          </label>
                          <input
                            type="number"
                            value={newAgent.rag_config?.topK || 5}
                            onChange={(e) => setNewAgent({
                              ...newAgent,
                              rag_config: {
                                ...(newAgent.rag_config || {}),
                                topK: parseInt(e.target.value)
                              } as RAGConfig
                            })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            min="1"
                            max="20"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Threshold
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={newAgent.rag_config?.threshold || 0.7}
                            onChange={(e) => setNewAgent({
                              ...newAgent,
                              rag_config: {
                                ...(newAgent.rag_config || {}),
                                threshold: parseFloat(e.target.value)
                              } as RAGConfig
                            })}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            min="0"
                            max="1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Base de Conhecimento
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Upload className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-600 mb-2">Arraste documentos aqui ou clique para selecionar</p>
                          <p className="text-sm text-gray-500">Suporta PDF, DOC, TXT, MD</p>
                          <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            Selecionar Arquivos
                          </button>
                        </div>

                        {/* Lista de documentos (placeholder) */}
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-gray-400" />
                              <span className="text-sm text-gray-700">manual_vendas.pdf</span>
                              <span className="text-xs text-gray-500">2.3 MB</span>
                            </div>
                            <button className="p-1 text-red-600 hover:bg-red-50 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurações Avançadas</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-yellow-600" />
                          <span className="font-medium text-yellow-800">Em Desenvolvimento</span>
                        </div>
                        <p className="text-sm text-yellow-700">
                          Funcionalidades avançadas como fine-tuning, webhooks e integrações personalizadas estarão disponíveis em breve.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border border-gray-200 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">Fine-tuning</h4>
                          <p className="text-sm text-gray-600 mb-3">Treine o modelo com dados específicos do seu domínio</p>
                          <button disabled className="px-3 py-1 bg-gray-100 text-gray-400 text-sm rounded cursor-not-allowed">
                            Em breve
                          </button>
                        </div>

                        <div className="p-4 border border-gray-200 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">Webhooks</h4>
                          <p className="text-sm text-gray-600 mb-3">Notificações automáticas para eventos específicos</p>
                          <button disabled className="px-3 py-1 bg-gray-100 text-gray-400 text-sm rounded cursor-not-allowed">
                            Em breve
                          </button>
                        </div>

                        <div className="p-4 border border-gray-200 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">APIs Personalizadas</h4>
                          <p className="text-sm text-gray-600 mb-3">Integre com sistemas internos da empresa</p>
                          <button disabled className="px-3 py-1 bg-gray-100 text-gray-400 text-sm rounded cursor-not-allowed">
                            Em breve
                          </button>
                        </div>

                        <div className="p-4 border border-gray-200 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">Monitoramento</h4>
                          <p className="text-sm text-gray-600 mb-3">Métricas avançadas e alertas em tempo real</p>
                          <button disabled className="px-3 py-1 bg-gray-100 text-gray-400 text-sm rounded cursor-not-allowed">
                            Em breve
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => setShowAgentCreator(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={isCreating || !newAgent.name || !newAgent.role}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Criar Assistente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Selector de Agentes Existentes */}
      {showAgentSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Selecionar Agentes Existentes</h2>
              <button
                onClick={() => setShowAgentSelector(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {availableAgents.filter(agent => !selectedAgents.find(sa => sa.id === agent.id)).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Todos os agentes disponíveis já foram adicionados ao team.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {availableAgents
                    .filter(agent => !selectedAgents.find(sa => sa.id === agent.id))
                    .map(agent => (
                      <div
                        key={agent.id}
                        onClick={() => {
                          setSelectedAgents([...selectedAgents, agent]);
                          setShowAgentSelector(false);
                        }}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{getModelIcon(agent.model_provider)}</span>
                          <div>
                            <h3 className="font-medium text-gray-900">{agent.name}</h3>
                            <p className="text-sm text-gray-600">{agent.role}</p>
                            {agent.description && (
                              <p className="text-xs text-gray-500 mt-1">{agent.description}</p>
                            )}
                            <div className="flex gap-2 mt-2">
                              {agent.tools.slice(0, 3).map(tool => (
                                <span
                                  key={tool.id}
                                  className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full"
                                >
                                  {tool.name}
                                </span>
                              ))}
                              {agent.tools.length > 3 && (
                                <span className="text-xs text-gray-500 self-center">
                                  +{agent.tools.length - 3} mais
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-green-600" />
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowAgentSelector(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedTeamBuilder;
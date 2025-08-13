import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Plus, Trash2, Settings, Play, Crown, Bot, ChevronRight, ChevronDown,
  Zap, Brain, MessageSquare, Save, AlertCircle, CheckCircle, Loader, User,
  Shield, Target, X, Search, Database, Globe, Code, Mail, Calendar, FileText,
  Image, Mic, Cpu, Layers, Eye, Edit, Copy, Wand2, HelpCircle, Upload, Link,
  DollarSign, Calculator, Cloud, Wrench, TrendingUp, Monitor, Activity,
  Filter, SortDesc, MoreVertical, Download, RefreshCw, Workflow, Network,
  GitBranch, Star, Heart, Clock, BarChart3, PieChart, LineChart, Hash,
  Sparkles, Rocket, Gauge, PhoneCall, Video, Headphones, Server, Lock,
  ShoppingCart, CreditCard, MapPin, Camera, Music, Film, Archive, Package
} from 'lucide-react';

// Types
interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'financial' | 'ai_media' | 'cloud' | 'utilities' | 'reasoning' | 'communication' | 'productivity' | 'ecommerce' | 'database';
  icon: React.ReactNode;
  config_schema?: any;
  requires_auth?: boolean;
  enabled?: boolean;
  available?: boolean;
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
  avatar?: string;
  created_at?: string;
  performance_score?: number;
  execution_count?: number;
}

interface Team {
  id?: string;
  name: string;
  description: string;
  teamType: 'collaborative' | 'hierarchical' | 'sequential';
  agents: Agent[];
  supervisorConfig?: Agent;
  metadata?: any;
  created_at?: string;
  execution_count?: number;
  success_rate?: number;
  avg_response_time?: number;
}

interface AgentExecution {
  id: string;
  agent_name: string;
  message: string;
  response?: string;
  status: 'running' | 'completed' | 'error';
  execution_time_ms?: number;
  timestamp: string;
}

const TeamBuilder: React.FC = () => {
  // States
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [executions, setExecutions] = useState<AgentExecution[]>([]);

  // UI States
  const [activeTab, setActiveTab] = useState<'builder' | 'agents' | 'tools' | 'executions' | 'analytics'>('builder');
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [toolSearchTerm, setToolSearchTerm] = useState('');
  const [selectedToolCategory, setSelectedToolCategory] = useState<string>('all');
  const [draggedAgent, setDraggedAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testingAgent, setTestingAgent] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<string>('');

  // Form states
  const [newAgent, setNewAgent] = useState<Partial<Agent>>({
    name: '',
    role: '',
    description: '',
    model_provider: 'openai',
    model_id: 'gpt-4o',
    instructions: [''],
    tools: [],
    memory_enabled: true,
    is_active: true,
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

  const [newTeam, setNewTeam] = useState<Partial<Team>>({
    name: '',
    description: '',
    teamType: 'collaborative',
    agents: []
  });

  // Mock data - in real app, fetch from API
  const mockTools: Tool[] = [
    // Web & Search
    { id: 'web_search', name: 'Web Search', description: 'Real-time web search with DuckDuckGo', category: 'web', icon: <Search className="w-4 h-4" />, available: true },
    { id: 'web_scraping', name: 'Web Scraping', description: 'Extract data from web pages', category: 'web', icon: <Globe className="w-4 h-4" />, available: true },
    { id: 'api_client', name: 'API Client', description: 'Generic REST API client', category: 'web', icon: <Link className="w-4 h-4" />, available: true },

    // Financial
    { id: 'yfinance', name: 'Yahoo Finance', description: 'Stock market data and analysis', category: 'financial', icon: <DollarSign className="w-4 h-4" />, available: true },
    { id: 'calculator', name: 'Advanced Calculator', description: 'Mathematical calculations and formulas', category: 'financial', icon: <Calculator className="w-4 h-4" />, available: true },
    { id: 'market_analysis', name: 'Market Analysis', description: 'Technical analysis and indicators', category: 'financial', icon: <TrendingUp className="w-4 h-4" />, available: true },

    // AI & Media
    { id: 'dalle', name: 'DALL-E 3', description: 'AI image generation', category: 'ai_media', icon: <Image className="w-4 h-4" />, available: true, requires_auth: true },
    { id: 'code_generation', name: 'Code Generator', description: 'Generate code in multiple languages', category: 'ai_media', icon: <Code className="w-4 h-4" />, available: true },
    { id: 'reasoning', name: 'Reasoning Engine', description: 'Advanced logical reasoning', category: 'reasoning', icon: <Brain className="w-4 h-4" />, available: true },

    // Communication
    { id: 'email_client', name: 'Email Client', description: 'Send and receive emails', category: 'communication', icon: <Mail className="w-4 h-4" />, available: false, requires_auth: true },
    { id: 'slack_bot', name: 'Slack Integration', description: 'Slack bot functionality', category: 'communication', icon: <MessageSquare className="w-4 h-4" />, available: false, requires_auth: true },

    // Productivity
    { id: 'calendar_manager', name: 'Calendar Manager', description: 'Manage calendar events', category: 'productivity', icon: <Calendar className="w-4 h-4" />, available: true },
    { id: 'file_processor', name: 'File Processor', description: 'Process documents and files', category: 'productivity', icon: <FileText className="w-4 h-4" />, available: true },

    // Database
    { id: 'database_query', name: 'Database Query', description: 'SQL database operations', category: 'database', icon: <Database className="w-4 h-4" />, available: false, requires_auth: true },

    // Cloud & Utilities
    { id: 'cloud_storage', name: 'Cloud Storage', description: 'Cloud file operations', category: 'cloud', icon: <Cloud className="w-4 h-4" />, available: false, requires_auth: true },
    { id: 'system_monitor', name: 'System Monitor', description: 'Monitor system resources', category: 'utilities', icon: <Monitor className="w-4 h-4" />, available: true }
  ];

  const toolCategories = [
    { id: 'all', name: 'All Tools', icon: <Layers className="w-4 h-4" />, color: 'gray' },
    { id: 'web', name: 'Web & APIs', icon: <Globe className="w-4 h-4" />, color: 'blue' },
    { id: 'financial', name: 'Financial', icon: <DollarSign className="w-4 h-4" />, color: 'green' },
    { id: 'ai_media', name: 'AI & Media', icon: <Sparkles className="w-4 h-4" />, color: 'purple' },
    { id: 'communication', name: 'Communication', icon: <MessageSquare className="w-4 h-4" />, color: 'indigo' },
    { id: 'productivity', name: 'Productivity', icon: <Calendar className="w-4 h-4" />, color: 'teal' },
    { id: 'database', name: 'Database', icon: <Database className="w-4 h-4" />, color: 'orange' },
    { id: 'cloud', name: 'Cloud', icon: <Cloud className="w-4 h-4" />, color: 'sky' },
    { id: 'utilities', name: 'Utilities', icon: <Wrench className="w-4 h-4" />, color: 'slate' },
    { id: 'reasoning', name: 'Reasoning', icon: <Brain className="w-4 h-4" />, color: 'rose' }
  ];

  const modelOptions = {
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o (Latest)', description: 'Most capable model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient' },
      { id: 'gpt-4', name: 'GPT-4', description: 'Previous generation' },
      { id: 'o1', name: 'O1 (Reasoning)', description: 'Advanced reasoning' },
      { id: 'o1-mini', name: 'O1 Mini', description: 'Lightweight reasoning' }
    ],
    anthropic: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Latest Claude model' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable Claude' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fast and efficient' }
    ],
    groq: [
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', description: 'High performance' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Long context' }
    ]
  };

  // Effects
  useEffect(() => {
    setAvailableTools(mockTools);
    loadTeams();
    loadAgents();
  }, []);

  // Mock API functions
  const loadTeams = async () => {
    setIsLoading(true);
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockTeams: Team[] = [
        {
          id: '1',
          name: 'Research Team',
          description: 'Specialized team for research and analysis',
          teamType: 'collaborative',
          agents: [],
          execution_count: 45,
          success_rate: 94.5,
          avg_response_time: 2.3,
          created_at: '2024-01-15'
        }
      ];
      setTeams(mockTeams);
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const mockAgents: Agent[] = [
        {
          id: '1',
          name: 'Research Assistant',
          role: 'Senior Researcher',
          description: 'Expert in data analysis and web research',
          model_provider: 'openai',
          model_id: 'gpt-4o',
          instructions: ['Focus on factual accuracy', 'Cite sources when possible'],
          tools: mockTools.slice(0, 4),
          is_active: true,
          memory_enabled: true,
          performance_score: 96,
          execution_count: 234,
          configuration: {},
          rag_config: {
            enabled: true,
            embeddingModel: 'text-embedding-3-small',
            chunkSize: 1000,
            chunkOverlap: 200,
            topK: 5,
            threshold: 0.7
          },
          created_at: '2024-01-10'
        }
      ];
      setAgents(mockAgents);
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const saveTeam = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const team: Team = {
        id: Date.now().toString(),
        ...newTeam as Team,
        created_at: new Date().toISOString(),
        execution_count: 0,
        success_rate: 0,
        avg_response_time: 0
      };
      setTeams([...teams, team]);
      setNewTeam({ name: '', description: '', teamType: 'collaborative', agents: [] });
      setIsCreatingTeam(false);
    } catch (error) {
      console.error('Error saving team:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAgent = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const agent: Agent = {
        id: Date.now().toString(),
        ...newAgent as Agent,
        created_at: new Date().toISOString(),
        performance_score: 0,
        execution_count: 0
      };
      setAgents([...agents, agent]);
      setNewAgent({
        name: '', role: '', description: '', model_provider: 'openai', model_id: 'gpt-4o',
        instructions: [''], tools: [], memory_enabled: true, is_active: true,
        rag_config: {
          enabled: false, embeddingModel: 'text-embedding-3-small',
          chunkSize: 1000, chunkOverlap: 200, topK: 5, threshold: 0.7, documents: []
        }
      });
      setIsCreatingAgent(false);
    } catch (error) {
      console.error('Error saving agent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testAgent = async (agentId: string) => {
    if (!testPrompt.trim()) return;

    setTestingAgent(agentId);
    setTestResult('');

    try {
      // Mock streaming response
      const responses = [
        "Processing your request...",
        "Analyzing data with available tools...",
        "Generating comprehensive response...",
        `Here's the result for "${testPrompt}": This is a detailed response from the agent demonstrating its capabilities and knowledge. The agent has successfully processed your request using its configured tools and model.`
      ];

      for (let i = 0; i < responses.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setTestResult(responses[i]);
      }
    } catch (error) {
      setTestResult('Error occurred during testing');
    } finally {
      setTestingAgent(null);
    }
  };

  // Utility functions
  const filteredTools = mockTools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(toolSearchTerm.toLowerCase()) ||
                         tool.description.toLowerCase().includes(toolSearchTerm.toLowerCase());
    const matchesCategory = selectedToolCategory === 'all' || tool.category === selectedToolCategory;
    return matchesSearch && matchesCategory;
  });

  const getProviderIcon = (provider: string) => {
    const icons = { openai: '🤖', anthropic: '🧠', groq: '⚡', ollama: '🦙' };
    return icons[provider as keyof typeof icons] || '🤖';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      web: 'blue', financial: 'green', ai_media: 'purple', communication: 'indigo',
      productivity: 'teal', database: 'orange', cloud: 'sky', utilities: 'slate', reasoning: 'rose'
    };
    return colors[category as keyof typeof colors] || 'gray';
  };

  // Drag & Drop handlers
  const handleDragStart = (agent: Agent) => {
    setDraggedAgent(agent);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, teamId: string) => {
    e.preventDefault();
    if (draggedAgent) {
      const updatedTeams = teams.map(team => {
        if (team.id === teamId) {
          return {
            ...team,
            agents: [...team.agents, { ...draggedAgent, roleInTeam: 'member' }]
          };
        }
        return team;
      });
      setTeams(updatedTeams);
      setDraggedAgent(null);
    }
  };

  const addInstructionToAgent = () => {
    setNewAgent({
      ...newAgent,
      instructions: [...(newAgent.instructions || []), '']
    });
  };

  const removeInstructionFromAgent = (index: number) => {
    const instructions = [...(newAgent.instructions || [])];
    instructions.splice(index, 1);
    setNewAgent({ ...newAgent, instructions });
  };

  const toggleToolForAgent = (tool: Tool) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Advanced Team Builder</h1>
                <p className="text-gray-600">Create, manage and orchestrate intelligent AI agent teams</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCreatingAgent(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Bot className="w-4 h-4" />
                New Agent
              </button>
              <button
                onClick={() => setIsCreatingTeam(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Team
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 mt-6 bg-gray-100 p-1 rounded-lg">
            {[
              { id: 'builder', name: 'Team Builder', icon: <Users className="w-4 h-4" /> },
              { id: 'agents', name: 'Agents', icon: <Bot className="w-4 h-4" /> },
              { id: 'tools', name: 'Tools Library', icon: <Wrench className="w-4 h-4" /> },
              { id: 'executions', name: 'Executions', icon: <Activity className="w-4 h-4" /> },
              { id: 'analytics', name: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === tab.id 
                    ? 'bg-white text-blue-600 shadow-sm font-medium' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.icon}
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Team Builder Tab */}
        {activeTab === 'builder' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Teams List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Layers className="w-6 h-6" />
                    Active Teams
                  </h2>
                  <button
                    onClick={() => setIsCreatingTeam(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Team
                  </button>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {teams.map(team => (
                      <div
                        key={team.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                        onClick={() => setSelectedTeam(team)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, team.id!)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              team.teamType === 'hierarchical' ? 'bg-purple-100 text-purple-600' :
                              team.teamType === 'sequential' ? 'bg-orange-100 text-orange-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {team.teamType === 'hierarchical' ? <Crown className="w-5 h-5" /> :
                               team.teamType === 'sequential' ? <GitBranch className="w-5 h-5" /> :
                               <Users className="w-5 h-5" />}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{team.name}</h3>
                              <p className="text-sm text-gray-600">{team.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Bot className="w-4 h-4" />
                              {team.agents.length} agents
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="w-4 h-4" />
                              {team.execution_count || 0} runs
                            </span>
                            <span className="flex items-center gap-1">
                              <Gauge className="w-4 h-4" />
                              {team.success_rate || 0}% success
                            </span>
                          </div>
                        </div>

                        {/* Agents in team */}
                        {team.agents.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {team.agents.map(agent => (
                              <div key={agent.id} className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-sm">
                                <span>{getProviderIcon(agent.model_provider)}</span>
                                <span className="font-medium">{agent.name}</span>
                                {agent.roleInTeam && (
                                  <span className="text-gray-500">({agent.roleInTeam})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {teams.length === 0 && (
                      <div className="text-center py-12">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
                        <p className="text-gray-600 mb-4">Create your first AI agent team to get started</p>
                        <button
                          onClick={() => setIsCreatingTeam(true)}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Create First Team
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Available Agents Sidebar */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Available Agents
              </h3>

              <div className="space-y-3">
                {agents.map(agent => (
                  <div
                    key={agent.id}
                    draggable
                    onDragStart={() => handleDragStart(agent)}
                    className="border border-gray-200 rounded-lg p-3 cursor-move hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getProviderIcon(agent.model_provider)}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{agent.name}</div>
                        <div className="text-sm text-gray-600">{agent.role}</div>
                      </div>
                      <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {agent.model_id}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{agent.tools.length} tools</span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {agent.performance_score || 0}%
                      </span>
                    </div>
                  </div>
                ))}

                {agents.length === 0 && (
                  <div className="text-center py-8">
                    <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 text-sm">No agents available</p>
                    <button
                      onClick={() => setIsCreatingAgent(true)}
                      className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Create Agent
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Agent Management</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsCreatingAgent(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Agent
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map(agent => (
                  <div key={agent.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <span className="text-2xl">{getProviderIcon(agent.model_provider)}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                          <p className="text-sm text-gray-600">{agent.role}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {agent.description && (
                      <p className="text-sm text-gray-600 mb-3">{agent.description}</p>
                    )}

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Model:</span>
                        <span className="font-medium">{agent.model_id}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tools:</span>
                        <span className="font-medium">{agent.tools.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Performance:</span>
                        <span className="font-medium">{agent.performance_score || 0}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Executions:</span>
                        <span className="font-medium">{agent.execution_count || 0}</span>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {agent.memory_enabled && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Memory</span>
                      )}
                      {agent.rag_config.enabled && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">RAG</span>
                      )}
                      {agent.is_active && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Active</span>
                      )}
                    </div>

                    {/* Test Agent */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Test message..."
                          value={testPrompt}
                          onChange={(e) => setTestPrompt(e.target.value)}
                          className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => testAgent(agent.id)}
                          disabled={testingAgent === agent.id || !testPrompt.trim()}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {testingAgent === agent.id ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          Test
                        </button>
                      </div>

                      {testingAgent === agent.id && (
                        <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <Loader className="w-4 h-4 animate-spin inline mr-2" />
                          Testing...
                        </div>
                      )}

                      {testResult && testingAgent !== agent.id && (
                        <div className="text-sm text-gray-700 bg-blue-50 p-2 rounded border-l-4 border-blue-400">
                          {testResult}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tools Library Tab */}
        {activeTab === 'tools' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Tools Library</h2>
                <div className="flex gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search tools..."
                      value={toolSearchTerm}
                      onChange={(e) => setToolSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Tool Categories */}
              <div className="flex flex-wrap gap-2 mb-6">
                {toolCategories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedToolCategory(category.id)}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                      selectedToolCategory === category.id
                        ? `bg-${category.color}-100 text-${category.color}-700 border-2 border-${category.color}-300`
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.icon}
                    {category.name}
                  </button>
                ))}
              </div>

              {/* Tools Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTools.map(tool => (
                  <div
                    key={tool.id}
                    className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${
                      tool.available 
                        ? 'border-gray-200 hover:border-blue-300 hover:shadow-md' 
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-${getCategoryColor(tool.category)}-100 text-${getCategoryColor(tool.category)}-600`}>
                          {tool.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{tool.name}</h3>
                          <p className="text-sm text-gray-600 capitalize">{tool.category.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {tool.available ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-orange-500" />
                        )}
                        {tool.requires_auth && (
                          <Lock className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">{tool.description}</p>

                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 text-xs rounded ${
                        tool.available ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {tool.available ? 'Available' : 'Setup Required'}
                      </span>

                      {tool.available && (
                        <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                          Configure
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Executions Tab */}
        {activeTab === 'executions' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Executions</h2>

            <div className="space-y-4">
              {executions.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No executions yet</h3>
                  <p className="text-gray-600">Agent executions will appear here</p>
                </div>
              ) : (
                executions.map(execution => (
                  <div key={execution.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          execution.status === 'completed' ? 'bg-green-500' :
                          execution.status === 'running' ? 'bg-blue-500 animate-pulse' :
                          'bg-red-500'
                        }`} />
                        <span className="font-medium">{execution.agent_name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{new Date(execution.timestamp).toLocaleString()}</span>
                        {execution.execution_time_ms && (
                          <span>{execution.execution_time_ms}ms</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded p-3 mb-2">
                      <p className="text-sm font-medium text-gray-700">Input:</p>
                      <p className="text-sm text-gray-600">{execution.message}</p>
                    </div>

                    {execution.response && (
                      <div className="bg-blue-50 rounded p-3">
                        <p className="text-sm font-medium text-blue-700">Response:</p>
                        <p className="text-sm text-blue-600">{execution.response}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
              <div className="space-y-4">
                {teams.map(team => (
                  <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{team.name}</div>
                      <div className="text-sm text-gray-600">{team.agents.length} agents</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{team.success_rate || 0}%</div>
                      <div className="text-sm text-gray-500">{team.execution_count || 0} runs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tool Usage</h3>
              <div className="space-y-3">
                {mockTools.slice(0, 5).map((tool, index) => (
                  <div key={tool.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {tool.icon}
                      <span className="text-sm">{tool.name}</span>
                    </div>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.random() * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Agent Modal */}
      {isCreatingAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Create New Agent</h2>
                <button
                  onClick={() => setIsCreatingAgent(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Agent Name</label>
                  <input
                    type="text"
                    value={newAgent.name || ''}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Research Assistant"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <input
                    type="text"
                    value={newAgent.role || ''}
                    onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Senior Researcher"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newAgent.description || ''}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe the agent's purpose and capabilities..."
                />
              </div>

              {/* Model Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                  <select
                    value={newAgent.model_provider || 'openai'}
                    onChange={(e) => setNewAgent({
                      ...newAgent,
                      model_provider: e.target.value as any,
                      model_id: modelOptions[e.target.value as keyof typeof modelOptions][0].id
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="groq">Groq</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                  <select
                    value={newAgent.model_id || ''}
                    onChange={(e) => setNewAgent({ ...newAgent, model_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {modelOptions[newAgent.model_provider as keyof typeof modelOptions]?.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} - {model.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Instructions</label>
                  <button
                    onClick={addInstructionToAgent}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Add Instruction
                  </button>
                </div>
                <div className="space-y-2">
                  {(newAgent.instructions || []).map((instruction, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={instruction}
                        onChange={(e) => {
                          const instructions = [...(newAgent.instructions || [])];
                          instructions[index] = e.target.value;
                          setNewAgent({ ...newAgent, instructions });
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Instruction ${index + 1}...`}
                      />
                      <button
                        onClick={() => removeInstructionFromAgent(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tools Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">Select Tools</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {mockTools.map(tool => (
                    <div
                      key={tool.id}
                      onClick={() => toggleToolForAgent(tool)}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        (newAgent.tools || []).some(t => t.id === tool.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${!tool.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {tool.icon}
                        <span className="font-medium text-sm">{tool.name}</span>
                        {(newAgent.tools || []).some(t => t.id === tool.id) && (
                          <CheckCircle className="w-4 h-4 text-blue-600 ml-auto" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600">{tool.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advanced Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newAgent.memory_enabled || false}
                    onChange={(e) => setNewAgent({ ...newAgent, memory_enabled: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Memory Enabled</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newAgent.is_active || false}
                    onChange={(e) => setNewAgent({ ...newAgent, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newAgent.rag_config?.enabled || false}
                    onChange={(e) => setNewAgent({
                      ...newAgent,
                      rag_config: { ...newAgent.rag_config!, enabled: e.target.checked }
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">RAG Enabled</span>
                </label>
              </div>

              {/* RAG Configuration */}
              {newAgent.rag_config?.enabled && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-medium text-purple-900">RAG Configuration</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-700 mb-1">Embedding Model</label>
                      <select
                        value={newAgent.rag_config?.embeddingModel || 'text-embedding-3-small'}
                        onChange={(e) => setNewAgent({
                          ...newAgent,
                          rag_config: { ...newAgent.rag_config!, embeddingModel: e.target.value as any }
                        })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg"
                      >
                        <option value="text-embedding-ada-002">Ada 002</option>
                        <option value="text-embedding-3-small">Text Embedding 3 Small</option>
                        <option value="text-embedding-3-large">Text Embedding 3 Large</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-700 mb-1">Chunk Size</label>
                      <input
                        type="number"
                        value={newAgent.rag_config?.chunkSize || 1000}
                        onChange={(e) => setNewAgent({
                          ...newAgent,
                          rag_config: { ...newAgent.rag_config!, chunkSize: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setIsCreatingAgent(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveAgent}
                disabled={isLoading || !newAgent.name || !newAgent.role}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <Loader className="w-4 h-4 animate-spin" />}
                Create Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {isCreatingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Create New Team</h2>
                <button
                  onClick={() => setIsCreatingTeam(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Team Name</label>
                <input
                  type="text"
                  value={newTeam.name || ''}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Research Team"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newTeam.description || ''}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe the team's purpose..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Team Type</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: 'collaborative', name: 'Collaborative', icon: <Users className="w-5 h-5" />, desc: 'Agents work together' },
                    { id: 'hierarchical', name: 'Hierarchical', icon: <Crown className="w-5 h-5" />, desc: 'With supervisor' },
                    { id: 'sequential', name: 'Sequential', icon: <GitBranch className="w-5 h-5" />, desc: 'Step by step' }
                  ].map(type => (
                    <div
                      key={type.id}
                      onClick={() => setNewTeam({ ...newTeam, teamType: type.id as any })}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        newTeam.teamType === type.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {type.icon}
                        <span className="font-medium">{type.name}</span>
                      </div>
                      <p className="text-sm text-gray-600">{type.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setIsCreatingTeam(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveTeam}
                disabled={isLoading || !newTeam.name}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <Loader className="w-4 h-4 animate-spin" />}
                Create Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamBuilder;
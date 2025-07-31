import React, { useState, useEffect } from 'react';
import {
  Bot,
  FileText,
  Download,
  Upload,
  Star,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Copy,
  Eye,
  Tag,
  Clock,
  User,
  Zap,
  Brain,
  TrendingUp,
  Code,
  MessageSquare,
  Loader,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw
} from 'lucide-react';

// Import do cliente Agno
import AgnoClient from './agnoClient';

const AgentTemplatesReal = () => {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateToEdit, setTemplateToEdit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agents, setAgents] = useState([]);

  // Cliente Agno
  const [agnoClient] = useState(() => new AgnoClient());

  // Carregar dados iniciais
  useEffect(() => {
    loadTemplatesAndAgents();
  }, []);

  const loadTemplatesAndAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carregar agentes existentes para usar como base para templates
      const agentsData = await agnoClient.listAgents();
      setAgents(agentsData);

      // Criar templates baseados nos agentes existentes
      const templatesFromAgents = agentsData.map((agent, index) => {
        let instructions = [];
        let tools = [];

        try {
          instructions = typeof agent.instructions === 'string'
            ? JSON.parse(agent.instructions)
            : agent.instructions || ['Assistente útil'];
        } catch (e) {
          instructions = ['Assistente útil'];
        }

        try {
          const langchainConfig = typeof agent.langchain_config === 'string'
            ? JSON.parse(agent.langchain_config)
            : agent.langchain_config || {};
          tools = langchainConfig.tools || [];
        } catch (e) {
          tools = [];
        }

        return {
          id: `template_${agent.id}`,
          name: `Template: ${agent.nome}`,
          description: `Template baseado no agente ${agent.nome} com papel de ${agent.agent_role}`,
          category: inferCategory(agent.agent_role, agent.nome),
          author: 'Sistema',
          isPublic: true,
          isFeatured: index < 2, // Primeiros 2 como featured
          rating: 4.5 + Math.random() * 0.5,
          downloads: Math.floor(Math.random() * 1000) + 100,
          lastUpdated: agent.created_at ? new Date(agent.created_at).toISOString().split('T')[0] : '2025-01-28',
          tags: generateTags(agent.agent_role, tools),
          originalAgentId: agent.id,
          config: {
            modelProvider: agent.empresa || 'openai',
            modelId: agent.modelo || 'gpt-4o',
            tools: tools,
            instructions: instructions,
            memoryEnabled: true,
            ragEnabled: agent.usa_rag || false,
            reasoningEnabled: tools.includes('reasoning')
          }
        };
      });

      // Adicionar alguns templates padrão
      const defaultTemplates = [
        {
          id: 'template_research',
          name: 'Assistente de Pesquisa Acadêmica',
          description: 'Especializado em pesquisa acadêmica com citações e análise crítica',
          category: 'research',
          author: 'Sistema',
          isPublic: true,
          isFeatured: true,
          rating: 4.8,
          downloads: 2847,
          lastUpdated: '2025-01-28',
          tags: ['pesquisa', 'acadêmico', 'citações', 'análise'],
          config: {
            modelProvider: 'openai',
            modelId: 'gpt-4o',
            tools: ['duckduckgo', 'reasoning'],
            instructions: [
              'Você é um assistente de pesquisa acadêmica especializado.',
              'Sempre cite suas fontes e forneça análise crítica.',
              'Use formatação acadêmica apropriada.',
              'Mantenha-se atualizado com as últimas descobertas em sua área.'
            ],
            memoryEnabled: true,
            ragEnabled: true,
            reasoningEnabled: true
          }
        },
        {
          id: 'template_finance',
          name: 'Analista Financeiro Pro',
          description: 'Análise financeira avançada com dados de mercado em tempo real',
          category: 'finance',
          author: 'Sistema',
          isPublic: true,
          isFeatured: true,
          rating: 4.9,
          downloads: 1923,
          lastUpdated: '2025-01-27',
          tags: ['finanças', 'mercado', 'análise', 'investimentos'],
          config: {
            modelProvider: 'anthropic',
            modelId: 'claude-3-5-sonnet-20241022',
            tools: ['yfinance', 'reasoning'],
            instructions: [
              'Você é um analista financeiro sênior com expertise em mercados globais.',
              'Forneça insights detalhados com disclaimers apropriados.',
              'Use gráficos e tabelas para apresentar dados complexos.',
              'Sempre considere o contexto econômico atual.',
              'Inclua análise de risco em suas recomendações.'
            ],
            memoryEnabled: true,
            ragEnabled: false,
            reasoningEnabled: true
          }
        },
        {
          id: 'template_marketing',
          name: 'Especialista em Marketing Digital',
          description: 'Estratégias de marketing digital e análise de campanhas modernas',
          category: 'marketing',
          author: 'Sistema',
          isPublic: true,
          isFeatured: false,
          rating: 4.6,
          downloads: 1456,
          lastUpdated: '2025-01-26',
          tags: ['marketing', 'digital', 'campanhas', 'redes sociais'],
          config: {
            modelProvider: 'openai',
            modelId: 'gpt-4o-mini',
            tools: ['duckduckgo', 'reasoning'],
            instructions: [
              'Você é um especialista em marketing digital com experiência em Growth Hacking.',
              'Foque em estratégias práticas e mensuráveis com ROI claro.',
              'Considere as últimas tendências em redes sociais e SEO.',
              'Forneça exemplos concretos e casos de uso.',
              'Inclua métricas relevantes para cada estratégia sugerida.'
            ],
            memoryEnabled: true,
            ragEnabled: true,
            reasoningEnabled: false
          }
        }
      ];

      const allTemplates = [...templatesFromAgents, ...defaultTemplates];
      setTemplates(allTemplates);

      // Calcular categorias
      const categoryCount = {};
      allTemplates.forEach(template => {
        categoryCount[template.category] = (categoryCount[template.category] || 0) + 1;
      });

      const calculatedCategories = [
        { id: 'all', name: 'Todos', count: allTemplates.length },
        { id: 'research', name: 'Pesquisa', count: categoryCount.research || 0 },
        { id: 'finance', name: 'Financeiro', count: categoryCount.finance || 0 },
        { id: 'marketing', name: 'Marketing', count: categoryCount.marketing || 0 },
        { id: 'development', name: 'Desenvolvimento', count: categoryCount.development || 0 },
        { id: 'support', name: 'Suporte', count: categoryCount.support || 0 },
        { id: 'general', name: 'Geral', count: categoryCount.general || 0 }
      ];

      setCategories(calculatedCategories);

    } catch (err) {
      console.error('Erro ao carregar templates:', err);
      setError(`Erro ao carregar templates: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const inferCategory = (role, name) => {
    const text = `${role} ${name}`.toLowerCase();
    if (text.includes('pesquis') || text.includes('research') || text.includes('academ')) return 'research';
    if (text.includes('financ') || text.includes('market') || text.includes('invest')) return 'finance';
    if (text.includes('marketing') || text.includes('social')) return 'marketing';
    if (text.includes('dev') || text.includes('code') || text.includes('program')) return 'development';
    if (text.includes('support') || text.includes('help') || text.includes('assist')) return 'support';
    return 'general';
  };

  const generateTags = (role, tools) => {
    const tags = [];
    if (role) tags.push(role.toLowerCase());
    tools.forEach(tool => tags.push(tool));
    return tags.slice(0, 4); // Máximo 4 tags
  };

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleUseTemplate = async (template) => {
    try {
      setError(null);

      // Criar agente baseado no template
      const agentData = {
        name: template.name.replace('Template: ', ''),
        role: template.config.instructions[0] || 'Assistant',
        model_provider: template.config.modelProvider,
        model_id: template.config.modelId,
        instructions: template.config.instructions,
        tools: template.config.tools,
        memory_enabled: template.config.memoryEnabled,
        rag_enabled: template.config.ragEnabled
      };

      console.log('Criando agente a partir do template:', agentData);
      const result = await agnoClient.createAgent(agentData);

      alert(`Agente criado com sucesso! ID: ${result.agent_id}`);

      // Recarregar dados para mostrar o novo agente
      await loadTemplatesAndAgents();

    } catch (error) {
      console.error('Erro ao usar template:', error);
      setError(`Erro ao criar agente: ${error.message}`);
    }
  };

  const handleCloneTemplate = (template) => {
    setTemplateToEdit({
      ...template,
      id: `template_clone_${Date.now()}`,
      name: `${template.name} (Cópia)`,
      author: 'Você',
      isPublic: false,
      downloads: 0
    });
    setShowCreateTemplate(true);
  };

  const handleDeleteTemplate = (templateId) => {
    if (confirm('Tem certeza que deseja excluir este template?')) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    }
  };

  const TemplateCard = ({ template, onView, onEdit, onClone, onUse, onDelete }) => {
    const categoryColors = {
      research: 'bg-blue-100 text-blue-800',
      finance: 'bg-green-100 text-green-800',
      marketing: 'bg-purple-100 text-purple-800',
      development: 'bg-orange-100 text-orange-800',
      support: 'bg-gray-100 text-gray-800',
      general: 'bg-indigo-100 text-indigo-800'
    };

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 group">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg text-white flex-shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 truncate">
                {template.name}
                {template.isFeatured && (
                  <Star className="w-4 h-4 text-yellow-500 fill-current flex-shrink-0" />
                )}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <User className="w-3 h-3" />
                <span>{template.author}</span>
                <span>•</span>
                <Clock className="w-3 h-3" />
                <span>{template.lastUpdated}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onView(template)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Ver detalhes"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => onClone(template)}
              className="p-1 text-gray-400 hover:text-green-600 rounded"
              title="Clonar"
            >
              <Copy className="w-4 h-4" />
            </button>
            {template.author === 'Você' && (
              <>
                <button
                  onClick={() => onEdit(template)}
                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(template.id)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Descrição */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5rem]">
          {template.description}
        </p>

        {/* Tags e Categoria */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${categoryColors[template.category] || categoryColors.general}`}>
            {categories.find(c => c.id === template.category)?.name || 'Geral'}
          </span>
          {template.tags.slice(0, 2).map(tag => (
            <span key={tag} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
              {tag}
            </span>
          ))}
          {template.tags.length > 2 && (
            <span className="text-xs text-gray-400">+{template.tags.length - 2}</span>
          )}
        </div>

        {/* Configurações */}
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <Brain className="w-3 h-3" />
            <span>{template.config.modelId}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            <span>{template.config.tools.length} tools</span>
          </div>
          {template.config.reasoningEnabled && (
            <div className="flex items-center gap-1 text-purple-500">
              <TrendingUp className="w-3 h-3" />
              <span>AI</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" />
              <span>{template.rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>{template.downloads.toLocaleString()}</span>
            </div>
          </div>
          {template.isPublic && (
            <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-[10px] font-medium">
              Público
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onUse(template)}
            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Usar Template
          </button>
          <button
            onClick={() => onView(template)}
            className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Ver
          </button>
        </div>
      </div>
    );
  };

  const TemplateModal = ({ template, onClose, onUse }) => {
    if (!template) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {template.name}
                {template.isFeatured && (
                  <Star className="w-5 h-5 text-yellow-500 fill-current" />
                )}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <User className="w-4 h-4" />
                <span>Por {template.author}</span>
                <span>•</span>
                <Star className="w-4 h-4 text-yellow-500" />
                <span>{template.rating.toFixed(1)}</span>
                <span>•</span>
                <Download className="w-4 h-4" />
                <span>{template.downloads.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Descrição */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Descrição</h3>
              <p className="text-gray-600">{template.description}</p>
            </div>

            {/* Tags */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {template.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Configuração */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Configuração</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Modelo:</span>
                    <div className="text-sm text-gray-600">{template.config.modelProvider} - {template.config.modelId}</div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Ferramentas:</span>
                    <div className="text-sm text-gray-600">{template.config.tools.join(', ') || 'Nenhuma'}</div>
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-700">Funcionalidades:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {template.config.memoryEnabled && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">Memória</span>
                    )}
                    {template.config.ragEnabled && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded">RAG</span>
                    )}
                    {template.config.reasoningEnabled && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded">Reasoning</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-700">Instruções:</span>
                  <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                    {template.config.instructions.map((instruction, index) => (
                      <div key={index} className="text-sm text-gray-600 bg-white p-2 rounded border">
                        {instruction}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Fechar
            </button>
            <button
              onClick={() => {
                onUse(template);
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Usar Template
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CreateTemplateModal = ({ onClose, onSave, editingTemplate }) => {
    const [formData, setFormData] = useState(editingTemplate || {
      name: '',
      description: '',
      category: 'general',
      tags: [],
      isPublic: false,
      config: {
        modelProvider: 'openai',
        modelId: 'gpt-4o',
        tools: [],
        instructions: [''],
        memoryEnabled: true,
        ragEnabled: false,
        reasoningEnabled: false
      }
    });

    const [tagInput, setTagInput] = useState('');
    const [saving, setSaving] = useState(false);

    const addTag = () => {
      if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, tagInput.trim()]
        }));
        setTagInput('');
      }
    };

    const removeTag = (tagToRemove) => {
      setFormData(prev => ({
        ...prev,
        tags: prev.tags.filter(tag => tag !== tagToRemove)
      }));
    };

    const handleSave = async () => {
      if (!formData.name || !formData.description || !formData.config.instructions[0]) {
        setError('Preencha todos os campos obrigatórios');
        return;
      }

      try {
        setSaving(true);

        const newTemplate = {
          ...formData,
          id: editingTemplate?.id || `template_custom_${Date.now()}`,
          author: 'Você',
          rating: 5.0,
          downloads: 0,
          lastUpdated: new Date().toISOString().split('T')[0],
          isPublic: formData.isPublic,
          isFeatured: false
        };

        if (editingTemplate) {
          setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? newTemplate : t));
        } else {
          setTemplates(prev => [...prev, newTemplate]);
        }

        onClose();
        setError(null);

      } catch (err) {
        setError(`Erro ao salvar template: ${err.message}`);
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            {editingTemplate ? 'Editar Template' : 'Criar Template de Agente'}
          </h2>

          <div className="space-y-6">
            {/* Informações básicas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Template *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Assistente de Marketing"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="general">Geral</option>
                  <option value="research">Pesquisa</option>
                  <option value="finance">Financeiro</option>
                  <option value="marketing">Marketing</option>
                  <option value="development">Desenvolvimento</option>
                  <option value="support">Suporte</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Descreva o propósito e funcionalidades do template..."
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite uma tag e pressione Enter"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Configuração do modelo */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Configuração do Agente</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provedor
                  </label>
                  <select
                    value={formData.config.modelProvider}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, modelProvider: e.target.value }
                    }))}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    value={formData.config.modelId}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, modelId: e.target.value }
                    }))}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {formData.config.modelProvider === 'openai' ? (
                      <>
                        <option key="openai-gpt-4o" value="gpt-4o">GPT-4o</option>
                        <option key="openai-gpt-4o-mini" value="gpt-4o-mini">GPT-4o Mini</option>
                        <option key="openai-gpt-3.5-turbo" value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </>
                    ) : (
                      <>
                        <option key="anthropic-claude-3-5-sonnet" value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                        <option key="anthropic-claude-3-haiku" value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ferramentas
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {['duckduckgo', 'yfinance', 'reasoning'].map(tool => (
                    <label key={`tool-${tool}`} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.config.tools.includes(tool)}
                        onChange={(e) => {
                          const tools = e.target.checked
                            ? [...formData.config.tools, tool]
                            : formData.config.tools.filter(t => t !== tool);
                          setFormData(prev => ({
                            ...prev,
                            config: { ...prev.config, tools }
                          }));
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm capitalize">{tool}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instruções do Agente *
                </label>
                <textarea
                  value={formData.config.instructions[0]}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    config: { ...prev.config, instructions: [e.target.value] }
                  }))}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="4"
                  placeholder="Descreva como o agente deve se comportar..."
                />
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.config.memoryEnabled}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, memoryEnabled: e.target.checked }
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Habilitar Memória</span>
                </label>

                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.config.ragEnabled}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, ragEnabled: e.target.checked }
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Habilitar RAG</span>
                </label>

                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.config.reasoningEnabled}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, reasoningEnabled: e.target.checked }
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Habilitar Reasoning</span>
                </label>
              </div>
            </div>

            {/* Visibilidade */}
            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Tornar template público</span>
                <span className="text-xs text-gray-500 ml-2">(outros usuários poderão usar)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Carregando Templates</h3>
          <p className="text-gray-500">Conectando com o backend...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg text-white">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Templates de Agentes</h1>
                <p className="text-sm text-gray-500">
                  {templates.length} templates disponíveis • Crie e use templates para acelerar o desenvolvimento
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadTemplatesAndAgents}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                onClick={() => setShowCreateTemplate(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Novo Template
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } border border-gray-200`}
              >
                {category.name} ({category.count})
              </button>
            ))}
          </div>
        </div>

        {/* Grid de templates */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onView={setSelectedTemplate}
              onEdit={(template) => {
                setTemplateToEdit(template);
                setShowCreateTemplate(true);
              }}
              onClone={handleCloneTemplate}
              onUse={handleUseTemplate}
              onDelete={handleDeleteTemplate}
            />
          ))}
        </div>

        {filteredTemplates.length === 0 && !loading && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum template encontrado
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || selectedCategory !== 'all'
                ? 'Tente ajustar os filtros de busca.'
                : 'Crie seu primeiro template para acelerar o desenvolvimento.'}
            </p>
            <button
              onClick={() => setShowCreateTemplate(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Criar Template
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedTemplate && (
        <TemplateModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onUse={handleUseTemplate}
        />
      )}

      {showCreateTemplate && (
        <CreateTemplateModal
          editingTemplate={templateToEdit}
          onClose={() => {
            setShowCreateTemplate(false);
            setTemplateToEdit(null);
          }}
          onSave={(templateData) => {
            console.log('Template salvo:', templateData);
          }}
        />
      )}
    </div>
  );
};

export default AgentTemplatesReal;
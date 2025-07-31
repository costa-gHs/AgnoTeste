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
  MessageSquare
} from 'lucide-react';

const AgentTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateToEdit, setTemplateToEdit] = useState(null);

  // Mock data para demonstração
  useEffect(() => {
    setCategories([
      { id: 'all', name: 'Todos', count: 24 },
      { id: 'research', name: 'Pesquisa', count: 8 },
      { id: 'finance', name: 'Financeiro', count: 6 },
      { id: 'marketing', name: 'Marketing', count: 4 },
      { id: 'development', name: 'Desenvolvimento', count: 3 },
      { id: 'support', name: 'Suporte', count: 3 }
    ]);

    setTemplates([
      {
        id: 'tpl_001',
        name: 'Assistente de Pesquisa Acadêmica',
        description: 'Especializado em pesquisa acadêmica com citações e análise crítica',
        category: 'research',
        author: 'Sistema',
        isPublic: true,
        isFeatured: true,
        rating: 4.8,
        downloads: 2847,
        lastUpdated: '2025-01-28',
        tags: ['pesquisa', 'acadêmico', 'citações'],
        config: {
          modelProvider: 'openai',
          modelId: 'gpt-4o',
          tools: ['duckduckgo', 'reasoning'],
          instructions: [
            'Você é um assistente de pesquisa acadêmica especializado.',
            'Sempre cite suas fontes e forneça análise crítica.',
            'Use formatação acadêmica apropriada.'
          ],
          memoryEnabled: true,
          ragEnabled: true,
          reasoningEnabled: true
        }
      },
      {
        id: 'tpl_002',
        name: 'Analista Financeiro Avançado',
        description: 'Análise financeira completa com dados de mercado em tempo real',
        category: 'finance',
        author: 'user_123',
        isPublic: true,
        isFeatured: true,
        rating: 4.9,
        downloads: 1923,
        lastUpdated: '2025-01-27',
        tags: ['finanças', 'mercado', 'análise'],
        config: {
          modelProvider: 'anthropic',
          modelId: 'claude-3-sonnet',
          tools: ['yfinance', 'reasoning'],
          instructions: [
            'Você é um analista financeiro com expertise em mercados.',
            'Forneça insights detalhados com disclaimers apropriados.',
            'Use gráficos e tabelas para apresentar dados.'
          ],
          memoryEnabled: true,
          ragEnabled: false,
          reasoningEnabled: true
        }
      },
      {
        id: 'tpl_003',
        name: 'Especialista em Marketing Digital',
        description: 'Estratégias de marketing digital e análise de campanhas',
        category: 'marketing',
        author: 'user_456',
        isPublic: true,
        isFeatured: false,
        rating: 4.6,
        downloads: 1456,
        lastUpdated: '2025-01-26',
        tags: ['marketing', 'digital', 'campanhas'],
        config: {
          modelProvider: 'openai',
          modelId: 'gpt-4o-mini',
          tools: ['duckduckgo', 'reasoning'],
          instructions: [
            'Você é um especialista em marketing digital.',
            'Foque em estratégias práticas e mensuráveis.',
            'Considere as últimas tendências e melhores práticas.'
          ],
          memoryEnabled: true,
          ragEnabled: true,
          reasoningEnabled: false
        }
      },
      {
        id: 'tpl_004',
        name: 'Assistente de Código Python',
        description: 'Desenvolvimento e debug de código Python com boas práticas',
        category: 'development',
        author: 'Sistema',
        isPublic: true,
        isFeatured: false,
        rating: 4.7,
        downloads: 3201,
        lastUpdated: '2025-01-25',
        tags: ['python', 'código', 'debug'],
        config: {
          modelProvider: 'openai',
          modelId: 'gpt-4o',
          tools: ['reasoning'],
          instructions: [
            'Você é um assistente de programação Python.',
            'Forneça código limpo e bem documentado.',
            'Explique conceitos complexos de forma simples.'
          ],
          memoryEnabled: true,
          ragEnabled: false,
          reasoningEnabled: true
        }
      }
    ]);
  }, []);

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const TemplateCard = ({ template, onView, onEdit, onClone, onUse }) => {
    const categoryColors = {
      research: 'bg-blue-100 text-blue-800',
      finance: 'bg-green-100 text-green-800',
      marketing: 'bg-purple-100 text-purple-800',
      development: 'bg-orange-100 text-orange-800',
      support: 'bg-gray-100 text-gray-800'
    };

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                {template.name}
                {template.isFeatured && (
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                )}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <User className="w-3 h-3" />
                <span>{template.author}</span>
                <span>•</span>
                <Clock className="w-3 h-3" />
                <span>{template.lastUpdated}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onView(template)}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Ver detalhes"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(template)}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="Editar"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onClone(template)}
              className="p-1 text-gray-400 hover:text-green-600"
              title="Clonar"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Descrição */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {template.description}
        </p>

        {/* Tags e Categoria */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${categoryColors[template.category]}`}>
            {categories.find(c => c.id === template.category)?.name}
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
              <span>Reasoning</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-4">
            <span>⭐ {template.rating}</span>
            <span>📥 {template.downloads.toLocaleString()}</span>
          </div>
          {template.isPublic && (
            <span className="bg-green-100 text-green-600 px-2 py-1 rounded">
              Público
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onUse(template)}
            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Usar Template
          </button>
          <button
            onClick={() => onView(template)}
            className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
          >
            Visualizar
          </button>
        </div>
      </div>
    );
  };

  const TemplateModal = ({ temple, onClose, onUse }) => {
    if (!temple) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {temple.name}
                {temple.isFeatured && (
                  <Star className="w-5 h-5 text-yellow-500 fill-current" />
                )}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <User className="w-4 h-4" />
                <span>Por {temple.author}</span>
                <span>•</span>
                <span>⭐ {temple.rating}</span>
                <span>•</span>
                <span>📥 {temple.downloads.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* Descrição */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Descrição</h3>
              <p className="text-gray-600">{temple.description}</p>
            </div>

            {/* Tags */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {temple.tags.map(tag => (
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Modelo:</span>
                    <div className="text-sm text-gray-600">{temple.config.modelProvider} - {temple.config.modelId}</div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Ferramentas:</span>
                    <div className="text-sm text-gray-600">{temple.config.tools.join(', ')}</div>
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-700">Funcionalidades:</span>
                  <div className="flex gap-2 mt-1">
                    {temple.config.memoryEnabled && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">Memória</span>
                    )}
                    {temple.config.ragEnabled && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded">RAG</span>
                    )}
                    {temple.config.reasoningEnabled && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded">Reasoning</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-700">Instruções:</span>
                  <div className="mt-1 space-y-1">
                    {temple.config.instructions.map((instruction, index) => (
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
              onClick={() => onUse(temple)}
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

  const CreateTemplateModal = ({ onClose, onSave }) => {
    const [formData, setFormData] = useState({
      name: '',
      description: '',
      category: 'research',
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

    const handleSave = () => {
      console.log('Salvando template:', formData);
      onSave(formData);
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Criar Template de Agente
          </h2>

          <div className="space-y-6">
            {/* Informações básicas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Template
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
                Descrição
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
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite uma tag e pressione Enter"
                />
                <button
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
                      onClick={() => removeTag(tag)}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Configuração do modelo */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Configuração do Agente</h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
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
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </>
                    ) : (
                      <>
                        <option value="claude-3-opus">Claude 3 Opus</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="claude-3-haiku">Claude 3 Haiku</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ferramentas
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['duckduckgo', 'yfinance', 'reasoning'].map(tool => (
                    <label key={tool} className="flex items-center">
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
                  Instruções do Agente
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

              <div className="flex items-center gap-6">
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
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Criar Template
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleUseTemplate = (template) => {
    console.log('Usando template:', template);
    // Aqui navegaria para o criador de agente com o template pré-preenchido
  };

  const handleCloneTemplate = (template) => {
    console.log('Clonando template:', template);
    // Criar uma cópia do template para edição
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg text-white">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Templates de Agentes</h1>
                <p className="text-sm text-gray-500">Crie e use templates para acelerar o desenvolvimento</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Importar
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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
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

          <div className="flex gap-2 overflow-x-auto">
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
              onEdit={setTemplateToEdit}
              onClone={handleCloneTemplate}
              onUse={handleUseTemplate}
            />
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum template encontrado
            </h3>
            <p className="text-gray-500 mb-4">
              Tente ajustar os filtros ou criar um novo template.
            </p>
            <button
              onClick={() => setShowCreateTemplate(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Criar Primeiro Template
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedTemplate && (
        <TemplateModal
          temple={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onUse={handleUseTemplate}
        />
      )}

      {showCreateTemplate && (
        <CreateTemplateModal
          onClose={() => setShowCreateTemplate(false)}
          onSave={(templateData) => {
            // Aqui salvaria o template via API
            console.log('Template criado:', templateData);
          }}
        />
      )}
    </div>
  );
};

export default AgentTemplates;
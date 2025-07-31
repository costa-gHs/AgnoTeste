import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Save,
  X,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Copy,
  Upload,
  Download,
  Settings,
  Zap,
  Brain,
  Code,
  Globe,
  Database,
  FileText,
  Calculator,
  Image,
  Music,
  Video,
  Mail,
  Calendar,
  MapPin,
  ShoppingCart,
  CreditCard,
  Smartphone,
  Wifi,
  Lock,
  Shield,
  AlertCircle,
  CheckCircle,
  Info,
  Loader,
  Eye,
  EyeOff
} from 'lucide-react';

// Mock de categorias e ferramentas disponíveis
const TOOL_CATEGORIES = {
  web: {
    name: 'Web & APIs',
    icon: Globe,
    color: 'blue',
    tools: [
      { id: 'web_search', name: 'Web Search', description: 'Busca na web em tempo real', required_config: [] },
      { id: 'web_scraping', name: 'Web Scraping', description: 'Extração de dados de páginas web', required_config: ['target_domains'] },
      { id: 'api_client', name: 'API Client', description: 'Cliente genérico para APIs REST', required_config: ['base_url', 'auth_token'] },
      { id: 'rss_reader', name: 'RSS Reader', description: 'Leitor de feeds RSS', required_config: [] },
      { id: 'webhook', name: 'Webhook', description: 'Receber notificações via webhook', required_config: ['endpoint_url'] }
    ]
  },
  code: {
    name: 'Código & Desenvolvimento',
    icon: Code,
    color: 'green',
    tools: [
      { id: 'code_interpreter', name: 'Code Interpreter', description: 'Executar código Python, JavaScript, etc.', required_config: ['allowed_languages'] },
      { id: 'git_client', name: 'Git Client', description: 'Interação com repositórios Git', required_config: ['repo_url', 'access_token'] },
      { id: 'docker_manager', name: 'Docker Manager', description: 'Gerenciar containers Docker', required_config: ['docker_host'] },
      { id: 'code_analyzer', name: 'Code Analyzer', description: 'Análise estática de código', required_config: [] },
      { id: 'package_manager', name: 'Package Manager', description: 'Gerenciar dependências de projetos', required_config: ['package_manager_type'] }
    ]
  },
  data: {
    name: 'Dados & Analytics',
    icon: Database,
    color: 'purple',
    tools: [
      { id: 'sql_executor', name: 'SQL Executor', description: 'Executar consultas SQL', required_config: ['connection_string'] },
      { id: 'csv_processor', name: 'CSV Processor', description: 'Processar arquivos CSV', required_config: [] },
      { id: 'data_visualizer', name: 'Data Visualizer', description: 'Criar gráficos e visualizações', required_config: [] },
      { id: 'excel_reader', name: 'Excel Reader', description: 'Ler arquivos Excel/XLSX', required_config: [] },
      { id: 'json_processor', name: 'JSON Processor', description: 'Processar dados JSON', required_config: [] }
    ]
  },
  files: {
    name: 'Arquivos & Documentos',
    icon: FileText,
    color: 'orange',
    tools: [
      { id: 'file_manager', name: 'File Manager', description: 'Gerenciar arquivos e pastas', required_config: ['base_path'] },
      { id: 'pdf_reader', name: 'PDF Reader', description: 'Ler e extrair texto de PDFs', required_config: [] },
      { id: 'word_processor', name: 'Word Processor', description: 'Processar documentos Word', required_config: [] },
      { id: 'image_analyzer', name: 'Image Analyzer', description: 'Analisar e processar imagens', required_config: [] },
      { id: 'document_converter', name: 'Document Converter', description: 'Converter entre formatos', required_config: [] }
    ]
  },
  communication: {
    name: 'Comunicação',
    icon: Mail,
    color: 'indigo',
    tools: [
      { id: 'email_client', name: 'Email Client', description: 'Enviar e receber emails', required_config: ['smtp_server', 'imap_server', 'credentials'] },
      { id: 'slack_bot', name: 'Slack Bot', description: 'Integração com Slack', required_config: ['bot_token', 'channel'] },
      { id: 'telegram_bot', name: 'Telegram Bot', description: 'Bot para Telegram', required_config: ['bot_token'] },
      { id: 'whatsapp_api', name: 'WhatsApp API', description: 'Integração com WhatsApp Business', required_config: ['api_key', 'phone_number'] },
      { id: 'sms_sender', name: 'SMS Sender', description: 'Enviar SMS', required_config: ['provider_api_key'] }
    ]
  },
  productivity: {
    name: 'Produtividade',
    icon: Calendar,
    color: 'teal',
    tools: [
      { id: 'calendar_manager', name: 'Calendar Manager', description: 'Gerenciar eventos de calendário', required_config: ['calendar_provider'] },
      { id: 'task_manager', name: 'Task Manager', description: 'Gerenciar tarefas e to-dos', required_config: [] },
      { id: 'note_taker', name: 'Note Taker', description: 'Criar e organizar notas', required_config: [] },
      { id: 'time_tracker', name: 'Time Tracker', description: 'Rastrear tempo gasto em atividades', required_config: [] },
      { id: 'project_manager', name: 'Project Manager', description: 'Gerenciar projetos e milestones', required_config: [] }
    ]
  },
  ecommerce: {
    name: 'E-commerce & Vendas',
    icon: ShoppingCart,
    color: 'pink',
    tools: [
      { id: 'shopify_api', name: 'Shopify API', description: 'Integração com Shopify', required_config: ['store_url', 'api_key'] },
      { id: 'payment_processor', name: 'Payment Processor', description: 'Processar pagamentos', required_config: ['payment_gateway'] },
      { id: 'inventory_manager', name: 'Inventory Manager', description: 'Gerenciar estoque', required_config: [] },
      { id: 'price_monitor', name: 'Price Monitor', description: 'Monitorar preços de produtos', required_config: ['target_sites'] },
      { id: 'sales_analytics', name: 'Sales Analytics', description: 'Análise de vendas e métricas', required_config: [] }
    ]
  },
  security: {
    name: 'Segurança & Autenticação',
    icon: Shield,
    color: 'red',
    tools: [
      { id: 'password_manager', name: 'Password Manager', description: 'Gerenciar senhas seguras', required_config: ['encryption_key'] },
      { id: 'two_factor_auth', name: 'Two Factor Auth', description: 'Autenticação de dois fatores', required_config: [] },
      { id: 'security_scanner', name: 'Security Scanner', description: 'Scanner de vulnerabilidades', required_config: [] },
      { id: 'encryption_tool', name: 'Encryption Tool', description: 'Criptografar/descriptografar dados', required_config: ['encryption_method'] },
      { id: 'audit_logger', name: 'Audit Logger', description: 'Log de auditoria e compliance', required_config: ['log_destination'] }
    ]
  }
};

const MODEL_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Modelo mais avançado, multimodal' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Versão eficiente do GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'GPT-4 com contexto estendido' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Modelo rápido e econômico' }
    ]
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Modelo mais poderoso da Anthropic' },
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', description: 'Equilíbrio entre performance e custo' },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Modelo rápido e eficiente' }
    ]
  },
  google: {
    name: 'Google',
    models: [
      { id: 'gemini-pro', name: 'Gemini Pro', description: 'Modelo avançado do Google' },
      { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', description: 'Gemini com capacidades visuais' }
    ]
  }
};

const CreateAgentInterface = ({ onClose, onSave, isOpen = true }) => {
  // Estados do formulário
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    description: '',
    model_provider: 'openai',
    model_id: 'gpt-4o-mini',
    instructions: [''],
    tools: [],
    tool_configs: {},
    memory_enabled: true,
    rag_enabled: false,
    rag_index_id: '',
    max_tokens: 4000,
    temperature: 0.7,
    top_p: 1.0,
    frequency_penalty: 0,
    presence_penalty: 0,
    tags: []
  });

  // Estados da interface
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedCategory, setSelectedCategory] = useState('web');
  const [toolSearchTerm, setToolSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(['web', 'code']);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Validação do formulário
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!formData.role.trim()) {
      newErrors.role = 'Papel/função é obrigatório';
    }

    if (formData.instructions.length === 0 || !formData.instructions[0].trim()) {
      newErrors.instructions = 'Pelo menos uma instrução é obrigatória';
    }

    // Validar configurações de ferramentas
    formData.tools.forEach(toolId => {
      const tool = Object.values(TOOL_CATEGORIES)
        .flatMap(cat => cat.tools)
        .find(t => t.id === toolId);

      if (tool && tool.required_config) {
        tool.required_config.forEach(configKey => {
          if (!formData.tool_configs[toolId]?.[configKey]) {
            newErrors[`tool_${toolId}_${configKey}`] = `Configuração ${configKey} é obrigatória para ${tool.name}`;
          }
        });
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Funções de manipulação do formulário
  const updateFormData = useCallback((path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });
  }, []);

  const addInstruction = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      instructions: [...prev.instructions, '']
    }));
  }, []);

  const removeInstruction = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index)
    }));
  }, []);

  const updateInstruction = useCallback((index, value) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.map((inst, i) => i === index ? value : inst)
    }));
  }, []);

  const toggleTool = useCallback((toolId) => {
    setFormData(prev => {
      const isSelected = prev.tools.includes(toolId);
      const newTools = isSelected
        ? prev.tools.filter(id => id !== toolId)
        : [...prev.tools, toolId];

      // Se removendo a ferramenta, remover também suas configurações
      const newToolConfigs = { ...prev.tool_configs };
      if (isSelected) {
        delete newToolConfigs[toolId];
      }

      return {
        ...prev,
        tools: newTools,
        tool_configs: newToolConfigs
      };
    });
  }, []);

  const updateToolConfig = useCallback((toolId, configKey, value) => {
    setFormData(prev => ({
      ...prev,
      tool_configs: {
        ...prev.tool_configs,
        [toolId]: {
          ...prev.tool_configs[toolId],
          [configKey]: value
        }
      }
    }));
  }, []);

  const toggleCategory = useCallback((categoryId) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const cleanData = {
        ...formData,
        instructions: formData.instructions.filter(inst => inst.trim()),
        tags: formData.tags.filter(tag => tag.trim())
      };

      await onSave?.(cleanData);
      onClose?.();
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm, onSave, onClose]);

  const loadTemplate = useCallback((template) => {
    setFormData(prev => ({
      ...prev,
      ...template,
      instructions: Array.isArray(template.instructions) ? template.instructions : [template.instructions]
    }));
  }, []);

  const exportConfig = useCallback(() => {
    const configBlob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(configBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-config-${formData.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [formData]);

  // Filtrar ferramentas por busca
  const filteredTools = useCallback((categoryId) => {
    const category = TOOL_CATEGORIES[categoryId];
    if (!category) return [];

    return category.tools.filter(tool =>
      tool.name.toLowerCase().includes(toolSearchTerm.toLowerCase()) ||
      tool.description.toLowerCase().includes(toolSearchTerm.toLowerCase())
    );
  }, [toolSearchTerm]);

  const selectedModel = MODEL_PROVIDERS[formData.model_provider]?.models.find(
    m => m.id === formData.model_id
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Criar Novo Assistente</h1>
                <p className="text-sm text-gray-500">Configure seu assistente personalizado com ferramentas específicas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {formData.name && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  Preview
                </button>
              )}
              <button
                onClick={exportConfig}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                title="Exportar configuração"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex mt-4 border-b border-gray-200">
            {[
              { id: 'basic', name: 'Configuração Básica', icon: Settings },
              { id: 'tools', name: 'Ferramentas', icon: Zap },
              { id: 'advanced', name: 'Avançado', icon: Brain }
            ].map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Main Form */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Errors */}
            {Object.keys(errors).length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <h3 className="font-medium text-red-800">Corrija os seguintes erros:</h3>
                </div>
                <ul className="text-sm text-red-700 space-y-1">
                  {Object.entries(errors).map(([key, error]) => (
                    <li key={key}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'basic' && (
              <div className="space-y-6">
                {/* Informações Básicas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do Assistente *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateFormData('name', e.target.value)}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Assistente de Vendas"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Papel/Função *
                    </label>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={(e) => updateFormData('role', e.target.value)}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.role ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Especialista em vendas e atendimento ao cliente"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Descreva o que este assistente faz..."
                  />
                </div>

                {/* Modelo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provider
                    </label>
                    <select
                      value={formData.model_provider}
                      onChange={(e) => {
                        updateFormData('model_provider', e.target.value);
                        updateFormData('model_id', MODEL_PROVIDERS[e.target.value].models[0].id);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {Object.entries(MODEL_PROVIDERS).map(([key, provider]) => (
                        <option key={key} value={key}>{provider.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Modelo
                    </label>
                    <select
                      value={formData.model_id}
                      onChange={(e) => updateFormData('model_id', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {MODEL_PROVIDERS[formData.model_provider].models.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                    {selectedModel && (
                      <p className="text-xs text-gray-500 mt-1">{selectedModel.description}</p>
                    )}
                  </div>
                </div>

                {/* Instruções */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instruções do Sistema *
                  </label>
                  {formData.instructions.map((instruction, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <textarea
                        value={instruction}
                        onChange={(e) => updateInstruction(index, e.target.value)}
                        rows={2}
                        className={`flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.instructions ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Ex: Você é um assistente especializado em..."
                      />
                      {formData.instructions.length > 1 && (
                        <button
                          onClick={() => removeInstruction(index)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addInstruction}
                    className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Instrução
                  </button>
                </div>

                {/* Templates */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Templates Rápidos
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        name: 'Atendimento ao Cliente',
                        role: 'Especialista em atendimento ao cliente',
                        instructions: ['Você é um assistente especializado em atendimento ao cliente', 'Sempre seja educado e prestativo', 'Busque resolver problemas de forma eficiente']
                      },
                      {
                        name: 'Desenvolvedor',
                        role: 'Desenvolvedor de software experiente',
                        instructions: ['Você é um desenvolvedor experiente', 'Forneça código limpo e bem documentado', 'Explique suas soluções de forma clara']
                      },
                      {
                        name: 'Analista de Dados',
                        role: 'Analista de dados e business intelligence',
                        instructions: ['Você é um analista de dados experiente', 'Forneça insights baseados em dados', 'Crie visualizações claras e úteis']
                      }
                    ].map((template, index) => (
                      <button
                        key={index}
                        onClick={() => loadTemplate(template)}
                        className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{template.role}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="space-y-6">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar ferramentas..."
                    value={toolSearchTerm}
                    onChange={(e) => setToolSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Selected Tools Summary */}
                {formData.tools.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-2">
                      Ferramentas Selecionadas ({formData.tools.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {formData.tools.map(toolId => {
                        const tool = Object.values(TOOL_CATEGORIES)
                          .flatMap(cat => cat.tools)
                          .find(t => t.id === toolId);
                        return (
                          <span
                            key={toolId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                          >
                            {tool?.name}
                            <button
                              onClick={() => toggleTool(toolId)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tool Categories */}
                <div className="space-y-4">
                  {Object.entries(TOOL_CATEGORIES).map(([categoryId, category]) => {
                    const IconComponent = category.icon;
                    const tools = filteredTools(categoryId);
                    const isExpanded = expandedCategories.includes(categoryId);
                    const selectedInCategory = formData.tools.filter(toolId =>
                      tools.some(tool => tool.id === toolId)
                    ).length;

                    if (toolSearchTerm && tools.length === 0) return null;

                    return (
                      <div key={categoryId} className="border border-gray-200 rounded-lg">
                        <button
                          onClick={() => toggleCategory(categoryId)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <IconComponent className={`w-5 h-5 text-${category.color}-500`} />
                            <h3 className="font-medium text-gray-900">{category.name}</h3>
                            {selectedInCategory > 0 && (
                              <span className={`px-2 py-1 bg-${category.color}-100 text-${category.color}-800 text-xs rounded-full`}>
                                {selectedInCategory} selecionada{selectedInCategory > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-gray-200 p-4 space-y-3">
                            {tools.map(tool => {
                              const isSelected = formData.tools.includes(tool.id);
                              return (
                                <div key={tool.id} className="border border-gray-100 rounded-lg p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleTool(tool.id)}
                                          className="rounded"
                                        />
                                        <div>
                                          <h4 className="font-medium text-gray-900">{tool.name}</h4>
                                          <p className="text-sm text-gray-600">{tool.description}</p>
                                        </div>
                                      </div>

                                      {/* Tool Configuration */}
                                      {isSelected && tool.required_config && tool.required_config.length > 0 && (
                                        <div className="mt-3 ml-6 space-y-2">
                                          <h5 className="text-sm font-medium text-gray-700">Configuração:</h5>
                                          {tool.required_config.map(configKey => (
                                            <div key={configKey}>
                                              <label className="block text-xs text-gray-600 mb-1">
                                                {configKey.replace(/_/g, ' ').toUpperCase()}
                                              </label>
                                              <input
                                                type="text"
                                                value={formData.tool_configs[tool.id]?.[configKey] || ''}
                                                onChange={(e) => updateToolConfig(tool.id, configKey, e.target.value)}
                                                className={`w-full p-2 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent ${
                                                  errors[`tool_${tool.id}_${configKey}`] ? 'border-red-300' : 'border-gray-300'
                                                }`}
                                                placeholder={`Digite ${configKey}...`}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-6">
                {/* Configurações de Modelo */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Parâmetros do Modelo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        value={formData.max_tokens}
                        onChange={(e) => updateFormData('max_tokens', parseInt(e.target.value))}
                        min="1"
                        max="8000"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Máximo de tokens na resposta</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Temperature: {formData.temperature}
                      </label>
                      <input
                        type="range"
                        value={formData.temperature}
                        onChange={(e) => updateFormData('temperature', parseFloat(e.target.value))}
                        min="0"
                        max="2"
                        step="0.1"
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">Controla a criatividade (0 = mais focado, 2 = mais criativo)</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Top P: {formData.top_p}
                      </label>
                      <input
                        type="range"
                        value={formData.top_p}
                        onChange={(e) => updateFormData('top_p', parseFloat(e.target.value))}
                        min="0"
                        max="1"
                        step="0.05"
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">Controla a diversidade do vocabulário</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Frequency Penalty: {formData.frequency_penalty}
                      </label>
                      <input
                        type="range"
                        value={formData.frequency_penalty}
                        onChange={(e) => updateFormData('frequency_penalty', parseFloat(e.target.value))}
                        min="-2"
                        max="2"
                        step="0.1"
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">Penaliza repetição de tokens</p>
                    </div>
                  </div>
                </div>

                {/* Recursos Avançados */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recursos Avançados</h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.memory_enabled}
                        onChange={(e) => updateFormData('memory_enabled', e.target.checked)}
                        className="rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900">Memória Conversacional</span>
                        <p className="text-sm text-gray-600">Manter contexto entre conversas</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.rag_enabled}
                        onChange={(e) => updateFormData('rag_enabled', e.target.checked)}
                        className="rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900">RAG (Retrieval Augmented Generation)</span>
                        <p className="text-sm text-gray-600">Busca em base de conhecimento personalizada</p>
                      </div>
                    </label>

                    {formData.rag_enabled && (
                      <div className="ml-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ID do Índice RAG
                        </label>
                        <input
                          type="text"
                          value={formData.rag_index_id}
                          onChange={(e) => updateFormData('rag_index_id', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ex: my-knowledge-base-v1"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    value={formData.tags.join(', ')}
                    onChange={(e) => updateFormData('tags', e.target.value.split(',').map(tag => tag.trim()))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: vendas, atendimento, e-commerce"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="w-80 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
              <h3 className="font-medium text-gray-900 mb-4">Preview do Assistente</h3>

              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{formData.name || 'Sem Nome'}</h4>
                    <p className="text-sm text-gray-600">{formData.role || 'Sem Função'}</p>
                  </div>
                </div>

                {formData.description && (
                  <p className="text-sm text-gray-700 mb-3">{formData.description}</p>
                )}

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Modelo:</span>
                    <span className="text-gray-900">{selectedModel?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ferramentas:</span>
                    <span className="text-gray-900">{formData.tools.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Instruções:</span>
                    <span className="text-gray-900">{formData.instructions.filter(i => i.trim()).length}</span>
                  </div>
                </div>

                {formData.tools.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Ferramentas:</p>
                    <div className="flex flex-wrap gap-1">
                      {formData.tools.slice(0, 5).map(toolId => {
                        const tool = Object.values(TOOL_CATEGORIES)
                          .flatMap(cat => cat.tools)
                          .find(t => t.id === toolId);
                        return (
                          <span key={toolId} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {tool?.name}
                          </span>
                        );
                      })}
                      {formData.tools.length > 5 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{formData.tools.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {formData.tools.length} ferramenta{formData.tools.length !== 1 ? 's' : ''} selecionada{formData.tools.length !== 1 ? 's' : ''}
              </span>
              {Object.keys(errors).length > 0 && (
                <span className="text-sm text-red-600">
                  {Object.keys(errors).length} erro{Object.keys(errors).length !== 1 ? 's' : ''} encontrado{Object.keys(errors).length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading || Object.keys(errors).length > 0}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Criar Assistente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAgentInterface;
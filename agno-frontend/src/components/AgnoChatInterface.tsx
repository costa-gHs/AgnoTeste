// src/components/AgnoChatInterface.tsx
// Interface de Chat com PARSER MELHORADO para separar eventos corretamente

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Bot, User, Loader, Settings, RefreshCw, Square,
  Wrench, Copy, Download, AlertCircle, CheckCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

// =============================================
// TIPOS TYPESCRIPT
// =============================================
interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'tool_call';
  content: string;
  timestamp: Date;
  streaming?: boolean;
  metadata?: {
    tool_name?: string;
    execution_time?: number;
    model_used?: string;
    tokens_used?: number;
    tools_used?: string[];
  };
}

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

// Interface para eventos processados
interface ProcessedEvent {
  type: 'tool_call' | 'tool_completed' | 'content' | 'ignore';
  tool_name?: string;
  tool_args?: any;
  execution_time?: number;
  content?: string;
}

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
const AgnoChatInterface: React.FC = () => {
  // Estados principais
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  // Estados de controle
  const [streamController, setStreamController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const USER_ID = 1;

  // =============================================
  // FUNÇÕES UTILITÁRIAS
  // =============================================
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const addLog = useCallback((level: 'info' | 'success' | 'error', message: string) => {
    console.log(`[${level.toUpperCase()}] ${message}`);
  }, []);

  // Parser MELHORADO para separar eventos do backend
  const parseEventContent = (content: string): ProcessedEvent[] => {
    const events: ProcessedEvent[] = [];

    // Se o conteúdo é muito pequeno (provavelmente um token de streaming), tratar como conteúdo direto
    if (content.length <= 2 && !content.includes('Event') && !content.includes('completed')) {
      return [{
        type: 'content',
        content: content
      }];
    }

    // Regex patterns para identificar diferentes tipos de eventos
    const patterns = {
      toolCallStarted: /ToolCallStartedEvent\([^)]+tool_name='([^']+)'[^)]+tool_args=(\{[^}]+\}|\{[^}]*\})[^)]*\)/g,
      toolCompleted: /(\w+)\([^)]*\) completed in ([\d.]+)s\./g,
      responseEvent: /RunResponseContentEvent\([^)]+\)/g
    };

    let remainingContent = content;

    // 1. Extrair tool calls iniciados
    let match;
    while ((match = patterns.toolCallStarted.exec(content)) !== null) {
      const toolName = match[1];
      let toolArgs = {};

      try {
        // Tentar parsear os argumentos
        const argsStr = match[2].replace(/'/g, '"');
        toolArgs = JSON.parse(argsStr);
      } catch (e) {
        // Se falhar, extrair manualmente
        const symbolMatch = match[2].match(/symbol['":\s]*['"]([^'"]+)['"]/);
        if (symbolMatch) {
          toolArgs = { symbol: symbolMatch[1] };
        }
      }

      events.push({
        type: 'tool_call',
        tool_name: toolName,
        tool_args: toolArgs
      });

      // Remover do conteúdo restante
      remainingContent = remainingContent.replace(match[0], '');
    }

    // 2. Extrair tool completions
    patterns.toolCompleted.lastIndex = 0;
    while ((match = patterns.toolCompleted.exec(content)) !== null) {
      const toolName = match[1];
      const executionTime = parseFloat(match[2]) * 1000; // converter para ms

      events.push({
        type: 'tool_completed',
        tool_name: toolName,
        execution_time: executionTime
      });

      // Remover do conteúdo restante
      remainingContent = remainingContent.replace(match[0], '');
    }

    // 3. Remover RunResponseContentEvent
    remainingContent = remainingContent.replace(patterns.responseEvent, '');

    // 4. Limpar conteúdo restante, mas preservar espaços importantes
    remainingContent = remainingContent
      .replace(/ToolCallStartedEvent\([^)]+\)/g, '')
      .replace(/RunResponseContentEvent\([^)]+\)/g, '')
      .replace(/\w+\([^)]*\) completed in [\d.]+s\./g, '');

    // 5. Se sobrou qualquer conteúdo (incluindo espaços), adicionar como content
    if (remainingContent.length > 0) {
      events.push({
        type: 'content',
        content: remainingContent
      });
    }

    return events;
  };

  // =============================================
  // FUNÇÕES DE API
  // =============================================
  const testConnection = useCallback(async () => {
    try {
      setConnectionStatus('connecting');
      addLog('info', '🔄 Testando conexão com backend...');

      const response = await fetch(`${API_BASE}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setConnectionStatus('connected');
      addLog('success', '✅ Backend conectado!');
      return { success: true, data };
    } catch (error) {
      setConnectionStatus('disconnected');
      addLog('error', `❌ Falha na conexão: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }, [API_BASE, addLog]);

  const loadAgents = useCallback(async () => {
    try {
      addLog('info', '📋 Carregando agentes...');

      const response = await fetch(`${API_BASE}/api/agents?user_id=${USER_ID}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setAgents(data);

      // Selecionar primeiro agente automaticamente
      if (data.length > 0 && !selectedAgent) {
        setSelectedAgent(data[0]);
      }

      addLog('success', `✅ ${data.length} agentes carregados`);
    } catch (error) {
      addLog('error', `❌ Erro ao carregar agentes: ${(error as Error).message}`);
    }
  }, [API_BASE, addLog, selectedAgent]);

  // =============================================
  // FUNÇÃO DE CHAT COM STREAMING APRIMORADO
  // =============================================
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isStreaming || !selectedAgent) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsStreaming(true);

    // Criar mensagem do assistente vazia para streaming
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Criar AbortController para cancelar streaming
      const controller = new AbortController();
      setStreamController(controller);

      addLog('info', `💬 Iniciando chat com agente ${selectedAgent.id}...`);

      const response = await fetch(`${API_BASE}/api/agents/${selectedAgent.id}/chat?user_id=${USER_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ prompt: inputMessage.trim() }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Stream não disponível');
      }

      let accumulatedContent = '';
      const toolCallsSet = new Set<string>();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decodificar chunk e adicionar ao buffer
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;

        // Processar linhas completas
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Manter última linha incompleta no buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6);

            if (eventData.trim() === '[DONE]' || eventData.trim() === '') {
              continue;
            }

            try {
              const data = JSON.parse(eventData);

              console.log('🔍 Dados recebidos:', data);

              // Processar diferentes tipos de evento
              if (data.type === 'chunk' && data.content) {
                // Para chunks pequenos de streaming (tokens individuais), tratar diretamente
                if (data.content.length <= 3 && !data.content.includes('Event') && !data.content.includes('completed')) {
                  accumulatedContent += data.content;

                  // Atualizar mensagem do assistente em tempo real
                  setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent, streaming: true }
                      : msg
                  ));
                } else {
                  // Para chunks maiores, usar o parser de eventos
                  const processedEvents = parseEventContent(data.content);

                  console.log('🔍 Eventos processados:', processedEvents);

                  for (const event of processedEvents) {
                    if (event.type === 'tool_call' && event.tool_name) {
                      // Registrar ferramenta usada
                      toolCallsSet.add(event.tool_name);

                      // Criar mensagem de chamada de ferramenta
                      const toolCallMessage: ChatMessage = {
                        id: `tool-${Date.now()}-${Math.random()}`,
                        type: 'tool_call',
                        content: `🔧 **${event.tool_name}**\n\n**Parâmetros:**\n\`\`\`json\n${JSON.stringify(event.tool_args || {}, null, 2)}\n\`\`\``,
                        timestamp: new Date(),
                        metadata: {
                          tool_name: event.tool_name
                        }
                      };

                      // Inserir mensagem da ferramenta antes da mensagem do assistente
                      setMessages(prev => {
                        const assistantIndex = prev.findIndex(msg => msg.id === assistantMessageId);
                        if (assistantIndex > -1) {
                          const newMessages = [...prev];
                          newMessages.splice(assistantIndex, 0, toolCallMessage);
                          return newMessages;
                        }
                        return prev;
                      });
                    }
                    else if (event.type === 'tool_completed' && event.tool_name && event.execution_time) {
                      // Atualizar a mensagem da ferramenta com tempo de execução
                      setMessages(prev => prev.map(msg => {
                        if (msg.type === 'tool_call' && msg.metadata?.tool_name === event.tool_name) {
                          return {
                            ...msg,
                            metadata: {
                              ...msg.metadata,
                              execution_time: event.execution_time
                            }
                          };
                        }
                        return msg;
                      }));
                    }
                    else if (event.type === 'content' && event.content) {
                      // Preservar espaços ao concatenar conteúdo
                      accumulatedContent += event.content;

                      // Atualizar mensagem do assistente em tempo real
                      setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: accumulatedContent, streaming: true }
                          : msg
                      ));
                    }
                  }
                }
              }
              else if (data.type === 'done') {
                // Finalizar streaming
                const toolsUsed = Array.from(toolCallsSet);
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: accumulatedContent || 'Resposta processada.',
                        streaming: false,
                        metadata: {
                          model_used: selectedAgent.model_id,
                          tools_used: toolsUsed.length > 0 ? toolsUsed : undefined
                        }
                      }
                    : msg
                ));
                break;
              }
            } catch (e) {
              console.warn('Erro ao parsear JSON SSE:', line, e);
            }
          }
        }
      }

      // Finalizar streaming se não foi finalizado pelo evento 'done'
      const toolsUsed = Array.from(toolCallsSet);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId && msg.streaming
          ? {
              ...msg,
              content: accumulatedContent || 'Resposta processada.',
              streaming: false,
              metadata: {
                model_used: selectedAgent.model_id,
                tools_used: toolsUsed.length > 0 ? toolsUsed : undefined
              }
            }
          : msg
      ));

      addLog('success', '✅ Chat concluído com sucesso');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Stream cancelado pelo usuário
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: '⏹️ *Streaming cancelado pelo usuário*', streaming: false }
            : msg
        ));
        addLog('info', '⏸️ Streaming cancelado');
      } else {
        console.error('Erro no chat:', error);

        // Remover mensagem do assistente e adicionar erro
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          type: 'system',
          content: `❌ **Erro**: ${error.message}`,
          timestamp: new Date()
        };

        setMessages(prev => [
          ...prev.filter(msg => msg.id !== assistantMessageId),
          errorMessage
        ]);

        addLog('error', `❌ Erro no chat: ${error.message}`);
      }
    } finally {
      setIsStreaming(false);
      setStreamController(null);
    }
  }, [inputMessage, isStreaming, selectedAgent, API_BASE, addLog]);

  // =============================================
  // FUNÇÃO PARA RENDERIZAR MENSAGENS
  // =============================================
  const renderMessage = useCallback((message: ChatMessage) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const isToolCall = message.type === 'tool_call';

    // Renderização especial para chamadas de ferramentas
    if (isToolCall) {
      return (
        <div key={message.id} className="mx-4 mb-4">
          <details className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-sm" open>
            <summary className="cursor-pointer text-yellow-700 font-medium flex items-center gap-2 hover:text-yellow-800">
              <Wrench className="w-4 h-4" />
              <span>🔧 {message.metadata?.tool_name || 'Ferramenta'}</span>
              {message.metadata?.execution_time && (
                <span className="ml-auto text-xs text-gray-500 bg-white px-2 py-1 rounded">
                  ⏱️ {message.metadata.execution_time}ms
                </span>
              )}
            </summary>
            <div className="mt-3 border-t border-yellow-200 pt-3">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    code({ inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={tomorrow}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-md !mt-2 !mb-2"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={`${className} bg-yellow-100 text-yellow-800 px-1 rounded`} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          </details>
        </div>
      );
    }

    // Renderização padrão para outras mensagens
    return (
      <div
        key={message.id}
        className={`flex gap-3 p-4 rounded-lg mb-4 group ${
          isUser
            ? 'bg-blue-50 border border-blue-200 ml-12'
            : isSystem
            ? 'bg-gray-50 border border-gray-200'
            : 'bg-white border border-gray-200 mr-12 shadow-sm'
        }`}
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
            isUser
              ? 'bg-blue-500'
              : isSystem
              ? 'bg-gray-500'
              : 'bg-green-500'
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4" />
          ) : isSystem ? (
            <Settings className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-gray-900">
              {isUser ? 'Você' : isSystem ? 'Sistema' : 'Assistente'}
            </span>
            <span className="text-xs text-gray-500">
              {message.timestamp.toLocaleTimeString('pt-BR')}
            </span>
            {message.metadata?.model_used && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {message.metadata.model_used}
              </span>
            )}
            {message.streaming && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full animate-pulse">
                Digitando...
              </span>
            )}
          </div>

          {/* Conteúdo da mensagem com ReactMarkdown */}
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                code({ inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={tomorrow}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-md !mt-2 !mb-2"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={`${className} bg-gray-100 text-gray-800 px-1 rounded`} {...props}>
                      {children}
                    </code>
                  );
                },
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-200 pl-4 italic text-gray-700 my-2">
                    {children}
                  </blockquote>
                ),
                h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-md font-bold mb-2">{children}</h3>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                hr: () => <hr className="my-4 border-gray-200" />,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-blue-600 hover:text-blue-800 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                )
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Metadados da mensagem */}
          {message.metadata?.tools_used && message.metadata.tools_used.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Wrench className="w-3 h-3" />
                <span>Ferramentas usadas:</span>
                <div className="flex gap-1 flex-wrap">
                  {message.metadata.tools_used.map((tool, index) => (
                    <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botão de copiar */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(message.content);
            console.log('✅ Mensagem copiada para clipboard');
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity"
          title="Copiar mensagem"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    );
  }, []);

  // =============================================
  // FUNÇÕES DE CONTROLE
  // =============================================
  const cancelStreaming = useCallback(() => {
    if (streamController) {
      streamController.abort();
    }
  }, [streamController]);

  const clearChat = useCallback(() => {
    setMessages([{
      id: 'welcome-new',
      type: 'system',
      content: '🧹 **Chat limpo!** Você pode começar uma nova conversa.',
      timestamp: new Date()
    }]);
  }, []);

  // =============================================
  // EFFECTS
  // =============================================
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    // Inicializar conexão e carregar dados
    const init = async () => {
      await testConnection();
      await loadAgents();
    };

    init();

    // Mensagem de boas-vindas
    setMessages([{
      id: 'welcome',
      type: 'system',
      content: '🚀 **Agno Chat Interface** inicializado!\n\nSelecione um agente e comece a conversar. As ferramentas serão utilizadas automaticamente quando necessário.',
      timestamp: new Date()
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =============================================
  // AUTO-RESIZE DO TEXTAREA
  // =============================================
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);

    // Auto-resize
    e.target.style.height = 'auto';
    const scrollHeight = Math.min(e.target.scrollHeight, 120);
    e.target.style.height = scrollHeight + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // =============================================
  // RENDER PRINCIPAL
  // =============================================
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Agno Chat</h1>
              <p className="text-sm text-gray-500">
                {selectedAgent ? `${selectedAgent.name} • ${selectedAgent.model_provider}/${selectedAgent.model_id}` : 'Selecione um agente'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de agente */}
            <select
              value={selectedAgent?.id || ''}
              onChange={(e) => {
                const agent = agents.find(a => a.id === parseInt(e.target.value));
                setSelectedAgent(agent || null);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um agente</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.model_provider})
                </option>
              ))}
            </select>

            {/* Status da conexão */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              connectionStatus === 'connected' 
                ? 'bg-green-100 text-green-700'
                : connectionStatus === 'connecting'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {connectionStatus === 'connected' ? (
                <CheckCircle className="w-4 h-4" />
              ) : connectionStatus === 'connecting' ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span>{connectionStatus === 'connected' ? 'Conectado' : connectionStatus === 'connecting' ? 'Conectando' : 'Desconectado'}</span>
            </div>

            {/* Controles */}
            <div className="flex items-center gap-2">
              {isStreaming && (
                <button
                  onClick={cancelStreaming}
                  className="flex items-center gap-2 px-3 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Parar
                </button>
              )}

              <button
                onClick={clearChat}
                className="p-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                title="Limpar chat"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={testConnection}
                className="p-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                title="Testar conexão"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Área de mensagens */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {messages.map(renderMessage)}

        {/* Indicador de typing quando streaming */}
        {isStreaming && (
          <div className="flex items-center gap-3 text-gray-500 px-4 py-2">
            <Bot className="w-5 h-5 text-green-500" />
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
            <span className="text-sm">Processando e usando ferramentas...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Área de input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={selectedAgent ? "Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)" : "Selecione um agente primeiro"}
              className="w-full resize-none border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 transition-all"
              rows={1}
              style={{
                minHeight: '48px',
                maxHeight: '120px'
              }}
              disabled={isStreaming || !selectedAgent}
            />
          </div>

          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isStreaming || !selectedAgent}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
          >
            {isStreaming ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Dicas de uso */}
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          <span>💡 <strong>Dica:</strong> Peça para usar ferramentas específicas</span>
          <span>•</span>
          <span>🔧 <strong>Exemplo:</strong> "Pesquise notícias sobre IA"</span>
          <span>•</span>
          <span>📊 "Analise a ação AAPL"</span>
          {selectedAgent && (
            <>
              <span>•</span>
              <span>🛠️ <strong>Ferramentas:</strong> {selectedAgent.tools.join(', ')}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgnoChatInterface;
// src/components/AgnoChatInterface.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Loader, AlertCircle, Settings,
  Play, Pause, Square, Copy, Download, RefreshCw,
  Brain, Wrench, Globe, DollarSign, Image, Cloud
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Types
interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'tool_call';
  content: string;
  timestamp: Date;
  metadata?: {
    tool_name?: string;
    execution_time?: number;
    model_used?: string;
    tokens_used?: number;
  };
}

interface AgentConfig {
  model_provider: string;
  model_id: string;
  instructions?: string[];
  description?: string;
}

interface ToolConfig {
  tool_id: number;
  config: Record<string, any>;
  is_enabled: boolean;
}

const AgnoChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgentId] = useState(1); // Para demo

  // Configurações do agente
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    model_provider: 'openai',
    model_id: 'gpt-4o',
    instructions: ['Você é um assistente útil com acesso a ferramentas.'],
    description: 'Assistente IA com ferramentas Agno'
  });

  // Estado do streaming
  const [streamController, setStreamController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Scroll automático para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Adicionar mensagem do sistema inicial
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      type: 'system',
      content: '🚀 **Agno Chat Interface** inicializado!\n\nVocê pode conversar comigo e eu usarei as ferramentas configuradas automaticamente.',
      timestamp: new Date()
    }]);
  }, []);

  // Função para enviar mensagem
  const sendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsStreaming(true);

    // Criar mensagem assistente vazia para streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Criar AbortController para controlar o streaming
      const controller = new AbortController();
      setStreamController(controller);

      const response = await fetch(`${API_BASE}/api/agno/agents/${currentAgentId}/execute/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_config: agentConfig,
          tools: [], // Usar ferramentas já configuradas no agente
          prompt: inputMessage
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Stream não disponível');
      }

      let accumulatedContent = '';
      let toolCalls: string[] = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decodificar chunk
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'chunk') {
                accumulatedContent += data.content;

                // Atualizar mensagem em tempo real
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              } else if (data.type === 'tool_call') {
                // Adicionar indicador de chamada de ferramenta
                toolCalls.push(`🔧 **${data.tool_name}**: ${data.method}`);

                const toolCallMessage: ChatMessage = {
                  id: `tool-${Date.now()}`,
                  type: 'tool_call',
                  content: `🔧 Usando **${data.tool_name}**\n\`\`\`json\n${JSON.stringify(data.params, null, 2)}\n\`\`\``,
                  timestamp: new Date(),
                  metadata: {
                    tool_name: data.tool_name,
                    execution_time: data.execution_time
                  }
                };

                setMessages(prev => {
                  // Inserir antes da mensagem do assistente
                  const index = prev.findIndex(msg => msg.id === assistantMessageId);
                  const newMessages = [...prev];
                  newMessages.splice(index, 0, toolCallMessage);
                  return newMessages;
                });
              } else if (data.type === 'done') {
                // Adicionar metadados finais
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: accumulatedContent,
                        metadata: {
                          model_used: agentConfig.model_id,
                          execution_time: data.execution_time,
                          tokens_used: data.tokens_used
                        }
                      }
                    : msg
                ));
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.warn('Erro ao parsear linha SSE:', line, e);
            }
          }
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Stream foi cancelado pelo usuário
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: '⏹️ *Streaming cancelado pelo usuário*' }
            : msg
        ));
      } else {
        console.error('Erro no streaming:', error);

        // Adicionar mensagem de erro
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          type: 'system',
          content: `❌ **Erro**: ${error.message}`,
          timestamp: new Date()
        };

        setMessages(prev => [...prev.filter(msg => msg.id !== assistantMessageId), errorMessage]);
      }
    } finally {
      setIsStreaming(false);
      setStreamController(null);
    }
  };

  // Cancelar streaming
  const cancelStreaming = () => {
    if (streamController) {
      streamController.abort();
    }
  };

  // Limpar chat
  const clearChat = () => {
    setMessages([{
      id: 'welcome-new',
      type: 'system',
      content: '🧹 Chat limpo! Você pode começar uma nova conversa.',
      timestamp: new Date()
    }]);
  };

  // Copiar mensagem
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    // Poderia adicionar um toast aqui
  };

  // Renderizar mensagem
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const isToolCall = message.type === 'tool_call';

    return (
      <div
        key={message.id}
        className={`
          flex gap-3 p-4 rounded-lg mb-4
          ${isUser 
            ? 'bg-blue-50 border border-blue-200 ml-12' 
            : isSystem
            ? 'bg-gray-50 border border-gray-200'
            : isToolCall
            ? 'bg-yellow-50 border border-yellow-200 mx-8'
            : 'bg-white border border-gray-200 mr-12'
          }
        `}
      >
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-medium
          ${isUser 
            ? 'bg-blue-500' 
            : isSystem
            ? 'bg-gray-500'
            : isToolCall
            ? 'bg-yellow-500'
            : 'bg-green-500'
          }
        `}>
          {isUser ? <User className="w-4 h-4" /> :
           isSystem ? <Settings className="w-4 h-4" /> :
           isToolCall ? <Wrench className="w-4 h-4" /> :
           <Bot className="w-4 h-4" />}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-gray-900">
              {isUser ? 'Você' :
               isSystem ? 'Sistema' :
               isToolCall ? 'Ferramenta' :
               'Assistente'}
            </span>
            <span className="text-xs text-gray-500">
              {message.timestamp.toLocaleTimeString()}
            </span>
            {message.metadata?.tool_name && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {message.metadata.tool_name}
              </span>
            )}
          </div>

          {/* Conteúdo da mensagem */}
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={tomorrow}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-md"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Metadados */}
          {message.metadata && (
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              {message.metadata.execution_time && (
                <span>⏱️ {message.metadata.execution_time}ms</span>
              )}
              {message.metadata.model_used && (
                <span>🤖 {message.metadata.model_used}</span>
              )}
              {message.metadata.tokens_used && (
                <span>🎯 {message.metadata.tokens_used} tokens</span>
              )}
            </div>
          )}

          {/* Ações da mensagem */}
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => copyMessage(message.content)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Copiar mensagem"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header do Chat */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Agno Chat</h2>
              <p className="text-sm text-gray-500">
                {agentConfig.model_provider} • {agentConfig.model_id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isStreaming && (
              <button
                onClick={cancelStreaming}
                className="flex items-center gap-2 px-3 py-1 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
              >
                <Square className="w-4 h-4" />
                Parar
              </button>
            )}

            <button
              onClick={clearChat}
              className="p-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
              title="Limpar chat"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Área de Mensagens */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map(renderMessage)}

        {/* Indicador de typing */}
        {isStreaming && (
          <div className="flex gap-3 p-4 rounded-lg bg-white border border-gray-200 mr-12">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-gray-900">Assistente</span>
                <div className="flex items-center gap-1">
                  <div className="animate-pulse w-1 h-1 bg-green-500 rounded-full"></div>
                  <div className="animate-pulse w-1 h-1 bg-green-500 rounded-full delay-100"></div>
                  <div className="animate-pulse w-1 h-1 bg-green-500 rounded-full delay-200"></div>
                </div>
              </div>
              <p className="text-gray-600 text-sm">Processando e usando ferramentas...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              className="w-full resize-none border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              style={{
                minHeight: '48px',
                maxHeight: '120px',
                resize: 'none'
              }}
              disabled={isStreaming}
            />
          </div>

          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isStreaming}
            className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Dicas */}
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
          <span>💡 Dica: Peça para eu usar ferramentas específicas</span>
          <span>•</span>
          <span>🔧 Exemplo: "Pesquise notícias sobre IA"</span>
          <span>•</span>
          <span>📊 "Análise da ação AAPL"</span>
        </div>
      </div>
    </div>
  );
};

export default AgnoChatInterface;
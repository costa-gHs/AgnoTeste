import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  User,
  Send,
  Loader,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Copy,
  Settings,
  Zap,
  Clock,
  Activity,
  Terminal,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

// Mock do AgnoClient para demonstração
class MockAgnoClient {
  async chatWithAgent(agentId, message, onChunk, onComplete, onError) {
    try {
      console.log(`🤖 Iniciando chat com agente ${agentId}: ${message}`);

      // Simular delay inicial
      await new Promise(resolve => setTimeout(resolve, 500));

      // Resposta simulada em chunks
      const response = `Olá! Você perguntou: "${message}"\n\nEsta é uma resposta simulada do agente ${agentId}. O sistema está funcionando corretamente e processando sua solicitação.\n\nVou demonstrar como o streaming funciona com múltiplos chunks de texto sendo enviados gradualmente para simular uma resposta real de um LLM.`;

      const words = response.split(' ');

      for (let i = 0; i < words.length; i++) {
        const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
        onChunk(chunk);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      onComplete({ session_id: `session_${Date.now()}` });
    } catch (error) {
      onError(error);
    }
  }
}

const ImprovedChatInterface = () => {
  // Estados principais
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamContent, setCurrentStreamContent] = useState('');
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  // Configurações do agente (simulado)
  const [currentAgent] = useState({
    id: 'agent-1',
    name: 'Assistente Virtual',
    model: 'gpt-4o-mini',
    provider: 'openai'
  });

  // Refs
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);
  const inputRef = useRef(null);
  const [agnoClient] = useState(() => new MockAgnoClient());

  // Auto-scroll para o fim das mensagens
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamContent, scrollToBottom]);

  // Auto-scroll logs
  const scrollLogsToBottom = useCallback(() => {
    if (showLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showLogs]);

  useEffect(() => {
    scrollLogsToBottom();
  }, [logs, scrollLogsToBottom]);

  // Adicionar log
  const addLog = useCallback((type, message, data = null) => {
    const logEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      type, // 'info', 'error', 'success', 'stream'
      message,
      data
    };
    setLogs(prev => [...prev, logEntry]);
  }, []);

  // Limpar logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Copiar mensagem
  const copyMessage = useCallback((content) => {
    navigator.clipboard.writeText(content);
    addLog('info', 'Mensagem copiada para a área de transferência');
  }, [addLog]);

  // Enviar mensagem
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setError(null);
    setIsStreaming(true);
    setCurrentStreamContent('');

    // Adicionar mensagem do usuário
    const newUserMessage = {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, newUserMessage]);
    addLog('info', `Enviando mensagem: "${userMessage}"`);

    // Preparar mensagem do agente (placeholder)
    const agentMessageId = Date.now() + 1;
    const agentMessage = {
      id: agentMessageId,
      type: 'agent',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
      agentName: currentAgent.name,
      isStreaming: true
    };
    setMessages(prev => [...prev, agentMessage]);

    try {
      addLog('stream', 'Iniciando stream de resposta do agente');

      await agnoClient.chatWithAgent(
        currentAgent.id,
        userMessage,
        // onChunk
        (chunk) => {
          setCurrentStreamContent(prev => prev + chunk);
          addLog('stream', `Chunk recebido: "${chunk}"`);
        },
        // onComplete
        (data) => {
          setMessages(prev => prev.map(msg =>
            msg.id === agentMessageId
              ? { ...msg, content: currentStreamContent, isStreaming: false }
              : msg
          ));
          setCurrentStreamContent('');
          setIsStreaming(false);
          setSessionId(data.session_id);
          addLog('success', `Chat concluído. Session ID: ${data.session_id}`);
        },
        // onError
        (error) => {
          setError(error.message);
          setIsStreaming(false);
          setCurrentStreamContent('');
          // Remover mensagem do agente em caso de erro
          setMessages(prev => prev.filter(msg => msg.id !== agentMessageId));
          addLog('error', `Erro: ${error.message}`);
        }
      );

    } catch (error) {
      setError(error.message);
      setIsStreaming(false);
      setCurrentStreamContent('');
      setMessages(prev => prev.filter(msg => msg.id !== agentMessageId));
      addLog('error', `Erro de conexão: ${error.message}`);
    }
  }, [inputMessage, isStreaming, currentAgent, agnoClient, addLog, currentStreamContent]);

  // Enter para enviar
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Renderizar ícone do log
  const renderLogIcon = (type) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'stream': return <Activity className="w-4 h-4 text-blue-500" />;
      default: return <Terminal className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Área principal do chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Chat com {currentAgent.name}</h1>
                <p className="text-sm text-gray-500">
                  {currentAgent.model} • {currentAgent.provider}
                  {sessionId && ` • Session: ${sessionId.slice(-8)}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showLogs 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Terminal className="w-4 h-4" />
                Logs ({logs.length})
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mt-4 rounded-r-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
              <h2 className="text-xl font-semibold mb-2">Bem-vindo ao Chat</h2>
              <p className="text-center max-w-md">
                Inicie uma conversa com o assistente virtual.
                As mensagens aparecerão em tempo real com streaming.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.type === 'user' 
                    ? 'bg-blue-500' 
                    : 'bg-gray-600'
                }`}>
                  {message.type === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Mensagem */}
                <div className={`flex-1 max-w-[80%] ${message.type === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block p-3 rounded-lg shadow-sm ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}>
                    <div className="whitespace-pre-wrap break-words">
                      {message.content || (message.isStreaming ? currentStreamContent : '')}
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-5 bg-gray-400 ml-1 animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${
                    message.type === 'user' ? 'justify-end' : ''
                  }`}>
                    <span>{message.timestamp}</span>
                    {message.agentName && <span>• {message.agentName}</span>}
                    {message.content && (
                      <button
                        onClick={() => copyMessage(message.content)}
                        className="hover:text-gray-700"
                        title="Copiar mensagem"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                disabled={isStreaming}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isStreaming}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isStreaming ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Panel de logs */}
      {showLogs && (
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Header dos logs */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Logs de Execução
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={clearLogs}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Limpar
              </button>
              <button
                onClick={() => setShowLogs(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de logs */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {logs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum log ainda</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 bg-gray-50 rounded-lg text-xs border border-gray-100"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {renderLogIcon(log.type)}
                    <span className="font-medium text-gray-600">{log.timestamp}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      log.type === 'error' ? 'bg-red-100 text-red-700' :
                      log.type === 'success' ? 'bg-green-100 text-green-700' :
                      log.type === 'stream' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {log.type}
                    </span>
                  </div>
                  <div className="text-gray-700 ml-6">
                    {log.message}
                    {log.data && (
                      <pre className="mt-1 text-xs bg-gray-100 p-1 rounded overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImprovedChatInterface;
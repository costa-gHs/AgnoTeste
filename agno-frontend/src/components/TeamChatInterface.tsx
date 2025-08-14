import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Bot, User, Loader, MessageSquare, Clock, CheckCircle,
  AlertCircle, RefreshCw, Settings, BarChart3, Play, Users,
  Copy, Download, X, Maximize2, Minimize2
} from 'lucide-react';

interface Team {
  id: string;
  name: string;
  description: string;
  team_type: 'collaborative' | 'hierarchical' | 'sequential';
  agent_count: number;
  agents: Array<{
    id: string;
    name: string;
    role: string;
    role_in_team?: string;
  }>;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'team' | 'system';
  content: string;
  timestamp: Date;
  team_name?: string;
  execution_id?: string;
  execution_time?: number;
  agents_used?: number;
  status?: 'sending' | 'completed' | 'error';
}

interface TeamChatProps {
  teams: Team[];
  onExecuteTeam: (teamId: string, message: string) => Promise<any>;
  className?: string;
}

const TeamChatInterface: React.FC<TeamChatProps> = ({
  teams,
  onExecuteTeam,
  className = ''
}) => {
  // States
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add system message
  const addSystemMessage = (content: string) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date(),
      status: 'completed'
    };
    setMessages(prev => [...prev, message]);
  };

  // Handle team selection
  const handleTeamSelect = (team: Team) => {
    setSelectedTeam(team);
    addSystemMessage(`Team "${team.name}" selecionado. ${team.agent_count} agentes prontos para colaborar.`);
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedTeam || isExecuting) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date(),
      status: 'completed'
    };

    const executingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'team',
      content: 'Processando sua solicitação...',
      timestamp: new Date(),
      team_name: selectedTeam.name,
      status: 'sending'
    };

    setMessages(prev => [...prev, userMessage, executingMessage]);
    setCurrentMessage('');
    setIsExecuting(true);

    try {
      const result = await onExecuteTeam(selectedTeam.id, currentMessage);

      // Update the executing message with result
      setMessages(prev => prev.map(msg =>
        msg.id === executingMessage.id
          ? {
              ...msg,
              content: result.response || 'Execução concluída com sucesso',
              status: 'completed',
              execution_id: result.execution_id,
              execution_time: result.execution_time_ms,
              agents_used: result.agents_used
            }
          : msg
      ));

    } catch (error: any) {
      // Update with error
      setMessages(prev => prev.map(msg =>
        msg.id === executingMessage.id
          ? {
              ...msg,
              content: `Erro na execução: ${error.message}`,
              status: 'error'
            }
          : msg
      ));
    } finally {
      setIsExecuting(false);
      inputRef.current?.focus();
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear chat
  const clearChat = () => {
    setMessages([]);
    if (selectedTeam) {
      addSystemMessage(`Chat limpo. Team "${selectedTeam.name}" ainda está selecionado.`);
    }
  };

  // Copy message content
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get message icon
  const getMessageIcon = (message: ChatMessage) => {
    if (message.type === 'user') return <User className=\"w-4 h-4\" />;
    if (message.type === 'system') return <Settings className=\"w-4 h-4\" />;

    if (message.status === 'sending') return <Loader className=\"w-4 h-4 animate-spin\" />;
    if (message.status === 'error') return <AlertCircle className=\"w-4 h-4\" />;
    return <Bot className=\"w-4 h-4\" />;
  };

  // Get message status color
  const getStatusColor = (message: ChatMessage) => {
    if (message.type === 'user') return 'bg-blue-500';
    if (message.type === 'system') return 'bg-gray-500';
    if (message.status === 'sending') return 'bg-yellow-500';
    if (message.status === 'error') return 'bg-red-500';
    return 'bg-green-500';
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border flex flex-col ${isExpanded ? 'h-screen' : 'h-96'} ${className}`}>
      {/* Header */}
      <div className=\"flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg\">
        <div className=\"flex items-center space-x-3\">
          <MessageSquare className=\"w-5 h-5 text-blue-600\" />
          <div>
            <h3 className=\"font-semibold text-gray-900\">Team Chat</h3>
            {selectedTeam ? (
              <p className=\"text-sm text-gray-600\">
                {selectedTeam.name} • {selectedTeam.agent_count} agentes
              </p>
            ) : (
              <p className=\"text-sm text-gray-600\">Selecione um team para começar</p>
            )}
          </div>
        </div>

        <div className=\"flex items-center space-x-2\">
          <button
            onClick={clearChat}
            disabled={messages.length === 0}
            className=\"p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed\"
            title=\"Limpar chat\"
          >
            <RefreshCw className=\"w-4 h-4\" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className=\"p-2 text-gray-500 hover:text-gray-700\"
            title={isExpanded ? 'Minimizar' : 'Expandir'}
          >
            {isExpanded ? <Minimize2 className=\"w-4 h-4\" /> : <Maximize2 className=\"w-4 h-4\" />}
          </button>
        </div>
      </div>

      {/* Team Selector */}
      {!selectedTeam && (
        <div className=\"p-4 border-b bg-blue-50\">
          <h4 className=\"text-sm font-medium text-gray-900 mb-3\">Selecione um Team:</h4>
          <div className=\"grid grid-cols-1 gap-2 max-h-32 overflow-y-auto\">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => handleTeamSelect(team)}
                className=\"flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left\"
              >
                <div>
                  <p className=\"font-medium text-gray-900\">{team.name}</p>
                  <p className=\"text-sm text-gray-600\">{team.team_type} • {team.agent_count} agentes</p>
                </div>
                <Users className=\"w-5 h-5 text-gray-400\" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className=\"flex-1 overflow-y-auto p-4 space-y-4\">
        {messages.length === 0 ? (
          <div className=\"text-center text-gray-500 py-8\">
            <MessageSquare className=\"w-12 h-12 text-gray-400 mx-auto mb-4\" />
            <p>Inicie uma conversa com seu team de agentes</p>
            <p className=\"text-sm mt-2\">Digite uma mensagem e veja a colaboração em ação!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-4xl ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                {/* Message Header */}
                <div className={`flex items-center space-x-2 mb-1 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-center space-x-1 text-xs text-gray-500`}>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(message)}`} />
                    <span>
                      {message.type === 'user' ? 'Você' :
                       message.type === 'system' ? 'Sistema' :
                       message.team_name || 'Team'}
                    </span>
                    <span>•</span>
                    <span>{formatTime(message.timestamp)}</span>
                    {message.execution_time && (
                      <>
                        <span>•</span>
                        <span>{message.execution_time}ms</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Message Content */}
                <div
                  className={`relative group px-4 py-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.type === 'system'
                      ? 'bg-gray-100 text-gray-800'
                      : message.status === 'error'
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-gray-50 text-gray-800'
                  }`}
                >
                  {/* Message Icon */}
                  <div className={`absolute -top-1 ${message.type === 'user' ? '-right-1' : '-left-1'} w-6 h-6 rounded-full flex items-center justify-center ${getStatusColor(message)} text-white`}>
                    {getMessageIcon(message)}
                  </div>

                  {/* Message Text */}
                  <div className=\"pr-8 whitespace-pre-wrap\">{message.content}</div>

                  {/* Copy Button */}
                  <button
                    onClick={() => copyMessage(message.content)}
                    className=\"absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black hover:bg-opacity-10 transition-opacity\"
                    title=\"Copiar mensagem\"
                  >
                    <Copy className=\"w-3 h-3\" />
                  </button>

                  {/* Execution Details */}
                  {message.agents_used && (
                    <div className=\"mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600\">
                      <div className=\"flex items-center space-x-4\">
                        <span className=\"flex items-center space-x-1\">
                          <Bot className=\"w-3 h-3\" />
                          <span>{message.agents_used} agentes</span>
                        </span>
                        {message.execution_id && (
                          <span className=\"flex items-center space-x-1\">
                            <BarChart3 className=\"w-3 h-3\" />
                            <span>ID: {message.execution_id.slice(0, 8)}...</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {selectedTeam && (
        <div className=\"p-4 border-t bg-gray-50\">
          <div className=\"flex items-end space-x-3\">
            {/* Team Info */}
            <div className=\"flex-shrink-0\">
              <div className=\"flex items-center space-x-2 text-sm text-gray-600 mb-2\">
                <Users className=\"w-4 h-4\" />
                <span>{selectedTeam.name}</span>
                <span className=\"w-1 h-1 bg-gray-400 rounded-full\" />
                <span className=\"text-green-600\">{selectedTeam.agent_count} agentes ativos</span>
              </div>
            </div>

            {/* Message Input */}
            <div className=\"flex-1 relative\">
              <input
                ref={inputRef}
                type=\"text\"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isExecuting ? 'Aguarde a resposta...' : 'Digite sua mensagem para o team...'}
                disabled={isExecuting}
                className=\"w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed\"
              />
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={!currentMessage.trim() || isExecuting}
              className=\"px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2\"
            >
              {isExecuting ? (
                <Loader className=\"w-4 h-4 animate-spin\" />
              ) : (
                <Send className=\"w-4 h-4\" />
              )}
              <span>{isExecuting ? 'Executando...' : 'Enviar'}</span>
            </button>
          </div>

          {/* Quick Actions */}
          <div className=\"flex items-center justify-between mt-3 pt-3 border-t border-gray-200\">
            <div className=\"flex items-center space-x-4 text-sm text-gray-500\">
              <span>Pressione Enter para enviar</span>
              {isExecuting && (
                <span className=\"flex items-center space-x-1 text-yellow-600\">
                  <Clock className=\"w-3 h-3\" />
                  <span>Agentes colaborando...</span>
                </span>
              )}
            </div>

            <div className=\"flex items-center space-x-2\">
              <button
                onClick={() => setSelectedTeam(null)}
                className=\"text-sm text-gray-500 hover:text-gray-700\"
              >
                Trocar Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamChatInterface;
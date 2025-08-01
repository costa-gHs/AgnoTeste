// agno_client.js - VERSÃO COMPLETA CORRIGIDA COM STREAMING FUNCIONANDO
const [sessionId, setSessionId] = useState(null);
class AgnoClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
    this.userId = 1;
    this.eventListeners = new Map();
    this.debugMode = true;
    this.streamingTimeout = 300000; // 5 minutos
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  // =============================================
  // SISTEMA DE LOGS MELHORADO
  // =============================================
  log(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = {
      debug: '🔍',
      info: '📝',
      warn: '⚠️',
      error: '❌',
      success: '✅',
      stream: '🌊'
    }[level] || '📝';

    if (this.debugMode) {
      console.log(`${emoji} [${timestamp}] AgnoClient.${level.toUpperCase()}: ${message}`);
      if (data) console.log('📊 Data:', data);
    }

    this.emit('log', { level, message, data, timestamp });
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  setLogCallback(callback) {
    if (!this.eventListeners.has('log')) {
      this.eventListeners.set('log', []);
    }
    this.eventListeners.get('log').push(callback);
  }

  removeLogCallback(callback) {
    if (this.eventListeners.has('log')) {
      const listeners = this.eventListeners.get('log');
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // =============================================
  // FORMATAÇÃO DE ERROS
  // =============================================
  formatError(error, context = '') {
    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      if (error.detail) return error.detail;
      if (error.message) return error.message;
      if (error.error) return error.error;
    }

    return `Erro${context ? ` em ${context}` : ''}: ${error?.toString() || 'Erro desconhecido'}`;
  }

  // =============================================
  // TESTE DE CONEXÃO
  // =============================================
  async testConnection() {
    try {
      this.log('info', '🔄 Testando conexão com backend...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseURL}/api/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.log('success', '✅ Backend acessível', data);
        return true;
      } else {
        this.log('warn', `⚠️ Backend respondeu com erro: ${response.status}`);
        return false;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        this.log('error', '⏰ Timeout na conexão com backend');
      } else {
        this.log('error', `❌ Backend inacessível: ${error.message}`);
      }
      return false;
    }
  }

  // =============================================
  // REQUISIÇÕES NORMAIS COM RETRY
  // =============================================
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.log('info', `🚀 Tentativa ${attempt}/${this.maxRetries}: ${options.method || 'GET'} ${url}`);

        const config = {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
          },
          mode: 'cors',
          credentials: 'omit',
          ...options,
        };

        // Adicionar user_id como query parameter se não for POST com body
        const urlWithUser = new URL(url);
        if (!options.body) {
          urlWithUser.searchParams.append('user_id', this.userId);
        }

        const response = await fetch(urlWithUser.toString(), config);

        this.log('debug', `📡 Resposta recebida: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
            this.log('error', '💥 Erro na resposta:', errorData);
          } catch {
            errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
          }
          throw new Error(this.formatError(errorData, 'request'));
        }

        const data = await response.json();
        this.log('success', '✅ Requisição bem-sucedida');
        return data;

      } catch (error) {
        lastError = error;
        this.log('error', `💥 Erro na tentativa ${attempt}: ${error.message}`);

        if (attempt < this.maxRetries) {
          this.log('info', `⏳ Aguardando ${this.retryDelay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }

    const finalErrorMessage = this.formatError(lastError, endpoint);
    throw new Error(finalErrorMessage);
  }

  // =============================================
  // STREAMING CORRIGIDO - FUNÇÃO PRINCIPAL! 🎯
  // =============================================
  async makeStreamingRequest(endpoint, data, onChunk, onComplete, onError) {
    const url = `${this.baseURL}${endpoint}?user_id=${this.userId}`;
    const requestId = `stream_${Date.now()}`;

    try {
      this.log('stream', `🚀 Iniciando streaming para: ${url}`, data);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        this.log('error', `⏰ Streaming timeout após ${this.streamingTimeout}ms`);
        controller.abort();
      }, this.streamingTimeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain, application/json',
          'Cache-Control': 'no-cache',
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      this.log('stream', `📡 Status do streaming: ${response.status}`);

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = this.formatError(errorData, 'streaming request');
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('Streaming não suportado - resposta sem body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      let totalContent = '';

      this.log('stream', '🌊 Iniciando leitura do stream...');

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            this.log('stream', `✅ Stream concluído após ${chunkCount} chunks`);
            break;
          }

          chunkCount++;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Processar linhas completas
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Manter a última linha incompleta no buffer

          for (const line of lines) {
            if (line.trim() === '') continue;

            this.log('debug', `📄 Processando linha: ${line.substring(0, 100)}...`);

            if (line.startsWith('data: ')) {
              try {
                const jsonData = line.slice(6);
                const parsed = JSON.parse(jsonData);

                this.log('stream', `📦 Chunk estruturado recebido:`, parsed);

                // ====== FIX PRINCIPAL: Aceitar "text" (backend) E "chunk" (esperado) ======
                if ((parsed.type === 'text' || parsed.type === 'chunk') && parsed.content) {
                  totalContent += parsed.content;
                  this.log('debug', `✨ Conteúdo: "${parsed.content.substring(0, 30)}..."`);
                  onChunk(parsed.content);
                }
                // ====== FIX: Aceitar "done" (backend) E "complete" (esperado) ======
                else if (parsed.type === 'done' || parsed.type === 'complete') {
                  this.log('success', '🏁 Stream marcado como completo');
                  onComplete({
                    ...parsed,
                    total_content: totalContent,
                    total_chunks: chunkCount
                  });
                  return;
                }
                else if (parsed.type === 'error') {
                  const errorMessage = this.formatError(parsed, 'stream error');
                  this.log('error', `💥 Erro no stream: ${errorMessage}`);
                  onError(new Error(errorMessage));
                  return;
                }
              } catch (parseError) {
                this.log('warn', `⚠️ Erro ao parsear chunk JSON: ${parseError.message}`);
                this.log('debug', `🔍 Linha problemática: ${line}`);

                // Fallback: tratar como texto simples
                const content = line.startsWith('data: ') ? line.slice(6) : line;
                if (content.trim() && !content.includes('{') && !content.startsWith('RunResponse')) {
                  totalContent += content;
                  this.log('stream', `📝 Texto simples: "${content.substring(0, 30)}..."`);
                  onChunk(content);
                }
              }
            } else if (line.trim() && !line.startsWith(':')) {
              // Linha de texto simples (não SSE)
              this.log('stream', `📄 Linha não-SSE: ${line.substring(0, 50)}...`);
              totalContent += line + '\n';
              onChunk(line + '\n');
            }
          }
        }

        // Se recebemos chunks mas não houve sinal explícito de completion
        if (chunkCount > 0) {
          this.log('success', '🎉 Stream finalizado implicitamente');
          onComplete({
            session_id: `session_${Date.now()}`,
            total_chunks: chunkCount,
            total_content: totalContent,
            completion_type: 'implicit'
          });
        } else {
          this.log('warn', '⚠️ Stream finalizado sem chunks recebidos');
          onError(new Error('Stream finalizado sem receber dados'));
        }

      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      const errorMessage = this.formatError(error, 'streaming');
      this.log('error', `💥 Erro no streaming: ${errorMessage}`);
      onError(new Error(errorMessage));
    }
  }

  // =============================================
  // MÉTODOS DA API DE AGENTES
  // =============================================
  async listAgents() {
    this.log('info', '📋 Listando agentes...');
    return this.makeRequest('/api/agents');
  }

  async listWorkflows() {
    this.log('info', '🔄 Listando workflows...');
    return this.makeRequest('/api/workflows');
  }

  async createAgent(agentData) {
    this.log('info', '🤖 Criando agente:', agentData);

    if (!agentData.name || !agentData.role) {
      throw new Error('Nome e papel são obrigatórios');
    }

    // Garantir que instructions seja um array
    if (typeof agentData.instructions === 'string') {
      agentData.instructions = [agentData.instructions];
    }

    return this.makeRequest('/api/agents/create', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  async updateAgent(agentId, agentData) {
    this.log('info', `✏️ Atualizando agente ${agentId}:`, agentData);
    return this.makeRequest(`/api/agents/${agentId}/update`, {
      method: 'PUT',
      body: JSON.stringify(agentData),
    });
  }

  async deleteAgent(agentId) {
    this.log('info', `🗑️ Deletando agente ${agentId}`);
    return this.makeRequest(`/api/agents/${agentId}/delete`, {
      method: 'DELETE',
    });
  }

  async getAgentDetails(agentId) {
    this.log('info', `🔍 Buscando detalhes do agente ${agentId}`);
    return this.makeRequest(`/api/agents/${agentId}`);
  }

  // =============================================
  // MÉTODO PRINCIPAL DE CHAT COM STREAMING! 🎯
  // =============================================
  async chatWithAgent(agentId, message, onChunk, onComplete, onError) {
    this.log('stream', `🚀 Iniciando chat com agente ${agentId}`);
    this.log('debug', `💬 Mensagem: ${message}`);
    // ✅ ADICIONAR estas linhas:
    const { sessionId } = options;
    let url = `${this.baseURL}/api/agents/${agentId}/chat?user_id=${this.userId}`;

    // ✅ ADICIONAR session_id na URL se existir:
    if (sessionId) {
      url += `&session_id=${sessionId}`;
    }
    try {
      await this.makeStreamingRequest(
        `/api/agents/${agentId}/chat`,
        { message: message.trim() },

        // onChunk - chamado para cada pedaço de texto recebido
        (chunk) => {
          this.log('debug', `📦 Chunk recebido: "${chunk.substring(0, 50)}..."`);
          onChunk(chunk);
        },

        // onComplete - chamado quando streaming termina
        (data) => {
          // ✅ ADICIONAR estas linhas:
          if (data.session_id && !sessionId) {
            setSessionId(data.session_id); // Manter session_id para próximas mensagens
          }

        // onError - chamado se houver erro
        (error) => {
          this.log('error', `💥 Erro no chat: ${error.message}`);
          onError(error);
        }
      })
    }
    catch (error) {
      this.log('error', `💥 Erro ao iniciar chat: ${error.message}`);
      onError(error);
    }
  }

  // =============================================
  // MÉTODOS DE WORKFLOW
  // =============================================
  async createWorkflow(workflowData) {
    this.log('info', '🔄 Criando workflow:', workflowData);
    return this.makeRequest('/api/workflows/create', {
      method: 'POST',
      body: JSON.stringify(workflowData),
    });
  }

  async executeWorkflow(workflowId, inputData, onChunk, onComplete, onError) {
    this.log('stream', `🔄 Executando workflow ${workflowId}`);

    try {
      await this.makeStreamingRequest(
        `/api/workflows/${workflowId}/execute`,
        inputData,
        onChunk,
        onComplete,
        onError
      );
    } catch (error) {
      this.log('error', `💥 Erro ao executar workflow: ${error.message}`);
      onError(error);
    }
  }

  // =============================================
  // MÉTODOS DE UTILIDADE
  // =============================================
  async getMetrics() {
    this.log('info', '📊 Buscando métricas do sistema');
    return this.makeRequest('/api/metrics');
  }

  async getHealth() {
    this.log('info', '🏥 Verificando saúde do sistema');
    return this.makeRequest('/api/health');
  }

  // =============================================
  // CONFIGURAÇÕES
  // =============================================
  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.log('info', `🔧 Debug mode ${enabled ? 'ativado' : 'desativado'}`);
  }

  setTimeout(timeout) {
    this.streamingTimeout = timeout;
    this.log('info', `⏰ Timeout de streaming definido para ${timeout}ms`);
  }

  setUserId(userId) {
    this.userId = userId;
    this.log('info', `👤 User ID definido para: ${userId}`);
  }

  setBaseURL(baseURL) {
    this.baseURL = baseURL;
    this.log('info', `🌐 Base URL definida para: ${baseURL}`);
  }
}

// =============================================
// EXPORTAR PARA USO
// =============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgnoClient;
} else if (typeof window !== 'undefined') {
  window.AgnoClient = AgnoClient;
}

export default AgnoClient;
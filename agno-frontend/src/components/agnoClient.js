// agno-frontend/src/lib/agnoClient.js
// =============================================
// AGNO CLIENT - VERSÃO CORRIGIDA E OTIMIZADA
// =============================================

class AgnoClient {
  constructor(baseURL = 'http://localhost:8000', userId = 1) {
    this.baseURL = baseURL;
    this.userId = userId;
    this.debugMode = false;
    this.timeout = 30000;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.streamingTimeout = 300000; // 5 minutos para streaming
    this.activeStreams = new Map(); // Rastrear streams ativos
  }

  // =============================================
  // CONFIGURAÇÕES
  // =============================================
  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.log('info', `🔧 Debug mode ${enabled ? 'ativado' : 'desativado'}`);
    return this;
  }

  setTimeout(timeout) {
    this.timeout = timeout;
    this.log('info', `⏱️ Timeout configurado para ${timeout}ms`);
    return this;
  }

  setUserId(userId) {
    this.userId = userId;
    this.log('info', `👤 User ID configurado: ${userId}`);
    return this;
  }

  // =============================================
  // LOGGING
  // =============================================
  log(level, message, data = null) {
    if (!this.debugMode && level !== 'error') return;

    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[AgnoClient ${timestamp}]`;
    const logData = data ? { message, data } : message;

    const levels = {
      error: (msg) => console.error(`❌ ${prefix}`, msg),
      warn: (msg) => console.warn(`⚠️ ${prefix}`, msg),
      info: (msg) => console.info(`ℹ️ ${prefix}`, msg),
      success: (msg) => console.log(`✅ ${prefix}`, msg),
      debug: (msg) => console.debug(`🔍 ${prefix}`, msg),
      stream: (msg) => console.log(`🌊 ${prefix}`, msg)
    };

    const logFn = levels[level] || levels.info;
    logFn(logData);
  }

  // =============================================
  // FORMATAÇÃO DE ERROS
  // =============================================
  formatError(error, context = '') {
    if (error?.detail) return error.detail;
    if (error?.message) return error.message;
    if (typeof error === 'string') return error;

    const contextStr = context ? ` em ${context}` : '';
    return `Erro desconhecido${contextStr}: ${error?.toString() || 'Sem detalhes'}`;
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
        return { success: true, data };
      } else {
        this.log('warn', `⚠️ Backend respondeu com erro: ${response.status}`);
        return { success: false, status: response.status };
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        this.log('error', '⏰ Timeout na conexão com backend');
      } else {
        this.log('error', `❌ Backend inacessível: ${error.message}`);
      }
      return { success: false, error: error.message };
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
        this.log('debug', `🚀 Tentativa ${attempt}/${this.maxRetries}: ${options.method || 'GET'} ${url}`);

        const urlWithUser = new URL(url);
        if (!options.body && !urlWithUser.searchParams.has('user_id')) {
          urlWithUser.searchParams.append('user_id', this.userId);
        }

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
          const delay = this.retryDelay * attempt;
          this.log('info', `⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(this.formatError(lastError, endpoint));
  }

  // =============================================
  // STREAMING CORRIGIDO - FUNÇÃO PRINCIPAL
  // =============================================
  async makeStreamingRequest(endpoint, data, options = {}) {
    const { sessionId, onChunk, onComplete, onError } = options;
    const streamId = `stream_${Date.now()}`;

    // Construir URL com parâmetros
    let url = `${this.baseURL}${endpoint}?user_id=${this.userId}`;
    if (sessionId) {
      url += `&session_id=${sessionId}`;
    }

    this.log('stream', `🚀 Iniciando streaming [${streamId}]`, { url, data });

    try {
      const controller = new AbortController();
      this.activeStreams.set(streamId, controller);

      // Timeout para streaming
      const timeoutId = setTimeout(() => {
        this.log('error', `⏰ Streaming timeout após ${this.streamingTimeout}ms`);
        controller.abort();
      }, this.streamingTimeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
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
          errorMessage = this.formatError(errorData, 'streaming');
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Processar stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalContent = '';
      let chunkCount = 0;
      let newSessionId = sessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();

              // Ignorar sinais especiais
              if (!jsonStr || jsonStr === '[DONE]') continue;

              const parsedData = JSON.parse(jsonStr);

              // Processar diferentes tipos de mensagem
              if (parsedData.type === 'error') {
                this.log('error', '❌ Erro no streaming:', parsedData);
                onError?.(new Error(parsedData.message || 'Erro no streaming'));
                return;
              }

              if (parsedData.type === 'done') {
                this.log('success', '✅ Streaming concluído', parsedData);
                onComplete?.({
                  session_id: parsedData.session_id || newSessionId,
                  total_chunks: chunkCount,
                  total_content: totalContent,
                  metrics: parsedData.metrics
                });
                return;
              }

              // Processar chunk de conteúdo
              if (parsedData.content || parsedData.type === 'text') {
                const content = parsedData.content || '';
                chunkCount++;
                totalContent += content;

                // Capturar session_id se disponível
                if (parsedData.session_id && !newSessionId) {
                  newSessionId = parsedData.session_id;
                }

                this.log('debug', `📦 Chunk ${chunkCount}: "${content.substring(0, 50)}..."`);
                onChunk?.(content);
              }

            } catch (parseError) {
              this.log('debug', 'Erro ao parsear linha:', { line, error: parseError.message });
              // Tratar como texto simples se não for JSON
              if (line.trim() && !line.startsWith('data:') && !line.includes('{')) {
                chunkCount++;
                totalContent += line + '\n';
                onChunk?.(line + '\n');
              }
            }
          }
        }
      }

      // Se chegou ao fim sem sinal explícito de done
      if (chunkCount > 0) {
        this.log('success', '🎉 Stream finalizado implicitamente');
        onComplete?.({
          session_id: newSessionId || `session_${Date.now()}`,
          total_chunks: chunkCount,
          total_content: totalContent
        });
      } else {
        this.log('warn', '⚠️ Stream finalizado sem chunks');
        onError?.(new Error('Stream finalizado sem receber dados'));
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        this.log('error', '🛑 Streaming abortado');
        onError?.(new Error('Streaming cancelado por timeout'));
      } else {
        this.log('error', `💥 Erro no streaming: ${error.message}`);
        onError?.(error);
      }
    } finally {
      this.activeStreams.delete(streamId);
      this.log('debug', `🧹 Stream ${streamId} removido da lista de ativos`);
    }
  }

  // =============================================
  // CANCELAR STREAMS ATIVOS
  // =============================================
  cancelAllStreams() {
    this.log('info', `🛑 Cancelando ${this.activeStreams.size} streams ativos`);
    this.activeStreams.forEach((controller, id) => {
      controller.abort();
      this.log('debug', `❌ Stream ${id} cancelado`);
    });
    this.activeStreams.clear();
  }

  // =============================================
  // MÉTODOS DA API - AGENTES
  // =============================================
  async listAgents() {
    this.log('info', '📋 Listando agentes...');
    return this.makeRequest('/api/agents');
  }

  async getAgent(agentId) {
    this.log('info', `🔍 Buscando agente ${agentId}...`);
    return this.makeRequest(`/api/agents/${agentId}`);
  }

  async createAgent(agentData) {
    this.log('info', '🤖 Criando agente:', agentData);

    if (!agentData.name || !agentData.role) {
      throw new Error('Nome e papel são obrigatórios');
    }

    return this.makeRequest('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        ...agentData,
        user_id: this.userId
      })
    });
  }

  async updateAgent(agentId, updates) {
    this.log('info', `📝 Atualizando agente ${agentId}:`, updates);
    return this.makeRequest(`/api/agents/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteAgent(agentId) {
    this.log('info', `🗑️ Deletando agente ${agentId}...`);
    return this.makeRequest(`/api/agents/${agentId}`, {
      method: 'DELETE'
    });
  }

  // =============================================
  // MÉTODOS DA API - CHAT
  // =============================================
  async chatWithAgent(agentId, message, options = {}) {
    this.log('stream', `💬 Iniciando chat com agente ${agentId}`);
    this.log('debug', `📝 Mensagem: ${message}`);

    return this.makeStreamingRequest(
      `/api/agents/${agentId}/chat`,
      { message: message.trim() },
      options
    );
  }

  async getChatHistory(agentId, sessionId) {
    this.log('info', `📜 Buscando histórico do chat ${sessionId}...`);
    return this.makeRequest(`/api/agents/${agentId}/sessions/${sessionId}`);
  }

  // =============================================
  // MÉTODOS DA API - WORKFLOWS
  // =============================================
  async listWorkflows() {
    this.log('info', '🔄 Listando workflows...');
    return this.makeRequest('/api/workflows');
  }

  async getWorkflow(workflowId) {
    this.log('info', `🔍 Buscando workflow ${workflowId}...`);
    return this.makeRequest(`/api/workflows/${workflowId}`);
  }

  async createWorkflow(workflowData) {
    this.log('info', '🔄 Criando workflow:', workflowData);
    return this.makeRequest('/api/workflows/create', {
      method: 'POST',
      body: JSON.stringify(workflowData)
    });
  }

  async executeWorkflow(workflowId, inputData, options = {}) {
    this.log('stream', `⚡ Executando workflow ${workflowId}`);

    return this.makeStreamingRequest(
      `/api/workflows/${workflowId}/execute`,
      inputData,
      options
    );
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

  async getSystemInfo() {
    this.log('info', '🖥️ Buscando informações do sistema');
    return this.makeRequest('/');
  }
}

// =============================================
// EXPORTAÇÃO
// =============================================
// Suporte para diferentes sistemas de módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgnoClient;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return AgnoClient; });
} else if (typeof window !== 'undefined') {
  window.AgnoClient = AgnoClient;
}

// Export default para ES6
export default AgnoClient;
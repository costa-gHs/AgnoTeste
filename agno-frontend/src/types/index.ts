// Tipos para Agentes
export interface Agent {
  id: string;
  name: string;
  role: string;
  modelProvider: 'openai' | 'anthropic';
  modelId: string;
  tools: string[];
  status: 'active' | 'inactive' | 'error';
  lastUsed: string;
  config: AgentConfig;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfig {
  instructions: string[];
  memoryEnabled: boolean;
  ragEnabled: boolean;
  ragIndexId?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

// Tipos para Workflows
export interface Workflow {
  id: string;
  name: string;
  description: string;
  flowType: 'sequential' | 'parallel' | 'conditional';
  agentCount: number;
  status: 'active' | 'inactive' | 'draft';
  lastUsed: string;
  config: WorkflowConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowConfig {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  supervisorEnabled: boolean;
  agents: Agent[];
}

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'condition' | 'parallel';
  name: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
}

// Tipos para Templates
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  isPublic: boolean;
  isFeatured: boolean;
  rating: number;
  downloads: number;
  lastUpdated: string;
  tags: string[];
  config: TemplateConfig;
}

export interface TemplateConfig {
  modelProvider: 'openai' | 'anthropic';
  modelId: string;
  tools: string[];
  instructions: string[];
  memoryEnabled: boolean;
  ragEnabled: boolean;
  reasoningEnabled: boolean;
}

// Tipos para Sessões de Chat
export interface ChatSession {
  id: string;
  agentId?: string;
  workflowId?: string;
  userId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  tokensUsed: number;
  messagesCount: number;
  cost: number;
  status: 'active' | 'completed' | 'error' | 'timeout';
  error?: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  toolsUsed?: string[];
  reasoning?: string;
  metadata?: Record<string, unknown>;
}

// Tipos para Monitoramento
export interface MetricsData {
  totalSessions: number;
  successRate: number;
  avgResponseTime: number;
  totalTokens: number;
  activeAgents: number;
  totalWorkflows: number;
  costToday: number;
  errorsToday: number;
}

export interface PerformanceData {
  time: string;
  responseTime: number;
  tokens: number;
  sessions: number;
  errors: number;
}

export interface UsageData {
  name: string;
  sessions: number;
  tokens: number;
  avgTime: number;
  success: number;
  cost?: number;
}

// Tipos para Usuários e Autenticação
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'project_admin' | 'regular_user';
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token?: string;
}

// Tipos para API
export interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Tipos para Formulários
export interface CreateAgentRequest {
  name: string;
  role: string;
  modelProvider: 'openai' | 'anthropic';
  modelId: string;
  instructions: string[];
  tools: string[];
  memoryEnabled: boolean;
  ragEnabled: boolean;
  ragIndexId?: string;
}

export interface CreateWorkflowRequest {
  name: string;
  description: string;
  flowType: 'sequential' | 'parallel' | 'conditional';
  supervisorEnabled: boolean;
  agents: CreateAgentRequest[];
}

export interface RunRequest {
  message: string;
  stream?: boolean;
  context?: Record<string, unknown>;
}

// Tipos para Tools
export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

// Tipos para Filtros e Busca
export interface FilterOptions {
  search?: string;
  category?: string;
  status?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Tipos para Eventos e WebSocket
export interface WebSocketMessage {
  type: 'chunk' | 'complete' | 'error' | 'status';
  content?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface StreamingResponse {
  id: string;
  content: string;
  isComplete: boolean;
  metadata?: Record<string, unknown>;
}

// Tipos para Configurações
export interface AppConfig {
  theme: 'light' | 'dark' | 'system';
  language: 'pt-BR' | 'en-US';
  autoSave: boolean;
  notifications: boolean;
  developerMode: boolean;
}

// Tipos para Erros
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// Tipos para Estados de Loading
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Tipos para Modais
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Tipos para Componentes de UI
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export interface InputProps {
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

// Tipos para Contextos
export interface AppContextType {
  user: User | null;
  agents: Agent[];
  workflows: Workflow[];
  templates: AgentTemplate[];
  config: AppConfig;
  loading: LoadingState;
  error: AppError | null;
}

// Exports para facilitar uso
export type { Agent as AgentType };
export type { Workflow as WorkflowType };
export type { ChatSession as ChatSessionType };
export type { User as UserType };
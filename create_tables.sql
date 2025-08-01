-- ===============================================
-- 🗄️ CRIAR TABELAS BÁSICAS DO AGNO PLATFORM
-- Execute estes comandos no PostgreSQL
-- ===============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS agno_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agents table
CREATE TABLE IF NOT EXISTS agno_agents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES agno_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    role VARCHAR(255),
    model_provider VARCHAR(20) NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    instructions JSONB NOT NULL DEFAULT '[]',
    tools JSONB NOT NULL DEFAULT '[]',
    configuration JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    memory_enabled BOOLEAN DEFAULT true,
    rag_enabled BOOLEAN DEFAULT false,
    rag_index_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflows table
CREATE TABLE IF NOT EXISTS agno_workflows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES agno_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    flow_type VARCHAR(20) DEFAULT 'sequential',
    workflow_definition JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflow Agents (Many-to-Many relationship)
CREATE TABLE IF NOT EXISTS agno_workflow_agents (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES agno_workflows(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agno_agents(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    node_config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workflow_id, agent_id, position)
);

-- Chat Sessions table (opcional para funcionalidade básica)
CREATE TABLE IF NOT EXISTS agno_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES agno_users(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agno_agents(id) ON DELETE SET NULL,
    workflow_id INTEGER REFERENCES agno_workflows(id) ON DELETE SET NULL,
    session_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    CHECK (agent_id IS NOT NULL OR workflow_id IS NOT NULL)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agno_agents_user_id ON agno_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agno_agents_is_active ON agno_agents(is_active);
CREATE INDEX IF NOT EXISTS idx_agno_workflows_user_id ON agno_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_agno_chat_sessions_user_id ON agno_chat_sessions(user_id);

-- Insert demo user
INSERT INTO agno_users (username, email, full_name, is_active) VALUES
('demo', 'demo@agno.ai', 'Demo User', true)
ON CONFLICT (email) DO NOTHING;

-- Insert sample agents
INSERT INTO agno_agents (
    user_id, name, description, role, model_provider, model_id,
    instructions, tools, memory_enabled, is_active
)
SELECT
    u.id,
    'Assistente Geral',
    'Assistente geral para diversas tarefas',
    'Assistente geral para diversas tarefas',
    'openai',
    'gpt-4o-mini',
    '["Você é um assistente útil e prestativo."]'::jsonb,
    '["reasoning", "web_search"]'::jsonb,
    true,
    true
FROM agno_users u WHERE u.email = 'demo@agno.ai'
ON CONFLICT DO NOTHING;

INSERT INTO agno_agents (
    user_id, name, description, role, model_provider, model_id,
    instructions, tools, memory_enabled, is_active
)
SELECT
    u.id,
    'Especialista em Código',
    'Especialista em programação e desenvolvimento',
    'Especialista em programação e desenvolvimento',
    'anthropic',
    'claude-3-5-sonnet-20241022',
    '["Você é especialista em programação.", "Use melhores práticas de código."]'::jsonb,
    '["code_interpreter", "reasoning"]'::jsonb,
    true,
    true
FROM agno_users u WHERE u.email = 'demo@agno.ai'
ON CONFLICT DO NOTHING;

INSERT INTO agno_agents (
    user_id, name, description, role, model_provider, model_id,
    instructions, tools, memory_enabled, is_active
)
SELECT
    u.id,
    'Analista Financeiro',
    'Especialista em análise financeira',
    'Especialista em análise financeira',
    'openai',
    'gpt-4o',
    '["Forneça análises financeiras precisas.", "Sempre inclua disclaimers."]'::jsonb,
    '["calculations", "web_search"]'::jsonb,
    true,
    true
FROM agno_users u WHERE u.email = 'demo@agno.ai'
ON CONFLICT DO NOTHING;

-- Insert sample workflow
INSERT INTO agno_workflows (
    user_id, name, description, flow_type, workflow_definition, is_active
)
SELECT
    u.id,
    'Análise de Dados Completa',
    'Workflow para análise completa de dados com múltiplos agentes',
    'sequential',
    '{
        "steps": [
            {"step": 1, "agent": "Assistente Geral", "description": "Preparação dos dados"},
            {"step": 2, "agent": "Analista Financeiro", "description": "Análise financeira"},
            {"step": 3, "agent": "Especialista em Código", "description": "Visualizações"}
        ]
    }'::jsonb,
    true
FROM agno_users u WHERE u.email = 'demo@agno.ai'
ON CONFLICT DO NOTHING;
# backend/routers/real_agno_routes.py

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text as sa_text
from typing import List, Dict, Any, Optional
import json
import asyncio
from datetime import datetime

from backend.database import async_session
from backend.services.agno_services import get_real_agno_service, AGNO_AVAILABLE
from pydantic import BaseModel

router = APIRouter(prefix="/api/agno", tags=["Agno Tools Real"])

# =============================================
# MODELS
# =============================================

class AgentExecuteRequest(BaseModel):
    prompt: str
    tools: List[str] = []
    stream: bool = False

class ToolTestRequest(BaseModel):
    tool_name: str
    params: Dict[str, Any] = {}

class AgentToolsUpdateRequest(BaseModel):
    agent_id: int
    tools: List[str]

# =============================================
# DEPENDENCY
# =============================================

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session

def get_current_user() -> int:
    return 1  # Para desenvolvimento

# =============================================
# ROTAS DE FERRAMENTAS
# =============================================

@router.get("/tools")
async def list_available_tools():
    """Lista todas as ferramentas Agno disponíveis (REAIS)"""
    try:
        agno_service = get_real_agno_service()
        tools = agno_service.get_available_tools_info()

        return {
            "status": "success",
            "framework": "agno_real",
            "total_tools": len(tools),
            "tools": tools
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar ferramentas: {str(e)}")

@router.post("/tools/test")
async def test_tool(request: ToolTestRequest):
    """Testa uma ferramenta específica do Agno"""
    try:
        agno_service = get_real_agno_service()
        result = agno_service.test_tool(request.tool_name, request.params)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao testar ferramenta: {str(e)}")

@router.get("/health")
async def agno_health_check():
    """Verifica saúde do sistema Agno REAL"""
    try:
        if not AGNO_AVAILABLE:
            return {
                "status": "unavailable",
                "framework": "agno_real",
                "error": "Agno framework não instalado",
                "install_command": "pip install agno openai duckduckgo-search yfinance"
            }

        agno_service = get_real_agno_service()
        health = agno_service.get_system_health()

        return {
            "status": health["overall_status"],
            "framework": "agno_real",
            "timestamp": datetime.utcnow().isoformat(),
            **health
        }

    except Exception as e:
        return {
            "status": "error",
            "framework": "agno_real",
            "error": str(e)
        }

# =============================================
# ROTAS DE EXECUÇÃO COM BANCO EXISTENTE
# =============================================

@router.post("/agents/{agent_id}/execute")
async def execute_agent_with_real_tools(
        agent_id: int,
        request: AgentExecuteRequest,
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Executa um agente REAL usando configurações do banco existente"""
    try:
        agno_service = get_real_agno_service()

        # Buscar configuração do agente no banco existente
        query = sa_text("""
            SELECT 
                id, name, description, role, model_provider, model_id,
                instructions, tools, memory_enabled, rag_enabled
            FROM agno_agents 
            WHERE id = :agent_id AND user_id = :user_id AND is_active = true
        """)

        result = await db.execute(query, {"agent_id": agent_id, "user_id": user_id})
        agent_row = result.fetchone()

        if not agent_row:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        # Montar configuração do agente
        agent_config = {
            "name": agent_row.name,
            "description": agent_row.description,
            "role": agent_row.role,
            "model_provider": agent_row.model_provider,
            "model_id": agent_row.model_id,
            "instructions": agent_row.instructions if isinstance(agent_row.instructions, list) else [str(agent_row.instructions)]
        }

        # Ferramentas: usar as do request ou as do banco
        tools_to_use = request.tools
        if not tools_to_use and agent_row.tools:
            # Converter ferramentas do banco para nomes do Agno
            db_tools = agent_row.tools if isinstance(agent_row.tools, list) else []
            tools_mapping = {
                "web_search": "duckduckgo",
                "financial": "yfinance",
                "calculations": "calculator",
                "reasoning": "reasoning",
                "image_generation": "dalle",
                "code_interpreter": "reasoning"
            }

            tools_to_use = []
            for db_tool in db_tools:
                agno_tool = tools_mapping.get(db_tool, db_tool)
                tools_to_use.append(agno_tool)

        # Executar com serviço real
        result = agno_service.execute_agent_task(
            agent_config=agent_config,
            prompt=request.prompt,
            tools_list=tools_to_use,
            stream=request.stream
        )

        # Salvar log da execução no banco
        if result["status"] == "success":
            await _save_execution_log(db, agent_id, user_id, request.prompt, result)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na execução: {str(e)}")

@router.post("/agents/{agent_id}/execute/stream")
async def execute_agent_stream_real(
        agent_id: int,
        request: AgentExecuteRequest,
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Executa agente REAL com streaming de resposta"""
    try:
        agno_service = get_real_agno_service()

        # Buscar configuração do agente (mesmo código acima)
        query = sa_text("""
            SELECT 
                id, name, description, role, model_provider, model_id,
                instructions, tools, memory_enabled, rag_enabled
            FROM agno_agents 
            WHERE id = :agent_id AND user_id = :user_id AND is_active = true
        """)

        result = await db.execute(query, {"agent_id": agent_id, "user_id": user_id})
        agent_row = result.fetchone()

        if not agent_row:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        agent_config = {
            "name": agent_row.name,
            "description": agent_row.description,
            "role": agent_row.role,
            "model_provider": agent_row.model_provider,
            "model_id": agent_row.model_id,
            "instructions": agent_row.instructions if isinstance(agent_row.instructions, list) else [str(agent_row.instructions)]
        }

        # Processar ferramentas
        tools_to_use = request.tools
        if not tools_to_use and agent_row.tools:
            db_tools = agent_row.tools if isinstance(agent_row.tools, list) else []
            tools_mapping = {
                "web_search": "duckduckgo",
                "financial": "yfinance",
                "calculations": "calculator",
                "reasoning": "reasoning",
                "image_generation": "dalle"
            }

            tools_to_use = [tools_mapping.get(db_tool, db_tool) for db_tool in db_tools]

        # Preparar para streaming
        stream_result = agno_service.execute_agent_task(
            agent_config=agent_config,
            prompt=request.prompt,
            tools_list=tools_to_use,
            stream=True
        )

        if stream_result["status"] != "ready_for_stream":
            raise HTTPException(status_code=500, detail="Erro ao preparar streaming")

        agent = stream_result["agent"]
        prompt = stream_result["prompt"]

        async def generate_stream():
            try:
                # Usar o gerador de streaming real
                for chunk_data in agno_service.create_streaming_generator(agent, prompt):
                    yield f"data: {json.dumps(chunk_data)}\n\n"

                # Salvar log após conclusão
                await _save_execution_log(db, agent_id, user_id, prompt, {
                    "status": "success",
                    "execution_time_ms": 0,
                    "tools_used": len(tools_to_use)
                })

            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no streaming: {str(e)}")

# =============================================
# ROTAS DE GERENCIAMENTO DE FERRAMENTAS
# =============================================

@router.put("/agents/{agent_id}/tools")
async def update_agent_tools_real(
        agent_id: int,
        request: AgentToolsUpdateRequest,
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Atualiza ferramentas de um agente no banco existente"""
    try:
        # Mapear ferramentas do Agno para formato do banco
        agno_to_db_mapping = {
            "duckduckgo": "web_search",
            "yfinance": "financial",
            "calculator": "calculations",
            "reasoning": "reasoning",
            "dalle": "image_generation"
        }

        db_tools = []
        for agno_tool in request.tools:
            db_tool = agno_to_db_mapping.get(agno_tool, agno_tool)
            db_tools.append(db_tool)

        # Atualizar no banco
        update_query = sa_text("""
            UPDATE agno_agents 
            SET tools = :tools, updated_at = CURRENT_TIMESTAMP
            WHERE id = :agent_id AND user_id = :user_id
        """)

        await db.execute(update_query, {
            "agent_id": agent_id,
            "user_id": user_id,
            "tools": json.dumps(db_tools)
        })

        await db.commit()

        return {
            "status": "success",
            "message": f"Ferramentas atualizadas para agente {agent_id}",
            "agno_tools": request.tools,
            "db_tools": db_tools
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar ferramentas: {str(e)}")

@router.get("/agents/{agent_id}/tools")
async def get_agent_tools_real(
        agent_id: int,
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Lista ferramentas configuradas para um agente no banco existente"""
    try:
        query = sa_text("""
            SELECT tools FROM agno_agents 
            WHERE id = :agent_id AND user_id = :user_id AND is_active = true
        """)

        result = await db.execute(query, {"agent_id": agent_id, "user_id": user_id})
        agent_row = result.fetchone()

        if not agent_row:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        # Converter ferramentas do banco para nomes do Agno
        db_tools = agent_row.tools if isinstance(agent_row.tools, list) else []

        db_to_agno_mapping = {
            "web_search": "duckduckgo",
            "financial": "yfinance",
            "calculations": "calculator",
            "reasoning": "reasoning",
            "image_generation": "dalle"
        }

        agno_tools = []
        for db_tool in db_tools:
            agno_tool = db_to_agno_mapping.get(db_tool, db_tool)
            agno_tools.append(agno_tool)

        return {
            "agent_id": agent_id,
            "db_tools": db_tools,
            "agno_tools": agno_tools,
            "total_tools": len(agno_tools)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar ferramentas: {str(e)}")

# =============================================
# ROTAS DE LOGS E MONITORAMENTO
# =============================================

@router.get("/executions")
async def get_execution_logs_real(
        agent_id: Optional[int] = Query(None),
        user_id: int = Depends(get_current_user),
        limit: int = Query(50, ge=1, le=200),
        db: AsyncSession = Depends(get_db)
):
    """Recupera logs de execução do banco existente"""
    try:
        # Buscar logs na tabela de sessões existente
        base_query = """
            SELECT 
                s.id,
                s.agent_id,
                a.name as agent_name,
                s.messages,
                s.created_at,
                s.status
            FROM agno_chat_sessions s
            JOIN agno_agents a ON s.agent_id = a.id
            WHERE s.user_id = :user_id
        """

        params = {"user_id": user_id}

        if agent_id:
            base_query += " AND s.agent_id = :agent_id"
            params["agent_id"] = agent_id

        base_query += " ORDER BY s.created_at DESC LIMIT :limit"
        params["limit"] = limit

        query = sa_text(base_query)
        result = await db.execute(query, params)
        rows = result.fetchall()

        executions = []
        for row in rows:
            # Extrair informações das mensagens
            messages = row.messages if isinstance(row.messages, list) else []

            # Encontrar última mensagem do usuário e resposta
            user_message = None
            assistant_message = None

            for msg in messages:
                if msg.get("role") == "user":
                    user_message = msg.get("content", "")
                elif msg.get("role") == "assistant":
                    assistant_message = msg.get("content", "")

            executions.append({
                "id": row.id,
                "agent_name": row.agent_name,
                "user_prompt": user_message or "N/A",
                "assistant_response": (assistant_message or "")[:200] + "..." if assistant_message and len(assistant_message) > 200 else assistant_message,
                "status": row.status or "completed",
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "framework": "agno_real"
            })

        return {
            "total": len(executions),
            "executions": executions,
            "framework": "agno_real"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar logs: {str(e)}")

@router.get("/stats")
async def get_usage_statistics_real(
        days: int = Query(30, ge=1, le=365),
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Estatísticas de uso do sistema Agno REAL"""
    try:
        # Estatísticas baseadas no banco existente
        stats_query = sa_text("""
            SELECT 
                COUNT(*) as total_sessions,
                COUNT(DISTINCT agent_id) as unique_agents,
                AVG(array_length(messages, 1)) as avg_messages_per_session
            FROM agno_chat_sessions 
            WHERE user_id = :user_id 
            AND created_at >= CURRENT_DATE - INTERVAL '%s days'
        """ % days)

        result = await db.execute(stats_query, {"user_id": user_id})
        stats_row = result.fetchone()

        # Buscar agentes mais usados
        agents_query = sa_text("""
            SELECT 
                a.name,
                a.model_provider,
                a.model_id,
                COUNT(s.id) as usage_count
            FROM agno_agents a
            LEFT JOIN agno_chat_sessions s ON a.id = s.agent_id 
                AND s.user_id = :user_id 
                AND s.created_at >= CURRENT_DATE - INTERVAL '%s days'
            WHERE a.user_id = :user_id AND a.is_active = true
            GROUP BY a.id, a.name, a.model_provider, a.model_id
            ORDER BY usage_count DESC
            LIMIT 10
        """ % days)

        agents_result = await db.execute(agents_query, {"user_id": user_id})
        agents_rows = agents_result.fetchall()

        return {
            "period_days": days,
            "framework": "agno_real",
            "total_sessions": stats_row.total_sessions or 0,
            "unique_agents": stats_row.unique_agents or 0,
            "avg_messages_per_session": round(stats_row.avg_messages_per_session or 0, 1),
            "top_agents": [
                {
                    "name": row.name,
                    "model": f"{row.model_provider}/{row.model_id}",
                    "usage_count": row.usage_count
                }
                for row in agents_rows
            ],
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter estatísticas: {str(e)}")

# =============================================
# FUNÇÕES AUXILIARES
# =============================================

async def _save_execution_log(
        db: AsyncSession,
        agent_id: int,
        user_id: int,
        prompt: str,
        result: Dict[str, Any]
):
    """Salva log de execução na tabela existente"""
    try:
        # Criar sessão de chat no formato existente
        session_data = {
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "timestamp": datetime.utcnow().isoformat()
                },
                {
                    "role": "assistant",
                    "content": result.get("response", ""),
                    "timestamp": datetime.utcnow().isoformat(),
                    "metadata": {
                        "framework": "agno_real",
                        "execution_time_ms": result.get("execution_time_ms"),
                        "tools_used": result.get("tools_used"),
                        "model_used": result.get("model_used")
                    }
                }
            ]
        }

        insert_query = sa_text("""
            INSERT INTO agno_chat_sessions (user_id, agent_id, messages, status, created_at)
            VALUES (:user_id, :agent_id, :messages, :status, CURRENT_TIMESTAMP)
        """)

        await db.execute(insert_query, {
            "user_id": user_id,
            "agent_id": agent_id,
            "messages": json.dumps(session_data["messages"]),
            "status": result.get("status", "completed")
        })

        await db.commit()

    except Exception as e:
        print(f"Erro ao salvar log: {e}")
        await db.rollback()
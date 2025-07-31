# supabase_client_fixed.py - Cliente Supabase corrigido

import os
import httpx
from supabase import create_client, Client
import bcrypt
from datetime import datetime
import logging
from api.logging_config import log_error, log_info
import time

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def hash_senha(senha):
    """Gera o hash da senha."""
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_senha(senha, hash_armazenado):
    """Verifica se a senha corresponde ao hash."""
    return bcrypt.checkpw(senha.encode("utf-8"), hash_armazenado.encode("utf-8"))


def create_optimized_supabase_client():
    """
    Cria cliente Supabase com configuração básica e estável
    """
    try:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")

        if not url or not key:
            log_error("SUPABASE_URL e SUPABASE_KEY devem estar configurados")
            raise ValueError("Configurações do Supabase não encontradas")

        log_info("Criando cliente Supabase...")

        # Usar cliente básico - mais estável
        supabase_client = create_client(url, key)

        log_info("Cliente Supabase criado com sucesso")
        return supabase_client

    except Exception as e:
        log_error(f"Erro ao criar cliente Supabase: {e}")
        raise


# Configurações do Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Verificar se as variáveis estão configuradas
if not SUPABASE_URL or not SUPABASE_KEY:
    log_error("SUPABASE_URL e SUPABASE_KEY devem estar configurados no arquivo .env")
    print("❌ ERRO: Configure as variáveis SUPABASE_URL e SUPABASE_KEY no arquivo .env")
    exit(1)

# Inicializa o cliente Supabase
try:
    supabase: Client = create_optimized_supabase_client()
    log_info("Cliente Supabase inicializado com sucesso")
    print("✅ Cliente Supabase conectado com sucesso")
except Exception as e:
    log_error(f"Falha ao inicializar cliente Supabase: {e}")
    print(f"❌ Erro ao conectar com Supabase: {e}")
    exit(1)


def safe_supabase_query(query_func, max_retries=3, operation_name="consulta"):
    """
    Wrapper para consultas Supabase com retry automático e timeout inteligente
    """
    for attempt in range(max_retries):
        start_time = time.time()
        try:
            log_info(f"Executando {operation_name} - tentativa {attempt + 1}/{max_retries}")

            result = query_func()

            elapsed = time.time() - start_time
            log_info(f"{operation_name} executada com sucesso em {elapsed:.2f}s")
            return result

        except Exception as e:
            elapsed = time.time() - start_time
            log_error(f"Tentativa {attempt + 1} de {operation_name} falhou após {elapsed:.2f}s: {e}")

            if attempt == max_retries - 1:
                log_error(f"Todas as {max_retries} tentativas de {operation_name} falharam")
                raise

            # Backoff exponencial com jitter
            sleep_time = min((attempt + 1) * 2, 10)  # Max 10 segundos
            log_info(f"Aguardando {sleep_time}s antes da próxima tentativa...")
            time.sleep(sleep_time)


def testar_login(nome, senha):
    """
    Testa credenciais de login com retry automático e tratamento robusto de erros.
    """

    def login_query():
        return supabase.table("usuarios").select("*").eq("nome", nome).execute()

    try:
        log_info(f"Iniciando teste de login para usuário: {nome}")
        start_time = time.time()

        # Busca o usuário com retry automático
        try:
            response = safe_supabase_query(login_query, operation_name="busca de usuário")
        except Exception as e:
            if "relation \"usuarios\" does not exist" in str(e):
                log_error("Tabela 'usuarios' não encontrada.")
                return False, None
            raise

        elapsed = time.time() - start_time
        log_info(f"Busca de usuário completada em {elapsed:.2f}s")

        usuario = response.data[0] if response.data else None

        if not usuario:
            log_info("Usuário não encontrado.")
            return False, None

        # Verifica se o campo senha existe
        if 'senha' not in usuario:
            log_error("Campo 'senha' não encontrado no registro do usuário.")
            return False, None

        # Verifica a senha com tratamento de erros
        try:
            senha_valida = verificar_senha(senha, usuario["senha"])
            log_info(f"Verificação de senha: {'válida' if senha_valida else 'inválida'}")
        except Exception as e:
            log_error(f"Erro ao verificar senha: {e}")
            # Tentar alternativa - comparação direta (APENAS PARA DESENVOLVIMENTO)
            senha_valida = senha == usuario["senha"]
            if senha_valida:
                log_error("AVISO: Usando comparação direta de senha. Isso é inseguro para produção.")

        if senha_valida:
            role = usuario.get("tipo_usuario", "regular_user")  # Default para compatibilidade
            total_elapsed = time.time() - start_time
            log_info(f"Login bem-sucedido em {total_elapsed:.2f}s! Usuário: {usuario['nome']}, Role: {role}")
            return True, usuario
        else:
            log_info("Senha incorreta.")
            return False, None

    except Exception as e:
        elapsed = time.time() - start_time if 'start_time' in locals() else 0
        log_error(f"Erro ao realizar login após {elapsed:.2f}s: {e}")
        return False, None


def is_bcrypt_hash(value):
    """Verifica se o valor é um hash bcrypt válido"""
    return value.startswith("$2b$") or value.startswith("$2a$") or value.startswith("$2y$")


def get_api_key(usuario_id):
    """
    Obtém a chave API com retry automático e tratamento robusto de erros.
    """

    def api_key_query():
        return supabase.table("api_keys") \
            .select("chave, status") \
            .eq("user_id", usuario_id) \
            .execute()

    def user_query():
        return supabase.table("usuarios").select("is_admin, tipo_usuario") \
            .eq("id", usuario_id) \
            .single() \
            .execute()

    def projeto_query():
        return supabase.table("projeto_usuarios") \
            .select("projeto_id") \
            .eq("usuario_id", usuario_id) \
            .eq("ativo", True) \
            .execute()

    try:
        log_info(f"Buscando API key para usuário {usuario_id}")
        start_time = time.time()

        # Abordagem direta: buscar primeiro uma chave direta para o usuário
        try:
            direct_key_response = safe_supabase_query(
                api_key_query,
                operation_name="busca de API key direta"
            )

            if direct_key_response.data:
                # Verificar se há alguma chave ativa
                active_keys = [k for k in direct_key_response.data if k.get('status') == 'active']
                if active_keys:
                    elapsed = time.time() - start_time
                    log_info(f"API key ativa encontrada em {elapsed:.2f}s para usuário {usuario_id}")
                    return active_keys[0]['chave']

                # Se não houver chaves ativas, mas houver chaves
                if direct_key_response.data:
                    log_info(f"API key inativa encontrada para usuário {usuario_id}, ativando...")
                    # Ativar a primeira chave encontrada
                    key_id = direct_key_response.data[0].get('id')
                    if key_id:
                        def activate_key():
                            return supabase.table("api_keys").update({"status": "active"}).eq("id", key_id).execute()

                        safe_supabase_query(activate_key, operation_name="ativação de API key")

                    elapsed = time.time() - start_time
                    log_info(f"API key ativada em {elapsed:.2f}s")
                    return direct_key_response.data[0]['chave']
        except Exception as e:
            log_error(f"Erro ao buscar API key direta: {e}")

        # Para simplificar, vamos sempre retornar a chave do ambiente se não encontrar no banco
        env_api_key = os.getenv('OPENAI_API_KEY')
        if env_api_key:
            elapsed = time.time() - start_time
            log_info(f"Usando API key global de ambiente para usuário {usuario_id} ({elapsed:.2f}s)")
            return env_api_key

        elapsed = time.time() - start_time
        log_error(f"Nenhuma API key encontrada para usuário {usuario_id} após {elapsed:.2f}s")
        return None

    except Exception as e:
        elapsed = time.time() - start_time if 'start_time' in locals() else 0
        log_error(f"Erro ao buscar a chave API após {elapsed:.2f}s: {e}")
        # Usar chave global como fallback
        return os.getenv('OPENAI_API_KEY')


def health_check():
    """
    Verifica se a conexão com Supabase está funcionando
    """

    def health_query():
        return supabase.table("usuarios").select("count").limit(1).execute()

    try:
        log_info("Executando health check do Supabase...")
        start_time = time.time()

        response = safe_supabase_query(health_query, max_retries=2, operation_name="health check")

        elapsed = time.time() - start_time
        log_info(f"Health check bem-sucedido em {elapsed:.2f}s")
        return True, f"Conexão OK ({elapsed:.2f}s)"

    except Exception as e:
        log_error(f"Health check falhou: {e}")
        return False, str(e)


# Teste inicial de conexão
if __name__ == "__main__":
    print("🧪 Testando conexão com Supabase...")

    try:
        is_healthy, message = health_check()
        if is_healthy:
            print(f"✅ {message}")
        else:
            print(f"❌ Erro: {message}")
    except Exception as e:
        print(f"❌ Erro ao testar conexão: {e}")

    # Testar API key
    print("\n🔑 Testando busca de API key...")
    try:
        api_key = get_api_key(1)  # Testar com usuário ID 1
        if api_key:
            print(f"✅ API key encontrada: {api_key[:20]}...")
        else:
            print("❌ API key não encontrada")
    except Exception as e:
        print(f"❌ Erro ao buscar API key: {e}")
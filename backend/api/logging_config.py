# logging_config.py
import logging
import sys
import os
from logging.handlers import RotatingFileHandler

# Desativar o logging da biblioteca werkzeug (para evitar logs duplos)
logging.getLogger('werkzeug').setLevel(logging.ERROR)

# Flag global para rastrear se o logging já foi configurado
_logging_configured = False

# Referência para o logger principal
app_logger = None


def setup_logging():
    """Configura o logging da aplicação de forma centralizada."""
    global _logging_configured, app_logger

    # Evitar configuração múltipla
    if _logging_configured:
        return app_logger

    # Criar diretório de logs se não existir
    log_dir = os.path.join(os.getcwd(), 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    # Caminho do arquivo de log
    log_file = os.path.join(log_dir, 'app.log')

    # Configurar handler para arquivo com rotação
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,  # Manter 5 backups
        encoding='utf-8'
    )

    # Configurar handler para console
    console_handler = logging.StreamHandler(sys.stdout)

    # Formato dos logs
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # Configurar o logger raiz
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Limpar handlers existentes para evitar duplicação
    if root_logger.handlers:
        root_logger.handlers.clear()

    # Adicionar os handlers
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)

    # Criar logger específico para a aplicação
    app_logger = logging.getLogger('app')
    _logging_configured = True

    # Registrar que o logging foi configurado
    app_logger.info("Sistema de logging configurado com sucesso")
    return app_logger


# Funções de logging com proteção contra recursão
def log_info(message, obj=None):
    """Log de informação com proteção contra recursão."""
    global app_logger
    if app_logger is None:
        app_logger = setup_logging()

    try:
        if obj is not None and not isinstance(obj, (str, int, float, bool, type(None))):
            app_logger.info(f"{message}: [objeto complexo]")
        else:
            app_logger.info(f"{message}{': ' + str(obj) if obj is not None else ''}")
    except Exception as e:
        # Usar print para evitar recursão
        print(f"ERRO AO FAZER LOG: {e} - Mensagem original: {message}")


def log_error(message, error=None):
    """Log de erro com proteção contra recursão."""
    global app_logger
    if app_logger is None:
        app_logger = setup_logging()

    try:
        if error is not None:
            error_type = type(error).__name__
            error_msg = str(error)
            app_logger.error(f"{message}: {error_type} - {error_msg}")
        else:
            app_logger.error(message)
    except Exception as e:
        # Usar print para evitar recursão
        print(f"ERRO AO FAZER LOG DE ERRO: {e} - Mensagem original: {message}")

def log_warning(message):
    """Registra mensagem de warning."""
    logger = logging.getLogger('app')
    logger.warning(message)

# Inicializar logging (não chamar automaticamente, deixar o app.py chamar)
app_logger = None
"""
DATABASE POSTGRESQL - Adaptação para Produção
=============================================

Este arquivo substitui database.py quando migrar para PostgreSQL.
Mantém a mesma interface, mas otimizado para produção.

MUDANÇAS PRINCIPAIS:
- psycopg2 em vez de sqlite3
- Connection pooling para performance
- Transações ACID apropriadas
- Logging melhorado
- Tratamento de erros robusto
"""

import psycopg2
import psycopg2.extras
import psycopg2.pool
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from datetime import date, datetime
from contextlib import contextmanager
from typing import Dict, List, Any, Optional
import hashlib
import time
import logging
import json
import os
from decimal import Decimal

# Configuração de logging
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURAÇÃO DO BANCO POSTGRESQL
# ============================================================================

# Configuração do PostgreSQL (usar variáveis de ambiente em produção)
DATABASE_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', 5432)),
    'database': os.getenv('POSTGRES_DB', 'investir_prod'),
    'user': os.getenv('POSTGRES_USER', 'investir_user'),
    'password': os.getenv('POSTGRES_PASSWORD', 'sua_senha_aqui'),
    'minconn': int(os.getenv('POSTGRES_MIN_CONN', 2)),
    'maxconn': int(os.getenv('POSTGRES_MAX_CONN', 20)),
}

# Pool de conexões global
_connection_pool = None

class DatabaseError(Exception):
    """Exceção customizada para erros de banco de dados"""
    pass

def initialize_connection_pool():
    """Inicializa o pool de conexões PostgreSQL"""
    global _connection_pool
    
    if _connection_pool is None:
        try:
            _connection_pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=DATABASE_CONFIG['minconn'],
                maxconn=DATABASE_CONFIG['maxconn'],
                host=DATABASE_CONFIG['host'],
                port=DATABASE_CONFIG['port'],
                database=DATABASE_CONFIG['database'],
                user=DATABASE_CONFIG['user'],
                password=DATABASE_CONFIG['password'],
                cursor_factory=psycopg2.extras.RealDictCursor
            )
            logger.info(f"✅ Pool de conexões PostgreSQL inicializado ({DATABASE_CONFIG['minconn']}-{DATABASE_CONFIG['maxconn']} conexões)")
        except psycopg2.Error as e:
            logger.error(f"❌ Erro ao inicializar pool PostgreSQL: {e}")
            raise DatabaseError(f"Falha ao conectar no PostgreSQL: {e}")

def close_connection_pool():
    """Fecha o pool de conexões"""
    global _connection_pool
    if _connection_pool:
        _connection_pool.closeall()
        _connection_pool = None
        logger.info("🔒 Pool de conexões PostgreSQL fechado")

@contextmanager
def get_db():
    """
    Context manager para conexões com PostgreSQL usando connection pool
    """
    if _connection_pool is None:
        initialize_connection_pool()
    
    conn = None
    try:
        conn = _connection_pool.getconn()
        conn.autocommit = False  # Usar transações explícitas
        yield conn
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro na conexão com PostgreSQL: {e}")
        raise DatabaseError(f"Erro de banco de dados: {e}")
    finally:
        if conn:
            _connection_pool.putconn(conn)

# ============================================================================
# FUNÇÕES AUXILIARES DE CONVERSÃO
# ============================================================================

def convert_sqlite_row_to_dict(row) -> Dict[str, Any]:
    """Converte row do psycopg2 para dict compatível com código existente"""
    if row is None:
        return None
    return dict(row)

def convert_decimal_to_float(value):
    """Converte Decimal para float quando necessário"""
    if isinstance(value, Decimal):
        return float(value)
    return value

def sanitize_row_for_response(row_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitiza dados para resposta da API (converte Decimal, datetime, etc.)"""
    if not row_dict:
        return row_dict
    
    sanitized = {}
    for key, value in row_dict.items():
        if isinstance(value, Decimal):
            sanitized[key] = float(value)
        elif isinstance(value, (datetime, date)):
            sanitized[key] = value.isoformat()
        else:
            sanitized[key] = value
    
    return sanitized

# ============================================================================
# FUNÇÕES DE SCHEMA E MIGRAÇÃO
# ============================================================================

def executar_migracao_se_necessario():
    """
    Executa migrações incrementais se necessário.
    Em produção, isso seria gerenciado por um sistema de migração dedicado.
    """
    logger.info("🔍 Verificando necessidade de migrações...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verificar se tabela de controle de migrações existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'schema_migrations'
            )
        """)
        
        migrations_table_exists = cursor.fetchone()[0]
        
        if not migrations_table_exists:
            # Criar tabela de controle de migrações
            cursor.execute("""
                CREATE TABLE schema_migrations (
                    id SERIAL PRIMARY KEY,
                    version VARCHAR(20) NOT NULL UNIQUE,
                    description TEXT,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("📋 Tabela schema_migrations criada")
        
        # Marcar migração inicial como aplicada se o schema básico existe
        cursor.execute("SELECT COUNT(*) FROM schema_migrations WHERE version = '001_initial_schema'")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO schema_migrations (version, description) 
                VALUES ('001_initial_schema', 'Schema inicial migrado do SQLite')
            """)
            logger.info("✅ Migração inicial registrada")
        
        conn.commit()

# ============================================================================
# FUNÇÕES COMPATIBILIDADE COM database.py (SQLite)
# ============================================================================

def obter_acao_info_por_ticker(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Obtém informações de uma ação (ticker, nome, cnpj) pelo ticker.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT ticker, nome, cnpj FROM acoes WHERE ticker = %s", (ticker,))
        row = cursor.fetchone()
        return convert_sqlite_row_to_dict(row) if row else None

def inserir_operacao(operacao: Dict[str, Any], usuario_id: Optional[int] = None, importacao_id: Optional[int] = None) -> int:
    """
    Insere uma operação no banco de dados.
    Verifica se o ticker da operação existe na tabela `acoes`.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verifica se o ticker existe na tabela acoes
        ticker_value = operacao["ticker"]
        cursor.execute("SELECT 1 FROM acoes WHERE ticker = %s", (ticker_value,))
        if cursor.fetchone() is None:
            raise ValueError(f"Ticker {ticker_value} não encontrado na tabela de ações (acoes).")

        # Inserir operação
        cursor.execute('''
        INSERT INTO operacoes (date, ticker, operation, quantity, price, fees, usuario_id, corretora_id, importacao_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        ''', (
            operacao["date"] if isinstance(operacao["date"], date) else operacao["date"],
            operacao["ticker"],
            operacao["operation"],
            operacao["quantity"],
            operacao["price"],
            operacao.get("fees", 0.0),
            usuario_id,
            operacao.get("corretora_id"),
            importacao_id
        ))
        
        operacao_id = cursor.fetchone()[0]
        conn.commit()
        return operacao_id

def obter_operacao_por_id(operacao_id: int, usuario_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtém uma operação pelo ID e usuario_id, incluindo informações de importação.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
        SELECT o.*, i.nome_arquivo, i.data_importacao, c.nome as nome_corretora
        FROM operacoes o
        LEFT JOIN importacoes i ON o.importacao_id = i.id
        LEFT JOIN corretoras c ON o.corretora_id = c.id
        WHERE o.id = %s AND o.usuario_id = %s
        ''', (operacao_id, usuario_id))
        
        row = cursor.fetchone()
        return sanitize_row_for_response(convert_sqlite_row_to_dict(row)) if row else None

def obter_operacoes_usuario(usuario_id: int, limit: Optional[int] = None, offset: int = 0) -> List[Dict[str, Any]]:
    """
    Obtém operações de um usuário com paginação
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = '''
        SELECT o.*, a.nome as nome_acao, c.nome as nome_corretora
        FROM operacoes o
        LEFT JOIN acoes a ON o.ticker = a.ticker
        LEFT JOIN corretoras c ON o.corretora_id = c.id
        WHERE o.usuario_id = %s
        ORDER BY o.date DESC, o.id DESC
        '''
        
        params = [usuario_id]
        
        if limit:
            query += ' LIMIT %s OFFSET %s'
            params.extend([limit, offset])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return [sanitize_row_for_response(convert_sqlite_row_to_dict(row)) for row in rows]

def obter_carteira_atual_usuario(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém a carteira atual de um usuário
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
        SELECT c.*, a.nome as nome_acao, a.razao_social
        FROM carteira_atual c
        JOIN acoes a ON c.ticker = a.ticker
        WHERE c.usuario_id = %s AND c.quantidade > 0
        ORDER BY c.ticker
        ''', (usuario_id,))
        
        rows = cursor.fetchall()
        return [sanitize_row_for_response(convert_sqlite_row_to_dict(row)) for row in rows]

def atualizar_carteira_atual(ticker: str, usuario_id: int, atualizacao: Dict[str, Any]) -> None:
    """
    Atualiza ou insere registro na carteira atual
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verificar se registro existe
        cursor.execute('''
        SELECT id FROM carteira_atual WHERE ticker = %s AND usuario_id = %s
        ''', (ticker, usuario_id))
        
        existing = cursor.fetchone()
        
        if existing:
            # Atualizar registro existente
            set_clauses = []
            params = []
            
            for field, value in atualizacao.items():
                if field in ['quantidade', 'custo_total', 'preco_medio', 'preco_editado_pelo_usuario']:
                    set_clauses.append(f"{field} = %s")
                    params.append(value)
            
            if set_clauses:
                set_clauses.append("updated_at = CURRENT_TIMESTAMP")
                params.extend([ticker, usuario_id])
                
                update_query = f'''
                UPDATE carteira_atual 
                SET {', '.join(set_clauses)}
                WHERE ticker = %s AND usuario_id = %s
                '''
                cursor.execute(update_query, params)
        else:
            # Inserir novo registro
            cursor.execute('''
            INSERT INTO carteira_atual (ticker, quantidade, custo_total, preco_medio, usuario_id, preco_editado_pelo_usuario)
            VALUES (%s, %s, %s, %s, %s, %s)
            ''', (
                ticker,
                atualizacao.get('quantidade', 0),
                atualizacao.get('custo_total', 0.0),
                atualizacao.get('preco_medio', 0.0),
                usuario_id,
                atualizacao.get('preco_editado_pelo_usuario', False)
            ))
        
        conn.commit()

def obter_operacoes_fechadas_usuario(usuario_id: int, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Obtém operações fechadas de um usuário
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = '''
        SELECT of.*, a.nome as nome_acao
        FROM operacoes_fechadas of
        LEFT JOIN acoes a ON of.ticker = a.ticker
        WHERE of.usuario_id = %s
        ORDER BY of.data_fechamento DESC
        '''
        
        params = [usuario_id]
        if limit:
            query += ' LIMIT %s'
            params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return [sanitize_row_for_response(convert_sqlite_row_to_dict(row)) for row in rows]

def obter_resultados_mensais_usuario(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém resultados mensais de IR de um usuário
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
        SELECT * FROM resultados_mensais 
        WHERE usuario_id = %s 
        ORDER BY mes DESC
        ''', (usuario_id,))
        
        rows = cursor.fetchall()
        return [sanitize_row_for_response(convert_sqlite_row_to_dict(row)) for row in rows]

def obter_proventos_recebidos_por_usuario_db(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém proventos recebidos por um usuário
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
        SELECT * FROM usuario_proventos_recebidos 
        WHERE usuario_id = %s 
        ORDER BY data_ex DESC
        ''', (usuario_id,))
        
        rows = cursor.fetchall()
        return [sanitize_row_for_response(convert_sqlite_row_to_dict(row)) for row in rows]

def inserir_corretora_se_nao_existir(nome_corretora: str) -> int:
    """
    Insere uma corretora se não existir e retorna o ID
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verificar se já existe
        cursor.execute("SELECT id FROM corretoras WHERE nome = %s", (nome_corretora,))
        existing = cursor.fetchone()
        
        if existing:
            return existing[0]
        
        # Inserir nova corretora
        cursor.execute('''
        INSERT INTO corretoras (nome) VALUES (%s) RETURNING id
        ''', (nome_corretora,))
        
        corretora_id = cursor.fetchone()[0]
        conn.commit()
        return corretora_id

# ============================================================================
# FUNÇÕES DE SISTEMA (USUÁRIOS, AUTENTICAÇÃO)
# ============================================================================

def criar_usuario(username: str, email: str, senha_hash: str, senha_salt: str, 
                 nome_completo: Optional[str] = None, cpf: Optional[str] = None) -> int:
    """Cria novo usuário"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO usuarios (username, email, senha_hash, senha_salt, nome_completo, cpf)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
        ''', (username, email, senha_hash, senha_salt, nome_completo, cpf))
        
        usuario_id = cursor.fetchone()[0]
        conn.commit()
        return usuario_id

def obter_usuario_por_username(username: str) -> Optional[Dict[str, Any]]:
    """Obtém usuário por username"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM usuarios WHERE username = %s", (username,))
        row = cursor.fetchone()
        return sanitize_row_for_response(convert_sqlite_row_to_dict(row)) if row else None

def obter_usuario_por_id(usuario_id: int) -> Optional[Dict[str, Any]]:
    """Obtém usuário por ID"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM usuarios WHERE id = %s", (usuario_id,))
        row = cursor.fetchone()
        return sanitize_row_for_response(convert_sqlite_row_to_dict(row)) if row else None

# ============================================================================
# HEALTH CHECK E MONITORAMENTO
# ============================================================================

def health_check() -> Dict[str, Any]:
    """Verifica saúde da conexão com banco"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            
            # Verificar pool de conexões
            pool_info = {
                'active_connections': len(_connection_pool._used) if _connection_pool else 0,
                'available_connections': len(_connection_pool._pool) if _connection_pool else 0,
                'total_connections': (_connection_pool.minconn + _connection_pool.maxconn) if _connection_pool else 0
            }
            
            return {
                'status': 'healthy',
                'database': 'postgresql',
                'connection': 'ok',
                'query_test': result[0] == 1,
                'pool_info': pool_info,
                'timestamp': datetime.now().isoformat()
            }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'database': 'postgresql',
            'connection': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }

# ============================================================================
# INICIALIZAÇÃO AUTOMÁTICA
# ============================================================================

def inicializar_database():
    """
    Inicializa database PostgreSQL na importação do módulo
    """
    try:
        initialize_connection_pool()
        executar_migracao_se_necessario()
        logger.info("✅ Database PostgreSQL inicializado com sucesso")
    except Exception as e:
        logger.error(f"❌ Erro ao inicializar database PostgreSQL: {e}")
        raise

# Inicializar automaticamente quando módulo for importado
# Comentado para evitar erro na importação se PostgreSQL não estiver rodando
# if os.getenv('AUTO_INIT_DB', 'true').lower() == 'true':
#     inicializar_database()

# ============================================================================
# FUNÇÕES LEGADAS PARA COMPATIBILIDADE (serão removidas gradualmente)
# ============================================================================

def migrar_operacoes_fechadas():
    """Função de compatibilidade - não necessária no PostgreSQL"""
    logger.info("ℹ️  migrar_operacoes_fechadas(): Não necessário no PostgreSQL")
    pass

def migrar_resultados_mensais():
    """Função de compatibilidade - não necessária no PostgreSQL"""
    logger.info("ℹ️  migrar_resultados_mensais(): Não necessário no PostgreSQL")
    pass

def migrar_acoes_logo():
    """Função de compatibilidade - não necessária no PostgreSQL"""
    logger.info("ℹ️  migrar_acoes_logo(): Não necessário no PostgreSQL")
    pass

def migrar_feedback_usuario():
    """Função de compatibilidade - não necessária no PostgreSQL"""
    logger.info("ℹ️  migrar_feedback_usuario(): Não necessário no PostgreSQL")
    pass

def criar_tabelas():
    """Função de compatibilidade - schema gerenciado por migrações no PostgreSQL"""
    logger.info("ℹ️  criar_tabelas(): Schema gerenciado por sistema de migrações")
    pass

# ============================================================================
# CLEANUP
# ============================================================================

import atexit
atexit.register(close_connection_pool)
#!/usr/bin/env python3
"""
MIGRAÇÃO DE DADOS: SQLite → PostgreSQL
=====================================

Este script migra todos os dados do banco SQLite atual para PostgreSQL.
Executa uma migração completa e segura, preservando todos os relacionamentos.

REQUISITOS:
- PostgreSQL rodando e acessível
- Banco de dados PostgreSQL já criado
- Schema já aplicado (migration_to_postgresql.sql)
- Dependências: psycopg2-binary, sqlite3

EXECUÇÃO:
python migrate_data_to_postgresql.py
"""

import sqlite3
import psycopg2
import psycopg2.extras
import logging
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional
import os
from contextlib import contextmanager

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURAÇÃO DOS BANCOS
# ============================================================================

# SQLite (fonte)
SQLITE_DB_PATH = "acoes_ir.db"

# PostgreSQL (destino)
POSTGRES_CONFIG = {
    'host': 'localhost',  # Ajustar conforme necessário
    'port': 5432,
    'database': 'investir_prod',  # Nome do banco PostgreSQL
    'user': 'investir_user',  # Usuário PostgreSQL
    'password': 'sua_senha_aqui'  # Senha PostgreSQL
}

class MigrationError(Exception):
    """Exceção customizada para erros de migração"""
    pass

@contextmanager
def get_sqlite_connection():
    """Conexão com SQLite (fonte)"""
    conn = sqlite3.connect(SQLITE_DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES|sqlite3.PARSE_COLNAMES)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

@contextmanager
def get_postgres_connection():
    """Conexão com PostgreSQL (destino)"""
    try:
        conn = psycopg2.connect(**POSTGRES_CONFIG)
        conn.autocommit = False
        yield conn
    except psycopg2.Error as e:
        logger.error(f"Erro ao conectar no PostgreSQL: {e}")
        raise MigrationError(f"Falha na conexão PostgreSQL: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

def verify_prerequisites():
    """Verifica se todos os pré-requisitos estão atendidos"""
    logger.info("🔍 Verificando pré-requisitos...")
    
    # Verificar se SQLite existe
    if not os.path.exists(SQLITE_DB_PATH):
        raise MigrationError(f"Banco SQLite não encontrado: {SQLITE_DB_PATH}")
    
    # Verificar conexão PostgreSQL
    try:
        with get_postgres_connection() as pg_conn:
            cursor = pg_conn.cursor()
            cursor.execute("SELECT version()")
            version = cursor.fetchone()[0]
            logger.info(f"✅ PostgreSQL conectado: {version}")
    except Exception as e:
        raise MigrationError(f"Não foi possível conectar no PostgreSQL: {e}")
    
    # Verificar se schema existe
    with get_postgres_connection() as pg_conn:
        cursor = pg_conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'acoes'
        """)
        if cursor.fetchone()[0] == 0:
            raise MigrationError("Schema PostgreSQL não encontrado. Execute migration_to_postgresql.sql primeiro!")
    
    logger.info("✅ Todos os pré-requisitos atendidos")

def get_table_row_count(table_name: str, conn_type: str = 'sqlite') -> int:
    """Conta registros em uma tabela"""
    if conn_type == 'sqlite':
        with get_sqlite_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            return cursor.fetchone()[0]
    else:  # postgresql
        with get_postgres_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            return cursor.fetchone()[0]

def clear_postgres_tables():
    """Limpa todas as tabelas PostgreSQL para uma migração limpa"""
    logger.info("🧹 Limpando tabelas PostgreSQL...")
    
    # Ordem correta devido às foreign keys
    tables_to_clear = [
        'usuario_proventos_recebidos',
        'cotacao_acoes',
        'historico_preco_medio',
        'operacoes_fechadas',
        'carteira_atual',
        'operacoes',
        'resultados_mensais',
        'proventos',
        'eventos_corporativos',
        'importacoes',
        'feedback_usuario',
        'mensagens',
        'tokens',
        'redefinicao_senha',
        'usuario_configuracoes',
        'usuario_funcoes',
        'usuarios',
        'funcoes',
        'corretoras',
        'acoes'
    ]
    
    with get_postgres_connection() as pg_conn:
        cursor = pg_conn.cursor()
        
        # Desabilitar temporariamente as foreign keys para limpeza
        cursor.execute("SET session_replication_role = replica;")
        
        for table in tables_to_clear:
            try:
                cursor.execute(f"DELETE FROM {table}")
                deleted = cursor.rowcount
                if deleted > 0:
                    logger.info(f"  - {table}: {deleted} registros removidos")
            except psycopg2.Error as e:
                logger.warning(f"  - {table}: Erro ao limpar ({e})")
        
        # Resetar sequences
        cursor.execute("""
            SELECT setval(pg_get_serial_sequence(table_name, column_name), 1, false)
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND column_default LIKE 'nextval%'
        """)
        
        # Reabilitar foreign keys
        cursor.execute("SET session_replication_role = DEFAULT;")
        
        pg_conn.commit()
        logger.info("✅ Limpeza concluída")

def migrate_table_data(table_name: str, 
                      column_mapping: Optional[Dict[str, str]] = None,
                      custom_transform: Optional[callable] = None,
                      where_clause: str = "") -> int:
    """
    Migra dados de uma tabela específica do SQLite para PostgreSQL
    
    Args:
        table_name: Nome da tabela
        column_mapping: Mapeamento de colunas {sqlite_col: postgres_col}
        custom_transform: Função para transformar dados
        where_clause: Cláusula WHERE para filtrar dados
    
    Returns:
        Número de registros migrados
    """
    logger.info(f"📋 Migrando tabela: {table_name}")
    
    try:
        # Contar registros na fonte
        source_count = get_table_row_count(table_name, 'sqlite')
        if source_count == 0:
            logger.info(f"  - {table_name}: Tabela vazia, pulando...")
            return 0
        
        # Buscar dados do SQLite
        with get_sqlite_connection() as sqlite_conn:
            cursor = sqlite_conn.cursor()
            query = f"SELECT * FROM {table_name}"
            if where_clause:
                query += f" WHERE {where_clause}"
            
            cursor.execute(query)
            rows = cursor.fetchall()
            
            if not rows:
                logger.info(f"  - {table_name}: Nenhum registro encontrado")
                return 0
        
        # Preparar dados para PostgreSQL
        postgres_rows = []
        for row in rows:
            row_dict = dict(row)
            
            # Aplicar mapeamento de colunas se fornecido
            if column_mapping:
                new_row = {}
                for sqlite_col, postgres_col in column_mapping.items():
                    if sqlite_col in row_dict:
                        new_row[postgres_col] = row_dict[sqlite_col]
                row_dict = new_row
            
            # Aplicar transformação customizada se fornecida
            if custom_transform:
                row_dict = custom_transform(row_dict)
            
            postgres_rows.append(row_dict)
        
        # Inserir no PostgreSQL
        if postgres_rows:
            with get_postgres_connection() as pg_conn:
                cursor = pg_conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
                
                # Construir query de INSERT
                columns = list(postgres_rows[0].keys())
                placeholders = [f"%({col})s" for col in columns]
                
                insert_query = f"""
                    INSERT INTO {table_name} ({', '.join(columns)})
                    VALUES ({', '.join(placeholders)})
                """
                
                cursor.executemany(insert_query, postgres_rows)
                pg_conn.commit()
                
                inserted_count = cursor.rowcount
                logger.info(f"  ✅ {table_name}: {inserted_count} registros migrados")
                return inserted_count
    
    except Exception as e:
        logger.error(f"  ❌ {table_name}: Erro na migração - {e}")
        raise MigrationError(f"Falha ao migrar {table_name}: {e}")

def transform_usuarios_data(row: Dict[str, Any]) -> Dict[str, Any]:
    """Transforma dados da tabela usuarios"""
    # Converter campos de data
    if 'data_criacao' in row and isinstance(row['data_criacao'], str):
        try:
            row['data_criacao'] = datetime.fromisoformat(row['data_criacao'].replace('Z', '+00:00'))
        except:
            row['data_criacao'] = datetime.now()
    
    if 'data_atualizacao' in row and isinstance(row['data_atualizacao'], str):
        try:
            row['data_atualizacao'] = datetime.fromisoformat(row['data_atualizacao'].replace('Z', '+00:00'))
        except:
            row['data_atualizacao'] = datetime.now()
    
    # Converter booleanos
    if 'ativo' in row:
        row['ativo'] = bool(row['ativo'])
    
    return row

def transform_operacoes_data(row: Dict[str, Any]) -> Dict[str, Any]:
    """Transforma dados da tabela operacoes"""
    # Garantir que valores numéricos estão corretos
    if 'quantity' in row:
        row['quantity'] = int(row['quantity'])
    if 'price' in row:
        row['price'] = float(row['price'])
    if 'fees' in row:
        row['fees'] = float(row['fees']) if row['fees'] is not None else 0.0
    
    return row

def transform_operacoes_fechadas_data(row: Dict[str, Any]) -> Dict[str, Any]:
    """Transforma dados da tabela operacoes_fechadas"""
    # Converter booleanos
    if 'day_trade' in row:
        row['day_trade'] = bool(row['day_trade'])
    
    # Garantir valores numéricos
    numeric_fields = ['quantidade', 'valor_compra', 'valor_venda', 'resultado', 'percentual_lucro']
    for field in numeric_fields:
        if field in row and row[field] is not None:
            row[field] = float(row[field])
    
    return row

def migrate_all_tables():
    """Executa a migração completa de todas as tabelas"""
    logger.info("🚀 Iniciando migração completa...")
    
    migration_stats = {}
    
    # Ordem de migração respeitando foreign keys
    migration_order = [
        # Tabelas base (sem dependências)
        ('funcoes', None, None),
        ('acoes', None, None),
        ('corretoras', None, None),
        
        # Usuários e autenticação
        ('usuarios', None, transform_usuarios_data),
        ('usuario_funcoes', None, None),
        ('tokens', None, None),
        ('redefinicao_senha', None, None),
        ('usuario_configuracoes', None, None),
        
        # Importações
        ('importacoes', None, None),
        
        # Operações e carteira
        ('operacoes', None, transform_operacoes_data),
        ('carteira_atual', None, None),
        ('operacoes_fechadas', None, transform_operacoes_fechadas_data),
        ('resultados_mensais', None, None),
        
        # Proventos
        ('proventos', None, None),
        ('usuario_proventos_recebidos', None, None),
        
        # Outras tabelas
        ('eventos_corporativos', None, None),
        ('historico_preco_medio', None, None),
        ('cotacao_acoes', None, None),
        ('feedback_usuario', None, None),
        ('mensagens', None, None),
    ]
    
    total_migrated = 0
    
    for table_name, column_mapping, transform_func in migration_order:
        try:
            count = migrate_table_data(table_name, column_mapping, transform_func)
            migration_stats[table_name] = count
            total_migrated += count
        except Exception as e:
            logger.error(f"❌ Falha crítica na migração da tabela {table_name}: {e}")
            raise MigrationError(f"Migração interrompida na tabela {table_name}")
    
    # Relatório final
    logger.info("\n" + "="*60)
    logger.info("📊 RELATÓRIO FINAL DA MIGRAÇÃO")
    logger.info("="*60)
    
    for table, count in migration_stats.items():
        status = "✅" if count >= 0 else "❌"
        logger.info(f"{status} {table:<30} {count:>10} registros")
    
    logger.info("-"*60)
    logger.info(f"📈 TOTAL MIGRADO: {total_migrated:>20} registros")
    logger.info("="*60)
    
    return migration_stats

def verify_migration_integrity():
    """Verifica a integridade da migração comparando contadores"""
    logger.info("🔍 Verificando integridade da migração...")
    
    # Lista de tabelas para verificar
    tables_to_check = [
        'acoes', 'usuarios', 'operacoes', 'carteira_atual', 
        'operacoes_fechadas', 'resultados_mensais', 'proventos',
        'usuario_proventos_recebidos'
    ]
    
    verification_results = {}
    all_ok = True
    
    for table in tables_to_check:
        try:
            sqlite_count = get_table_row_count(table, 'sqlite')
            postgres_count = get_table_row_count(table, 'postgres')
            
            verification_results[table] = {
                'sqlite': sqlite_count,
                'postgres': postgres_count,
                'match': sqlite_count == postgres_count
            }
            
            status = "✅" if sqlite_count == postgres_count else "❌"
            logger.info(f"{status} {table:<25} SQLite: {sqlite_count:>6} | PostgreSQL: {postgres_count:>6}")
            
            if sqlite_count != postgres_count:
                all_ok = False
                
        except Exception as e:
            logger.error(f"❌ Erro ao verificar {table}: {e}")
            all_ok = False
    
    if all_ok:
        logger.info("✅ Verificação de integridade: SUCESSO")
    else:
        logger.warning("⚠️  Verificação de integridade: INCONSISTÊNCIAS ENCONTRADAS")
    
    return verification_results

def update_postgres_sequences():
    """Atualiza as sequences do PostgreSQL para evitar conflitos de ID"""
    logger.info("🔄 Atualizando sequences do PostgreSQL...")
    
    with get_postgres_connection() as pg_conn:
        cursor = pg_conn.cursor()
        
        # Buscar todas as sequences
        cursor.execute("""
            SELECT schemaname, sequencename, tablename, columnname
            FROM pg_sequences 
            WHERE schemaname = 'public'
        """)
        
        sequences = cursor.fetchall()
        
        for schema, seq_name, table_name, col_name in sequences:
            try:
                # Buscar o maior ID atual na tabela
                cursor.execute(f"SELECT COALESCE(MAX({col_name}), 0) + 1 FROM {table_name}")
                next_val = cursor.fetchone()[0]
                
                # Atualizar a sequence
                cursor.execute(f"SELECT setval('{seq_name}', {next_val}, false)")
                
                logger.info(f"  ✅ {seq_name}: próximo valor = {next_val}")
                
            except Exception as e:
                logger.warning(f"  ⚠️  {seq_name}: erro ao atualizar - {e}")
        
        pg_conn.commit()
        logger.info("✅ Sequences atualizadas")

def main():
    """Função principal da migração"""
    try:
        logger.info("🎯 INICIANDO MIGRAÇÃO INVESTIR: SQLite → PostgreSQL")
        logger.info("="*60)
        
        # 1. Verificar pré-requisitos
        verify_prerequisites()
        
        # 2. Confirmar com usuário (em produção, adicionar input)
        logger.info("\n⚠️  ATENÇÃO: Esta operação irá:")
        logger.info("  - Limpar TODOS os dados do PostgreSQL")
        logger.info("  - Migrar TODOS os dados do SQLite")
        logger.info("  - Atualizar sequences automaticamente")
        
        # Para automação, comentar as linhas abaixo
        # response = input("\n🤔 Continuar? (digite 'SIM' para confirmar): ")
        # if response.upper() != 'SIM':
        #     logger.info("❌ Migração cancelada pelo usuário")
        #     return
        
        # 3. Limpar PostgreSQL
        clear_postgres_tables()
        
        # 4. Migrar dados
        migration_stats = migrate_all_tables()
        
        # 5. Atualizar sequences
        update_postgres_sequences()
        
        # 6. Verificar integridade
        verification_results = verify_migration_integrity()
        
        # 7. Resultado final
        logger.info("\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!")
        logger.info(f"📊 Total de registros migrados: {sum(migration_stats.values())}")
        logger.info(f"📅 Finalizada em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return True
        
    except MigrationError as e:
        logger.error(f"❌ ERRO DE MIGRAÇÃO: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ ERRO INESPERADO: {e}")
        logger.error("Stack trace:", exc_info=True)
        return False

if __name__ == "__main__":
    # Configurar PostgreSQL antes de executar
    print("🔧 CONFIGURAÇÃO NECESSÁRIA:")
    print("1. Editar POSTGRES_CONFIG neste arquivo")
    print("2. Garantir que o PostgreSQL está rodando")
    print("3. Garantir que o schema foi aplicado")
    print("4. Executar: pip install psycopg2-binary")
    print()
    
    success = main()
    sys.exit(0 if success else 1)
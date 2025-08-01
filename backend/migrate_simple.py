#!/usr/bin/env python3
"""
MIGRAÇÃO SIMPLES: SQLite → PostgreSQL
====================================

Versão simplificada da migração que funciona sem privilégios de superusuário.
"""

import sqlite3
import psycopg2
import psycopg2.extras
from datetime import datetime
import sys

# Configuração do PostgreSQL
POSTGRES_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'investir_prod',
    'user': 'investir_user',
    'password': 'senha123'
}

# SQLite fonte
SQLITE_DB_PATH = "acoes_ir.db"

def get_sqlite_data(table_name):
    """Busca dados do SQLite"""
    conn = sqlite3.connect(SQLITE_DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES|sqlite3.PARSE_COLNAMES)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def insert_postgres_data(table_name, data):
    """Insere dados no PostgreSQL"""
    if not data:
        print(f"  - {table_name}: Tabela vazia, pulando...")
        return 0
    
    conn = psycopg2.connect(**POSTGRES_CONFIG)
    cursor = conn.cursor()
    
    try:
        # Limpar tabela primeiro
        cursor.execute(f"DELETE FROM {table_name}")
        
        # Preparar dados
        columns = list(data[0].keys())
        placeholders = [f"%({col})s" for col in columns]
        
        insert_query = f"""
            INSERT INTO {table_name} ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
        """
        
        cursor.executemany(insert_query, data)
        conn.commit()
        
        count = cursor.rowcount
        print(f"  - {table_name}: {count} registros migrados")
        return count
        
    except Exception as e:
        print(f"  - {table_name}: ERRO - {e}")
        conn.rollback()
        return 0
    finally:
        conn.close()

def migrate_table(table_name):
    """Migra uma tabela específica"""
    try:
        data = get_sqlite_data(table_name)
        return insert_postgres_data(table_name, data)
    except Exception as e:
        print(f"  - {table_name}: ERRO ao migrar - {e}")
        return 0

def main():
    """Executa migração simples"""
    print("=== MIGRACAO SIMPLES SQLite -> PostgreSQL ===")
    print()
    
    # Verificar conexões
    try:
        # Testar SQLite
        sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
        sqlite_conn.close()
        print("SQLite: OK")
        
        # Testar PostgreSQL
        pg_conn = psycopg2.connect(**POSTGRES_CONFIG)
        pg_conn.close()
        print("PostgreSQL: OK")
        print()
        
    except Exception as e:
        print(f"ERRO na conexao: {e}")
        return False
    
    # Tabelas para migrar (ordem respeitando FK)
    tables = [
        'funcoes',
        'acoes', 
        'corretoras',
        'usuarios',
        'usuario_funcoes',
        'tokens',
        'redefinicao_senha',
        'usuario_configuracoes',
        'importacoes',
        'operacoes',
        'carteira_atual',
        'operacoes_fechadas',
        'resultados_mensais',
        'proventos',
        'usuario_proventos_recebidos',
        'eventos_corporativos',
        'historico_preco_medio',
        'cotacao_acoes',
        'feedback_usuario',
        'mensagens'
    ]
    
    total_migrated = 0
    
    print("Migrando tabelas:")
    for table in tables:
        count = migrate_table(table)
        total_migrated += count
    
    print()
    print(f"=== MIGRACAO CONCLUIDA ===")
    print(f"Total migrado: {total_migrated} registros")
    
    # Verificar integridade básica
    print()
    print("Verificando integridade:")
    try:
        pg_conn = psycopg2.connect(**POSTGRES_CONFIG)
        cursor = pg_conn.cursor()
        
        for table in ['acoes', 'usuarios', 'operacoes', 'carteira_atual']:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            pg_count = cursor.fetchone()[0]
            
            sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
            sqlite_cursor = sqlite_conn.cursor()
            sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            sqlite_count = sqlite_cursor.fetchone()[0]
            sqlite_conn.close()
            
            status = "OK" if pg_count == sqlite_count else "DIFERENCA"
            print(f"  - {table}: SQLite={sqlite_count}, PostgreSQL={pg_count} [{status}]")
        
        pg_conn.close()
        
    except Exception as e:
        print(f"Erro na verificacao: {e}")
    
    print()
    print("PRONTO! PostgreSQL populado com dados do SQLite.")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
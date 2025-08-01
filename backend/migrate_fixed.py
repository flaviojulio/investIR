#!/usr/bin/env python3
"""
MIGRAÇÃO CORRIGIDA: SQLite → PostgreSQL
=======================================

Versão que trata as incompatibilidades encontradas entre SQLite e PostgreSQL.
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

def fix_data_for_postgres(table_name, data):
    """Corrige dados para compatibilidade PostgreSQL"""
    fixed_data = []
    
    for row in data:
        fixed_row = {}
        
        for key, value in row.items():
            # Conversões específicas por tabela
            if table_name == 'usuarios':
                if key == 'ativo':
                    fixed_row[key] = bool(value) if value is not None else True
                else:
                    fixed_row[key] = value
                    
            elif table_name == 'acoes':
                if key == 'classificacao' and value and len(str(value)) > 100:
                    fixed_row[key] = str(value)[:100]  # Truncar para 100 chars
                else:
                    fixed_row[key] = value
                    
            elif table_name == 'carteira_atual':
                if key == 'preco_editado_pelo_usuario':
                    fixed_row[key] = bool(value) if value is not None else False
                else:
                    fixed_row[key] = value
                    
            elif table_name == 'operacoes_fechadas':
                if key == 'day_trade':
                    fixed_row[key] = bool(value) if value is not None else False
                else:
                    fixed_row[key] = value
                    
            elif table_name == 'proventos':
                if key == 'valor' and isinstance(value, str):
                    # Converter vírgula para ponto
                    try:
                        fixed_row[key] = float(value.replace(',', '.'))
                    except:
                        fixed_row[key] = 0.0
                else:
                    fixed_row[key] = value
                    
            else:
                fixed_row[key] = value
        
        fixed_data.append(fixed_row)
    
    return fixed_data

def get_postgres_columns(table_name):
    """Busca colunas existentes no PostgreSQL"""
    conn = psycopg2.connect(**POSTGRES_CONFIG)
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = '{table_name}' AND table_schema = 'public'
    """)
    columns = [row[0] for row in cursor.fetchall()]
    conn.close()
    return columns

def filter_columns(table_name, data):
    """Remove colunas que não existem no PostgreSQL"""
    if not data:
        return data
    
    postgres_columns = get_postgres_columns(table_name)
    
    filtered_data = []
    for row in data:
        filtered_row = {}
        for key, value in row.items():
            if key in postgres_columns:
                filtered_row[key] = value
        filtered_data.append(filtered_row)
    
    return filtered_data

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
        
        # Filtrar colunas existentes
        data = filter_columns(table_name, data)
        
        if not data or not data[0]:
            print(f"  - {table_name}: Nenhuma coluna compatível encontrada")
            return 0
        
        # Corrigir dados para PostgreSQL
        data = fix_data_for_postgres(table_name, data)
        
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
        print(f"Migrando {table_name}...")
        data = get_sqlite_data(table_name)
        return insert_postgres_data(table_name, data)
    except Exception as e:
        print(f"  - {table_name}: ERRO ao buscar dados SQLite - {e}")
        return 0

def reset_sequences():
    """Reseta sequences do PostgreSQL"""
    conn = psycopg2.connect(**POSTGRES_CONFIG)
    cursor = conn.cursor()
    
    try:
        # Buscar sequences
        cursor.execute("""
            SELECT sequence_name, table_name, column_name
            FROM information_schema.sequences s
            JOIN information_schema.columns c ON s.sequence_name = c.table_name || '_' || c.column_name || '_seq'
            WHERE s.sequence_schema = 'public'
        """)
        
        sequences = cursor.fetchall()
        
        for seq_name, table_name, col_name in sequences:
            try:
                cursor.execute(f"SELECT COALESCE(MAX({col_name}), 0) + 1 FROM {table_name}")
                next_val = cursor.fetchone()[0]
                cursor.execute(f"ALTER SEQUENCE {seq_name} RESTART WITH {next_val}")
                print(f"  - {seq_name}: próximo valor = {next_val}")
            except Exception as e:
                print(f"  - {seq_name}: erro - {e}")
        
        conn.commit()
        print("Sequences atualizadas!")
        
    except Exception as e:
        print(f"Erro ao atualizar sequences: {e}")
    finally:
        conn.close()

def main():
    """Executa migração corrigida"""
    print("=== MIGRACAO CORRIGIDA SQLite -> PostgreSQL ===")
    print()
    
    # Verificar conexões
    try:
        sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
        sqlite_conn.close()
        print("SQLite: OK")
        
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
        'importacoes',
        'operacoes',
        'carteira_atual',
        'operacoes_fechadas',
        'resultados_mensais',
        'proventos',
        'usuario_proventos_recebidos',
        'eventos_corporativos',
        'cotacao_acoes',
        'feedback_usuario'
    ]
    
    total_migrated = 0
    
    print("Migrando tabelas:")
    for table in tables:
        count = migrate_table(table)
        total_migrated += count
    
    print()
    print("Atualizando sequences...")
    reset_sequences()
    
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
            
            status = "OK" if pg_count == sqlite_count else f"DIFERENCA (SQLite: {sqlite_count}, PG: {pg_count})"
            print(f"  - {table}: {status}")
        
        pg_conn.close()
        
    except Exception as e:
        print(f"Erro na verificacao: {e}")
    
    print()
    print("PRONTO! Migracao corrigida concluida.")
    print("Proximo passo: Alterar main.py para usar database_postgresql.py")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
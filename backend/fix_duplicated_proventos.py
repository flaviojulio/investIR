#!/usr/bin/env python3
"""
 SCRIPT CRTICO: Limpeza de Duplicatas na Tabela usuario_proventos_recebidos

PROBLEMA IDENTIFICADO:
- Mltiplas inseres do mesmo provento com provento_global_id diferentes
- Exemplos: MGLU3 com 9 duplicatas, B3SA3 com 7-14 duplicatas
- Causa: Falta de constraint UNIQUE e mltiplas funes inserindo dados

SOLUO:
1. Identificar e remover duplicatas mantendo apenas a mais recente
2. Adicionar ndice UNIQUE para prevenir futuras duplicatas
3. Recalcular totais aps limpeza
"""

import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# Add the backend directory to Python path for imports
sys.path.append(str(Path(__file__).parent))

def backup_database():
    """Criar backup da base de dados antes da limpeza"""
    import shutil
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = f'acoes_ir_backup_{timestamp}.db'
    shutil.copy2('acoes_ir.db', backup_file)
    print(f" Backup criado: {backup_file}")
    return backup_file

def analyze_duplicates(conn):
    """Analisar a extenso do problema de duplicatas"""
    cursor = conn.cursor()
    
    print("\n ANLISE DE DUPLICATAS:")
    print("=" * 50)
    
    # Total de registros
    cursor.execute("SELECT COUNT(*) FROM usuario_proventos_recebidos")
    total_records = cursor.fetchone()[0]
    print(f"Total de registros: {total_records}")
    
    # Duplicatas por critrio rigoroso
    cursor.execute("""
        SELECT 
            COUNT(*) as grupos_duplicados,
            SUM(duplicatas - 1) as registros_extras
        FROM (
            SELECT 
                usuario_id, id_acao, tipo_provento, data_ex, dt_pagamento, 
                valor_unitario_provento, quantidade_possuida_na_data_ex,
                COUNT(*) as duplicatas
            FROM usuario_proventos_recebidos 
            GROUP BY usuario_id, id_acao, tipo_provento, data_ex, dt_pagamento, 
                     valor_unitario_provento, quantidade_possuida_na_data_ex
            HAVING COUNT(*) > 1
        )
    """)
    
    result = cursor.fetchone()
    grupos_duplicados, registros_extras = result[0], result[1] or 0
    
    print(f"Grupos com duplicatas: {grupos_duplicados}")
    print(f"Registros extras (para remoo): {registros_extras}")
    print(f"Eficincia aps limpeza: {((total_records - registros_extras) / total_records * 100):.1f}%")
    
    # Top 10 piores casos
    print(f"\n TOP 10 PIORES CASOS:")
    cursor.execute("""
        SELECT 
            ticker_acao,
            tipo_provento,
            data_ex,
            COUNT(*) as duplicatas
        FROM usuario_proventos_recebidos 
        WHERE usuario_id = 2
        GROUP BY usuario_id, ticker_acao, tipo_provento, data_ex
        HAVING COUNT(*) > 1
        ORDER BY duplicatas DESC
        LIMIT 10
    """)
    
    for row in cursor.fetchall():
        ticker, tipo, data_ex, dups = row
        print(f"  {ticker:6} {tipo:10} {data_ex}  {dups} duplicatas")
    
    return total_records, registros_extras

def remove_duplicates(conn):
    """Remove duplicatas mantendo apenas o registro mais recente (maior ID)"""
    cursor = conn.cursor()
    
    print(f"\n REMOVENDO DUPLICATAS...")
    print("=" * 50)
    
    # SQL para identificar IDs a serem removidos (manter apenas o mais recente por grupo)
    remove_query = """
        DELETE FROM usuario_proventos_recebidos 
        WHERE id NOT IN (
            SELECT MAX(id)
            FROM usuario_proventos_recebidos
            GROUP BY usuario_id, id_acao, tipo_provento, data_ex, dt_pagamento, 
                     valor_unitario_provento, quantidade_possuida_na_data_ex
        )
    """
    
    cursor.execute(remove_query)
    removed_count = cursor.rowcount
    
    print(f" Removidos {removed_count} registros duplicados")
    
    # Verificar se ainda h duplicatas
    cursor.execute("""
        SELECT COUNT(*) 
        FROM (
            SELECT 1
            FROM usuario_proventos_recebidos 
            GROUP BY usuario_id, id_acao, tipo_provento, data_ex, dt_pagamento, 
                     valor_unitario_provento, quantidade_possuida_na_data_ex
            HAVING COUNT(*) > 1
        )
    """)
    
    remaining_dups = cursor.fetchone()[0]
    if remaining_dups == 0:
        print(" Nenhuma duplicata restante!")
    else:
        print(f" Ainda h {remaining_dups} grupos com duplicatas")
    
    return removed_count

def create_unique_index(conn):
    """Criar ndice UNIQUE para prevenir futuras duplicatas"""
    cursor = conn.cursor()
    
    print(f"\n CRIANDO NDICE UNIQUE...")
    print("=" * 50)
    
    try:
        # Criar ndice nico composto para prevenir duplicatas
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_usuario_provento_recebido
            ON usuario_proventos_recebidos (
                usuario_id, 
                id_acao, 
                tipo_provento, 
                data_ex, 
                dt_pagamento, 
                valor_unitario_provento, 
                quantidade_possuida_na_data_ex
            )
        """)
        print(" ndice UNIQUE criado com sucesso")
        print("   - Previne futuras duplicatas automaticamente")
        print("   - Garante integridade dos dados")
    
    except sqlite3.IntegrityError as e:
        print(f" Erro ao criar ndice UNIQUE: {e}")
        print("   - Ainda h duplicatas na tabela")
        print("   - Execute novamente a limpeza")
        return False
    
    return True

def verify_cleanup(conn):
    """Verificar integridade aps limpeza"""
    cursor = conn.cursor()
    
    print(f"\n VERIFICAO FINAL:")
    print("=" * 50)
    
    # Contar registros finais
    cursor.execute("SELECT COUNT(*) FROM usuario_proventos_recebidos")
    final_count = cursor.fetchone()[0]
    print(f"Registros finais: {final_count}")
    
    # Verificar se h duplicatas
    cursor.execute("""
        SELECT COUNT(*) 
        FROM (
            SELECT 1
            FROM usuario_proventos_recebidos 
            GROUP BY usuario_id, id_acao, tipo_provento, data_ex, dt_pagamento, 
                     valor_unitario_provento, quantidade_possuida_na_data_ex
            HAVING COUNT(*) > 1
        )
    """)
    
    duplicates = cursor.fetchone()[0]
    
    if duplicates == 0:
        print(" Base de dados limpa - sem duplicatas")
    else:
        print(f" Ainda h {duplicates} grupos duplicados")
    
    # Testar insero de duplicata
    try:
        cursor.execute("""
            INSERT INTO usuario_proventos_recebidos 
            (usuario_id, provento_global_id, id_acao, ticker_acao, nome_acao, 
             tipo_provento, data_ex, dt_pagamento, valor_unitario_provento, 
             quantidade_possuida_na_data_ex, valor_total_recebido, data_calculo)
            SELECT 
                usuario_id, provento_global_id, id_acao, ticker_acao, nome_acao, 
                tipo_provento, data_ex, dt_pagamento, valor_unitario_provento, 
                quantidade_possuida_na_data_ex, valor_total_recebido, datetime('now')
            FROM usuario_proventos_recebidos 
            LIMIT 1
        """)
        print(" PROBLEMA: Ainda  possvel inserir duplicatas!")
    except sqlite3.IntegrityError:
        print(" Proteo ativa: Tentativa de duplicata foi bloqueada")
    
    return duplicates == 0

def main():
    """Funo principal de limpeza"""
    print("LIMPEZA CRITICA DE DUPLICATAS - usuario_proventos_recebidos")
    print("=" * 70)
    
    # Verificar se arquivo existe
    if not Path('acoes_ir.db').exists():
        print("ERRO: Arquivo acoes_ir.db nao encontrado!")
        print("   Execute este script na pasta backend/")
        return False
    
    # Criar backup
    backup_file = backup_database()
    
    # Conectar  base de dados
    conn = sqlite3.connect('acoes_ir.db')
    conn.row_factory = sqlite3.Row  # Permite acesso por nome de coluna
    
    try:
        # Analisar problema
        total_inicial, registros_extras = analyze_duplicates(conn)
        
        if registros_extras == 0:
            print("OK: Nenhuma duplicata encontrada!")
            return True
        
        # Confirmao do usurio
        print(f"\nATENCAO: Serao removidos {registros_extras} registros duplicados")
        resposta = input("Continuar? (sim/nao): ").lower().strip()
        
        if resposta not in ['sim', 's', 'yes', 'y']:
            print("CANCELADO: Operacao cancelada pelo usuario")
            return False
        
        # Remover duplicatas
        removed = remove_duplicates(conn)
        
        # Criar ndice de proteo
        index_created = create_unique_index(conn)
        
        # Commit das mudanas
        conn.commit()
        
        # Verificao final
        success = verify_cleanup(conn)
        
        if success and index_created:
            print(f"\nSUCESSO: LIMPEZA CONCLUIDA!")
            print(f"   - Removidos: {removed} registros duplicados")
            print(f"   - Backup: {backup_file}")
            print(f"   - Protecao: Indice UNIQUE ativo")
        else:
            print(f"\nPARCIAL: Limpeza parcial")
            print(f"   - Remova manualmente duplicatas restantes")
            print(f"   - Backup disponivel: {backup_file}")
        
        return success
        
    except Exception as e:
        print(f"ERRO DURANTE LIMPEZA: {e}")
        print(f"   - Restaure backup: {backup_file}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
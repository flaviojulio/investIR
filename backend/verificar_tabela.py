from database import get_db

# Verificar se a tabela cotacao_acoes existe
with get_db() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='cotacao_acoes'")
    result = cursor.fetchone()
    
    if result:
        print("✅ Tabela cotacao_acoes encontrada!")
        
        # Verificar estrutura
        cursor.execute("PRAGMA table_info(cotacao_acoes)")
        columns = cursor.fetchall()
        print("\nColunas da tabela:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
    else:
        print("❌ Tabela cotacao_acoes NÃO encontrada!")

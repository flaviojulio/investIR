from database import get_db

with get_db() as conn:
    cursor = conn.cursor()
    
    # Verificar total de registros
    cursor.execute('SELECT COUNT(*) FROM cotacao_acoes')
    total_registros = cursor.fetchone()[0]
    print(f'Total de registros na cotacao_acoes: {total_registros}')
    
    # Verificar quantas ações têm cotações
    cursor.execute('SELECT COUNT(DISTINCT acao_id) FROM cotacao_acoes')
    acoes_com_cotacoes = cursor.fetchone()[0]
    print(f'Ações com cotações: {acoes_com_cotacoes}')
    
    # Verificar alguns tickers específicos
    tickers_teste = ['BBAS3', 'WEGE3', 'PETR4']
    for ticker in tickers_teste:
        cursor.execute('''
            SELECT c.fechamento, c.data 
            FROM cotacao_acoes c
            JOIN acoes a ON c.acao_id = a.id
            WHERE a.ticker = ?
            ORDER BY c.data DESC
            LIMIT 1
        ''', (ticker,))
        
        result = cursor.fetchone()
        if result:
            print(f'{ticker}: última cotação R$ {result[0]} em {result[1]}')
        else:
            print(f'{ticker}: sem cotações encontradas')

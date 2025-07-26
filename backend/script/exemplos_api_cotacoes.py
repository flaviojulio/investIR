"""
Exemplos Práticos - API de Cotações Melhorada
Demonstra como usar os novos parâmetros de filtragem por data
"""

import requests
from datetime import datetime, timedelta

# Configuração base
BASE_URL = "http://localhost:8000/api/cotacoes"

def exemplo_data_unica():
    """Exemplo: Buscar cotação de uma data específica"""
    print("=== COTAÇÃO DE DATA ESPECÍFICA ===")
    
    # Buscar cotação do PETR4 em uma data específica
    data_especifica = "2024-12-20"
    
    # Método 1: Endpoint específico para data
    response = requests.get(f"{BASE_URL}/ticker/PETR4/data/{data_especifica}")
    if response.status_code == 200:
        cotacao = response.json()
        print(f"PETR4 em {data_especifica}:")
        print(f"  Abertura: R$ {cotacao['abertura']}")
        print(f"  Fechamento: R$ {cotacao['fechamento']}")
        print(f"  Volume: {cotacao['volume']:,}")
    
    # Método 2: Usando parâmetro data_unica
    response = requests.get(f"{BASE_URL}/ticker/PETR4?data_unica={data_especifica}")
    if response.status_code == 200:
        cotacoes = response.json()
        print(f"\nMesmo resultado com parâmetro: {len(cotacoes)} registro(s)")

def exemplo_ultimos_dias():
    """Exemplo: Buscar cotações dos últimos N dias"""
    print("\n=== ÚLTIMOS DIAS ===")
    
    # Últimos 7 dias úteis
    response = requests.get(f"{BASE_URL}/ticker/VALE3/ultimas/7?apenas_dias_uteis=true")
    if response.status_code == 200:
        cotacoes = response.json()
        print(f"VALE3 - Últimos 7 dias úteis ({len(cotacoes)} registros):")
        for cotacao in cotacoes[:3]:  # Mostrar apenas os 3 primeiros
            print(f"  {cotacao['data']}: R$ {cotacao['fechamento']}")
        print("  ...")
    
    # Últimos 30 dias (incluindo fins de semana)
    response = requests.get(f"{BASE_URL}/ticker/VALE3?ultimos_dias=30&limite=20")
    if response.status_code == 200:
        cotacoes = response.json()
        print(f"\nVALE3 - Últimos 30 dias (limitado a 20): {len(cotacoes)} registros")

def exemplo_range_otimizado():
    """Exemplo: Range de datas com limite para performance"""
    print("\n=== RANGE OTIMIZADO ===")
    
    # Range de 3 meses com limite
    data_inicio = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
    data_fim = datetime.now().strftime('%Y-%m-%d')
    
    response = requests.get(f"{BASE_URL}/ticker/ITUB4", params={
        'data_inicio': data_inicio,
        'data_fim': data_fim,
        'limite': 50  # Apenas as 50 mais recentes
    })
    
    if response.status_code == 200:
        cotacoes = response.json()
        print(f"ITUB4 - Últimos 3 meses (limitado a 50): {len(cotacoes)} registros")
        
        # Calcular variação do período
        if len(cotacoes) >= 2:
            mais_antiga = cotacoes[-1]  # Última da lista (mais antiga cronologicamente)
            mais_recente = cotacoes[0]   # Primeira da lista (mais recente)
            
            variacao = ((mais_recente['fechamento'] - mais_antiga['fechamento']) / 
                       mais_antiga['fechamento']) * 100
            
            print(f"Variação no período: {variacao:.2f}%")

def exemplo_comparacao_multipla():
    """Exemplo: Comparar múltiplas ações eficientemente"""
    print("\n=== COMPARAÇÃO MÚLTIPLA ===")
    
    # Comparar 3 ações dos últimos 60 dias
    tickers = "PETR4,VALE3,ITUB4"
    
    response = requests.get(f"{BASE_URL}/range-datas", params={
        'tickers': tickers,
        'ultimos_dias': 60,
        'limite_por_acao': 30  # Máximo 30 registros por ação
    })
    
    if response.status_code == 200:
        dados = response.json()
        print(f"Dados de {len(dados)} cotações para comparação")
        
        # Agrupar por ticker
        por_ticker = {}
        for cotacao in dados:
            ticker = cotacao['ticker']
            if ticker not in por_ticker:
                por_ticker[ticker] = []
            por_ticker[ticker].append(cotacao)
        
        print("Resumo por ação:")
        for ticker, cotacoes in por_ticker.items():
            if cotacoes:
                print(f"  {ticker}: {len(cotacoes)} cotações")

def exemplo_resumo_analise():
    """Exemplo: Usar endpoint de resumo para análise rápida"""
    print("\n=== RESUMO E ANÁLISE ===")
    
    response = requests.get(f"{BASE_URL}/resumo/PETR4")
    if response.status_code == 200:
        resumo = response.json()
        
        print(f"Análise PETR4:")
        print(f"  Preço atual: R$ {resumo['cotacao_atual']['fechamento']}")
        print(f"  Performance 30 dias: {resumo['resumo_30_dias']['variacao_periodo']}%")
        print(f"  Performance 365 dias: {resumo['resumo_365_dias']['variacao_periodo']}%")
        print(f"  Máxima 30 dias: R$ {resumo['resumo_30_dias']['preco_maximo']}")
        print(f"  Mínima 30 dias: R$ {resumo['resumo_30_dias']['preco_minimo']}")

def exemplo_comparacao_performance():
    """Exemplo: Comparar performance de múltiplas ações"""
    print("\n=== COMPARAÇÃO DE PERFORMANCE ===")
    
    # Comparar últimos 6 meses
    data_inicio = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
    
    response = requests.get(f"{BASE_URL}/comparacao", params={
        'tickers': 'PETR4,VALE3,ITUB4,BBAS3,ABEV3',
        'data_inicio': data_inicio
    })
    
    if response.status_code == 200:
        comparacao = response.json()
        
        print(f"Ranking de performance ({comparacao['periodo']}):")
        for i, (ticker, performance) in enumerate(comparacao['ranking_performance'], 1):
            print(f"  {i}. {ticker}: {performance}%")

def exemplo_uso_dashboard():
    """Exemplo: Dados otimizados para dashboard"""
    print("\n=== DADOS PARA DASHBOARD ===")
    
    # Widget de múltiplas ações - apenas cotação mais recente
    principais_acoes = ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'ABEV3']
    
    widgets_data = {}
    for ticker in principais_acoes:
        response = requests.get(f"{BASE_URL}/ticker/{ticker}/mais-recente")
        if response.status_code == 200:
            cotacao = response.json()
            widgets_data[ticker] = {
                'preco': cotacao['fechamento'],
                'data': cotacao['data'],
                'volume': cotacao['volume']
            }
    
    print("Dados para widgets do dashboard:")
    for ticker, dados in widgets_data.items():
        print(f"  {ticker}: R$ {dados['preco']} ({dados['data']})")

def exemplo_analise_tecnica():
    """Exemplo: Dados para análise técnica"""
    print("\n=== ANÁLISE TÉCNICA ===")
    
    # Buscar dados para médias móveis (últimos 50 dias úteis)
    response = requests.get(f"{BASE_URL}/ticker/PETR4/ultimas/50?apenas_dias_uteis=true")
    if response.status_code == 200:
        cotacoes = response.json()
        
        # Calcular média móvel simples de 20 períodos
        if len(cotacoes) >= 20:
            precos_20 = [c['fechamento'] for c in cotacoes[:20] if c['fechamento']]
            media_20 = sum(precos_20) / len(precos_20)
            
            preco_atual = cotacoes[0]['fechamento']
            print(f"PETR4 - Análise técnica:")
            print(f"  Preço atual: R$ {preco_atual}")
            print(f"  Média móvel 20 períodos: R$ {media_20:.2f}")
            print(f"  Posição: {'Acima' if preco_atual > media_20 else 'Abaixo'} da média")

if __name__ == "__main__":
    print("🚀 Exemplos Práticos - API de Cotações Melhorada")
    print("=" * 60)
    
    try:
        exemplo_data_unica()
        exemplo_ultimos_dias()
        exemplo_range_otimizado()
        exemplo_comparacao_multipla()
        exemplo_resumo_analise()
        exemplo_comparacao_performance()
        exemplo_uso_dashboard()
        exemplo_analise_tecnica()
        
        print("\n✅ Todos os exemplos executados com sucesso!")
        print("\n💡 Dicas de Performance:")
        print("- Use 'limite' para controlar a quantidade de dados")
        print("- 'data_unica' é mais eficiente que ranges para consultas pontuais")
        print("- 'apenas_dias_uteis' reduz dados em análises técnicas")
        print("- Endpoints de resumo são ideais para dashboards")
        
    except requests.exceptions.ConnectionError:
        print("❌ Erro: Não foi possível conectar à API")
        print("   Certifique-se de que o backend está rodando em localhost:8000")
    except Exception as e:
        print(f"❌ Erro inesperado: {e}")

"""
Utilitários para testes
Funções auxiliares para criação de dados de teste e validações
"""
import random
from datetime import date, datetime, timedelta
from typing import List, Dict, Any
from decimal import Decimal


def gerar_operacoes_aleatorias(
    usuario_id: int,
    num_operacoes: int = 100,
    data_inicio: date = None,
    data_fim: date = None,
    tickers: List[str] = None
) -> List[Dict[str, Any]]:
    """
    Gera operações aleatórias para testes
    
    Args:
        usuario_id: ID do usuário
        num_operacoes: Número de operações a gerar
        data_inicio: Data de início do período
        data_fim: Data de fim do período
        tickers: Lista de tickers a usar
    
    Returns:
        Lista de operações geradas
    """
    if data_inicio is None:
        data_inicio = date(2024, 1, 1)
    if data_fim is None:
        data_fim = date(2024, 12, 31)
    if tickers is None:
        tickers = ["PETR4", "VALE3", "ITUB4", "BBAS3", "WEGE3"]
    
    operacoes = []
    delta = data_fim - data_inicio
    
    for i in range(num_operacoes):
        # Data aleatória no período
        dias_random = random.randint(0, delta.days)
        data_op = data_inicio + timedelta(days=dias_random)
        
        # Ticker aleatório
        ticker = random.choice(tickers)
        
        # Tipo de operação
        operation = random.choice(["buy", "sell"])
        
        # Quantidade (múltiplos de 100)
        quantity = random.choice([100, 200, 300, 500, 1000])
        
        # Preço (baseado no ticker)
        precos_base = {
            "PETR4": 30.00,
            "VALE3": 65.00,
            "ITUB4": 25.00,
            "BBAS3": 45.00,
            "WEGE3": 40.00
        }
        preco_base = precos_base.get(ticker, 30.00)
        price = round(preco_base + random.uniform(-5.0, 5.0), 2)
        
        # Taxas (proporcionais ao valor da operação)
        valor_operacao = quantity * price
        fees = round(valor_operacao * random.uniform(0.0001, 0.005), 2)
        
        operacao = {
            "date": data_op,
            "ticker": ticker,
            "operation": operation,
            "quantity": quantity,
            "price": price,
            "fees": fees,
            "usuario_id": usuario_id
        }
        
        operacoes.append(operacao)
    
    # Ordenar por data
    operacoes.sort(key=lambda x: x["date"])
    
    return operacoes


def gerar_day_trades_aleatorios(
    usuario_id: int,
    num_day_trades: int = 10,
    data_inicio: date = None,
    data_fim: date = None
) -> List[Dict[str, Any]]:
    """
    Gera day trades aleatórios (pares compra-venda no mesmo dia)
    
    Args:
        usuario_id: ID do usuário
        num_day_trades: Número de day trades a gerar
        data_inicio: Data de início
        data_fim: Data de fim
    
    Returns:
        Lista de operações de day trade
    """
    if data_inicio is None:
        data_inicio = date(2024, 1, 1)
    if data_fim is None:
        data_fim = date(2024, 12, 31)
    
    operacoes = []
    delta = data_fim - data_inicio
    tickers = ["PETR4", "VALE3", "ITUB4", "BBAS3", "WEGE3"]
    
    for _ in range(num_day_trades):
        # Data aleatória
        dias_random = random.randint(0, delta.days)
        data_dt = data_inicio + timedelta(days=dias_random)
        
        # Ticker aleatório
        ticker = random.choice(tickers)
        
        # Quantidade
        quantity = random.choice([100, 200, 300, 500])
        
        # Preços (venda ligeiramente diferente da compra)
        preco_compra = round(random.uniform(20.0, 80.0), 2)
        variacao = random.uniform(-0.02, 0.03)  # -2% a +3%
        preco_venda = round(preco_compra * (1 + variacao), 2)
        
        # Taxas
        taxa_compra = round(quantity * preco_compra * 0.0005, 2)
        taxa_venda = round(quantity * preco_venda * 0.0005, 2)
        
        # Operação de compra
        compra = {
            "date": data_dt,
            "ticker": ticker,
            "operation": "buy",
            "quantity": quantity,
            "price": preco_compra,
            "fees": taxa_compra,
            "usuario_id": usuario_id
        }
        
        # Operação de venda
        venda = {
            "date": data_dt,
            "ticker": ticker,
            "operation": "sell",
            "quantity": quantity,
            "price": preco_venda,
            "fees": taxa_venda,
            "usuario_id": usuario_id
        }
        
        operacoes.extend([compra, venda])
    
    return operacoes


def gerar_swing_trades_aleatorios(
    usuario_id: int,
    num_swing_trades: int = 5,
    data_inicio: date = None,
    data_fim: date = None,
    periodo_min_dias: int = 7,
    periodo_max_dias: int = 90
) -> List[Dict[str, Any]]:
    """
    Gera swing trades aleatórios (compra e venda em datas diferentes)
    
    Args:
        usuario_id: ID do usuário
        num_swing_trades: Número de swing trades
        data_inicio: Data de início
        data_fim: Data de fim
        periodo_min_dias: Período mínimo entre compra e venda
        periodo_max_dias: Período máximo entre compra e venda
    
    Returns:
        Lista de operações de swing trade
    """
    if data_inicio is None:
        data_inicio = date(2024, 1, 1)
    if data_fim is None:
        data_fim = date(2024, 12, 31)
    
    operacoes = []
    tickers = ["PETR4", "VALE3", "ITUB4", "BBAS3", "WEGE3"]
    
    for _ in range(num_swing_trades):
        ticker = random.choice(tickers)
        quantity = random.choice([100, 200, 300, 500, 1000])
        
        # Data da compra
        delta_compra = (data_fim - timedelta(days=periodo_max_dias) - data_inicio).days
        if delta_compra <= 0:
            continue
            
        dias_compra = random.randint(0, delta_compra)
        data_compra = data_inicio + timedelta(days=dias_compra)
        
        # Data da venda (depois da compra)
        periodo_holding = random.randint(periodo_min_dias, periodo_max_dias)
        data_venda = data_compra + timedelta(days=periodo_holding)
        
        if data_venda > data_fim:
            continue
        
        # Preços
        preco_compra = round(random.uniform(20.0, 80.0), 2)
        variacao = random.uniform(-0.10, 0.20)  # -10% a +20%
        preco_venda = round(preco_compra * (1 + variacao), 2)
        
        # Taxas
        taxa_compra = round(quantity * preco_compra * 0.0005, 2)
        taxa_venda = round(quantity * preco_venda * 0.0005, 2)
        
        # Operações
        compra = {
            "date": data_compra,
            "ticker": ticker,
            "operation": "buy",
            "quantity": quantity,
            "price": preco_compra,
            "fees": taxa_compra,
            "usuario_id": usuario_id
        }
        
        venda = {
            "date": data_venda,
            "ticker": ticker,
            "operation": "sell",
            "quantity": quantity,
            "price": preco_venda,
            "fees": taxa_venda,
            "usuario_id": usuario_id
        }
        
        operacoes.extend([compra, venda])
    
    return operacoes


def gerar_vendas_descoberto_aleatorias(
    usuario_id: int,
    num_vendas: int = 3,
    data_inicio: date = None,
    data_fim: date = None
) -> List[Dict[str, Any]]:
    """
    Gera vendas descoberto aleatórias
    
    Args:
        usuario_id: ID do usuário
        num_vendas: Número de vendas descoberto
        data_inicio: Data de início
        data_fim: Data de fim
    
    Returns:
        Lista de operações de venda descoberto
    """
    if data_inicio is None:
        data_inicio = date(2024, 1, 1)
    if data_fim is None:
        data_fim = date(2024, 12, 31)
    
    operacoes = []
    tickers = ["PETR4", "VALE3", "ITUB4", "BBAS3", "WEGE3"]
    
    for _ in range(num_vendas):
        ticker = random.choice(tickers)
        quantity = random.choice([100, 200, 300, 400])
        
        # Data da venda descoberto
        delta = (data_fim - timedelta(days=30) - data_inicio).days
        if delta <= 0:
            continue
            
        dias_venda = random.randint(0, delta)
        data_venda = data_inicio + timedelta(days=dias_venda)
        
        # Data da cobertura (recompra)
        periodo_cobertura = random.randint(1, 30)
        data_cobertura = data_venda + timedelta(days=periodo_cobertura)
        
        if data_cobertura > data_fim:
            continue
        
        # Preços (esperança de queda para lucro)
        preco_venda = round(random.uniform(30.0, 80.0), 2)
        variacao = random.uniform(-0.05, 0.02)  # -5% a +2%
        preco_cobertura = round(preco_venda * (1 + variacao), 2)
        
        # Taxas
        taxa_venda = round(quantity * preco_venda * 0.0005, 2)
        taxa_cobertura = round(quantity * preco_cobertura * 0.0005, 2)
        
        # Operações
        venda = {
            "date": data_venda,
            "ticker": ticker,
            "operation": "sell",
            "quantity": quantity,
            "price": preco_venda,
            "fees": taxa_venda,
            "usuario_id": usuario_id
        }
        
        cobertura = {
            "date": data_cobertura,
            "ticker": ticker,
            "operation": "buy",
            "quantity": quantity,
            "price": preco_cobertura,
            "fees": taxa_cobertura,
            "usuario_id": usuario_id
        }
        
        operacoes.extend([venda, cobertura])
    
    return operacoes


def validar_operacao_fechada(operacao_fechada) -> bool:
    """
    Valida se uma operação fechada está consistente
    
    Args:
        operacao_fechada: Objeto OperacaoFechada
    
    Returns:
        True se válida, False caso contrário
    """
    try:
        # Validações básicas
        assert operacao_fechada.quantidade > 0
        assert operacao_fechada.valor_compra > 0
        assert operacao_fechada.valor_venda > 0
        assert operacao_fechada.data_abertura <= operacao_fechada.data_fechamento
        
        # Validar cálculo do resultado
        resultado_esperado = operacao_fechada.valor_venda - operacao_fechada.valor_compra
        assert abs(operacao_fechada.resultado - resultado_esperado) < 0.01
        
        # Validar percentual
        if operacao_fechada.valor_compra > 0:
            percentual_esperado = (resultado_esperado / operacao_fechada.valor_compra) * 100
            assert abs(operacao_fechada.percentual_lucro - percentual_esperado) < 0.01
        
        # Validar tipo
        assert operacao_fechada.tipo in ["compra-venda", "venda-compra"]
        
        # Validar day trade (mesmo dia)
        if operacao_fechada.day_trade:
            assert operacao_fechada.data_abertura == operacao_fechada.data_fechamento
        
        return True
        
    except (AssertionError, AttributeError):
        return False


def validar_resultado_mensal(resultado: Dict[str, Any]) -> bool:
    """
    Valida se um resultado mensal está consistente
    
    Args:
        resultado: Dicionário com resultado mensal
    
    Returns:
        True se válido, False caso contrário
    """
    try:
        # Campos obrigatórios
        campos_obrigatorios = [
            "mes", "vendas_swing", "custo_swing", "ganho_liquido_swing",
            "vendas_day_trade", "custo_day_trade", "ganho_liquido_day",
            "ir_devido_swing", "ir_devido_day", "ir_pagar_swing", "ir_pagar_day"
        ]
        
        for campo in campos_obrigatorios:
            assert campo in resultado
        
        # Validar formato do mês
        mes = resultado["mes"]
        assert len(mes) == 7  # YYYY-MM
        assert mes[4] == "-"
        
        ano = int(mes[:4])
        mes_num = int(mes[5:])
        assert 2020 <= ano <= 2030  # Ano razoável
        assert 1 <= mes_num <= 12   # Mês válido
        
        # Validar cálculos
        # Ganho líquido = vendas - custos
        ganho_swing_esperado = resultado["vendas_swing"] - resultado["custo_swing"]
        assert abs(resultado["ganho_liquido_swing"] - ganho_swing_esperado) < 0.01
        
        ganho_day_esperado = resultado["vendas_day_trade"] - resultado["custo_day_trade"]
        assert abs(resultado["ganho_liquido_day"] - ganho_day_esperado) < 0.01
        
        # IR a pagar não pode ser maior que IR devido
        assert resultado["ir_pagar_swing"] <= resultado["ir_devido_swing"]
        assert resultado["ir_pagar_day"] <= resultado["ir_devido_day"]
        
        # Valores não podem ser negativos (exceto ganho líquido)
        assert resultado["vendas_swing"] >= 0
        assert resultado["custo_swing"] >= 0
        assert resultado["vendas_day_trade"] >= 0
        assert resultado["custo_day_trade"] >= 0
        assert resultado["ir_devido_swing"] >= 0
        assert resultado["ir_devido_day"] >= 0
        assert resultado["ir_pagar_swing"] >= 0
        assert resultado["ir_pagar_day"] >= 0
        
        return True
        
    except (AssertionError, KeyError, ValueError):
        return False


def calcular_estatisticas_operacoes(operacoes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calcula estatísticas de uma lista de operações
    
    Args:
        operacoes: Lista de operações
    
    Returns:
        Dicionário com estatísticas
    """
    if not operacoes:
        return {
            "total_operacoes": 0,
            "total_compras": 0,
            "total_vendas": 0,
            "volume_total": 0.0,
            "taxa_media": 0.0,
            "tickers_unicos": 0,
            "periodo_dias": 0
        }
    
    total_operacoes = len(operacoes)
    compras = [op for op in operacoes if op["operation"] == "buy"]
    vendas = [op for op in operacoes if op["operation"] == "sell"]
    
    volume_total = sum(op["quantity"] * op["price"] for op in operacoes)
    taxa_total = sum(op["fees"] for op in operacoes)
    taxa_media = taxa_total / total_operacoes if total_operacoes > 0 else 0
    
    tickers_unicos = len(set(op["ticker"] for op in operacoes))
    
    datas = [op["date"] for op in operacoes if op["date"]]
    periodo_dias = 0
    if datas:
        data_min = min(datas)
        data_max = max(datas)
        periodo_dias = (data_max - data_min).days
    
    return {
        "total_operacoes": total_operacoes,
        "total_compras": len(compras),
        "total_vendas": len(vendas),
        "volume_total": round(volume_total, 2),
        "taxa_media": round(taxa_media, 2),
        "tickers_unicos": tickers_unicos,
        "periodo_dias": periodo_dias
    }


def criar_cenario_fiscal_complexo(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Cria um cenário fiscal complexo para testes
    
    Args:
        usuario_id: ID do usuário
    
    Returns:
        Lista de operações que geram cenário fiscal complexo
    """
    operacoes = []
    
    # Janeiro: Day trade com lucro
    operacoes.extend([
        {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "buy", "quantity": 1000, "price": 30.00, "fees": 15.00, "usuario_id": usuario_id},
        {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "sell", "quantity": 1000, "price": 32.00, "fees": 16.00, "usuario_id": usuario_id}
    ])
    
    # Fevereiro: Swing trade com lucro (isento)
    operacoes.extend([
        {"date": date(2024, 2, 5), "ticker": "VALE3", "operation": "buy", "quantity": 100, "price": 60.00, "fees": 6.00, "usuario_id": usuario_id},
        {"date": date(2024, 2, 20), "ticker": "VALE3", "operation": "sell", "quantity": 100, "price": 65.00, "fees": 6.50, "usuario_id": usuario_id}
    ])
    
    # Março: Day trade com prejuízo
    operacoes.extend([
        {"date": date(2024, 3, 10), "ticker": "ITUB4", "operation": "buy", "quantity": 800, "price": 26.00, "fees": 12.00, "usuario_id": usuario_id},
        {"date": date(2024, 3, 10), "ticker": "ITUB4", "operation": "sell", "quantity": 800, "price": 24.50, "fees": 13.00, "usuario_id": usuario_id}
    ])
    
    # Abril: Swing trade com lucro (tributável)
    operacoes.extend([
        {"date": date(2024, 4, 1), "ticker": "BBAS3", "operation": "buy", "quantity": 500, "price": 45.00, "fees": 15.00, "usuario_id": usuario_id},
        {"date": date(2024, 4, 25), "ticker": "BBAS3", "operation": "sell", "quantity": 500, "price": 50.00, "fees": 16.00, "usuario_id": usuario_id}
    ])
    
    # Maio: Day trade com lucro (deve compensar prejuízo anterior)
    operacoes.extend([
        {"date": date(2024, 5, 8), "ticker": "WEGE3", "operation": "buy", "quantity": 600, "price": 40.00, "fees": 12.00, "usuario_id": usuario_id},
        {"date": date(2024, 5, 8), "ticker": "WEGE3", "operation": "sell", "quantity": 600, "price": 43.00, "fees": 14.00, "usuario_id": usuario_id}
    ])
    
    # Junho: Venda descoberto com lucro
    operacoes.extend([
        {"date": date(2024, 6, 5), "ticker": "PETR4", "operation": "sell", "quantity": 400, "price": 35.00, "fees": 10.00, "usuario_id": usuario_id},
        {"date": date(2024, 6, 20), "ticker": "PETR4", "operation": "buy", "quantity": 400, "price": 32.50, "fees": 9.50, "usuario_id": usuario_id}
    ])
    
    return operacoes


def assert_valores_proximos(valor1: float, valor2: float, tolerancia: float = 0.01) -> bool:
    """
    Verifica se dois valores estão próximos dentro de uma tolerância
    
    Args:
        valor1: Primeiro valor
        valor2: Segundo valor
        tolerancia: Tolerância para diferença
    
    Returns:
        True se valores estão próximos
    """
    return abs(valor1 - valor2) <= tolerancia


def imprimir_resumo_teste(nome_teste: str, operacoes: List[Dict], resultados: List[Dict]):
    """
    Imprime resumo de um teste para debug
    
    Args:
        nome_teste: Nome do teste
        operacoes: Lista de operações
        resultados: Lista de resultados mensais
    """
    print(f"\n=== RESUMO DO TESTE: {nome_teste} ===")
    print(f"Total de operações: {len(operacoes)}")
    
    if operacoes:
        stats = calcular_estatisticas_operacoes(operacoes)
        print(f"Compras: {stats['total_compras']}, Vendas: {stats['total_vendas']}")
        print(f"Volume total: R$ {stats['volume_total']:,.2f}")
        print(f"Tickers únicos: {stats['tickers_unicos']}")
    
    if resultados:
        print(f"Meses com resultados: {len(resultados)}")
        for resultado in resultados:
            print(f"  {resultado['mes']}: "
                  f"Swing R$ {resultado.get('ganho_liquido_swing', 0):.2f}, "
                  f"Day R$ {resultado.get('ganho_liquido_day', 0):.2f}")
    
    print("=" * 50)
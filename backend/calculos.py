"""
Este módulo contém toda a lógica de negócio para cálculos relacionados a
operações de ações, incluindo preço médio, resultados de operações,
e apuração de impostos, seguindo as regras da B3 e da Receita Federal.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import List, Dict, Any, Optional

from models import Operacao

@dataclass
class PosicaoAcao:
    """Representa a posição em uma única ação."""
    ticker: str
    quantidade: int = 0
    custo_total: float = 0.0
    preco_medio: float = 0.0

    # Posição vendida (short)
    quantidade_vendida: int = 0
    valor_venda_total: float = 0.0
    preco_medio_venda: float = 0.0

def classificar_operacoes_por_dia(operacoes_do_dia: List[Operacao]) -> Dict[str, List[Operacao]]:
    """
    Classifica as operações de um dia em Day Trade e Swing Trade, dividindo
    as operações se necessário.

    Args:
        operacoes_do_dia: Lista de operações de um único dia.

    Returns:
        Um dicionário com duas chaves: 'day_trade' e 'swing_trade',
        cada uma contendo uma lista de operações.
    """
    operacoes_day_trade = []
    operacoes_swing_trade = []

    ops_por_ticker = defaultdict(lambda: {'compras': [], 'vendas': []})
    for op in operacoes_do_dia:
        if op.operation == 'buy':
            ops_por_ticker[op.ticker]['compras'].append(op)
        else:
            ops_por_ticker[op.ticker]['vendas'].append(op)

    for ticker, trades in ops_por_ticker.items():
        compras = trades['compras']
        vendas = trades['vendas']

        if not compras or not vendas:
            operacoes_swing_trade.extend(compras)
            operacoes_swing_trade.extend(vendas)
            continue

        total_comprado = sum(op.quantity for op in compras)
        total_vendido = sum(op.quantity for op in vendas)
        qtd_day_trade = min(total_comprado, total_vendido)

        if qtd_day_trade == 0:
            operacoes_swing_trade.extend(compras)
            operacoes_swing_trade.extend(vendas)
            continue

        # Lógica de split para compras
        qtd_day_trade_alocada_compra = 0
        for op in compras:
            if qtd_day_trade_alocada_compra >= qtd_day_trade:
                operacoes_swing_trade.append(op)
                continue

            qtd_para_dt = min(op.quantity, qtd_day_trade - qtd_day_trade_alocada_compra)

            if qtd_para_dt > 0:
                op_dt = op.model_copy(deep=True)
                op_dt.quantity = qtd_para_dt
                operacoes_day_trade.append(op_dt)
                qtd_day_trade_alocada_compra += qtd_para_dt

            qtd_para_st = op.quantity - qtd_para_dt
            if qtd_para_st > 0:
                op_st = op.model_copy(deep=True)
                op_st.quantity = qtd_para_st
                operacoes_swing_trade.append(op_st)

        # Lógica de split para vendas
        qtd_day_trade_alocada_venda = 0
        for op in vendas:
            if qtd_day_trade_alocada_venda >= qtd_day_trade:
                operacoes_swing_trade.append(op)
                continue

            qtd_para_dt = min(op.quantity, qtd_day_trade - qtd_day_trade_alocada_venda)

            if qtd_para_dt > 0:
                op_dt = op.model_copy(deep=True)
                op_dt.quantity = qtd_para_dt
                operacoes_day_trade.append(op_dt)
                qtd_day_trade_alocada_venda += qtd_para_dt

            qtd_para_st = op.quantity - qtd_para_dt
            if qtd_para_st > 0:
                op_st = op.model_copy(deep=True)
                op_st.quantity = qtd_para_st
                operacoes_swing_trade.append(op_st)

    return {
        'day_trade': operacoes_day_trade,
        'swing_trade': operacoes_swing_trade
    }

@dataclass
class OperacaoFechada:
    """Representa uma operação de compra/venda que foi liquidada."""
    ticker: str
    quantidade: int
    preco_medio_compra: float
    preco_medio_venda: float
    resultado: float
    day_trade: bool
    data_fechamento: date

def calcular_resultado_day_trade(operacoes: List[Operacao]) -> Optional[OperacaoFechada]:
    """
    Calcula o resultado consolidado de todas as operações de day trade para um ticker.
    """
    if not operacoes:
        return None

    ticker = operacoes[0].ticker
    data_operacao = operacoes[0].date

    compras = [op for op in operacoes if op.operation == 'buy']
    vendas = [op for op in operacoes if op.operation == 'sell']

    total_custo_compra = sum(op.quantity * op.price + op.fees for op in compras)
    total_valor_venda = sum(op.quantity * op.price - op.fees for op in vendas)
    total_qtd_compra = sum(op.quantity for op in compras)
    total_qtd_venda = sum(op.quantity for op in vendas)

    if total_qtd_compra == 0 or total_qtd_venda == 0:
        return None # Não é um day trade completo

    pm_compra = total_custo_compra / total_qtd_compra
    pm_venda = total_valor_venda / total_qtd_venda

    qtd_day_trade = min(total_qtd_compra, total_qtd_venda)

    resultado = (pm_venda - pm_compra) * qtd_day_trade

    return OperacaoFechada(
        ticker=ticker,
        quantidade=qtd_day_trade,
        preco_medio_compra=pm_compra,
        preco_medio_venda=pm_venda,
        resultado=resultado,
        day_trade=True,
        data_fechamento=data_operacao
    )

def processar_operacao_swing_trade(posicao: PosicaoAcao, operacao: Operacao) -> Optional[OperacaoFechada]:
    """
    Processa uma única operação de swing trade (compra ou venda),
    atualizando a posição da ação e retornando uma operação fechada (resultado)
    se uma venda ocorrer. O cálculo do custo de aquisição é baseado no preço
    médio ponderado de todas as compras realizadas.
    """
    if operacao.operation == 'buy':
        # Adiciona o custo da nova compra ao custo total e a quantidade comprada à quantidade total.
        custo_compra = operacao.quantity * operacao.price + operacao.fees
        posicao.custo_total += custo_compra
        posicao.quantidade += operacao.quantity

        # Recalcula o preço médio ponderado após a compra.
        if posicao.quantidade > 0:
            posicao.preco_medio = posicao.custo_total / posicao.quantidade

        return None  # Compras não fecham operações, apenas atualizam a posição.

    elif operacao.operation == 'sell':
        # A venda só pode ocorrer se houver uma posição comprada.
        if posicao.quantidade > 0:
            qtd_a_vender = min(operacao.quantity, posicao.quantidade)

            # O custo das ações vendidas é baseado no preço médio ponderado atual.
            custo_da_venda = qtd_a_vender * posicao.preco_medio
            valor_da_venda = qtd_a_vender * operacao.price - operacao.fees
            resultado = valor_da_venda - custo_da_venda

            # Atualiza a posição em carteira, deduzindo a quantidade e o custo proporcional.
            posicao.quantidade -= qtd_a_vender
            posicao.custo_total -= custo_da_venda

            # Se a posição for zerada, o preço médio e o custo total também devem ser zerados.
            if posicao.quantidade == 0:
                posicao.preco_medio = 0
                posicao.custo_total = 0

            # Cria um registro da operação fechada com o resultado apurado.
            return OperacaoFechada(
                ticker=posicao.ticker,
                quantidade=qtd_a_vender,
                preco_medio_compra=posicao.preco_medio,
                preco_medio_venda=operacao.price,
                resultado=resultado,
                day_trade=False,
                data_fechamento=operacao.date
            )

    return None  # Retorna None se a operação não for uma venda ou se não houver posição para vender.

def calcular_resultados_operacoes(operacoes: List[Operacao]) -> Dict[str, Any]:
    """
    Orquestra o cálculo de resultados para uma lista de operações de um usuário.

    Args:
        operacoes: Lista de todas as operações do usuário, ordenadas por data.

    Returns:
        Um dicionário contendo 'operacoes_fechadas' e 'carteira_final'.
    """
    operacoes_fechadas = []
    posicoes = defaultdict(PosicaoAcao)

    operacoes_por_dia = defaultdict(list)
    for op in operacoes:
        operacoes_por_dia[op.date].append(op)

    for data, ops_dia in sorted(operacoes_por_dia.items()):
        classificadas = classificar_operacoes_por_dia(ops_dia)

        # Processa Day Trades
        ops_dt_por_ticker = defaultdict(list)
        for op_dt in classificadas['day_trade']:
            ops_dt_por_ticker[op_dt.ticker].append(op_dt)

        for ticker, ops_dt in ops_dt_por_ticker.items():
            resultado_dt = calcular_resultado_day_trade(ops_dt)
            if resultado_dt:
                operacoes_fechadas.append(resultado_dt)

        # Processa Swing Trades
        for op_st in sorted(classificadas['swing_trade'], key=lambda x: x.id or 0):
            if op_st.ticker not in posicoes:
                posicoes[op_st.ticker] = PosicaoAcao(ticker=op_st.ticker)

            posicao_atual = posicoes[op_st.ticker]
            resultado_st = processar_operacao_swing_trade(posicao_atual, op_st)
            if resultado_st:
                operacoes_fechadas.append(resultado_st)

    return {
        "operacoes_fechadas": operacoes_fechadas,
        "carteira_final": posicoes
    }

def _calcular_status_ir_operacao_fechada(op_fechada, resultados_mensais_map):
    """
    Calcula o status de IR para uma operação fechada
    """
    data_fechamento = op_fechada["data_fechamento"]
    if isinstance(data_fechamento, str):
        from datetime import datetime
        data_fechamento_obj = datetime.fromisoformat(data_fechamento.split("T")[0]).date()
    else:
        data_fechamento_obj = data_fechamento

    mes_fechamento = data_fechamento_obj.strftime("%Y-%m")
    resultado_mes = resultados_mensais_map.get(mes_fechamento)

    if op_fechada["resultado"] <= 0:
        return "Prejuízo Acumulado"

    if op_fechada["day_trade"]:
        if resultado_mes and resultado_mes.get("ir_pagar_day", 0) > 0:
            return "Tributável Day Trade"
        else:
            return "Lucro Compensado"
    else:  # Swing Trade
        if resultado_mes and resultado_mes.get("isento_swing", False):
            return "Isento"
        elif resultado_mes and resultado_mes.get("ir_pagar_swing", 0) > 0:
            return "Tributável Swing"
        else:
            return "Lucro Compensado"

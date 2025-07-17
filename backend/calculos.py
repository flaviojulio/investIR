"""
Este módulo contém toda a lógica de negócio para cálculos relacionados a
operações de ações, incluindo preço médio, resultados de operações,
e apuração de impostos, seguindo as regras da B3 e da Receita Federal.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import List, Dict, Any, Optional

from .models import Operacao

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
    Agrupa as operações de um dia por ticker.
    """
    ops_por_ticker = defaultdict(list)
    for op in operacoes_do_dia:
        ops_por_ticker[op.ticker].append(op)
    return ops_por_ticker

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

def calcular_resultado_day_trade(operacoes: List[Operacao]) -> Dict[str, Any]:
    """
    Calcula o resultado de day trade e retorna as operações de swing trade restantes.
    """
    ticker = operacoes[0].ticker
    data_operacao = operacoes[0].date

    compras = [op for op in operacoes if op.operation == 'buy']
    vendas = [op for op in operacoes if op.operation == 'sell']

    total_custo_compra = sum(op.quantity * op.price + op.fees for op in compras)
    total_qtd_compra = sum(op.quantity for op in compras)
    pm_compra_ponderado = total_custo_compra / total_qtd_compra if total_qtd_compra > 0 else 0

    total_valor_venda = sum(op.quantity * op.price - op.fees for op in vendas)
    total_qtd_venda = sum(op.quantity for op in vendas)
    pm_venda_ponderado = total_valor_venda / total_qtd_venda if total_qtd_venda > 0 else 0

    qtd_day_trade = min(total_qtd_compra, total_qtd_venda)

    resultado_dt = None
    if qtd_day_trade > 0:
        custo_total_dt = qtd_day_trade * pm_compra_ponderado
        valor_venda_dt = qtd_day_trade * pm_venda_ponderado
        resultado = valor_venda_dt - custo_total_dt
        resultado_dt = OperacaoFechada(
            ticker=ticker,
            quantidade=qtd_day_trade,
            preco_medio_compra=pm_compra_ponderado,
            preco_medio_venda=pm_venda_ponderado,
            resultado=resultado,
            day_trade=True,
            data_fechamento=data_operacao
        )

    swing_trade_ops = []
    if total_qtd_compra > qtd_day_trade:
        # Simplificação: adiciona todas as compras se houver excesso
        swing_trade_ops.extend(compras)
    if total_qtd_venda > qtd_day_trade:
        # Simplificação: adiciona todas as vendas se houver excesso
        swing_trade_ops.extend(vendas)

    return {"resultado_dt": resultado_dt, "swing_trade_ops": swing_trade_ops}

def processar_operacao_swing_trade(posicao: PosicaoAcao, operacao: Operacao) -> Optional[OperacaoFechada]:
    """
    Processa uma única operação de swing trade, atualizando a posição e
    retornando uma operação fechada se aplicável.
    """
    if operacao.operation == 'buy':
        custo_compra = operacao.quantity * operacao.price + operacao.fees

        if posicao.quantidade_vendida > 0:
            qtd_coberta = min(posicao.quantidade_vendida, operacao.quantity)
            valor_venda_original = qtd_coberta * posicao.preco_medio_venda
            custo_recompra = qtd_coberta * operacao.price
            resultado = valor_venda_original - custo_recompra

            posicao.quantidade_vendida -= qtd_coberta
            posicao.valor_venda_total -= valor_venda_original
            if posicao.quantidade_vendida > 0:
                posicao.preco_medio_venda = posicao.valor_venda_total / posicao.quantidade_vendida
            else:
                posicao.preco_medio_venda = 0

            op_fechada = OperacaoFechada(
                ticker=posicao.ticker,
                quantidade=qtd_coberta,
                preco_medio_compra=operacao.price,
                preco_medio_venda=posicao.preco_medio_venda,
                resultado=resultado,
                day_trade=False,
                data_fechamento=operacao.date
            )

            qtd_restante = operacao.quantity - qtd_coberta
            if qtd_restante > 0:
                posicao.quantidade += qtd_restante
                posicao.custo_total += qtd_restante * operacao.price + operacao.fees
                posicao.preco_medio = posicao.custo_total / posicao.quantidade

            return op_fechada
        else:
            posicao.quantidade += operacao.quantity
            posicao.custo_total += custo_compra
            posicao.preco_medio = posicao.custo_total / posicao.quantidade
            return None
    else: # sell
        valor_venda = operacao.quantity * operacao.price - operacao.fees

        if posicao.quantidade > 0:
            qtd_a_vender = min(posicao.quantidade, operacao.quantity)

            custo_venda = qtd_a_vender * posicao.preco_medio
            resultado = (qtd_a_vender * operacao.price) - custo_venda - operacao.fees

            posicao.quantidade -= qtd_a_vender
            posicao.custo_total -= custo_venda
            if posicao.quantidade > 0:
                posicao.preco_medio = posicao.custo_total / posicao.quantidade
            else:
                posicao.preco_medio = 0

            op_fechada = OperacaoFechada(
                ticker=posicao.ticker,
                quantidade=qtd_a_vender,
                preco_medio_compra=posicao.preco_medio,
                preco_medio_venda=operacao.price,
                resultado=resultado,
                day_trade=False,
                data_fechamento=operacao.date
            )

            qtd_restante = operacao.quantity - qtd_a_vender
            if qtd_restante > 0:
                posicao.quantidade_vendida += qtd_restante
                posicao.valor_venda_total += qtd_restante * operacao.price - operacao.fees
                posicao.preco_medio_venda = posicao.valor_venda_total / posicao.quantidade_vendida

            return op_fechada
        else:
            posicao.quantidade_vendida += operacao.quantity
            posicao.valor_venda_total += valor_venda
            posicao.preco_medio_venda = posicao.valor_venda_total / posicao.quantidade_vendida
            return None

def calcular_resultados_operacoes(operacoes: List[Operacao]) -> Dict[str, Any]:
    """
    Orquestra o cálculo de resultados para uma lista de operações de um usuário.
    """
    operacoes_fechadas = []
    posicoes = defaultdict(PosicaoAcao)

    operacoes_por_dia = defaultdict(list)
    for op in operacoes:
        operacoes_por_dia[op.date].append(op)

    for data, ops_dia in sorted(operacoes_por_dia.items()):
        ops_por_ticker = classificar_operacoes_por_dia(ops_dia)

        for ticker, ops_ticker_dia in ops_por_ticker.items():
            compras = [op for op in ops_ticker_dia if op.operation == 'buy']
            vendas = [op for op in ops_ticker_dia if op.operation == 'sell']

            swing_trade_ops = ops_ticker_dia
            if compras and vendas:
                resultado_day_trade = calcular_resultado_day_trade(ops_ticker_dia)
                if resultado_day_trade["resultado_dt"]:
                    operacoes_fechadas.append(resultado_day_trade["resultado_dt"])
                swing_trade_ops = resultado_day_trade["swing_trade_ops"]

            for op_st in sorted(swing_trade_ops, key=lambda x: x.id or 0):
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

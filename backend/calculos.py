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
    CORREÇÃO: Não separa mais operações por DT/ST.
    Apenas identifica se é um dia de day trade ou não.
    
    Para day trade: usa preço médio ponderado global
    Para swing trade: usa preço médio histórico
    """
    ops_por_ticker = defaultdict(lambda: {'compras': [], 'vendas': []})
    for op in operacoes_do_dia:
        if op.operation == 'buy':
            ops_por_ticker[op.ticker]['compras'].append(op)
        else:
            ops_por_ticker[op.ticker]['vendas'].append(op)

    # Verificar se há day trade (compra E venda no mesmo dia)
    day_trade_tickers = []
    for ticker, trades in ops_por_ticker.items():
        compras = trades['compras']
        vendas = trades['vendas']
        
        if compras and vendas:  # Há compra E venda = day trade
            day_trade_tickers.append(ticker)

    # NOVA LÓGICA: Não separa operações, apenas marca como DT ou ST
    if day_trade_tickers:
        # É um dia de day trade - retorna TODAS as operações como day_trade
        return {
            'day_trade': operacoes_do_dia,
            'swing_trade': []
        }
    else:
        # É um dia de swing trade apenas
        return {
            'day_trade': [],
            'swing_trade': operacoes_do_dia
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
    CORREÇÃO: Calcula o resultado de day trade usando preço médio ponderado global.
    """
    if not operacoes:
        return None

    ticker = operacoes[0].ticker
    data_operacao = operacoes[0].date

    compras = [op for op in operacoes if op.operation == 'buy']
    vendas = [op for op in operacoes if op.operation == 'sell']

    if not compras or not vendas:
        return None  # Não é day trade completo

    # CORREÇÃO: Calcular preço médio ponderado global de TODAS as compras
    total_custo_compra = sum(op.quantity * op.price + op.fees for op in compras)
    total_qtd_compra = sum(op.quantity for op in compras)
    
    # CORREÇÃO: Calcular preço médio ponderado global de TODAS as vendas
    total_valor_venda_bruto = sum(op.quantity * op.price for op in vendas)
    total_fees_venda = sum(op.fees for op in vendas)
    total_valor_venda_liquido = total_valor_venda_bruto - total_fees_venda
    total_qtd_venda = sum(op.quantity for op in vendas)

    # CORREÇÃO: Preço médio ponderado global
    pm_compra = total_custo_compra / total_qtd_compra
    pm_venda = total_valor_venda_liquido / total_qtd_venda

    # Day trade é a menor quantidade entre compras e vendas
    qtd_day_trade = min(total_qtd_compra, total_qtd_venda)

    # CORREÇÃO: Resultado baseado no preço médio ponderado global
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
    Processa uma única operação de swing trade.
    CORREÇÃO: Aplica validação de zeramento.
    """
    if operacao.operation == 'buy':
        custo_compra = operacao.quantity * operacao.price + operacao.fees
        posicao.custo_total += custo_compra
        posicao.quantidade += operacao.quantity

        if posicao.quantidade > 0:
            posicao.preco_medio = posicao.custo_total / posicao.quantidade

        return None

    elif operacao.operation == 'sell':
        if posicao.quantidade > 0:
            qtd_a_vender = min(operacao.quantity, posicao.quantidade)
            custo_da_venda = qtd_a_vender * posicao.preco_medio
            valor_da_venda = qtd_a_vender * operacao.price - operacao.fees
            resultado = valor_da_venda - custo_da_venda

            posicao.quantidade -= qtd_a_vender
            posicao.custo_total -= custo_da_venda

            # CORREÇÃO: Aplicar validação de zeramento
            if posicao.quantidade == 0:
                posicao.preco_medio = 0.0
                posicao.custo_total = 0.0
            elif posicao.quantidade > 0:
                posicao.preco_medio = posicao.custo_total / posicao.quantidade

            return OperacaoFechada(
                ticker=posicao.ticker,
                quantidade=qtd_a_vender,
                preco_medio_compra=posicao.preco_medio,
                preco_medio_venda=operacao.price,
                resultado=resultado,
                day_trade=False,
                data_fechamento=operacao.date
            )

    return None

def calcular_resultados_operacoes(operacoes: List[Operacao]) -> Dict[str, Any]:
    """
    CORREÇÃO: Nova lógica que calcula preço médio ponderado corretamente.
    """
    operacoes_fechadas = []
    posicoes = defaultdict(PosicaoAcao)

    # Agrupar operações por dia
    operacoes_por_dia = defaultdict(list)
    for op in operacoes:
        operacoes_por_dia[op.date].append(op)

    for data, ops_dia in sorted(operacoes_por_dia.items()):
        # Verificar se há day trade neste dia
        ops_por_ticker = defaultdict(lambda: {'compras': [], 'vendas': []})
        for op in ops_dia:
            if op.operation == 'buy':
                ops_por_ticker[op.ticker]['compras'].append(op)
            else:
                ops_por_ticker[op.ticker]['vendas'].append(op)

        for ticker, trades in ops_por_ticker.items():
            compras = trades['compras']
            vendas = trades['vendas']
            
            if compras and vendas:
                # DIA DE DAY TRADE - usar PM global
                ops_do_ticker = compras + vendas
                resultado_dt = calcular_resultado_day_trade(ops_do_ticker)
                if resultado_dt:
                    operacoes_fechadas.append(resultado_dt)
                
                # Processar o que sobrou como swing trade
                total_comprado = sum(op.quantity for op in compras)
                total_vendido = sum(op.quantity for op in vendas)
                
                if total_comprado > total_vendido:
                    # Sobrou compra - adicionar à posição
                    qtd_restante = total_comprado - total_vendido
                    # Criar operação virtual de compra com PM global
                    pm_compra_global = sum(op.quantity * op.price + op.fees for op in compras) / total_comprado
                    
                    if ticker not in posicoes:
                        posicoes[ticker] = PosicaoAcao(ticker=ticker)
                    
                    posicoes[ticker].quantidade += qtd_restante
                    posicoes[ticker].custo_total += qtd_restante * pm_compra_global
                    if posicoes[ticker].quantidade > 0:
                        posicoes[ticker].preco_medio = posicoes[ticker].custo_total / posicoes[ticker].quantidade
                
                elif total_vendido > total_comprado:
                    # Sobrou venda - processar como swing trade
                    qtd_venda_st = total_vendido - total_comprado
                    pm_venda_global = (sum(op.quantity * op.price for op in vendas) - sum(op.fees for op in vendas)) / total_vendido
                    
                    if ticker not in posicoes:
                        posicoes[ticker] = PosicaoAcao(ticker=ticker)
                    
                    if posicoes[ticker].quantidade > 0:
                        qtd_a_vender = min(qtd_venda_st, posicoes[ticker].quantidade)
                        custo_da_venda = qtd_a_vender * posicoes[ticker].preco_medio
                        valor_da_venda = qtd_a_vender * pm_venda_global
                        resultado = valor_da_venda - custo_da_venda
                        
                        # Criar operação fechada de swing trade
                        op_fechada_st = OperacaoFechada(
                            ticker=ticker,
                            quantidade=qtd_a_vender,
                            preco_medio_compra=posicoes[ticker].preco_medio,
                            preco_medio_venda=pm_venda_global,
                            resultado=resultado,
                            day_trade=False,
                            data_fechamento=data
                        )
                        operacoes_fechadas.append(op_fechada_st)
                        
                        # Atualizar posição
                        posicoes[ticker].quantidade -= qtd_a_vender
                        posicoes[ticker].custo_total -= custo_da_venda
                        if posicoes[ticker].quantidade == 0:
                            posicoes[ticker].preco_medio = 0.0
                            posicoes[ticker].custo_total = 0.0
                        elif posicoes[ticker].quantidade > 0:
                            posicoes[ticker].preco_medio = posicoes[ticker].custo_total / posicoes[ticker].quantidade
            else:
                # DIA DE SWING TRADE APENAS
                for op in compras + vendas:
                    if op.ticker not in posicoes:
                        posicoes[op.ticker] = PosicaoAcao(ticker=op.ticker)
                    
                    resultado_st = processar_operacao_swing_trade(posicoes[op.ticker], op)
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

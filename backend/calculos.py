from utils import extrair_mes_data_seguro
"""
Este módulo contém toda a lógica de negócio para cálculos relacionados a
operações de ações, incluindo preço médio, resultados de operações,
e apuração de impostos, seguindo as regras da B3 e da Receita Federal.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import List, Dict, Any, Optional

from models import Operacao, OperacaoFechada

@dataclass
class PosicaoAcao:
    """Representa a posição em uma única ação."""
    ticker: str
    quantidade: int = 0
    custo_total: float = 0.0
    preco_medio: float = 0.0

    # ✅ CORREÇÃO: Posição vendida (short) com campos corretos
    quantidade_vendida: int = 0
    valor_venda_total: float = 0.0
    preco_medio_venda: float = 0.0
    
    def tem_posicao_vendida(self) -> bool:
        """Verifica se há posição vendida (short)"""
        return self.quantidade_vendida > 0
    
    def tem_posicao_comprada(self) -> bool:
        """Verifica se há posição comprada (long)"""
        return self.quantidade > 0


def calcular_resultado_day_trade(operacoes: List[Operacao]) -> Optional[OperacaoFechada]:
    """
    Calcula o resultado de day trade usando preço médio ponderado global.
    """
    if not operacoes:
        return None

    ticker = operacoes[0].ticker
    data_operacao = operacoes[0].date

    compras = [op for op in operacoes if op.operation == 'buy']
    vendas = [op for op in operacoes if op.operation == 'sell']

    if not compras or not vendas:
        return None  # Não é day trade completo

    # Calcular preço médio ponderado global de TODAS as compras
    total_custo_compra = sum(op.quantity * op.price + op.fees for op in compras)
    total_qtd_compra = sum(op.quantity for op in compras)
    
    # Validação: Verificar se há quantidade de compra
    if total_qtd_compra <= 0:
        return None
    
    # Calcular preço médio ponderado global de TODAS as vendas
    total_valor_venda_bruto = sum(op.quantity * op.price for op in vendas)
    total_fees_venda = sum(op.fees for op in vendas)
    total_valor_venda_liquido = total_valor_venda_bruto - total_fees_venda
    total_qtd_venda = sum(op.quantity for op in vendas)

    # Validação: Verificar se há quantidade de venda
    if total_qtd_venda <= 0:
        return None

    # Preço médio ponderado global com validação
    pm_compra = total_custo_compra / total_qtd_compra
    pm_venda = total_valor_venda_liquido / total_qtd_venda

    # Validações críticas
    if pm_compra <= 0 or pm_venda <= 0:
        return None

    # Day trade é a menor quantidade entre compras e vendas
    qtd_day_trade = min(total_qtd_compra, total_qtd_venda)

    # Resultado baseado no preço médio ponderado global
    resultado = (pm_venda - pm_compra) * qtd_day_trade

    return OperacaoFechada(
        ticker=ticker,
        quantidade=qtd_day_trade,
        preco_medio_compra=pm_compra,
        preco_medio_venda=pm_venda,
        resultado=resultado,
        day_trade=True,  # ✅ CRÍTICO: Marcar como day trade
        data_fechamento=data_operacao
    )





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






def processar_operacao_swing_trade(posicao: PosicaoAcao, operacao: Operacao) -> Optional[OperacaoFechada]:
    """
    Processa uma única operação de swing trade.
    CORREÇÃO: Trata adequadamente vendas a descoberto e suas coberturas.
    """
    if operacao.operation == 'buy':
        # ✅ CASO 1: Compra para cobrir posição vendida (short covering)
        if posicao.tem_posicao_vendida():
            qtd_a_cobrir = min(operacao.quantity, posicao.quantidade_vendida)
            
            # Calcular preços efetivos
            preco_compra_efetivo = operacao.price + (operacao.fees / operacao.quantity if operacao.quantity > 0 else 0)
            preco_venda_original = posicao.preco_medio_venda
            
            # ✅ VALIDAÇÃO: Verificar se preços são válidos
            if preco_venda_original <= 0:
                print(f"❌ ERRO: Preço médio da venda a descoberto inválido: {preco_venda_original}")
                return None
            
            # Criar operação fechada de cobertura (VENDA → COMPRA)
            resultado = (preco_venda_original - preco_compra_efetivo) * qtd_a_cobrir
            
            op_fechada = OperacaoFechada(
                ticker=posicao.ticker,
                quantidade=qtd_a_cobrir,
                preco_medio_compra=preco_compra_efetivo,    # Preço da compra de cobertura
                preco_medio_venda=preco_venda_original,     # Preço da venda original
                resultado=resultado,
                day_trade=False,
                data_fechamento=operacao.date
            )
            
            # Atualizar posição vendida
            valor_removido = qtd_a_cobrir * preco_venda_original
            posicao.quantidade_vendida -= qtd_a_cobrir
            posicao.valor_venda_total -= valor_removido
            
            if posicao.quantidade_vendida > 0:
                posicao.preco_medio_venda = posicao.valor_venda_total / posicao.quantidade_vendida
            else:
                posicao.preco_medio_venda = 0.0
                posicao.valor_venda_total = 0.0
            
            # Se sobrou quantidade da compra, adicionar à posição longa
            qtd_restante = operacao.quantity - qtd_a_cobrir
            if qtd_restante > 0:
                custo_restante = qtd_restante * preco_compra_efetivo
                posicao.quantidade += qtd_restante
                posicao.custo_total += custo_restante
                if posicao.quantidade > 0:
                    posicao.preco_medio = posicao.custo_total / posicao.quantidade
            
            return op_fechada
        
        # Compra normal (adicionar à posição longa)
        else:
            custo_compra = operacao.quantity * operacao.price + operacao.fees
            posicao.custo_total += custo_compra
            posicao.quantidade += operacao.quantity

            if posicao.quantidade > 0:
                posicao.preco_medio = posicao.custo_total / posicao.quantidade

            return None

    elif operacao.operation == 'sell':
        # Venda de posição longa existente
        if posicao.tem_posicao_comprada():
            qtd_a_vender = min(operacao.quantity, posicao.quantidade)
            
            # Validação: Verificar se preço médio da posição é válido
            if posicao.preco_medio <= 0:
                return None
            
            preco_venda_efetivo = operacao.price - (operacao.fees / operacao.quantity if operacao.quantity > 0 else 0)
            custo_da_venda = qtd_a_vender * posicao.preco_medio
            valor_da_venda = qtd_a_vender * preco_venda_efetivo
            resultado = valor_da_venda - custo_da_venda

            # Criar operação fechada normal (COMPRA → VENDA)
            op_fechada = OperacaoFechada(
                ticker=posicao.ticker,
                quantidade=qtd_a_vender,
                preco_medio_compra=posicao.preco_medio,
                preco_medio_venda=preco_venda_efetivo,
                resultado=resultado,
                day_trade=False,
                data_fechamento=operacao.date
            )

            # Atualizar posição longa
            posicao.quantidade -= qtd_a_vender
            posicao.custo_total -= custo_da_venda

            # Validação de zeramento
            if posicao.quantidade == 0:
                posicao.preco_medio = 0.0
                posicao.custo_total = 0.0
            elif posicao.quantidade > 0:
                posicao.preco_medio = posicao.custo_total / posicao.quantidade

            # Se sobrou quantidade da venda, criar posição vendida
            qtd_restante = operacao.quantity - qtd_a_vender
            if qtd_restante > 0:
                valor_venda_restante = qtd_restante * preco_venda_efetivo
                posicao.quantidade_vendida += qtd_restante
                posicao.valor_venda_total += valor_venda_restante
                posicao.preco_medio_venda = posicao.valor_venda_total / posicao.quantidade_vendida

            return op_fechada
        
        # Venda a descoberto (short selling)
        else:
            preco_venda_efetivo = operacao.price - (operacao.fees / operacao.quantity if operacao.quantity > 0 else 0)
            valor_venda = operacao.quantity * preco_venda_efetivo
            
            # Adicionar à posição vendida
            posicao.quantidade_vendida += operacao.quantity
            posicao.valor_venda_total += valor_venda
            posicao.preco_medio_venda = posicao.valor_venda_total / posicao.quantidade_vendida
            
            return None  # Não gera operação fechada ainda

    return None


def validar_operacao_fechada(op_fechada: OperacaoFechada) -> bool:
    """
    Valida se uma operação fechada tem todos os campos corretos.
    """
    import logging
    
    if not op_fechada:
        logging.warning("Operação fechada é None")
        return False
    
    ticker = op_fechada.ticker
    
    # Validar preços médios
    if op_fechada.preco_medio_compra <= 0:
        logging.warning(f"Preço médio de compra inválido para {ticker}: {op_fechada.preco_medio_compra}")
        return False
        
    if op_fechada.preco_medio_venda <= 0:
        logging.warning(f"Preço médio de venda inválido para {ticker}: {op_fechada.preco_medio_venda}")
        return False
        
    # Validar quantidade
    if op_fechada.quantidade <= 0:
        logging.warning(f"Quantidade inválida para {ticker}: {op_fechada.quantidade}")
        return False
    
    # Validar resultado
    resultado_calculado = (op_fechada.preco_medio_venda - op_fechada.preco_medio_compra) * op_fechada.quantidade
    if abs(resultado_calculado - op_fechada.resultado) > 0.01:
        logging.warning(f"Resultado inconsistente para {ticker}: "
                       f"calculado={resultado_calculado:.2f}, salvo={op_fechada.resultado:.2f}")
        return False
    
    return True



# ✅ FUNÇÃO PRINCIPAL DE CÁLCULO
def calcular_resultados_operacoes(operacoes: List[Operacao]) -> Dict[str, Any]:
    """
    Calcula resultados de todas as operações, identificando day trades e swing trades.
    """
    import logging
    logging.info(f"Iniciando cálculo com {len(operacoes)} operações")
    
    operacoes_fechadas = []
    posicoes = defaultdict(lambda: PosicaoAcao(ticker=""))

    # Agrupar operações por dia
    operacoes_por_dia = defaultdict(list)
    for op in operacoes:
        operacoes_por_dia[op.date].append(op)

    logging.info(f"Operações agrupadas em {len(operacoes_por_dia)} dias")

    for data, ops_dia in sorted(operacoes_por_dia.items()):
        # Agrupar operações por ticker
        ops_por_ticker = defaultdict(lambda: {'compras': [], 'vendas': []})
        for op in ops_dia:
            if op.operation == 'buy':
                ops_por_ticker[op.ticker]['compras'].append(op)
            else:
                ops_por_ticker[op.ticker]['vendas'].append(op)

        for ticker, trades in ops_por_ticker.items():
            compras = trades['compras']
            vendas = trades['vendas']
            
            if ticker not in posicoes:
                posicoes[ticker] = PosicaoAcao(ticker=ticker)
            
            # Calcular totais para day trade
            total_comprado = sum(op.quantity for op in compras)
            total_vendido = sum(op.quantity for op in vendas)
            
            if compras and vendas:
                # Day trade detectado
                ops_do_ticker = compras + vendas
                resultado_dt = calcular_resultado_day_trade(ops_do_ticker)
                
                if resultado_dt and validar_operacao_fechada(resultado_dt):
                    operacoes_fechadas.append(resultado_dt)
                    logging.info(f"Day Trade {ticker}: Resultado={resultado_dt.resultado:.2f}")
                elif resultado_dt:
                    logging.warning(f"Day trade inválido descartado: {ticker} em {data}")
                else:
                    logging.warning(f"calcular_resultado_day_trade retornou None para {ticker}")
                
                # Processar sobras como swing trade
                qtd_day_trade = min(total_comprado, total_vendido)
                
                # Processar sobras se houver
                sobra_compra = total_comprado - qtd_day_trade
                sobra_venda = total_vendido - qtd_day_trade
                
                if sobra_compra > 0:
                    # Adicionar sobra de compra à posição
                    pm_compra_global = sum(op.quantity * op.price + op.fees for op in compras) / total_comprado
                    posicoes[ticker].quantidade += sobra_compra
                    posicoes[ticker].custo_total += sobra_compra * pm_compra_global
                    if posicoes[ticker].quantidade > 0:
                        posicoes[ticker].preco_medio = posicoes[ticker].custo_total / posicoes[ticker].quantidade
                
                elif sobra_venda > 0:
                    # Processar sobra de venda
                    if posicoes[ticker].tem_posicao_comprada():
                        qtd_venda_normal = min(sobra_venda, posicoes[ticker].quantidade)
                        if qtd_venda_normal > 0 and posicoes[ticker].preco_medio > 0:
                            
                            pm_vendas_global = (sum(op.quantity * op.price for op in vendas) - sum(op.fees for op in vendas)) / total_vendido
                            resultado_swing = (pm_vendas_global - posicoes[ticker].preco_medio) * qtd_venda_normal
                            
                            op_swing = OperacaoFechada(
                                ticker=ticker,
                                quantidade=qtd_venda_normal,
                                preco_medio_compra=posicoes[ticker].preco_medio,
                                preco_medio_venda=pm_vendas_global,
                                resultado=resultado_swing,
                                day_trade=False,
                                data_fechamento=data
                            )
                            
                            if validar_operacao_fechada(op_swing):
                                operacoes_fechadas.append(op_swing)
                                logging.info(f"Swing Trade sobra {ticker}: Resultado={resultado_swing:.2f}")
                            
                            # Atualizar posição
                            posicoes[ticker].quantidade -= qtd_venda_normal
                            posicoes[ticker].custo_total -= qtd_venda_normal * posicoes[ticker].preco_medio
                            if posicoes[ticker].quantidade == 0:
                                posicoes[ticker].preco_medio = 0.0
                                posicoes[ticker].custo_total = 0.0
            
            else:
                # Swing trade apenas
                for op in compras + vendas:
                    resultado_st = processar_operacao_swing_trade(posicoes[ticker], op)
                    
                    if resultado_st and validar_operacao_fechada(resultado_st):
                        operacoes_fechadas.append(resultado_st)
                        logging.info(f"Swing Trade {ticker}: {op.operation} - Resultado={resultado_st.resultado:.2f}")
                    elif resultado_st:
                        logging.warning(f"Swing trade inválido descartado: {ticker} em {data}")

    logging.info(f"Total de operações fechadas válidas: {len(operacoes_fechadas)}")
    
    # Resumo estatístico
    day_trades = [op for op in operacoes_fechadas if op.day_trade]
    swing_trades = [op for op in operacoes_fechadas if not op.day_trade]
    
    logging.info(f"Resumo: {len(day_trades)} Day Trades, {len(swing_trades)} Swing Trades")
    
    return {
        "operacoes_fechadas": operacoes_fechadas,
        "carteira_final": posicoes
    }
    """
    CORREÇÃO: Melhora debug e validações para identificar problemas.
    """
    import logging
    logging.info(f"🔄 [CALCULOS.PY] Iniciando cálculo com {len(operacoes)} operações")
    
    operacoes_fechadas = []
    posicoes = defaultdict(lambda: PosicaoAcao(ticker=""))

    # Agrupar operações por dia
    operacoes_por_dia = defaultdict(list)
    for op in operacoes:
        operacoes_por_dia[op.date].append(op)

    logging.info(f"🔄 [CALCULOS.PY] Operações agrupadas em {len(operacoes_por_dia)} dias")

    for data, ops_dia in sorted(operacoes_por_dia.items()):
        logging.info(f"\n📅 [CALCULOS.PY] Processando {data} com {len(ops_dia)} operações")
        
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
            
            if ticker not in posicoes:
                posicoes[ticker] = PosicaoAcao(ticker=ticker)
            
            # ✅ DEBUG da posição antes do processamento
            pos_antes = posicoes[ticker]
            logging.info(f"🎯 [ANTES] {ticker}: Long={pos_antes.quantidade}@{pos_antes.preco_medio:.2f}, "
                        f"Short={pos_antes.quantidade_vendida}@{pos_antes.preco_medio_venda:.2f}")
            
            if compras and vendas:
                # ✅ DIA DE DAY TRADE - usar PM global
                ops_do_ticker = compras + vendas
                logging.info(f"🔄 [DAY TRADE] {ticker}: {len(compras)} compras + {len(vendas)} vendas")
                
                resultado_dt = calcular_resultado_day_trade(ops_do_ticker)
                
                if resultado_dt and validar_operacao_fechada(resultado_dt):
                    operacoes_fechadas.append(resultado_dt)
                    logging.info(f"✅ Day Trade adicionado: {ticker} - Resultado: {resultado_dt.resultado:.2f}")
                elif resultado_dt:
                    logging.warning(f"❌ Day trade inválido descartado: {ticker} em {data}")
                    # Debug detalhado do por que foi descartado
                    logging.info(f"   Debug: PM_compra={resultado_dt.preco_medio_compra:.2f}, "
                               f"PM_venda={resultado_dt.preco_medio_venda:.2f}, "
                               f"Quantidade={resultado_dt.quantidade}, "
                               f"Resultado={resultado_dt.resultado:.2f}")
                
                # ✅ PROCESSAR SOBRAS COMO SWING TRADE
                total_comprado = sum(op.quantity for op in compras)
                total_vendido = sum(op.quantity for op in vendas)
                qtd_day_trade = min(total_comprado, total_vendido)
                
                logging.info(f"📊 [SOBRAS] {ticker}: Comprado={total_comprado}, Vendido={total_vendido}, DT={qtd_day_trade}")
                
                qtd_swing = 0
                
                sobra_venda = total_vendido - qtd_day_trade
                if sobra_venda > 0 and posicoes[ticker].tem_posicao_comprada():
                    qtd_swing = min(sobra_venda, posicoes[ticker].quantidade)
                    if qtd_swing > 0 and posicoes[ticker].preco_medio > 0:
                        
                        # ✅ PM vendas (usar média ponderada do dia)
                        valor_bruto_vendas = sum(op.quantity * op.price for op in vendas)
                        fees_vendas = sum(op.fees for op in vendas)
                        valor_liquido_vendas = valor_bruto_vendas - fees_vendas
                        pm_vendas_swing = valor_liquido_vendas / total_vendido
                        
                        resultado_swing = (pm_vendas_swing - posicoes[ticker].preco_medio) * qtd_swing
                        
                        op_swing = OperacaoFechada(
                            ticker=ticker,
                            quantidade=qtd_swing,
                            preco_medio_compra=posicoes[ticker].preco_medio,  # ✅ PM da posição
                            preco_medio_venda=pm_vendas_swing,
                            resultado=resultado_swing,
                            day_trade=False,
                            data_fechamento=data
                        )
                        
                        if validar_operacao_fechada(op_swing):
                            operacoes_fechadas.append(op_swing)
                            logging.info(f"✅ Swing Trade sobra adicionado: {ticker} - Resultado: {resultado_swing:.2f}")
                        else:
                            logging.warning(f"❌ Swing trade sobra inválido: {ticker}")
                
                # ✅ ATUALIZAR POSIÇÕES após day trade
                for op in compras:
                    resultado_st = processar_operacao_swing_trade(posicoes[ticker], op)
                    if resultado_st and validar_operacao_fechada(resultado_st):
                        # Esta seria uma operação adicional (cobertura de short, etc.)
                        operacoes_fechadas.append(resultado_st)
                        logging.info(f"✅ Operação adicional (compra): {ticker}")
                
                # Processar vendas restantes (vendas a descoberto)
                for op in vendas:
                    # Só processar se sobrou algo após day trade e swing trade
                    sobra_desta_venda = op.quantity - (op.quantity * qtd_day_trade / total_vendido if total_vendido > 0 else 0)
                    if sobra_desta_venda > qtd_swing:
                        resultado_st = processar_operacao_swing_trade(posicoes[ticker], op)
                        if resultado_st and validar_operacao_fechada(resultado_st):
                            operacoes_fechadas.append(resultado_st)
                            logging.info(f"✅ Operação adicional (venda): {ticker}")
            
            else:
                # ✅ DIA DE SWING TRADE APENAS
                logging.info(f"🔄 [SWING ONLY] {ticker}: {len(compras)} compras + {len(vendas)} vendas")
                
                for op in compras + vendas:
                    resultado_st = processar_operacao_swing_trade(posicoes[ticker], op)
                    
                    if resultado_st and validar_operacao_fechada(resultado_st):
                        operacoes_fechadas.append(resultado_st)
                        tipo_op = "Cobertura" if op.operation == 'buy' and posicoes[ticker].tem_posicao_vendida() else "Venda Normal"
                        logging.info(f"✅ {tipo_op} adicionado: {ticker} - Resultado: {resultado_st.resultado:.2f}")
                    elif resultado_st:
                        logging.warning(f"❌ Swing trade inválido descartado: {ticker} em {data}")
                        # Debug detalhado
                        logging.info(f"   Debug: PM_compra={resultado_st.preco_medio_compra:.2f}, "
                                   f"PM_venda={resultado_st.preco_medio_venda:.2f}, "
                                   f"Quantidade={resultado_st.quantidade}, "
                                   f"Resultado={resultado_st.resultado:.2f}")
            
            # ✅ DEBUG da posição depois do processamento
            pos_depois = posicoes[ticker]
            logging.info(f"🎯 [DEPOIS] {ticker}: Long={pos_depois.quantidade}@{pos_depois.preco_medio:.2f}, "
                        f"Short={pos_depois.quantidade_vendida}@{pos_depois.preco_medio_venda:.2f}")

    logging.info(f"✅ [CALCULOS.PY] Total de operações fechadas válidas: {len(operacoes_fechadas)}")
    
    return {
        "operacoes_fechadas": operacoes_fechadas,
        "carteira_final": posicoes
    }
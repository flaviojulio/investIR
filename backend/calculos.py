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

    # ✅ CORREÇÃO com debug temporário
    resultado = op_fechada["resultado"]
    ticker = op_fechada.get("ticker", "N/A")
    
    if resultado == 0:
        print(f"🟢 [STATUS CORRIGIDO] {ticker}: resultado=0 → Isento")
        return "Isento"
    
    if resultado < 0:
        print(f"🔴 [STATUS] {ticker}: resultado={resultado} → Prejuízo Acumulado")
        return "Prejuízo Acumulado"

    # Para operações com lucro (resultado > 0)
    print(f"🟡 [STATUS] {ticker}: resultado={resultado} → Analisando tributação...")
    
    if op_fechada["day_trade"]:
        if resultado_mes and resultado_mes.get("ir_pagar_day", 0) > 0:
            print(f"🟠 [STATUS] {ticker}: Day Trade tributável")
            return "Tributável Day Trade"
        else:
            print(f"🟢 [STATUS] {ticker}: Day Trade compensado")
            return "Lucro Compensado"
    else:  # Swing Trade
        if resultado_mes and resultado_mes.get("isento_swing", False):
            print(f"🟢 [STATUS] {ticker}: Swing Trade isento")
            return "Isento"
        elif resultado_mes and resultado_mes.get("ir_pagar_swing", 0) > 0:
            print(f"🔵 [STATUS] {ticker}: Swing Trade tributável")
            return "Tributável Swing"
        else:
            print(f"🟢 [STATUS] {ticker}: Swing Trade compensado")
            return "Lucro Compensado"

# ✅ CORREÇÕES no módulo calculos.py

def calcular_resultado_day_trade(operacoes: List[Operacao]) -> Optional[OperacaoFechada]:
    """
    CORREÇÃO: Calcula o resultado de day trade usando preço médio ponderado global.
    Adiciona validações para evitar preços médios zerados.
    """
    if not operacoes:
        return None

    ticker = operacoes[0].ticker
    data_operacao = operacoes[0].date

    compras = [op for op in operacoes if op.operation == 'buy']
    vendas = [op for op in operacoes if op.operation == 'sell']

    if not compras or not vendas:
        return None  # Não é day trade completo

    # ✅ CORREÇÃO: Calcular preço médio ponderado global de TODAS as compras
    total_custo_compra = sum(op.quantity * op.price + op.fees for op in compras)
    total_qtd_compra = sum(op.quantity for op in compras)
    
    # ✅ VALIDAÇÃO: Verificar se há quantidade de compra
    if total_qtd_compra <= 0:
        print(f"❌ ERRO: Quantidade total de compra é zero para {ticker}")
        return None
    
    # ✅ CORREÇÃO: Calcular preço médio ponderado global de TODAS as vendas
    total_valor_venda_bruto = sum(op.quantity * op.price for op in vendas)
    total_fees_venda = sum(op.fees for op in vendas)
    total_valor_venda_liquido = total_valor_venda_bruto - total_fees_venda
    total_qtd_venda = sum(op.quantity for op in vendas)

    # ✅ VALIDAÇÃO: Verificar se há quantidade de venda
    if total_qtd_venda <= 0:
        print(f"❌ ERRO: Quantidade total de venda é zero para {ticker}")
        return None

    # ✅ CORREÇÃO: Preço médio ponderado global com validação
    pm_compra = total_custo_compra / total_qtd_compra
    pm_venda = total_valor_venda_liquido / total_qtd_venda

    # ✅ VALIDAÇÕES CRÍTICAS
    if pm_compra <= 0:
        print(f"❌ ERRO: Preço médio de compra é zero ou negativo: {pm_compra}")
        print(f"   Detalhes: custo_total={total_custo_compra}, qtd_total={total_qtd_compra}")
        return None
        
    if pm_venda <= 0:
        print(f"❌ ERRO: Preço médio de venda é zero ou negativo: {pm_venda}")
        print(f"   Detalhes: valor_liquido={total_valor_venda_liquido}, qtd_total={total_qtd_venda}")
        return None

    # Day trade é a menor quantidade entre compras e vendas
    qtd_day_trade = min(total_qtd_compra, total_qtd_venda)

    # ✅ CORREÇÃO: Resultado baseado no preço médio ponderado global
    resultado = (pm_venda - pm_compra) * qtd_day_trade

    print(f"✅ Day Trade {ticker}: PM_compra={pm_compra:.2f}, PM_venda={pm_venda:.2f}, Qtd={qtd_day_trade}, Resultado={resultado:.2f}")

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
            
            print(f"✅ Short Covering {posicao.ticker}: PM_venda={preco_venda_original:.2f}, PM_compra={preco_compra_efetivo:.2f}, Qtd={qtd_a_cobrir}, Resultado={resultado:.2f}")
            return op_fechada
        
        # ✅ CASO 2: Compra normal (adicionar à posição longa)
        else:
            custo_compra = operacao.quantity * operacao.price + operacao.fees
            posicao.custo_total += custo_compra
            posicao.quantidade += operacao.quantity

            if posicao.quantidade > 0:
                posicao.preco_medio = posicao.custo_total / posicao.quantidade
                
                # ✅ VALIDAÇÃO: Verificar se preço médio faz sentido
                if posicao.preco_medio <= 0:
                    print(f"❌ ERRO: Preço médio de compra inválido: {posicao.preco_medio}")
                    print(f"   Detalhes: custo_total={posicao.custo_total}, quantidade={posicao.quantidade}")

            return None

    elif operacao.operation == 'sell':
        # ✅ CASO 3: Venda de posição longa existente
        if posicao.tem_posicao_comprada():
            qtd_a_vender = min(operacao.quantity, posicao.quantidade)
            
            # ✅ VALIDAÇÃO: Verificar se preço médio da posição é válido
            if posicao.preco_medio <= 0:
                print(f"❌ ERRO: Preço médio da posição longa é inválido: {posicao.preco_medio}")
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

            # ✅ VALIDAÇÃO DE ZERAMENTO
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

            print(f"✅ Normal Sale {posicao.ticker}: PM_compra={posicao.preco_medio:.2f}, PM_venda={preco_venda_efetivo:.2f}, Qtd={qtd_a_vender}, Resultado={resultado:.2f}")
            return op_fechada
        
        # ✅ CASO 4: Venda a descoberto (short selling)
        else:
            preco_venda_efetivo = operacao.price - (operacao.fees / operacao.quantity if operacao.quantity > 0 else 0)
            valor_venda = operacao.quantity * preco_venda_efetivo
            
            # Adicionar à posição vendida
            posicao.quantidade_vendida += operacao.quantity
            posicao.valor_venda_total += valor_venda
            posicao.preco_medio_venda = posicao.valor_venda_total / posicao.quantidade_vendida
            
            print(f"✅ Short Sale {posicao.ticker}: PM_venda={preco_venda_efetivo:.2f}, Qtd={operacao.quantity} (aguardando cobertura)")
            return None  # Não gera operação fechada ainda

    return None

# ✅ FUNÇÃO AUXILIAR PARA DEBUG DE POSIÇÕES
def debug_posicao(posicao: PosicaoAcao, operacao_atual: Operacao):
    """Debug das posições antes e depois das operações"""
    print(f"📊 [POSIÇÃO DEBUG] {posicao.ticker} - {operacao_atual.operation} {operacao_atual.quantity}@{operacao_atual.price}")
    print(f"   Posição Longa: {posicao.quantidade} ações @ PM {posicao.preco_medio:.2f} (custo: {posicao.custo_total:.2f})")
    print(f"   Posição Vendida: {posicao.quantidade_vendida} ações @ PM {posicao.preco_medio_venda:.2f} (valor: {posicao.valor_venda_total:.2f})")
    print("=" * 50)


# ✅ VALIDAÇÃO APRIMORADA
def validar_operacao_fechada(op_fechada: OperacaoFechada) -> bool:
    """
    Valida se uma operação fechada tem todos os campos corretos.
    CORREÇÃO: Adiciona debug detalhado para identificar problemas.
    """
    import logging
    
    if not op_fechada:
        logging.warning(f"❌ [VALIDAÇÃO] Operação fechada é None")
        return False
    
    ticker = op_fechada.ticker
    
    # ✅ Validar preços médios
    if op_fechada.preco_medio_compra <= 0:
        logging.warning(f"❌ [VALIDAÇÃO] {ticker}: Preço médio de compra inválido: {op_fechada.preco_medio_compra}")
        return False
        
    if op_fechada.preco_medio_venda <= 0:
        logging.warning(f"❌ [VALIDAÇÃO] {ticker}: Preço médio de venda inválido: {op_fechada.preco_medio_venda}")
        return False
        
    # ✅ Validar quantidade
    if op_fechada.quantidade <= 0:
        logging.warning(f"❌ [VALIDAÇÃO] {ticker}: Quantidade inválida: {op_fechada.quantidade}")
        return False
    
    # ✅ Validar resultado
    resultado_calculado = (op_fechada.preco_medio_venda - op_fechada.preco_medio_compra) * op_fechada.quantidade
    if abs(resultado_calculado - op_fechada.resultado) > 0.01:
        logging.warning(f"❌ [VALIDAÇÃO] {ticker}: Resultado inconsistente: "
                       f"calculado={resultado_calculado:.2f}, salvo={op_fechada.resultado:.2f}")
        return False
    
    # ✅ Se chegou até aqui, a operação é válida
    logging.debug(f"✅ [VALIDAÇÃO] {ticker}: Operação fechada válida - {op_fechada.resultado:.2f}")
    return True



# ✅ MODIFICAÇÃO na função calcular_resultados_operacoes
def calcular_resultados_operacoes(operacoes: List[Operacao]) -> Dict[str, Any]:
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
    
    # ✅ DEBUG ESPECÍFICO PARA BBAS3
    bbas3_ops = [op for op in operacoes_fechadas if op.ticker == 'BBAS3']
    if bbas3_ops:
        logging.info(f"🎯 [BBAS3 RESULTADO] {len(bbas3_ops)} operações fechadas:")
        for i, op in enumerate(bbas3_ops, 1):
            logging.info(f"   {i}. {op.data_fechamento}: {op.quantidade} ações, "
                        f"PM_compra={op.preco_medio_compra:.2f}, "
                        f"PM_venda={op.preco_medio_venda:.2f}, "
                        f"Resultado={op.resultado:.2f}")
    else:
        logging.warning(f"⚠️ [BBAS3] Nenhuma operação fechada gerada!")
        
        # Verificar se há operações BBAS3
        bbas3_operacoes = [op for op in operacoes if op.ticker == 'BBAS3']
        if bbas3_operacoes:
            logging.info(f"🔍 [BBAS3 DEBUG] {len(bbas3_operacoes)} operações BBAS3 processadas:")
            for op in bbas3_operacoes:
                logging.info(f"   {op.date}: {op.operation} {op.quantity} @ {op.price:.2f}")
    
    return {
        "operacoes_fechadas": operacoes_fechadas,
        "carteira_final": posicoes
    }


    """
    CORREÇÃO: Trata adequadamente vendas a descoberto em todas as situações.
    """
    operacoes_fechadas = []
    posicoes = defaultdict(lambda: PosicaoAcao(ticker=""))

    # Agrupar operações por dia
    operacoes_por_dia = defaultdict(list)
    for op in operacoes:
        operacoes_por_dia[op.date].append(op)

    for data, ops_dia in sorted(operacoes_por_dia.items()):
        print(f"\n📅 [PROCESSANDO] {data}")
        
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
            
            # Debug da posição antes do processamento
            if compras or vendas:
                print(f"🎯 [ANTES] {ticker}: Long={posicoes[ticker].quantidade}@{posicoes[ticker].preco_medio:.2f}, Short={posicoes[ticker].quantidade_vendida}@{posicoes[ticker].preco_medio_venda:.2f}")
            
            if compras and vendas:
                # DIA DE DAY TRADE - usar PM global
                ops_do_ticker = compras + vendas
                resultado_dt = calcular_resultado_day_trade(ops_do_ticker)
                
                if resultado_dt and validar_operacao_fechada(resultado_dt):
                    operacoes_fechadas.append(resultado_dt)
                    print(f"✅ Day Trade adicionado: {ticker}")
                elif resultado_dt:
                    print(f"❌ Day trade inválido descartado: {ticker} em {data}")
                
                # ✅ CORREÇÃO: Processar sobras considerando vendas a descoberto
                total_comprado = sum(op.quantity for op in compras)
                total_vendido = sum(op.quantity for op in vendas)
                
                # Simular o que sobrou após day trade
                qtd_day_trade = min(total_comprado, total_vendido)
                sobra_compra = total_comprado - qtd_day_trade
                sobra_venda = total_vendido - qtd_day_trade
                
                if sobra_compra > 0:
                    # Processar compras restantes
                    pm_compra_global = sum(op.quantity * op.price + op.fees for op in compras) / total_comprado
                    
                    # Se há posição vendida, pode ser cobertura
                    if posicoes[ticker].tem_posicao_vendida():
                        qtd_cobertura = min(sobra_compra, posicoes[ticker].quantidade_vendida)
                        if qtd_cobertura > 0:
                            # Simular cobertura
                            preco_venda_original = posicoes[ticker].preco_medio_venda
                            resultado_cobertura = (preco_venda_original - pm_compra_global) * qtd_cobertura
                            
                            op_cobertura = OperacaoFechada(
                                ticker=ticker,
                                quantidade=qtd_cobertura,
                                preco_medio_compra=pm_compra_global,
                                preco_medio_venda=preco_venda_original,
                                resultado=resultado_cobertura,
                                day_trade=False,
                                data_fechamento=data
                            )
                            
                            if validar_operacao_fechada(op_cobertura):
                                operacoes_fechadas.append(op_cobertura)
                                print(f"✅ Cobertura adicionada: {ticker}")
                    
                    # Adicionar sobra à posição longa
                    sobra_final_compra = sobra_compra - (qtd_cobertura if 'qtd_cobertura' in locals() else 0)
                    if sobra_final_compra > 0:
                        posicoes[ticker].quantidade += sobra_final_compra
                        posicoes[ticker].custo_total += sobra_final_compra * pm_compra_global
                        if posicoes[ticker].quantidade > 0:
                            posicoes[ticker].preco_medio = posicoes[ticker].custo_total / posicoes[ticker].quantidade
                
                elif sobra_venda > 0:
                    # Processar vendas restantes
                    pm_venda_global = (sum(op.quantity * op.price for op in vendas) - sum(op.fees for op in vendas)) / total_vendido
                    
                    # Se há posição longa, pode ser venda normal
                    if posicoes[ticker].tem_posicao_comprada():
                        qtd_venda_normal = min(sobra_venda, posicoes[ticker].quantidade)
                        if qtd_venda_normal > 0 and posicoes[ticker].preco_medio > 0:
                            custo_venda = qtd_venda_normal * posicoes[ticker].preco_medio
                            valor_venda = qtd_venda_normal * pm_venda_global
                            resultado_venda = valor_venda - custo_venda
                            
                            op_venda = OperacaoFechada(
                                ticker=ticker,
                                quantidade=qtd_venda_normal,
                                preco_medio_compra=posicoes[ticker].preco_medio,
                                preco_medio_venda=pm_venda_global,
                                resultado=resultado_venda,
                                day_trade=False,
                                data_fechamento=data
                            )
                            
                            if validar_operacao_fechada(op_venda):
                                operacoes_fechadas.append(op_venda)
                                print(f"✅ Venda normal adicionada: {ticker}")
                            
                            # Atualizar posição longa
                            posicoes[ticker].quantidade -= qtd_venda_normal
                            posicoes[ticker].custo_total -= custo_venda
                            if posicoes[ticker].quantidade == 0:
                                posicoes[ticker].preco_medio = 0.0
                                posicoes[ticker].custo_total = 0.0
                    
                    # Adicionar sobra à posição vendida
                    sobra_final_venda = sobra_venda - (qtd_venda_normal if 'qtd_venda_normal' in locals() else 0)
                    if sobra_final_venda > 0:
                        posicoes[ticker].quantidade_vendida += sobra_final_venda
                        posicoes[ticker].valor_venda_total += sobra_final_venda * pm_venda_global
                        posicoes[ticker].preco_medio_venda = posicoes[ticker].valor_venda_total / posicoes[ticker].quantidade_vendida
            else:
                # DIA DE SWING TRADE APENAS
                for op in compras + vendas:
                    resultado_st = processar_operacao_swing_trade(posicoes[ticker], op)
                    
                    if resultado_st and validar_operacao_fechada(resultado_st):
                        operacoes_fechadas.append(resultado_st)
                        print(f"✅ Swing trade adicionado: {ticker}")
                    elif resultado_st:
                        print(f"❌ Swing trade inválido descartado: {ticker} em {data}")

    print(f"\n✅ Total de operações fechadas válidas: {len(operacoes_fechadas)}")
    return {
        "operacoes_fechadas": operacoes_fechadas,
        "carteira_final": posicoes
    }
    
    """
    CORREÇÃO: Nova lógica que calcula preço médio ponderado corretamente.
    Adiciona validações em cada operação fechada criada.
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
                
                # ✅ VALIDAÇÃO: Só adiciona se a operação for válida
                if resultado_dt and validar_operacao_fechada(resultado_dt):
                    operacoes_fechadas.append(resultado_dt)
                elif resultado_dt:
                    print(f"❌ Day trade inválido descartado: {ticker} em {data}")
                
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
                        
                        # ✅ VALIDAÇÃO: Verificar se PM da posição é válido
                        if posicoes[ticker].preco_medio <= 0:
                            print(f"❌ ERRO: Preço médio da posição inválido para {ticker}: {posicoes[ticker].preco_medio}")
                            continue
                            
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
                        
                        # ✅ VALIDAÇÃO: Só adiciona se válido
                        if validar_operacao_fechada(op_fechada_st):
                            operacoes_fechadas.append(op_fechada_st)
                        else:
                            print(f"❌ Swing trade inválido descartado: {ticker} em {data}")
                        
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
                    
                    # ✅ VALIDAÇÃO: Só adiciona se válido
                    if resultado_st and validar_operacao_fechada(resultado_st):
                        operacoes_fechadas.append(resultado_st)
                    elif resultado_st:
                        print(f"❌ Swing trade inválido descartado: {op.ticker} em {data}")

    print(f"✅ Total de operações fechadas válidas: {len(operacoes_fechadas)}")
    return {
        "operacoes_fechadas": operacoes_fechadas,
        "carteira_final": posicoes
    }        
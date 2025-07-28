"""
Módulo para validação específica de dados da B3.
Lida com limitações de histórico e saldos negativos.
"""

from datetime import date, datetime
from typing import Dict, List, Any, Tuple, Optional
from collections import defaultdict
import logging

# Data limite de histórico da B3
B3_DATA_LIMITE_HISTORICO = date(2019, 11, 1)

def validar_operacoes_b3(operacoes: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Valida operações da B3 e identifica problemas de saldo negativo.
    
    Args:
        operacoes: Lista de operações para validar
        
    Returns:
        Tuple[operacoes_validas, relatorio_validacao]
    """
    logging.info(f"🔍 [VALIDAÇÃO B3] Iniciando validação de {len(operacoes)} operações")
    
    # Organizar operações por ticker e ordenar por data
    operacoes_por_ticker = defaultdict(list)
    
    for op in operacoes:
        ticker = op.get('ticker', '').upper()
        if ticker:
            # Converter data se necessário
            data_op = op.get('date')
            if isinstance(data_op, str):
                try:
                    data_op = datetime.fromisoformat(data_op).date()
                except ValueError:
                    try:
                        data_op = datetime.strptime(data_op, '%Y-%m-%d').date()
                    except ValueError:
                        logging.warning(f"⚠️ Data inválida ignorada: {data_op}")
                        continue
            
            op_copia = op.copy()
            op_copia['date'] = data_op
            operacoes_por_ticker[ticker].append(op_copia)
    
    # Ordenar por data para cada ticker
    for ticker in operacoes_por_ticker:
        operacoes_por_ticker[ticker].sort(key=lambda x: x['date'])
    
    operacoes_validas = []
    operacoes_ignoradas = []
    tickers_com_problema = []
    
    # Validar cada ticker
    for ticker, ops_ticker in operacoes_por_ticker.items():
        logging.info(f"📊 [VALIDAÇÃO B3] Validando {ticker} com {len(ops_ticker)} operações")
        
        saldo_atual = 0
        ops_validas_ticker = []
        ops_ignoradas_ticker = []
        
        for op in ops_ticker:
            quantidade = op.get('quantity', 0)
            operacao = op.get('operation', '').lower()
            data_op = op['date']
            
            if operacao == 'buy':
                saldo_atual += quantidade
                ops_validas_ticker.append(op)
                
            elif operacao == 'sell':
                # Verificar se há saldo suficiente
                if saldo_atual >= quantidade:
                    saldo_atual -= quantidade
                    ops_validas_ticker.append(op)
                else:
                    # Saldo insuficiente - provável operação anterior à Nov/2019
                    logging.warning(f"⚠️ {ticker}: Venda de {quantidade} em {data_op} com saldo {saldo_atual}")
                    
                    # Se há algum saldo, fazer venda parcial
                    if saldo_atual > 0:
                        op_parcial = op.copy()
                        op_parcial['quantity'] = saldo_atual
                        ops_validas_ticker.append(op_parcial)
                        
                        # Criar registro da operação ignorada
                        op_ignorada = op.copy()
                        op_ignorada['quantity'] = quantidade - saldo_atual
                        op_ignorada['motivo_ignorado'] = f"Saldo insuficiente - possível compra anterior a Nov/2019"
                        ops_ignoradas_ticker.append(op_ignorada)
                        
                        saldo_atual = 0
                    else:
                        # Ignorar completamente
                        op_ignorada = op.copy()
                        op_ignorada['motivo_ignorado'] = f"Venda sem saldo - possível compra anterior a Nov/2019"
                        ops_ignoradas_ticker.append(op_ignorada)
        
        # Adicionar às listas finais
        operacoes_validas.extend(ops_validas_ticker)
        operacoes_ignoradas.extend(ops_ignoradas_ticker)
        
        if ops_ignoradas_ticker:
            tickers_com_problema.append({
                'ticker': ticker,
                'operacoes_ignoradas': len(ops_ignoradas_ticker),
                'total_operacoes': len(ops_ticker)
            })
    
    # Gerar relatório
    relatorio = {
        'total_operacoes_analisadas': len(operacoes),
        'total_operacoes_validas': len(operacoes_validas),
        'total_operacoes_ignoradas': len(operacoes_ignoradas),
        'tickers_com_problema': tickers_com_problema,
        'operacoes_ignoradas_detalhes': operacoes_ignoradas,
        'limitacao_b3_detectada': len(operacoes_ignoradas) > 0
    }
    
    logging.info(f"✅ [VALIDAÇÃO B3] Concluída - Válidas: {len(operacoes_validas)}, Ignoradas: {len(operacoes_ignoradas)}")
    
    return operacoes_validas, relatorio

def gerar_aviso_b3(relatorio: Dict[str, Any]) -> Optional[str]:
    """
    Gera texto de aviso baseado no relatório de validação.
    
    Args:
        relatorio: Relatório da validação B3
        
    Returns:
        Texto do aviso ou None se não há problemas
    """
    if not relatorio.get('limitacao_b3_detectada', False):
        return None
    
    total_ignoradas = relatorio.get('total_operacoes_ignoradas', 0)
    tickers_problema = relatorio.get('tickers_com_problema', [])
    
    if total_ignoradas == 0:
        return None
    
    # Gerar lista de tickers afetados
    tickers_afetados = [t['ticker'] for t in tickers_problema]
    
    aviso = f"⚠️ {total_ignoradas} operações foram ignoradas devido à limitação de histórico da B3.\n\n"
    aviso += f"📅 A B3 fornece dados apenas a partir de <strong>Novembro 2019</strong>.\n"
    aviso += f"📊 Tickers com operações afetadas: {', '.join(tickers_afetados[:5])}"
    
    if len(tickers_afetados) > 5:
        aviso += f" (e mais {len(tickers_afetados) - 5})"
    
    aviso += f"\n\n✅ As demais operações foram importadas normalmente."
    
    return aviso

def gerar_relatorio_detalhado_b3(relatorio: Dict[str, Any]) -> str:
    """
    Gera relatório detalhado para logs.
    
    Args:
        relatorio: Relatório da validação B3
        
    Returns:
        Texto do relatório detalhado
    """
    if not relatorio.get('limitacao_b3_detectada', False):
        return "✅ Nenhum problema de histórico B3 detectado."
    
    texto = f"\n📋 RELATÓRIO DETALHADO - VALIDAÇÃO B3\n"
    texto += f"{'='*50}\n"
    texto += f"Total analisadas: {relatorio.get('total_operacoes_analisadas', 0)}\n"
    texto += f"Total válidas: {relatorio.get('total_operacoes_validas', 0)}\n"
    texto += f"Total ignoradas: {relatorio.get('total_operacoes_ignoradas', 0)}\n\n"
    
    tickers_problema = relatorio.get('tickers_com_problema', [])
    if tickers_problema:
        texto += f"📊 TICKERS AFETADOS:\n"
        for ticker_info in tickers_problema:
            ticker = ticker_info['ticker']
            ignoradas = ticker_info['operacoes_ignoradas']
            total = ticker_info['total_operacoes']
            texto += f"   {ticker}: {ignoradas}/{total} ignoradas\n"
    
    return texto

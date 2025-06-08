from typing import List, Dict, Any, Optional # Tuple replaced with tuple, Optional added
from datetime import date, datetime, timedelta
from decimal import Decimal # Kept for specific calculations in recalcular_resultados
import calendar
from collections import defaultdict
from fastapi import HTTPException # Added HTTPException

from models import OperacaoCreate, AtualizacaoCarteira, Operacao, ResultadoTicker, ProventoCreate, ProventoInfo # Added Provento models
from database import (
    inserir_operacao,
    obter_todas_operacoes, # Comment removed
    atualizar_carteira,
    obter_carteira_atual,
    salvar_resultado_mensal,
    obter_resultados_mensais,
    obter_operacao_por_id, # Added
    # Import new/updated database functions
    obter_operacoes_para_calculo_fechadas,
    salvar_operacao_fechada,
    limpar_operacoes_fechadas_usuario,
    remover_operacao,  # Added import for remover_operacao
    remover_todas_operacoes_usuario, # Added import for new function
    atualizar_status_darf_db, # Added for DARF status update
    limpar_carteira_usuario_db, # Added for clearing portfolio before recalc
    limpar_resultados_mensais_usuario_db, # Added for clearing monthly results before recalc
    remover_item_carteira_db, # Added for deleting single portfolio item
    obter_operacoes_por_ticker_db, # Added for fetching operations by ticker
    obter_todas_acoes, # Renamed from obter_todos_stocks
    # Provento related database functions
    inserir_provento,
    obter_proventos_por_acao_id,
    obter_provento_por_id,
    obter_todos_proventos,
    obter_acao_por_id # For validating id_acao in proventos
)

def _calculate_darf_due_date(year_month_str: str) -> date:
    """
    Calcula a data de vencimento do DARF para um dado mês/ano de competência.
    O vencimento é o último dia útil do mês seguinte ao mês de competência.
    """
    ano, mes_num = map(int, year_month_str.split('-'))
    
    # Calcula o próximo mês e ano
    prox_mes_ano = ano
    prox_mes_num = mes_num + 1
    if prox_mes_num > 12:
        prox_mes_num = 1
        prox_mes_ano += 1
        
    # Último dia do próximo mês
    ultimo_dia_prox_mes = calendar.monthrange(prox_mes_ano, prox_mes_num)[1]
    vencimento = date(prox_mes_ano, prox_mes_num, ultimo_dia_prox_mes)
    
    # Ajusta para o último dia útil (retrocede se for sábado ou domingo)
    while vencimento.weekday() >= 5:  # 5 = Sábado, 6 = Domingo
        vencimento -= timedelta(days=1)
    return vencimento

def processar_operacoes(operacoes: List[OperacaoCreate], usuario_id: int) -> None:
    """
    Processa uma lista de operações, salvando-as no banco de dados
    e atualizando a carteira atual para um usuário específico.
    
    Args:
        operacoes: Lista de operações a serem processadas.
        usuario_id: ID do usuário.
    """
    # Salva as operações no banco de dados
    for op in operacoes:
        try:
            inserir_operacao(op.model_dump(), usuario_id=usuario_id) # Use model_dump() for Pydantic v2
        except ValueError as e:
            # If any operation fails due to invalid ticker, stop processing and raise error.
            # Note: Operations inserted before this error are not rolled back with current DB interaction pattern.
            raise ValueError(f"Erro ao processar lote: Ticker {op.ticker} inválido. Nenhuma operação adicional foi salva.")
    
    # Recalcula a carteira atual
    recalcular_carteira(usuario_id=usuario_id)
    
    # Recalcula os resultados mensais
    recalcular_resultados(usuario_id=usuario_id)

def _eh_day_trade(operacoes_dia: List[Dict[str, Any]], ticker: str) -> bool:
    """
    Verifica se houve day trade para um ticker específico em um dia.
    
    Args:
        operacoes_dia: Lista de operações do dia.
        ticker: Ticker a ser verificado.
        
    Returns:
        bool: True se houve day trade, False caso contrário.
    """
    compras = sum(op["quantity"] for op in operacoes_dia 
                 if op["ticker"] == ticker and op["operation"] == "buy")
    vendas = sum(op["quantity"] for op in operacoes_dia 
                if op["ticker"] == ticker and op["operation"] == "sell")
    
    # Se houve compra e venda do mesmo ticker no mesmo dia, é day trade
    return compras > 0 and vendas > 0

def _calcular_resultado_dia(operacoes_dia: List[Dict[str, Any]], usuario_id: int) -> tuple[Dict[str, float], Dict[str, float]]: # Changed Tuple to tuple
    """
    Calcula o resultado de swing trade e day trade para um dia para um usuário.
    
    Args:
        operacoes_dia: Lista de operações do dia.
        usuario_id: ID do usuário.
        
    Returns:
        tuple[Optional[Dict[str, float]], Dict[str, float]]: Resultados de swing trade (None) e day trade.
    """
    import logging # Se já não estiver importado globalmente no módulo

    resultado_day = {
        "vendas_total": 0.0, # Total de vendas (valor - taxas)
        "custo_total": 0.0,  # Total de compras (valor + taxas)
        "ganho_liquido": 0.0,
        "irrf": 0.0
    }
    
    # Identifica os tickers com day trade DENTRO DAS OPERAÇÕES FORNECIDAS (operacoes_dia)
    # Esta parte é crucial: _eh_day_trade deve ser chamada com as operações do dia para aquele ticker.
    tickers_day_trade_neste_conjunto = set()
    ops_por_ticker_no_dia = defaultdict(list)
    for op_dt_check in operacoes_dia: # Renomeado para evitar conflito de nome
        ops_por_ticker_no_dia[op_dt_check["ticker"]].append(op_dt_check)

    for ticker_dt, ops_do_ticker_neste_conjunto in ops_por_ticker_no_dia.items(): # Renomeado para evitar conflito
        if _eh_day_trade(ops_do_ticker_neste_conjunto, ticker_dt): # Passa a lista filtrada por ticker
            tickers_day_trade_neste_conjunto.add(ticker_dt)

    for op in operacoes_dia: # Processa apenas as operações que efetivamente são day trade
        if op["ticker"] in tickers_day_trade_neste_conjunto:
            valor = op["quantity"] * op["price"]
            fees = op.get("fees", 0.0)
            if op["operation"] == "buy":
                resultado_day["custo_total"] += valor + fees
            else:  # sell
                resultado_day["vendas_total"] += valor - fees
                resultado_day["irrf"] += (op["quantity"] * op["price"]) * 0.01 # IRRF is on gross sale value
    
    resultado_day["ganho_liquido"] = resultado_day["vendas_total"] - resultado_day["custo_total"]
    return None, resultado_day # Retorna None para resultado_swing

def calcular_resultados_mensais(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém os resultados mensais calculados para um usuário.
    
    Args:
        usuario_id: ID do usuário.
        
    Returns:
        List[Dict[str, Any]]: Lista de resultados mensais.
    """
    return obter_resultados_mensais(usuario_id=usuario_id)

def calcular_carteira_atual(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém a carteira atual de ações de um usuário.
    
    Args:
        usuario_id: ID do usuário.
        
    Returns:
        List[Dict[str, Any]]: Lista de itens da carteira.
    """
    return obter_carteira_atual(usuario_id=usuario_id)

def gerar_darfs(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Gera a lista de DARFs a partir dos resultados mensais de um usuário.
    
    Args:
        usuario_id: ID do usuário.
        
    Returns:
        List[Dict[str, Any]]: Lista de DARFs.
    """
    resultados = obter_resultados_mensais(usuario_id=usuario_id)
    
    darfs = []
    for resultado in resultados:
        if resultado.get("darf_codigo") and resultado.get("darf_valor", 0) > 0:
            darfs.append({
                "codigo": resultado["darf_codigo"],
                "competencia": resultado["darf_competencia"],
                "valor": resultado["darf_valor"],
                "vencimento": resultado["darf_vencimento"]
            })
    
    return darfs

# Novas funções para as funcionalidades adicionais

def inserir_operacao_manual(operacao: OperacaoCreate, usuario_id: int) -> int:
    """
    Insere uma operação manualmente para um usuário e recalcula a carteira e os resultados.
    Retorna o ID da operação inserida.
    
    Args:
        operacao: Dados da operação a ser inserida.
        usuario_id: ID do usuário.
        
    Returns:
        int: ID da operação inserida.
    """
    # Insere a operação no banco de dados
    try:
        new_operacao_id = inserir_operacao(operacao.model_dump(), usuario_id=usuario_id)
    except ValueError: # Catching the specific ValueError from database.inserir_operacao
        raise # Re-raise it to be handled by the router (e.g., converted to HTTPException)
    
    # Recalcula a carteira e os resultados
    recalcular_carteira(usuario_id=usuario_id)
    recalcular_resultados(usuario_id=usuario_id)
    return new_operacao_id

def obter_operacao_service(operacao_id: int, usuario_id: int) -> Optional[Operacao]:
    """
    Obtém uma operação específica pelo ID e ID do usuário.
    
    Args:
        operacao_id: ID da operação.
        usuario_id: ID do usuário.
        
    Returns:
        Optional[Operacao]: O objeto Operacao se encontrado, None caso contrário.
    """
    operacao_data = obter_operacao_por_id(operacao_id, usuario_id)
    if operacao_data:
        return Operacao(**operacao_data)
    return None

def atualizar_item_carteira(dados: AtualizacaoCarteira, usuario_id: int) -> None:
    """
    Atualiza um item da carteira manualmente para um usuário.
    
    Args:
        dados: Novos dados do item da carteira (ticker, quantidade e preço médio).
        usuario_id: ID do usuário.
    """
    custo_total_calculado: float
    if dados.quantidade < 0:
        # Para posições vendidas editadas manualmente, o custo_total deve ser o valor (positivo) da posição vendida.
        # O preco_medio fornecido em 'dados' para uma qtd negativa é o PM de venda.
        custo_total_calculado = abs(dados.quantidade) * dados.preco_medio
    else:
        # Para posições compradas ou zeradas (quantidade >= 0)
        custo_total_calculado = dados.quantidade * dados.preco_medio

    # Atualiza o item na carteira
    atualizar_carteira(dados.ticker, dados.quantidade, dados.preco_medio, custo_total_calculado, usuario_id=usuario_id)
    
    # Adiciona chamadas para recalcular tudo após a atualização manual da carteira
    # REMOVED: recalcular_carteira(usuario_id=usuario_id) 
    # The following recalculations might need further review in the future
    # if manual portfolio edits are meant to be fully authoritative and 
    # potentially correct historical discrepancies reflected in tax calculations.
    # For now, we keep them to ensure tax data is updated based on operations,
    # but acknowledge the portfolio itself is now manually set for this item.
    recalcular_resultados(usuario_id=usuario_id) 
    calcular_operacoes_fechadas(usuario_id=usuario_id) 


def calcular_operacoes_fechadas(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Calcula as operações fechadas para um usuário.
    Usa o método FIFO (First In, First Out) para rastrear as operações.
    Os resultados são salvos no banco de dados.
    
    Args:
        usuario_id: ID do usuário.
        
    Returns:
        List[Dict[str, Any]]: Lista de operações fechadas.
    """
    # Limpa operações fechadas antigas do usuário
    limpar_operacoes_fechadas_usuario(usuario_id=usuario_id)

    # Fetch monthly results to determine tax exemption status for swing trades
    resultados_mensais_list = obter_resultados_mensais(usuario_id=usuario_id)
    resultados_mensais_map = {rm['mes']: rm for rm in resultados_mensais_list}

    # Obtém todas as operações do usuário
    operacoes = obter_operacoes_para_calculo_fechadas(usuario_id=usuario_id)
    
    # Dicionário para rastrear as operações por ticker
    operacoes_por_ticker = defaultdict(list)
    for op in operacoes:
        # Garante que 'fees' exista
        op_data = op.copy()
        if 'fees' not in op_data:
            op_data['fees'] = 0.0
        operacoes_por_ticker[op_data["ticker"]].append(op_data)
    
    # Lista para armazenar as operações fechadas que serão salvas
    operacoes_fechadas_para_salvar = []
    
    # Processa cada ticker
    for ticker, ops_ticker in operacoes_por_ticker.items():
        # Ordena as operações por data e depois por ID (para manter a ordem de inserção no mesmo dia)
        ops_ticker.sort(key=lambda x: (x["date"], x["id"]))
        
        # Filas para rastrear compras e vendas pendentes (FIFO)
        compras_pendentes = [] # Lista de Dicts de operações de compra
        vendas_pendentes = []  # Lista de Dicts de operações de venda (para venda a descoberto)
        
        for op_atual in ops_ticker:
            quantidade_atual = op_atual["quantity"]
            
            if op_atual["operation"] == "buy":
                # Tenta fechar com vendas pendentes (venda a descoberto)
                while quantidade_atual > 0 and vendas_pendentes:
                    venda_pendente = vendas_pendentes[0]
                    qtd_fechar = min(quantidade_atual, venda_pendente["quantity"])
                    
                    op_fechada = _criar_operacao_fechada_detalhada(
                        op_abertura=venda_pendente, 
                        op_fechamento=op_atual, 
                        quantidade_fechada=qtd_fechar,
                        tipo_fechamento="venda_descoberta_fechada_com_compra"
                    )
                    operacoes_fechadas_para_salvar.append(op_fechada)
                    
                    venda_pendente["quantity"] -= qtd_fechar
                    quantidade_atual -= qtd_fechar
                    
                    if venda_pendente["quantity"] == 0:
                        vendas_pendentes.pop(0)
                
                if quantidade_atual > 0:
                    op_atual_restante = op_atual.copy()
                    op_atual_restante["quantity"] = quantidade_atual
                    compras_pendentes.append(op_atual_restante)

            elif op_atual["operation"] == "sell":
                # Tenta fechar com compras pendentes
                while quantidade_atual > 0 and compras_pendentes:
                    compra_pendente = compras_pendentes[0]
                    qtd_fechar = min(quantidade_atual, compra_pendente["quantity"])

                    op_fechada = _criar_operacao_fechada_detalhada(
                        op_abertura=compra_pendente, 
                        op_fechamento=op_atual, 
                        quantidade_fechada=qtd_fechar,
                        tipo_fechamento="compra_fechada_com_venda"
                    )
                    operacoes_fechadas_para_salvar.append(op_fechada)
                    
                    compra_pendente["quantity"] -= qtd_fechar
                    quantidade_atual -= qtd_fechar
                    
                    if compra_pendente["quantity"] == 0:
                        compras_pendentes.pop(0)
                
                if quantidade_atual > 0: # Venda a descoberto
                    op_atual_restante = op_atual.copy()
                    op_atual_restante["quantity"] = quantidade_atual
                    vendas_pendentes.append(op_atual_restante)

    # Salva todas as operações fechadas no banco E adiciona status_ir
    for op_f in operacoes_fechadas_para_salvar:
        # Determine status_ir
        data_fechamento_obj = op_f["data_fechamento"]
        # Ensure data_fechamento_obj is a date object if it's not already (it should be from _criar_operacao_fechada_detalhada)
        if isinstance(data_fechamento_obj, str): 
            data_fechamento_obj = datetime.fromisoformat(data_fechamento_obj.split("T")[0]).date()
        
        mes_fechamento_str = data_fechamento_obj.strftime("%Y-%m")
        resultado_do_mes_dict = resultados_mensais_map.get(mes_fechamento_str)

        if op_f["resultado"] <= 0:
            op_f["status_ir"] = "Prejuízo Acumulado"
        else: # op_f["resultado"] > 0
            if op_f["day_trade"]:
                ir_pagar_mensal_day_trade = 0.0
                if resultado_do_mes_dict and isinstance(resultado_do_mes_dict.get("ir_pagar_day"), (int, float)):
                    ir_pagar_mensal_day_trade = resultado_do_mes_dict["ir_pagar_day"]
                
                if ir_pagar_mensal_day_trade > 0:
                    op_f["status_ir"] = "Tributável Day Trade"
                else: 
                    op_f["status_ir"] = "Lucro Compensado"
                    
            else: # Swing Trade
                is_exempt_swing_mensal = False 
                if resultado_do_mes_dict and isinstance(resultado_do_mes_dict.get("isento_swing"), bool):
                    is_exempt_swing_mensal = resultado_do_mes_dict["isento_swing"]

                if is_exempt_swing_mensal:
                    op_f["status_ir"] = "Isento"
                else: 
                    ir_pagar_mensal_swing_trade = 0.0
                    if resultado_do_mes_dict and isinstance(resultado_do_mes_dict.get("ir_pagar_swing"), (int, float)):
                        ir_pagar_mensal_swing_trade = resultado_do_mes_dict["ir_pagar_swing"]
                    
                    if ir_pagar_mensal_swing_trade > 0:
                        op_f["status_ir"] = "Tributável Swing"
                    else: 
                        op_f["status_ir"] = "Lucro Compensado"
        
        # Salva a operação fechada (que agora inclui status_ir, though salvar_operacao_fechada might not save it yet)
        salvar_operacao_fechada(op_f, usuario_id=usuario_id)
        
    return operacoes_fechadas_para_salvar


def _criar_operacao_fechada_detalhada(op_abertura: Dict, op_fechamento: Dict, quantidade_fechada: int, tipo_fechamento: str) -> Dict:
    """
    Cria um dicionário detalhado para uma operação fechada, alinhado com OperacaoFechada e OperacaoDetalhe.
    """
    # Preços unitários
    preco_unitario_abertura = op_abertura["price"]
    preco_unitario_fechamento = op_fechamento["price"]
    
    # Taxas proporcionais
    taxas_proporcionais_abertura = (op_abertura["fees"] / op_abertura["quantity"]) * quantidade_fechada if op_abertura["quantity"] > 0 else 0
    taxas_proporcionais_fechamento = (op_fechamento["fees"] / op_fechamento["quantity"]) * quantidade_fechada if op_fechamento["quantity"] > 0 else 0

    # Valores totais para cálculo do resultado
    valor_total_abertura_calculo = preco_unitario_abertura * quantidade_fechada
    valor_total_fechamento_calculo = preco_unitario_fechamento * quantidade_fechada

    # Determina o tipo e calcula o resultado
    if tipo_fechamento == "compra_fechada_com_venda": # Compra (abertura) e Venda (fechamento)
        tipo_operacao_fechada = "compra-venda"
        resultado_bruto = valor_total_fechamento_calculo - valor_total_abertura_calculo
        resultado_liquido = resultado_bruto - taxas_proporcionais_abertura - taxas_proporcionais_fechamento
        data_ab = op_abertura["date"]
        data_fec = op_fechamento["date"]
    elif tipo_fechamento == "venda_descoberta_fechada_com_compra": # Venda (abertura) e Compra (fechamento)
        tipo_operacao_fechada = "venda-compra"
        resultado_bruto = valor_total_abertura_calculo - valor_total_fechamento_calculo # Venda é abertura (valor maior)
        resultado_liquido = resultado_bruto - taxas_proporcionais_abertura - taxas_proporcionais_fechamento
        data_ab = op_abertura["date"] # Data da venda a descoberto
        data_fec = op_fechamento["date"] # Data da recompra
    else:
        raise ValueError(f"Tipo de fechamento desconhecido: {tipo_fechamento}")

    # Cálculo do percentual de lucro/prejuízo
    custo_para_calculo_percentual = 0.0
    if op_abertura["operation"] == "buy": # Abertura foi uma compra
        custo_para_calculo_percentual = (op_abertura["price"] * quantidade_fechada) + taxas_proporcionais_abertura
    elif op_abertura["operation"] == "sell": # Abertura foi uma venda (short sale)
        # Base é o valor recebido na venda, líquido de taxas da venda.
        # O resultado_liquido já considera o lucro/prejuízo.
        # A base para o percentual deve ser o "investimento" ou "risco" inicial.
        # Para short sale, o "investimento" é o valor que se espera recomprar, mas o ganho é sobre o valor vendido.
        # Se vendi por 100 (líquido de taxas) e recomprei por 80, lucro de 20. Percentual é 20/100 = 20%.
        # Se vendi por 100 e recomprei por 120, prejuízo de 20. Percentual é -20/100 = -20%.
        custo_para_calculo_percentual = (op_abertura["price"] * quantidade_fechada) - taxas_proporcionais_abertura
        
    percentual_lucro = 0.0
    base_para_percentual_abs = abs(custo_para_calculo_percentual)
    if base_para_percentual_abs != 0:
        percentual_lucro = (resultado_liquido / base_para_percentual_abs) * 100.0
    else:
        if resultado_liquido > 0:
            percentual_lucro = 100.0 
        elif resultado_liquido < 0:
            percentual_lucro = -100.0
        # Se resultado_liquido for 0 e base também, percentual_lucro permanece 0.0

    operacoes_relacionadas = [
        {
            "id": op_abertura.get("id"),
            "date": op_abertura["date"],
            "operation": op_abertura["operation"],
            "quantity": quantidade_fechada,
            "price": preco_unitario_abertura,
            "fees": taxas_proporcionais_abertura,
            "valor_total": preco_unitario_abertura * quantidade_fechada
        },
        {
            "id": op_fechamento.get("id"),
            "date": op_fechamento["date"],
            "operation": op_fechamento["operation"],
            "quantity": quantidade_fechada,
            "price": preco_unitario_fechamento,
            "fees": taxas_proporcionais_fechamento,
            "valor_total": preco_unitario_fechamento * quantidade_fechada
        }
    ]

    return {
        "ticker": op_abertura["ticker"],
        "data_abertura": data_ab,
        "data_fechamento": data_fec,
        "tipo": tipo_operacao_fechada,
        "quantidade": quantidade_fechada,
        "valor_compra": preco_unitario_abertura,
        "valor_venda": preco_unitario_fechamento,
        "taxas_total": taxas_proporcionais_abertura + taxas_proporcionais_fechamento,
        "resultado": resultado_liquido,
        "percentual_lucro": percentual_lucro, # Added this key
        "operacoes_relacionadas": operacoes_relacionadas,
        "day_trade": op_abertura["date"] == op_fechamento["date"]
    }


def recalcular_carteira(usuario_id: int) -> None:
    """
    Recalcula a carteira atual de um usuário com base em todas as suas operações.
    A carteira existente do usuário é limpa antes do recálculo.
    """
    import logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    # Limpa a carteira atual do usuário no banco de dados antes de recalcular
    limpar_carteira_usuario_db(usuario_id=usuario_id)

    # Obtém todas as operações do usuário
    operacoes = obter_todas_operacoes(usuario_id=usuario_id)
    
    # Dicionário para armazenar a carteira atual
    carteira_temp = defaultdict(lambda: {"quantidade": 0, "custo_total": 0.0, "preco_medio": 0.0})
    
    # Processa cada operação
    for op in operacoes:
        logging.info(f"[recalcular_carteira] Processando op: {op['ticker']}, {op['operation']}, Qtd: {op['quantity']}, Preço: {op['price']}, Data: {op.get('date')})")
        ticker = op["ticker"]

        # Log ANTES da operação
        # Certifique-se de que o ticker existe em carteira_temp para evitar KeyError se for a primeira operação do ticker
        # Usamos .get para segurança, embora defaultdict deva criar
        pm_antes = carteira_temp[ticker].get('preco_medio', 0.0) if ticker in carteira_temp else 0.0
        logging.info(f"[recalcular_carteira] ANTES op ({op['ticker']}): Qtd: {carteira_temp[ticker]['quantidade']}, CustoTotal: {carteira_temp[ticker]['custo_total']}, PM: {pm_antes}")

        quantidade_op = op["quantity"]
        valor_op_bruto = quantidade_op * op["price"] # Renomeado para clareza (valor bruto da operação)
        fees_op = op.get("fees", 0.0)

        # Salva o estado ANTES de modificar quantidade, custo_total e PM para lógica de compra/venda
        estado_anterior_quantidade = carteira_temp[ticker]["quantidade"]
        estado_anterior_preco_medio = carteira_temp[ticker]["preco_medio"]
        estado_anterior_custo_total = carteira_temp[ticker]["custo_total"] # Captura o custo total anterior

        if op["operation"] == "buy":
            custo_da_compra_atual_total = valor_op_bruto + fees_op

            if estado_anterior_quantidade < 0: # Estava vendido e esta compra está cobrindo (parcialmente ou totalmente)
                quantidade_acoes_sendo_cobertas = min(abs(estado_anterior_quantidade), quantidade_op)

                carteira_temp[ticker]["quantidade"] += quantidade_op

                if carteira_temp[ticker]["quantidade"] == 0: # Compra zerou exatamente a posição vendida
                    carteira_temp[ticker]["custo_total"] = 0.0
                elif carteira_temp[ticker]["quantidade"] > 0: # Compra cobriu a posição vendida e iniciou uma nova posição comprada
                    quantidade_comprada_excedente = carteira_temp[ticker]["quantidade"]
                    custo_da_parte_excedente = (custo_da_compra_atual_total / quantidade_op) * quantidade_comprada_excedente if quantidade_op != 0 else 0
                    carteira_temp[ticker]["custo_total"] = custo_da_parte_excedente
                else: # Compra apenas reduziu a posição vendida (carteira_temp[ticker]["quantidade"] < 0)
                    reducao_valor_pos_vendida = estado_anterior_preco_medio * quantidade_acoes_sendo_cobertas
                    carteira_temp[ticker]["custo_total"] = estado_anterior_custo_total - reducao_valor_pos_vendida
                    if carteira_temp[ticker]["custo_total"] < 0: # Garante que não fique negativo
                        carteira_temp[ticker]["custo_total"] = 0.0
            else: # Estava zerado ou já comprado (caso normal de compra)
                carteira_temp[ticker]["quantidade"] += quantidade_op
                carteira_temp[ticker]["custo_total"] += custo_da_compra_atual_total
        elif op["operation"] == "sell":
            # valor_liquido_venda = valor_op_bruto - fees_op # Valor que efetivamente altera o caixa ou valor da posição

            # Se estava comprado antes desta venda
            if estado_anterior_quantidade > 0:
                quantidade_vendida_da_posicao_comprada = min(estado_anterior_quantidade, quantidade_op)
                custo_a_baixar = estado_anterior_preco_medio * quantidade_vendida_da_posicao_comprada
                carteira_temp[ticker]["custo_total"] -= custo_a_baixar
                carteira_temp[ticker]["quantidade"] -= quantidade_vendida_da_posicao_comprada

                quantidade_op_restante_apos_vender_comprado = quantidade_op - quantidade_vendida_da_posicao_comprada
                if quantidade_op_restante_apos_vender_comprado > 0: # Venda excedeu a posição comprada, virou vendido
                    # Custo_total da parte comprada deve ter sido zerado ou estar próximo de zero.
                    # Agora, custo_total representa o valor da nova posição vendida.
                    proporcao_restante = quantidade_op_restante_apos_vender_comprado / quantidade_op if quantidade_op else 0
                    carteira_temp[ticker]["custo_total"] = (valor_op_bruto * proporcao_restante) # Usar valor bruto para PM de venda, taxas afetam resultado.
                    carteira_temp[ticker]["quantidade"] -= quantidade_op_restante_apos_vender_comprado
            else: # Estava zerado ou já vendido (aumentando a posição vendida)
                carteira_temp[ticker]["quantidade"] -= quantidade_op
                # Custo_total para vendidos acumula o valor (bruto) obtido com as vendas.
                # O preco_medio será (custo_total / abs(quantidade))
                carteira_temp[ticker]["custo_total"] += valor_op_bruto

        logging.info(f"[recalcular_carteira] APÓS op ({op['ticker']}): Qtd: {carteira_temp[ticker]['quantidade']}, CustoTotal: {carteira_temp[ticker]['custo_total']}")

        # Recalcula o preço médio final da posição
        if carteira_temp[ticker]["quantidade"] > 0: # Posição comprada
            carteira_temp[ticker]["preco_medio"] = carteira_temp[ticker]["custo_total"] / carteira_temp[ticker]["quantidade"]
            logging.info(f"[recalcular_carteira] NOVO PM COMPRADO ({op['ticker']}): {carteira_temp[ticker]['preco_medio']}")
        elif carteira_temp[ticker]["quantidade"] < 0: # Posição vendida
            # Se a quantidade é negativa, o custo_total deve representar o valor total obtido
            # com as vendas a descoberto, e o preco_medio o preço médio dessas vendas.
            # Estes valores devem ter sido calculados corretamente no bloco 'if op["operation"] == "sell"'.
            # Aqui, apenas garantimos que sejam usados para o preco_medio e não zerados.
            if abs(carteira_temp[ticker]["quantidade"]) > 0 and carteira_temp[ticker]["custo_total"] != 0: # Evitar divisão por zero se custo_total ainda for 0 por algum motivo
                carteira_temp[ticker]["preco_medio"] = carteira_temp[ticker]["custo_total"] / abs(carteira_temp[ticker]["quantidade"])
            elif op["operation"] == "sell": # Se foi uma venda que resultou em pos negativa e custo_total está 0 (deveria ter sido setado)
                 carteira_temp[ticker]["preco_medio"] = op["price"] # Usa o preço da operação atual como PM
                 # O custo_total também deveria ter sido op["price"] * op["quantity"] no bloco da venda
                 # Se o custo_total ficou 0 para AERI3, precisamos garantir que ele seja atualizado no bloco de venda.
            else:
                 carteira_temp[ticker]["preco_medio"] = 0.0 # Fallback
            logging.info(f"[recalcular_carteira] NOVO PM VENDIDO ({op['ticker']}): {carteira_temp[ticker]['preco_medio']}, CustoTotal: {carteira_temp[ticker]['custo_total']}")
        else: # Quantidade é zero
            carteira_temp[ticker]["preco_medio"] = 0.0
            carteira_temp[ticker]["custo_total"] = 0.0
            logging.info(f"[recalcular_carteira] PM ZERADO ({op['ticker']}): Qtd zero.")
            
    # Atualiza a carteira no banco de dados para o usuário
    for ticker, dados in carteira_temp.items():
        # Salva mesmo se a quantidade for zero para remover da carteira no DB,
        # ou a função atualizar_carteira pode decidir não salvar se quantidade for zero.
        # A função `atualizar_carteira` do database usa INSERT OR REPLACE, 
        # então se a quantidade for 0, ela ainda será salva assim.
        # Se quisermos remover, precisaríamos de uma lógica de DELETE no DB.
        # Por ora, salvar com quantidade zero é aceitável.
        atualizar_carteira(ticker, dados["quantidade"], dados["preco_medio"], dados["custo_total"], usuario_id=usuario_id)


def recalcular_resultados(usuario_id: int) -> None:
    """
    Recalcula os resultados mensais de um usuário com base em todas as suas operações.
    Os resultados mensais existentes do usuário são limpos antes do recálculo.
    """
    import logging # Adicionado para logs
    # Limpa os resultados mensais existentes do usuário no banco de dados
    limpar_resultados_mensais_usuario_db(usuario_id=usuario_id)

    # Obtém todas as operações do usuário, ordenadas por data e ID
    # A função obter_todas_operacoes já deve retornar ordenado por data, e ID como desempate.
    # Se não, a ordenação precisa ser garantida aqui. Ex: operacoes.sort(key=lambda x: (x['date'], x.get('id', 0)))
    operacoes = obter_todas_operacoes(usuario_id=usuario_id)
    
    # Dicionário para manter o estado da carteira para cálculo de PM de Swing Trade
    carteira_estado_atual = defaultdict(lambda: {"quantidade": 0, "custo_total": 0.0, "preco_medio": 0.0})
    posicoes_vendidas_estado_atual = defaultdict(lambda: {"quantidade_vendida": 0, "valor_total_venda": 0.0, "preco_medio_venda": 0.0})

    # Agrupa as operações por mês
    operacoes_por_mes = defaultdict(list)
    for op in operacoes:
        op_date = op["date"]
        if isinstance(op_date, str):
            op_date = datetime.fromisoformat(op_date.split("T")[0]).date()
        elif isinstance(op_date, datetime):
            op_date = op_date.date()
        op["date"] = op_date # Garante que a data é um objeto date
        
        mes = op_date.strftime("%Y-%m")
        operacoes_por_mes[mes].append(op)
    
    prejuizo_acumulado_swing = 0.0
    prejuizo_acumulado_day = 0.0
    
    for mes_str, ops_mes_original in sorted(operacoes_por_mes.items()): # Renomeado para clareza
        resultado_mes_swing = {"vendas": 0.0, "custo": 0.0, "ganho_liquido": 0.0}
        resultado_mes_day = {"vendas_total": 0.0, "custo_total": 0.0, "ganho_liquido": 0.0, "irrf": 0.0}
        
        operacoes_por_dia_no_mes = defaultdict(list)
        for op_m in ops_mes_original: # Renomeado para clareza
            dia_iso = op_m["date"].isoformat()
            operacoes_por_dia_no_mes[dia_iso].append(op_m)
            
        for dia_str, ops_dia_list_original in sorted(operacoes_por_dia_no_mes.items()):
            
            ops_day_trade_dia = []
            ops_swing_trade_dia_compras = []
            ops_swing_trade_dia_vendas = []

            # Separa operações por ticker para checar day trade corretamente
            ops_por_ticker_neste_dia = defaultdict(list)
            for op_dia in ops_dia_list_original:
                ops_por_ticker_neste_dia[op_dia["ticker"]].append(op_dia)

            for ticker_dia, lista_ops_ticker_dia in ops_por_ticker_neste_dia.items():
                if _eh_day_trade(lista_ops_ticker_dia, ticker_dia):
                    ops_day_trade_dia.extend(lista_ops_ticker_dia)
                else: # Não é day trade para este ticker, são swing trades
                    for op_swing in lista_ops_ticker_dia:
                        if op_swing["operation"] == "buy":
                            ops_swing_trade_dia_compras.append(op_swing)
                        else:
                            ops_swing_trade_dia_vendas.append(op_swing)

            # Ordena compras e vendas por ID para manter a ordem de execução no dia
            ops_swing_trade_dia_compras.sort(key=lambda x: x.get('id', 0))
            ops_swing_trade_dia_vendas.sort(key=lambda x: x.get('id', 0))

            # Processar Compras de Swing Trade do Dia
            for compra_op in ops_swing_trade_dia_compras:
                ticker = compra_op["ticker"]
                quantidade_compra_total = compra_op["quantity"]
                preco_compra_unitario = compra_op["price"]
                fees_compra_total = compra_op.get("fees", 0.0)
                # valor_compra_bruto_total = quantidade_compra_total * preco_compra_unitario # Não usado diretamente abaixo, mas conceitual

                if posicoes_vendidas_estado_atual[ticker]["quantidade_vendida"] > 0:
                    qtd_a_cobrir = min(posicoes_vendidas_estado_atual[ticker]["quantidade_vendida"], quantidade_compra_total)
                    pm_venda_anterior = posicoes_vendidas_estado_atual[ticker]["preco_medio_venda"]
                    
                    valor_da_venda_original_para_acoes_cobertas = qtd_a_cobrir * pm_venda_anterior # Valor bruto da venda original
                    custo_da_recompra_para_acoes_cobertas_bruto = qtd_a_cobrir * preco_compra_unitario
                    fees_compra_proporcional = (fees_compra_total / quantidade_compra_total) * qtd_a_cobrir if quantidade_compra_total > 0 else 0

                    # Adiciona o custo da recompra ao resultado do mês.
                    # A venda original já foi adicionada a resultado_mes_swing["vendas"].
                    resultado_mes_swing["custo"] += custo_da_recompra_para_acoes_cobertas_bruto + fees_compra_proporcional
                    
                    # Atualiza posicoes_vendidas_estado_atual
                    posicoes_vendidas_estado_atual[ticker]["valor_total_venda"] -= valor_da_venda_original_para_acoes_cobertas # Deduz o valor bruto das ações recompradas
                    posicoes_vendidas_estado_atual[ticker]["quantidade_vendida"] -= qtd_a_cobrir
                    
                    if posicoes_vendidas_estado_atual[ticker]["quantidade_vendida"] > 0:
                        posicoes_vendidas_estado_atual[ticker]["preco_medio_venda"] = posicoes_vendidas_estado_atual[ticker]["valor_total_venda"] / posicoes_vendidas_estado_atual[ticker]["quantidade_vendida"]
                    else: # Zerou a posição vendida
                        posicoes_vendidas_estado_atual[ticker]["preco_medio_venda"] = 0.0
                        posicoes_vendidas_estado_atual[ticker]["valor_total_venda"] = 0.0 # Garante zeragem
                    
                    logging.info(f"[recalcular_resultados] COMPRA COBRINDO VENDA ({ticker}): Qtd Coberta:{qtd_a_cobrir}, Preço Compra:{preco_compra_unitario}, PM Venda Anterior:{pm_venda_anterior}")
                    logging.info(f"[recalcular_resultados] Estado Pos Vendida APÓS COBERTURA ({ticker}): Qtd:{posicoes_vendidas_estado_atual[ticker]['quantidade_vendida']}, PM Vendido:{posicoes_vendidas_estado_atual[ticker]['preco_medio_venda']}")

                    quantidade_compra_restante = quantidade_compra_total - qtd_a_cobrir
                    if quantidade_compra_restante > 0:
                        # Trata o restante como uma compra normal para a carteira_estado_atual (posição comprada)
                        valor_compra_restante_bruto = quantidade_compra_restante * preco_compra_unitario
                        fees_compra_restante = (fees_compra_total / quantidade_compra_total) * quantidade_compra_restante if quantidade_compra_total > 0 else 0
                        
                        carteira_estado_atual[ticker]["quantidade"] += quantidade_compra_restante
                        carteira_estado_atual[ticker]["custo_total"] += valor_compra_restante_bruto + fees_compra_restante
                        if carteira_estado_atual[ticker]["quantidade"] > 0: # Sempre será >0 aqui
                             carteira_estado_atual[ticker]["preco_medio"] = carteira_estado_atual[ticker]["custo_total"] / carteira_estado_atual[ticker]["quantidade"]
                        logging.info(f"[recalcular_resultados] COMPRA SWING (Restante após cobrir venda) ({ticker}): Qtd:{quantidade_compra_restante}, Preço:{preco_compra_unitario}, Novo PM Comprado:{carteira_estado_atual[ticker]['preco_medio']}")
                else:
                    # Lógica original para compra normal (nenhuma posição vendida para cobrir)
                    carteira_estado_atual[ticker]["quantidade"] += quantidade_compra_total
                    carteira_estado_atual[ticker]["custo_total"] += (quantidade_compra_total * preco_compra_unitario) + fees_compra_total
                    if carteira_estado_atual[ticker]["quantidade"] > 0:
                        carteira_estado_atual[ticker]["preco_medio"] = carteira_estado_atual[ticker]["custo_total"] / carteira_estado_atual[ticker]["quantidade"]
                    else: # Improvável para uma compra, mas para segurança
                        carteira_estado_atual[ticker]["preco_medio"] = 0.0
                        carteira_estado_atual[ticker]["custo_total"] = 0.0
                    logging.info(f"[recalcular_resultados] COMPRA SWING (Normal) ({ticker}): Qtd:{quantidade_compra_total}, Preço:{preco_compra_unitario}, Novo PM Comprado:{carteira_estado_atual[ticker]['preco_medio']}")

            # Processar Vendas de Swing Trade do Dia
            for venda_op in ops_swing_trade_dia_vendas:
                ticker = venda_op["ticker"]
                quantidade_venda_total = venda_op["quantity"]
                preco_venda_unitario = venda_op["price"]
                fees_total_venda = venda_op.get("fees", 0.0)
                
                quantidade_vendida_de_posicao_comprada = 0
                quantidade_vendida_a_descoberto = 0

                # Parte 1: Venda cobre posição comprada existente
                if carteira_estado_atual[ticker]["quantidade"] > 0:
                    pm_para_venda_comprada = carteira_estado_atual[ticker]["preco_medio"]
                    quantidade_vendida_de_posicao_comprada = min(carteira_estado_atual[ticker]["quantidade"], quantidade_venda_total)
                    
                    custo_da_parte_comprada_vendida = quantidade_vendida_de_posicao_comprada * pm_para_venda_comprada
                    valor_bruto_da_parte_comprada_vendida = quantidade_vendida_de_posicao_comprada * preco_venda_unitario
                    fees_da_parte_comprada_vendida = (fees_total_venda / quantidade_venda_total) * quantidade_vendida_de_posicao_comprada if quantidade_venda_total > 0 else 0
                    valor_liquido_da_parte_comprada_vendida = valor_bruto_da_parte_comprada_vendida - fees_da_parte_comprada_vendida

                    resultado_mes_swing["vendas"] += valor_liquido_da_parte_comprada_vendida
                    resultado_mes_swing["custo"] += custo_da_parte_comprada_vendida
                    
                    carteira_estado_atual[ticker]["quantidade"] -= quantidade_vendida_de_posicao_comprada
                    carteira_estado_atual[ticker]["custo_total"] -= custo_da_parte_comprada_vendida
                    if carteira_estado_atual[ticker]["quantidade"] <= 0:
                        carteira_estado_atual[ticker]["custo_total"] = 0.0
                        carteira_estado_atual[ticker]["preco_medio"] = 0.0
                    
                    logging.info(f"[recalcular_resultados] VENDA DE POS_COMPRADA ({ticker}): Qtd:{quantidade_vendida_de_posicao_comprada}, Preço:{preco_venda_unitario}, PM Usado:{pm_para_venda_comprada}, Custo Venda:{custo_da_parte_comprada_vendida}")

                # Parte 2: Venda a descoberto (o restante da quantidade da operação de venda)
                quantidade_vendida_a_descoberto = quantidade_venda_total - quantidade_vendida_de_posicao_comprada
                
                if quantidade_vendida_a_descoberto > 0:
                    valor_desta_venda_descoberto_bruto = quantidade_vendida_a_descoberto * preco_venda_unitario
                    fees_desta_venda_descoberto = (fees_total_venda / quantidade_venda_total) * quantidade_vendida_a_descoberto if quantidade_venda_total > 0 else 0
                    valor_liquido_desta_venda_descoberto = valor_desta_venda_descoberto_bruto - fees_desta_venda_descoberto

                    resultado_mes_swing["vendas"] += valor_liquido_desta_venda_descoberto
                    # O custo da venda a descoberto será apurado na recompra.

                    posicoes_vendidas_estado_atual[ticker]["valor_total_venda"] += valor_desta_venda_descoberto_bruto # Acumula valor bruto para PM de venda
                    posicoes_vendidas_estado_atual[ticker]["quantidade_vendida"] += quantidade_vendida_a_descoberto
                    
                    if posicoes_vendidas_estado_atual[ticker]["quantidade_vendida"] > 0:
                        posicoes_vendidas_estado_atual[ticker]["preco_medio_venda"] = posicoes_vendidas_estado_atual[ticker]["valor_total_venda"] / posicoes_vendidas_estado_atual[ticker]["quantidade_vendida"]
                    
                    logging.info(f"[recalcular_resultados] VENDA A DESCOBERTO ({ticker}): Qtd:{quantidade_vendida_a_descoberto}, Preço:{preco_venda_unitario}, Novo PM Vendido:{posicoes_vendidas_estado_atual[ticker]['preco_medio_venda']}")

                logging.info(f"[recalcular_resultados] Estado Carteira APÓS VENDA ({ticker}): Qtd:{carteira_estado_atual[ticker]['quantidade']}, CustoTotal:{carteira_estado_atual[ticker]['custo_total']}, PM:{carteira_estado_atual[ticker]['preco_medio']}")
                logging.info(f"[recalcular_resultados] Estado Pos Vendida APÓS VENDA ({ticker}): Qtd:{posicoes_vendidas_estado_atual[ticker]['quantidade_vendida']}, PM Vendido:{posicoes_vendidas_estado_atual[ticker]['preco_medio_venda']}")

            # Calcular resultados de Day Trade do dia (se houver)
            if ops_day_trade_dia:
                _, resultado_dia_day_obj = _calcular_resultado_dia(ops_day_trade_dia, usuario_id)
                if resultado_dia_day_obj: # Se houver resultado de day trade
                    resultado_mes_day["vendas_total"] += resultado_dia_day_obj["vendas_total"]
                    resultado_mes_day["custo_total"] += resultado_dia_day_obj["custo_total"]
                    # O ganho líquido do dia de daytrade é vendas - custo. Esse valor será somado ao do mês.
                    resultado_mes_day["ganho_liquido"] += resultado_dia_day_obj["ganho_liquido"]
                    resultado_mes_day["irrf"] += resultado_dia_day_obj["irrf"]

        # Após processar todos os dias do mês:
        resultado_mes_swing["ganho_liquido"] = resultado_mes_swing["vendas"] - resultado_mes_swing["custo"]
        # O ganho líquido de day trade já foi acumulado.

        isento_swing = resultado_mes_swing["vendas"] <= 20000.0
        
        # Aplica a compensação de prejuízos (Swing Trade)
        ganho_liquido_swing_antes_compensacao = resultado_mes_swing["ganho_liquido"]
        if prejuizo_acumulado_swing > 0 and ganho_liquido_swing_antes_compensacao > 0:
            compensacao = min(prejuizo_acumulado_swing, ganho_liquido_swing_antes_compensacao)
            ganho_liquido_swing_apos_compensacao = ganho_liquido_swing_antes_compensacao - compensacao
            prejuizo_acumulado_swing -= compensacao
        elif ganho_liquido_swing_antes_compensacao < 0:
            prejuizo_acumulado_swing += abs(ganho_liquido_swing_antes_compensacao)
            ganho_liquido_swing_apos_compensacao = 0.0
        else:
            ganho_liquido_swing_apos_compensacao = ganho_liquido_swing_antes_compensacao

        # Aplica a compensação de prejuízos (Day Trade)
        ganho_liquido_day_antes_compensacao = resultado_mes_day["ganho_liquido"]
        if prejuizo_acumulado_day > 0 and ganho_liquido_day_antes_compensacao > 0:
            compensacao_day = min(prejuizo_acumulado_day, ganho_liquido_day_antes_compensacao)
            ganho_liquido_day_apos_compensacao = ganho_liquido_day_antes_compensacao - compensacao_day
            prejuizo_acumulado_day -= compensacao_day
        elif ganho_liquido_day_antes_compensacao < 0:
            prejuizo_acumulado_day += abs(ganho_liquido_day_antes_compensacao)
            ganho_liquido_day_apos_compensacao = 0.0
        else:
            ganho_liquido_day_apos_compensacao = ganho_liquido_day_antes_compensacao

        # Prepara o dicionário final para salvar no banco
        resultado_dict: Dict[str, Any] = {
            "mes": mes_str,
            "vendas_swing": resultado_mes_swing["vendas"],
            "custo_swing": resultado_mes_swing["custo"],
            "ganho_liquido_swing": ganho_liquido_swing_apos_compensacao, # Já compensado
            "isento_swing": isento_swing,
            "prejuizo_acumulado_swing": prejuizo_acumulado_swing,

            "vendas_day_trade": resultado_mes_day["vendas_total"],
            "custo_day_trade": resultado_mes_day["custo_total"],
            "ganho_liquido_day": ganho_liquido_day_apos_compensacao, # Já compensado
            "irrf_day": resultado_mes_day["irrf"],
            "prejuizo_acumulado_day": prejuizo_acumulado_day,
            
            # Defaults for DARF fields
            "darf_codigo_swing": None, "darf_competencia_swing": None, "darf_valor_swing": None, "darf_vencimento_swing": None, "status_darf_swing_trade": None,
            "darf_codigo_day": None, "darf_competencia_day": None, "darf_valor_day": None, "darf_vencimento_day": None, "status_darf_day_trade": None,
        }

        # Swing Trade IR calculations
        current_ir_devido_swing = 0.0
        if not isento_swing and resultado_dict["ganho_liquido_swing"] > 0:
            current_ir_devido_swing = resultado_dict["ganho_liquido_swing"] * 0.15
        
        # Simplificando ir_pagar_swing = current_ir_devido_swing (desconsiderando IRRF de 0,005% em swing, que não é comum reter para DARF)
        current_ir_pagar_swing = max(0.0, current_ir_devido_swing) 
        
        resultado_dict["ir_devido_swing"] = current_ir_devido_swing
        resultado_dict["ir_pagar_swing"] = current_ir_pagar_swing

        if current_ir_pagar_swing >= 10.0:
            resultado_dict["darf_valor_swing"] = current_ir_pagar_swing
            resultado_dict["darf_codigo_swing"] = "6015" # Código genérico, pode ser diferente para swing
            resultado_dict["darf_competencia_swing"] = mes_str
            resultado_dict["darf_vencimento_swing"] = _calculate_darf_due_date(mes_str)
            resultado_dict["status_darf_swing_trade"] = "Pendente"
        
        # Day Trade IR calculations
        current_ir_devido_day = 0.0
        if resultado_dict["ganho_liquido_day"] > 0:
             current_ir_devido_day = resultado_dict["ganho_liquido_day"] * 0.20
        
        current_ir_pagar_day = max(0.0, current_ir_devido_day - resultado_dict["irrf_day"])

        resultado_dict["ir_devido_day"] = current_ir_devido_day
        resultado_dict["ir_pagar_day"] = current_ir_pagar_day

        if current_ir_pagar_day >= 10.0:
            resultado_dict["darf_valor_day"] = current_ir_pagar_day
            resultado_dict["darf_codigo_day"] = "6015"
            resultado_dict["darf_competencia_day"] = mes_str
            resultado_dict["darf_vencimento_day"] = _calculate_darf_due_date(mes_str)
            resultado_dict["status_darf_day_trade"] = "Pendente"
            
        salvar_resultado_mensal(resultado_dict, usuario_id=usuario_id)

def listar_operacoes_service(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Serviço para listar todas as operações de um usuário.
    """
    return obter_todas_operacoes(usuario_id=usuario_id)

def deletar_operacao_service(operacao_id: int, usuario_id: int) -> bool:
    """
    Serviço para deletar uma operação e recalcular carteira e resultados.
    Retorna True se a operação foi deletada, False caso contrário.
    """
    if remover_operacao(operacao_id, usuario_id=usuario_id):
        recalcular_carteira(usuario_id=usuario_id)
        recalcular_resultados(usuario_id=usuario_id)
        return True
    return False

def gerar_resumo_operacoes_fechadas(usuario_id: int) -> Dict[str, Any]:
    """
    Gera um resumo das operações fechadas para um usuário.
    """
    operacoes_fechadas = calcular_operacoes_fechadas(usuario_id=usuario_id)
    
    # Calcula o resumo
    total_operacoes = len(operacoes_fechadas)
    lucro_total = sum(op["resultado"] for op in operacoes_fechadas)
    
    # Separa day trade e swing trade
    operacoes_day_trade = [op for op in operacoes_fechadas if op.get("day_trade", False)]
    operacoes_swing_trade = [op for op in operacoes_fechadas if not op.get("day_trade", False)]
    
    lucro_day_trade = sum(op["resultado"] for op in operacoes_day_trade)
    lucro_swing_trade = sum(op["resultado"] for op in operacoes_swing_trade)
    
    # Encontra as operações mais lucrativas e com maior prejuízo
    # Certifique-se de que 'resultado' existe em cada 'op'
    operacoes_ordenadas = sorted(operacoes_fechadas, key=lambda x: x.get("resultado", 0), reverse=True)
    operacoes_lucrativas = [op for op in operacoes_ordenadas if op.get("resultado", 0) > 0]
    operacoes_prejuizo = [op for op in operacoes_ordenadas if op.get("resultado", 0) < 0] # Corrigido para < 0
    
    top_lucrativas = operacoes_lucrativas[:5]
    top_prejuizo = sorted(operacoes_prejuizo, key=lambda x: x.get("resultado", 0))[:5] # Ordena por menor resultado para pegar os maiores prejuízos

    # Calcula o resumo por ticker
    resumo_por_ticker = defaultdict(lambda: {
        "total_operacoes": 0,
        "lucro_total": 0.0, # Certifique-se que é float
        "operacoes_lucrativas": 0,
        "operacoes_prejuizo": 0
    })
    for op in operacoes_fechadas:
        ticker = op["ticker"]
        resumo_por_ticker[ticker]["total_operacoes"] += 1
        resumo_por_ticker[ticker]["lucro_total"] += op.get("resultado", 0)
        
        if op.get("resultado", 0) > 0:
            resumo_por_ticker[ticker]["operacoes_lucrativas"] += 1
        elif op.get("resultado", 0) < 0:
            resumo_por_ticker[ticker]["operacoes_prejuizo"] += 1
    
    return {
        "total_operacoes": total_operacoes,
        "lucro_total": lucro_total,
        "lucro_day_trade": lucro_day_trade,
        "lucro_swing_trade": lucro_swing_trade,
        "total_day_trade": len(operacoes_day_trade),
        "total_swing_trade": len(operacoes_swing_trade),
        "top_lucrativas": top_lucrativas,
        "top_prejuizo": top_prejuizo,
        "resumo_por_ticker": dict(resumo_por_ticker) # Converte defaultdict para dict para a resposta
    }

# A função recalcular_resultados abaixo do comentário parece ser uma versão mais antiga ou incorreta.
# Vou remover para evitar confusão, pois a de cima já foi atualizada.
# def recalcular_resultados() -> None:
#     """
#     Recalcula os resultados mensais com base em todas as operações.
#     """
#     # Obtém todas as operações
#     operacoes = obter_todas_operacoes()  # Corrigido de obter_todas_operações
    
#     # Dicionário para armazenar resultados mensais
#     resultados_mensais = defaultdict(lambda: {"resultado": 0.0})
    
#     # Processa cada operação
#     for op in operacoes:
#         ticker = op["ticker"]
#         quantidade = op["quantity"]
#         valor = quantidade * op["price"]
#         data = op["date"]
        
#         # Formata a data para o início do mês
#         ano, mes = data.year, data.month
#         mes_primeiro_dia = date(ano, mes, 1)
        
#         if op["operation"] == "buy":
#             # Compra: subtrai do resultado mensal
#             resultados_mensais[mes_primeiro_dia]["resultado"] -= valor + op["fees"]
#         else:
#             # Venda: adiciona ao resultado mensal
#             resultados_mensais[mes_primeiro_dia]["resultado"] += valor - op["fees"]
    
#     # Salva os resultados mensais no banco de dados
#     for data_primeiro_dia, dados in resultados_mensais.items():
#         salvar_resultado_mensal(data_primeiro_dia, dados["resultado"])

def deletar_todas_operacoes_service(usuario_id: int) -> Dict[str, Any]:
    """
    Serviço para deletar todas as operações de um usuário e recalcular
    a carteira e os resultados.
    """
    deleted_count = remover_todas_operacoes_usuario(usuario_id=usuario_id)
    
    # Após remover as operações, é crucial recalcular a carteira e os resultados.
    # A carteira ficará vazia, e os resultados mensais serão zerados ou recalculados para refletir
    # a ausência de operações.
    recalcular_carteira(usuario_id=usuario_id)
    recalcular_resultados(usuario_id=usuario_id) # Isso também limpará os resultados mensais no DB
                                               # se não houver operações.
    
    return {"mensagem": f"{deleted_count} operações foram removidas com sucesso.", "deleted_count": deleted_count}

def atualizar_status_darf_service(usuario_id: int, year_month: str, darf_type: str, new_status: str) -> Dict[str, str]:
    """
    Serviço para atualizar o status de um DARF (swing ou daytrade).
    """
    if darf_type.lower() not in ["swing", "daytrade"]:
        raise ValueError("Tipo de DARF inválido. Use 'swing' or 'daytrade'.")

    success = atualizar_status_darf_db(
        usuario_id=usuario_id,
        year_month=year_month,
        darf_type=darf_type.lower(),
        new_status=new_status
    )

    if success:
        return {"mensagem": "Status do DARF atualizado com sucesso."}
    else:
        # Isso pode significar que o registro para o mês/usuário não existe,
        # ou o tipo de darf era inválido (já verificado), ou o status já era o novo_status.
        # Para o cliente, "não encontrado ou status não alterado" pode ser uma mensagem razoável.
        return {"mensagem": "DARF não encontrado ou status não necessitou alteração."}

def remover_item_carteira_service(usuario_id: int, ticker: str) -> bool:
    """
    Serviço para remover um item específico (ticker) da carteira de um usuário.
    Nenhuma recalculação é acionada, pois esta é uma ação de override manual.
    """
    return remover_item_carteira_db(usuario_id=usuario_id, ticker=ticker)

def listar_operacoes_por_ticker_service(usuario_id: int, ticker: str) -> List[Operacao]:
    """
    Serviço para listar todas as operações de um usuário para um ticker específico.
    """
    operacoes_data = obter_operacoes_por_ticker_db(usuario_id=usuario_id, ticker=ticker.upper())
    return [Operacao(**op_data) for op_data in operacoes_data]

def calcular_resultados_por_ticker_service(usuario_id: int, ticker: str) -> ResultadoTicker:
    """
    Calcula e retorna resultados agregados para um ticker específico para o usuário.
    """
    ticker_upper = ticker.upper()

    # 1. Current Holdings
    carteira_completa = obter_carteira_atual(usuario_id=usuario_id) # This function already filters by user_id
    item_carteira_atual = next((item for item in carteira_completa if item["ticker"] == ticker_upper), None)

    quantidade_atual = 0
    preco_medio_atual = 0.0
    custo_total_atual = 0.0

    if item_carteira_atual:
        quantidade_atual = item_carteira_atual.get("quantidade", 0)
        preco_medio_atual = item_carteira_atual.get("preco_medio", 0.0)
        custo_total_atual = item_carteira_atual.get("custo_total", 0.0)

    # 2. Historical Aggregates from Operations
    operacoes_ticker = listar_operacoes_por_ticker_service(usuario_id=usuario_id, ticker=ticker_upper)
    
    total_investido_historico = 0.0
    total_vendido_historico = 0.0
    operacoes_compra_total_quantidade = 0
    operacoes_venda_total_quantidade = 0

    for op in operacoes_ticker:
        valor_operacao = op.quantity * op.price
        if op.operation == "buy":
            total_investido_historico += valor_operacao + op.fees
            operacoes_compra_total_quantidade += op.quantity
        elif op.operation == "sell":
            total_vendido_historico += valor_operacao - op.fees
            operacoes_venda_total_quantidade += op.quantity
            
    # 3. Realized Profit/Loss from Closed Operations
    # calcular_operacoes_fechadas recalcula e salva no DB, depois retorna a lista.
    # Se for chamado com frequência, pode ser um gargalo. Considerar se as ops fechadas devem ser apenas lidas.
    # Para este contexto, vamos assumir que queremos os dados mais recentes, então o recálculo é aceitável.
    operacoes_fechadas_todas = calcular_operacoes_fechadas(usuario_id=usuario_id) 
    
    lucro_prejuizo_realizado_total = 0.0
    for op_fechada in operacoes_fechadas_todas:
        if op_fechada.get('ticker') == ticker_upper:
            lucro_prejuizo_realizado_total += op_fechada.get('resultado', 0.0)

    return ResultadoTicker(
        ticker=ticker_upper,
        quantidade_atual=quantidade_atual,
        preco_medio_atual=preco_medio_atual,
        custo_total_atual=custo_total_atual,
        total_investido_historico=total_investido_historico,
        total_vendido_historico=total_vendido_historico,
        lucro_prejuizo_realizado_total=lucro_prejuizo_realizado_total,
        operacoes_compra_total_quantidade=operacoes_compra_total_quantidade,
        operacoes_venda_total_quantidade=operacoes_venda_total_quantidade
    )

def listar_todas_acoes_service() -> List[Dict[str, Any]]: # Renamed from listar_todos_stocks_service
    """
    Serviço para listar todas as ações (stocks) cadastradas.
    """
    return obter_todas_acoes() # Renamed from obter_todos_stocks


# --- Serviços de Proventos ---

def registrar_provento_service(id_acao_url: int, provento_in: ProventoCreate) -> ProventoInfo:
    """
    Registra um novo provento para uma ação específica.
    Valida se o id_acao na URL corresponde ao do corpo e se a ação existe.
    Converte os dados de ProventoCreate para o formato esperado pelo banco de dados.
    """
    if id_acao_url != provento_in.id_acao:
        raise HTTPException(status_code=400, detail="ID da ação na URL não corresponde ao ID no corpo da requisição.")

    acao_existente = obter_acao_por_id(provento_in.id_acao)
    if not acao_existente:
        raise HTTPException(status_code=404, detail=f"Ação com ID {provento_in.id_acao} não encontrada.")

    # Os validadores em ProventoCreate já converteram valor para float e datas para objetos date.
    # Para o banco, as datas precisam ser strings no formato ISO.
    provento_data_db = {
        "id_acao": provento_in.id_acao,
        "tipo": provento_in.tipo,
        "valor": provento_in.valor, # Já é float
        "data_registro": provento_in.data_registro.isoformat(), # Convertido para date pelo Pydantic, agora para str ISO
        "data_ex": provento_in.data_ex.isoformat(),
        "dt_pagamento": provento_in.dt_pagamento.isoformat()
    }

    new_provento_id = inserir_provento(provento_data_db)
    provento_db = obter_provento_por_id(new_provento_id)

    if not provento_db:
        # Isso seria um erro inesperado se a inserção foi bem-sucedida
        raise HTTPException(status_code=500, detail="Erro ao buscar provento recém-criado.")

    # ProventoInfo espera objetos date, e obter_provento_por_id retorna strings ISO do DB.
    # Pydantic model_validate irá analisar as strings ISO para objetos date automaticamente.
    return ProventoInfo.model_validate(provento_db)


def listar_proventos_por_acao_service(id_acao: int) -> List[ProventoInfo]:
    """
    Lista todos os proventos para uma ação específica.
    Verifica se a ação existe antes de listar os proventos.
    """
    acao_existente = obter_acao_por_id(id_acao)
    if not acao_existente:
        raise HTTPException(status_code=404, detail=f"Ação com ID {id_acao} não encontrada.")

    proventos_db = obter_proventos_por_acao_id(id_acao)
    # Pydantic model_validate irá analisar as strings ISO de data para objetos date.
    return [ProventoInfo.model_validate(p) for p in proventos_db]


def listar_todos_proventos_service() -> List[ProventoInfo]:
    """
    Lista todos os proventos de todas as ações.
    """
    proventos_db = obter_todos_proventos()
    # Pydantic model_validate irá analisar as strings ISO de data para objetos date.
    return [ProventoInfo.model_validate(p) for p in proventos_db]
from typing import List, Dict, Any, Optional # Tuple replaced with tuple, Optional added
import calculos  # Importa o módulo calculos para uso das funções de cálculo
from datetime import date, datetime, timedelta # date was already implicitly imported via from datetime import date, datetime
from decimal import Decimal # Kept for specific calculations in recalcular_resultados
import calendar
from collections import defaultdict
from fastapi import HTTPException # Added HTTPException
import logging
import time
from datetime import date, datetime, timedelta
from collections import defaultdict
from typing import List, Dict, Any, Optional
import logging

from models import (
    OperacaoCreate, AtualizacaoCarteira, Operacao, ResultadoTicker,
    ProventoCreate, ProventoInfo, EventoCorporativoCreate, EventoCorporativoInfo,
    UsuarioProventoRecebidoDB,
    ResumoProventoAnual, ResumoProventoMensal, ResumoProventoPorAcao, DetalheTipoProvento,
    StatusImportacao, ImportacaoCreate, ImportacaoResponse, ImportacaoResumo, OperacaoDuplicada, ResultadoImportacao
)

# datetime is already imported from datetime import date, datetime, timedelta but ensure strptime is accessible
from datetime import datetime as dt # Alias for strptime usage if needed, or just use datetime.strptime
import sqlite3 # For sqlite3.IntegrityError

from database import (
    inserir_operacao,
    inserir_corretora_se_nao_existir,  # Importada para uso na importação
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
    limpar_historico_preco_medio_usuario, # Added import for clearing price history
    atualizar_status_darf_db, # Added for DARF status update
    limpar_carteira_usuario_db, # Added for clearing portfolio before recalc
    limpar_resultados_mensais_usuario_db, # Added for clearing monthly results before recalc
    remover_item_carteira_db, # Added for deleting single portfolio item
    obter_operacoes_por_ticker_db, # Added for fetching operations by ticker
    obter_todas_acoes, # Renamed from obter_todos_stocks
    obter_acao_info_por_ticker, # Added for getting stock info
    # Provento related database functions
    inserir_provento,
    obter_proventos_por_acao_id,
    obter_provento_por_id,
    obter_todos_proventos,
    obter_acao_por_id, # For validating id_acao in proventos
    # EventoCorporativo related database functions
    # Importation and duplicate analysis functions
    analisar_duplicatas_usuario,
    verificar_estrutura_importacao,
    inserir_evento_corporativo,
    obter_eventos_corporativos_por_acao_id,
    obter_evento_corporativo_por_id,
    obter_todos_eventos_corporativos,
    # For saldo_acao_em_data
    obter_operacoes_por_ticker_ate_data_db,
    obter_id_acao_por_ticker, # Added for corporate event processing
    obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a, # Added for corporate event processing
    # For new service:
    limpar_usuario_proventos_recebidos_db,
    inserir_usuario_provento_recebido_db,
    obter_tickers_operados_por_usuario, # Added for recalcular_proventos_recebidos_rapido
    obter_proventos_por_ticker,      # Added for recalcular_proventos_recebidos_rapido
    obter_primeira_data_operacao_usuario, # Added for recalcular_proventos_recebidos_rapido
    # Novas funções de consulta para resumos
    obter_proventos_recebidos_por_usuario_db,
    obter_resumo_anual_proventos_recebidos_db,
    obter_resumo_mensal_proventos_recebidos_db,
    obter_resumo_por_acao_proventos_recebidos_db,
    # Novas funções para preço médio da carteira
    obter_preco_medio_carteira,
    registrar_alteracao_preco_medio,
    # Import database functions for importation
    inserir_importacao,
    atualizar_status_importacao,
    calcular_hash_arquivo,
    verificar_arquivo_ja_importado,
    detectar_operacao_duplicada,
    obter_importacao_por_id,
    listar_importacoes_usuario,
    obter_operacoes_por_importacao,
    remover_operacoes_por_importacao,
    limpar_importacoes_usuario
)

# --- Função Auxiliar para Transformação de Proventos do DB ---
def _transformar_provento_db_para_modelo(p_db: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if p_db is None:
        return None

    dados_transformados = {
        'id': p_db['id'] if 'id' in p_db else None,
        'id_acao': p_db['id_acao'] if 'id_acao' in p_db else None,
        'tipo': p_db['tipo'] if 'tipo' in p_db else None,
        # Adicione outros campos que não precisam de conversão aqui
        # 'nome_acao': p_db['nome_acao'] if 'nome_acao' in p_db else None, # Exemplo se existisse no dict p_db
        # 'ticker_acao': p_db['ticker_acao'] if 'ticker_acao' in p_db else None # Exemplo
    }

    # Converter valor
    valor_db = p_db['valor'] if 'valor' in p_db else None
    if valor_db is not None:
        try:
            # Tenta converter para float, tratando vírgula como separador decimal
            dados_transformados['valor'] = float(str(valor_db).replace(',', '.'))
        except ValueError:
            # Se a conversão falhar, define como None ou lança erro, dependendo da política de erro.
            # Para ProventoInfo, valor é obrigatório, então um erro seria mais apropriado se não puder ser None.
            # No entanto, ProventoCreate permite string e valida, ProventoInfo espera float.
            # Se o DB puder ter lixo, aqui é um bom lugar para limpar ou logar.
            # Por ora, vamos permitir que Pydantic trate se for None e o campo for obrigatório.
            dados_transformados['valor'] = None
            # Ou: raise ValueError(f"Valor inválido no banco de dados para provento ID {p_db['id'] if 'id' in p_db else None}: {valor_db}")
    else:
        dados_transformados['valor'] = None

    # Converter datas de DD/MM/YYYY para objetos date
    # Se o banco já armazena em ISO YYYY-MM-DD, Pydantic lida com isso.
    # Esta conversão é se o banco estivesse armazenando no formato DD/MM/YYYY.
    # Com os conversores de data do SQLite, os campos de data já devem ser objetos `date` ou None.
    for campo_data in ['data_registro', 'data_ex', 'dt_pagamento']:
        valor_data = p_db[campo_data] if campo_data in p_db else None
        if isinstance(valor_data, date): # datetime.date
            dados_transformados[campo_data] = valor_data
        else: # Deveria ser None se não for um objeto date, ou se era NULL no DB.
              # Se por algum motivo ainda for uma string (ex: erro na config do converter),
              # Pydantic tentará converter de ISO string para date.
              # Se for uma string em formato inesperado, Pydantic levantará erro.
            dados_transformados[campo_data] = None
            if valor_data is not None: # Log se não for date nem None
                 logging.warning(f"Campo {campo_data} para provento ID {p_db['id'] if 'id' in p_db else None} era esperado como date ou None, mas foi {type(valor_data)}: {valor_data}. Será tratado como None.")


    return dados_transformados


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
    for op in operacoes:
        # Conversão automática do campo date
        if hasattr(op, 'date'):
            op.date = parse_date_to_iso(op.date)
        # Se vier nome de corretora e não vier id, insere se não existir
        corretora_nome = getattr(op, 'corretora_nome', None) or (op.dict().get('corretora_nome') if hasattr(op, 'dict') else None)
        if not getattr(op, 'corretora_id', None) and corretora_nome:
            corretora_id = inserir_corretora_se_nao_existir(corretora_nome)
            op.corretora_id = corretora_id
        inserir_operacao(op.model_dump(), usuario_id=usuario_id)
    recalcular_carteira(usuario_id=usuario_id)
    recalcular_resultados(usuario_id=usuario_id)

def _eh_day_trade(operacoes_dia: List[Dict[str, Any]], ticker: str) -> bool:
    """
    Verifica se houve day trade para um ticker específico em um dia.

    Day trade ocorre quando há compra e venda do mesmo ticker no mesmo dia,
    mas apenas a quantidade que foi efetivamente zerada no dia é considerada day trade.

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

def _calcular_quantidade_day_trade(operacoes_dia: List[Dict[str, Any]], ticker: str) -> int:
    """
    Calcula a quantidade efetiva de day trade para um ticker em um dia.

    A quantidade de day trade é a menor entre compras e vendas do mesmo dia.

    Args:
        operacoes_dia: Lista de operações do dia.
        ticker: Ticker a ser verificado.

    Returns:
        int: Quantidade de ações que foram efetivamente day trade.
    """
    compras = sum(op["quantity"] for op in operacoes_dia
                 if op["ticker"] == ticker and op["operation"] == "buy")
    vendas = sum(op["quantity"] for op in operacoes_dia
                if op["ticker"] == ticker and op["operation"] == "sell")

    # Day trade é a menor quantidade entre compras e vendas
    return min(compras, vendas)

def _calcular_resultado_dia(operacoes_dia: List[Dict[str, Any]], usuario_id: int) -> tuple[Dict[str, float], Dict[str, float]]:
    """
    Calcula o resultado de swing trade e day trade para um dia para um usuário.
    CORREÇÃO: IRRF de 1% aplicado apenas sobre GANHOS de day trade, não sobre toda operação.

    Args:
        operacoes_dia: Lista de operações do dia.
        usuario_id: ID do usuário.

    Returns:
        tuple[Dict[str, float], Dict[str, float]]: Resultados de swing trade e day trade.
    """
    import logging

    resultado_day = {"vendas_total": 0.0, "custo_total": 0.0, "ganho_liquido": 0.0, "irrf": 0.0}
    resultado_swing = {"vendas_total": 0.0, "custo_total": 0.0, "ganho_liquido": 0.0, "irrf": 0.0}

    ops_por_ticker = defaultdict(list)
    for op in operacoes_dia:
        ops_por_ticker[op["ticker"]].append(op)

    for ticker, ops in ops_por_ticker.items():
        if _eh_day_trade(ops, ticker):
            qtd_day = _calcular_quantidade_day_trade(ops, ticker)

            # Para swing trade: usa PM histórico se há posição anterior
            pm_hist = _calcular_preco_medio_antes_operacao(ticker, usuario_id, ops[0]["date"], 0) or 0.0
            qtd_hist = obter_saldo_acao_em_data(usuario_id, ticker, ops[0]["date"] - timedelta(days=1))

            # Separa operações do dia
            compras = [op for op in ops if op["operation"] == "buy"]
            vendas = [op for op in ops if op["operation"] == "sell"]

            # Calcula PM das compras do dia (com fees adicionado ao custo)
            valor_compra_dia = sum(op["quantity"] * op["price"] + op.get("fees", 0.0) for op in compras)
            qtd_compra_dia = sum(op["quantity"] for op in compras)
            pm_compra_dia = valor_compra_dia / qtd_compra_dia if qtd_compra_dia > 0 else 0.0

            # Calcula PM das vendas do dia (com fees subtraído do valor)
            valor_venda_bruto = sum(op["quantity"] * op["price"] for op in vendas)
            fees_venda_total = sum(op.get("fees", 0.0) for op in vendas)
            valor_venda_liquido = valor_venda_bruto - fees_venda_total
            qtd_venda = sum(op["quantity"] for op in vendas)
            pm_venda_liquido = valor_venda_liquido / qtd_venda if qtd_venda > 0 else 0.0

            # === PARTE DAY TRADE ===
            if qtd_day > 0:
                custo_dt = qtd_day * pm_compra_dia
                receita_dt = qtd_day * pm_venda_liquido
                ganho_dt = receita_dt - custo_dt

                resultado_day["vendas_total"] += receita_dt
                resultado_day["custo_total"] += custo_dt
                resultado_day["ganho_liquido"] += ganho_dt

                # CORREÇÃO: IRRF de 1% apenas sobre GANHOS positivos de day trade
                if ganho_dt > 0:
                    irrf_dt = ganho_dt * 0.01  # 1% sobre o ganho, não sobre o valor da operação
                    resultado_day["irrf"] += irrf_dt
                    logging.info(f"[IRRF-DT] {ticker}: Ganho R${ganho_dt:.2f}, IRRF 1% = R${irrf_dt:.2f}")

            # === PARTE SWING TRADE ===
            qtd_st = max(0, qtd_venda - qtd_day)
            if qtd_st > 0 and qtd_hist > 0:
                qtd_st_efetiva = min(qtd_st, qtd_hist)
                custo_st = qtd_st_efetiva * pm_hist
                receita_st = qtd_st_efetiva * pm_venda_liquido
                ganho_st = receita_st - custo_st

                resultado_swing["vendas_total"] += receita_st
                resultado_swing["custo_total"] += custo_st
                resultado_swing["ganho_liquido"] += ganho_st

                # IRRF para swing trade: 0.005% sobre o valor da venda bruta
                irrf_st = valor_venda_bruto * (qtd_st_efetiva / qtd_venda) * 0.00005  # 0.005%
                resultado_swing["irrf"] += irrf_st
                logging.info(f"[IRRF-ST] {ticker}: Venda R${receita_st:.2f}, IRRF 0.005% = R${irrf_st:.2f}")

        else:
            # Não é day trade, tudo é swing trade
            for op in ops:
                if op["operation"] == "sell":
                    qtd_hist = obter_saldo_acao_em_data(usuario_id, ticker, op["date"] - timedelta(days=1))
                    if qtd_hist > 0:
                        pm_hist = _calcular_preco_medio_antes_operacao(ticker, usuario_id, op["date"], op.get("id", 0)) or 0.0
                        qtd_venda_st = min(op["quantity"], qtd_hist)

                        custo_st = qtd_venda_st * pm_hist
                        receita_st_bruta = qtd_venda_st * op["price"]
                        fees_st = op.get("fees", 0.0) * (qtd_venda_st / op["quantity"]) if op["quantity"] > 0 else 0.0
                        receita_st = receita_st_bruta - fees_st
                        ganho_st = receita_st - custo_st

                        resultado_swing["vendas_total"] += receita_st
                        resultado_swing["custo_total"] += custo_st
                        resultado_swing["ganho_liquido"] += ganho_st

                        # IRRF swing trade: 0.005% sobre valor da venda bruta
                        irrf_st = receita_st_bruta * 0.00005
                        resultado_swing["irrf"] += irrf_st

    return resultado_swing, resultado_day


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

def inserir_operacao_manual(operacao: OperacaoCreate, usuario_id: int, importacao_id: Optional[int] = None) -> int:
    """
    Insere uma operação manualmente para um usuário e recalcula a carteira e os resultados.
    Retorna o ID da operação inserida.
    
    Args:
        operacao: Dados da operação a ser inserida.
        usuario_id: ID do usuário.
        importacao_id: ID da importação (opcional, para tracking de importações).
        
    Returns:
        int: ID da operação inserida.
    """
    # Insere a operação no banco de dados
    try:
        if importacao_id is not None:
            # Usar a função inserir_operacao padrão com importacao_id
            new_operacao_id = inserir_operacao(operacao.model_dump(), usuario_id=usuario_id, importacao_id=importacao_id)
        else:
            # Usar a função tradicional
            new_operacao_id = inserir_operacao(operacao.model_dump(), usuario_id=usuario_id)
    except ValueError: # Catching the specific ValueError from database.inserir_operacao
        raise # Re-raise it to be handled by the router (e.g., converted to HTTPException)
    
    # Recalcula a carteira e os resultados
    recalcular_carteira(usuario_id=usuario_id)
    recalcular_resultados(usuario_id=usuario_id)

    try:
        logging.info(f"[PROVENTO-TRACE] Iniciando recálculo rápido de proventos para usuário {usuario_id} após inserção manual de operação ID {new_operacao_id}. ORIGEM: inserir_operacao_manual")
        stats = recalcular_proventos_recebidos_rapido(usuario_id=usuario_id)
        logging.info(f"[PROVENTO-TRACE] Recálculo rápido de proventos para usuário {usuario_id} após inserção manual concluído. Stats: {stats}")
    except Exception as e_recalc:
        logging.error(f"[PROVENTO-TRACE] ALERTA: Falha ao recalcular proventos (rápido) para usuário {usuario_id} após inserção manual de operação ID {new_operacao_id}. A operação principal foi bem-sucedida. Erro no recálculo de proventos: {e_recalc}", exc_info=True)
        # Não relançar o erro para não afetar o status da criação da operação.

    return new_operacao_id

def obter_operacao_service(operacao_id: int, usuario_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtém uma operação específica pelo ID e ID do usuário, incluindo informações de importação.
    
    Args:
        operacao_id: ID da operação.
        usuario_id: ID do usuário.
        
    Returns:
        Optional[Dict[str, Any]]: Os dados da operação se encontrada, None caso contrário.
    """
    return obter_operacao_por_id(operacao_id, usuario_id)

def atualizar_item_carteira(dados: AtualizacaoCarteira, usuario_id: int) -> None:
    """
    Atualiza um item da carteira manualmente para um usuário.
    
    Args:
        dados: Novos dados do item da carteira (ticker, quantidade e preço médio).
        usuario_id: ID do usuário.
    """
    # Obter preço médio anterior para histórico
    info_carteira_anterior = obter_preco_medio_carteira(dados.ticker, usuario_id)
    preco_anterior = info_carteira_anterior['preco_medio'] if info_carteira_anterior else 0.0
    
    custo_total_calculado: float
    if dados.quantidade < 0:
        # Para posições vendidas editadas manualmente, o custo_total deve ser o valor (positivo) da posição vendida.
        # O preco_medio fornecido em 'dados' para uma qtd negativa é o PM de venda.
        custo_total_calculado = abs(dados.quantidade) * dados.preco_medio
    else:
        # Para posições compradas ou zeradas (quantidade >= 0)
        custo_total_calculado = dados.quantidade * dados.preco_medio

    # Registrar no histórico se houve mudança de preço
    if preco_anterior != dados.preco_medio:
        registrar_alteracao_preco_medio(
            dados.ticker, 
            usuario_id, 
            preco_anterior, 
            dados.preco_medio, 
            "Alteração manual pelo usuário"
        )

    # Atualiza o item na carteira, marcando como editado pelo usuário
    atualizar_carteira(dados.ticker, dados.quantidade, dados.preco_medio, custo_total_calculado, usuario_id=usuario_id, preco_editado_pelo_usuario=True)
    
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
    Calcula e salva as operações fechadas para um usuário, usando o novo
    módulo de cálculos.
    """
    logging.info(f"Iniciando cálculo de operações fechadas para o usuário {usuario_id}.")
    
    limpar_operacoes_fechadas_usuario(usuario_id=usuario_id)

    operacoes_db = obter_todas_operacoes(usuario_id=usuario_id)
    if not operacoes_db:
        return []

    operacoes = [Operacao(**op_data) for op_data in operacoes_db]
    operacoes.sort(key=lambda op: (op.date, op.id or 0))

    # TODO: Adicionar lógica de eventos corporativos aqui
    operacoes_ajustadas = operacoes

    resultados = calculos.calcular_resultados_operacoes(operacoes_ajustadas)
    operacoes_fechadas_calculadas = resultados['operacoes_fechadas']

    # ✅ CORREÇÃO: Buscar resultados mensais reais em vez de mapa vazio
    resultados_mensais_list = obter_resultados_mensais(usuario_id=usuario_id)
    resultados_mensais_map = {}
    for rm in resultados_mensais_list:
        mes_str = rm.get('mes', '')
        resultados_mensais_map[mes_str] = rm

    operacoes_fechadas_salvas = []
    for op_fechada in operacoes_fechadas_calculadas:
        valor_base_lucro = op_fechada.preco_medio_compra * op_fechada.quantidade

        # ✅ CORREÇÃO: Calcular status_ir usando a função existente
        status_ir = calculos._calcular_status_ir_operacao_fechada(
            {
                "data_fechamento": op_fechada.data_fechamento,
                "resultado": op_fechada.resultado,
                "day_trade": op_fechada.day_trade
            },
            resultados_mensais_map
        )

        op_dict = {
            "ticker": op_fechada.ticker,
            "quantidade": op_fechada.quantidade,
            "preco_abertura": op_fechada.preco_medio_compra,
            "preco_fechamento": op_fechada.preco_medio_venda,
            "preco_medio_compra": op_fechada.preco_medio_compra,  # <-- Adicionado para o frontend
            "resultado": op_fechada.resultado,
            "day_trade": op_fechada.day_trade,
            "data_fechamento": op_fechada.data_fechamento,
            "data_abertura": op_fechada.data_fechamento, # Simplificação
            "tipo": "compra-venda", # Simplificação
            "valor_compra": valor_base_lucro,
            "valor_venda": op_fechada.preco_medio_venda * op_fechada.quantidade,
            "taxas_total": 0,
            "percentual_lucro": (op_fechada.resultado / valor_base_lucro) * 100 if valor_base_lucro != 0 else 0,
            "prejuizo_anterior_acumulado": 0,
            "operacoes_relacionadas": [],
            "status_ir": status_ir  # ✅ CORREÇÃO: Campo adicionado
        }
        
        salvar_operacao_fechada(op_dict, usuario_id=usuario_id)
        operacoes_fechadas_salvas.append(op_dict)

    logging.info(f"{len(operacoes_fechadas_salvas)} operações fechadas salvas no banco.")
    return operacoes_fechadas_salvas

def recalcular_carteira(usuario_id: int) -> None:
    """
    Recalcula a carteira atual de um usuário com base em todas as suas operações.
    A carteira existente do usuário é limpa antes do recálculo, mas preserva informações de preços editados.
    """
    import logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

    # IMPORTANTE: Salvar informações de preços editados ANTES de limpar a carteira
    carteira_atual = obter_carteira_atual(usuario_id)
    precos_editados = {}

    for item in carteira_atual:
        if item.get('preco_editado_pelo_usuario'):
            ticker = item['ticker']
            precos_editados[ticker] = {
                'preco_medio': item['preco_medio'],
                'editado': True
            }
            print(f"[recalcular_carteira] Salvando preço editado para {ticker}: R$ {item['preco_medio']:.2f}")

    # Agora limpa a carteira atual do usuário no banco de dados
    limpar_carteira_usuario_db(usuario_id=usuario_id)

    # Obtém todas as operações do usuário
    operacoes_originais = obter_todas_operacoes(usuario_id=usuario_id)

    # 🔍 DEBUG: Verificar quantas operações foram obtidas
    logging.info(f"[CARTEIRA-DEBUG] ===== OPERAÇÕES OBTIDAS DO BANCO =====")
    logging.info(f"[CARTEIRA-DEBUG] Total operações originais para usuário {usuario_id}: {len(operacoes_originais)}")
    for i, op in enumerate(operacoes_originais):
        logging.info(f"[CARTEIRA-DEBUG] Op original {i+1}: ID={op.get('id', 'N/A')} | {op['date']} | {op['operation']} | {op['quantity']} {op['ticker']} @{op['price']}")

    operacoes_originais.sort(key=lambda x: (x['date'] if isinstance(x['date'], date) else datetime.fromisoformat(x['date']).date(), x.get('id', 0)))

    # 🔍 DEBUG: Verificar após ordenação
    logging.info(f"[CARTEIRA-DEBUG] ===== OPERAÇÕES APÓS ORDENAÇÃO =====")
    for i, op in enumerate(operacoes_originais):
        logging.info(f"[CARTEIRA-DEBUG] Op ordenada {i+1}: ID={op.get('id', 'N/A')} | {op['date']} | {op['operation']} | {op['quantity']} {op['ticker']} @{op['price']}")

    # --- START NEW LOGIC FOR CORPORATE EVENTS ---
    adjusted_operacoes = []
    if operacoes_originais:
        # 🔍 DEBUG: Verificar operações antes do loop de eventos corporativos
        logging.info(f"[CARTEIRA-DEBUG] ===== PROCESSANDO EVENTOS CORPORATIVOS =====")
        logging.info(f"[CARTEIRA-DEBUG] Operações antes eventos: {len(operacoes_originais)}")

        today_date = date.today()
        unique_tickers = list(set(op_from_db['ticker'] for op_from_db in operacoes_originais))
        events_by_ticker: Dict[str, List[EventoCorporativoInfo]] = {}

        for ticker_symbol in unique_tickers:
            id_acao = obter_id_acao_por_ticker(ticker_symbol)
            if id_acao:
                # Otimização: encontrar a data da primeira operação para este ticker
                first_op_date = min(
                    op_from_db['date'] if isinstance(op_from_db['date'], date)
                    else datetime.fromisoformat(str(op_from_db['date']).split("T")[0]).date()
                    for op_from_db in operacoes_originais
                    if op_from_db['ticker'] == ticker_symbol
                )

                # Buscar eventos apenas a partir de um pouco antes da primeira operação
                search_start_date = first_op_date - timedelta(days=30)  # 30 dias antes

                raw_events_data = obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a(id_acao, today_date)

                # Filtrar eventos para manter apenas os relevantes
                filtered_events_data = [
                    event for event in raw_events_data
                    if event.get('data_ex') and (
                        isinstance(event['data_ex'], date) and event['data_ex'] >= search_start_date
                        or isinstance(event['data_ex'], str) and datetime.fromisoformat(event['data_ex']).date() >= search_start_date
                    )
                ]

                print(f"Eventos para {ticker_symbol} (primeira operação: {first_op_date}, filtro: {search_start_date}): {len(filtered_events_data)} eventos")

                # Event data from DB should have date objects due to [date] alias and converters
                events_by_ticker[ticker_symbol] = [EventoCorporativoInfo.model_validate(event_data) for event_data in filtered_events_data]

        for op_from_db in operacoes_originais:
            logging.info(f"[CARTEIRA-DEBUG] Processando op ID {op_from_db.get('id', 'N/A')} para eventos...")
            current_op_date = op_from_db['date']
            # Ensure current_op_date is a date object (should be from obter_todas_operacoes)
            if not isinstance(current_op_date, date):
                try:
                    current_op_date = datetime.fromisoformat(str(current_op_date).split("T")[0]).date()
                except ValueError:
                    logging.error(f"Invalid date format for operation ID {op_from_db.get('id')}: {op_from_db['date']}. Skipping event adjustment for this op.")
                    adjusted_operacoes.append(op_from_db.copy())
                    continue

            adj_op_data = op_from_db.copy()
            adj_op_data['date'] = current_op_date

            adj_op_data['quantity'] = int(adj_op_data['quantity'])
            adj_op_data['price'] = float(adj_op_data['price'])

            ticker_events = events_by_ticker.get(adj_op_data['ticker'], [])

            # Ordenar eventos por data_ex ascendente para aplicar na sequência correta
            for event_info in sorted(ticker_events, key=lambda e: e.data_ex if e.data_ex else date.min):
                if event_info.data_ex is None:
                    continue

                if adj_op_data['date'] >= event_info.data_ex:
                    if event_info.evento and event_info.evento.lower().startswith("bonific"):
                        bonus_increase = event_info.get_bonus_quantity_increase(float(adj_op_data['quantity']))
                        quantidade_antiga = float(adj_op_data['quantity'])
                        quantidade_nova = quantidade_antiga + bonus_increase
                        adj_op_data['quantity'] = int(round(quantidade_nova))
                        if quantidade_nova > 0:
                            adj_op_data['price'] = float(adj_op_data['price']) * quantidade_antiga / quantidade_nova
                        continue
                    factor = event_info.get_adjustment_factor()
                    if factor == 1.0:
                        continue

                    current_quantity_float = float(adj_op_data['quantity'])
                    current_price_float = float(adj_op_data['price'])

                    current_quantity_float = current_quantity_float * factor
                    if factor != 0.0:
                        current_price_float = current_price_float / factor
                    else:
                        logging.warning(f"Fator zero para evento em {event_info.data_ex}; pulando preço para evitar divisão por zero.")

                    adj_op_data['quantity'] = int(round(current_quantity_float))
                    adj_op_data['price'] = current_price_float

            adjusted_operacoes.append(adj_op_data)
            logging.info(f"[CARTEIRA-DEBUG] Adicionada op ID {adj_op_data.get('id', 'N/A')} à lista ajustada")
    # No original operations
    else:
        adjusted_operacoes = []

    # 🔍 DEBUG: Verificar operações finais
    logging.info(f"[CARTEIRA-DEBUG] ===== OPERAÇÕES FINAIS PARA PROCESSAMENTO =====")
    logging.info(f"[CARTEIRA-DEBUG] Total operações ajustadas: {len(adjusted_operacoes)}")
    for i, op in enumerate(adjusted_operacoes):
        logging.info(f"[CARTEIRA-DEBUG] Op final {i+1}: ID={op.get('id', 'N/A')} | {op['date']} | {op['operation']} | {op['quantity']} {op['ticker']} @{op['price']}")
    # --- END NEW LOGIC FOR CORPORATE EVENTS ---

    # Dicionário para armazenar a carteira atual
    carteira_temp = defaultdict(lambda: {"quantidade": 0, "custo_total": 0.0, "preco_medio": 0.0})

    # Processa cada operação ajustada
    for op in adjusted_operacoes:
        ticker = op["ticker"]

        # DEBUG: Log ANTES da operação
        logging.info(f"[CARTEIRA-DEBUG] ANTES op {op.get('id', 'N/A')}: {ticker} {op['operation']} {op['quantity']}@{op['price']} | Qtd: {carteira_temp[ticker]['quantidade']}, Custo: {carteira_temp[ticker]['custo_total']:.2f}, PM: {carteira_temp[ticker]['preco_medio']:.2f}")

        quantidade_op = op["quantity"]
        valor_op_bruto = quantidade_op * op["price"]
        fees_op = op.get("fees", 0.0)

        # Salva o estado ANTES
        estado_anterior_quantidade = carteira_temp[ticker]["quantidade"]
        estado_anterior_preco_medio = carteira_temp[ticker]["preco_medio"]
        estado_anterior_custo_total = carteira_temp[ticker]["custo_total"]

        if op["operation"] == "buy":
            custo_da_compra_atual_total = valor_op_bruto + fees_op

            if estado_anterior_quantidade < 0:
                quantidade_acoes_sendo_cobertas = min(abs(estado_anterior_quantidade), quantidade_op)
                carteira_temp[ticker]["quantidade"] += quantidade_op
                if carteira_temp[ticker]["quantidade"] == 0:
                    carteira_temp[ticker]["custo_total"] = 0.0
                elif carteira_temp[ticker]["quantidade"] > 0:
                    quantidade_comprada_excedente = carteira_temp[ticker]["quantidade"]
                    custo_da_parte_excedente = (custo_da_compra_atual_total / quantidade_op) * quantidade_comprada_excedente if quantidade_op != 0 else 0
                    carteira_temp[ticker]["custo_total"] = custo_da_parte_excedente
                else:
                    reducao_valor_pos_vendida = estado_anterior_preco_medio * quantidade_acoes_sendo_cobertas
                    carteira_temp[ticker]["custo_total"] = estado_anterior_custo_total - reducao_valor_pos_vendida
                    if carteira_temp[ticker]["custo_total"] < 0:
                        carteira_temp[ticker]["custo_total"] = 0.0
            else:
                carteira_temp[ticker]["quantidade"] += quantidade_op
                carteira_temp[ticker]["custo_total"] += custo_da_compra_atual_total
        elif op["operation"] == "sell":
            # DEBUG: Log do estado antes da venda
            logging.info(f"[CARTEIRA-DEBUG] VENDA {ticker}: Estado anterior -> Qtd: {estado_anterior_quantidade}, PM: {estado_anterior_preco_medio:.2f}")

            if estado_anterior_quantidade > 0:
                quantidade_vendida_da_posicao_comprada = min(estado_anterior_quantidade, quantidade_op)
                custo_a_baixar = estado_anterior_preco_medio * quantidade_vendida_da_posicao_comprada
                logging.info(f"[CARTEIRA-DEBUG] VENDA {ticker}: Vendendo {quantidade_vendida_da_posicao_comprada} da posição comprada, custo a baixar: {custo_a_baixar:.2f}")
                carteira_temp[ticker]["custo_total"] -= custo_a_baixar
                carteira_temp[ticker]["quantidade"] -= quantidade_vendida_da_posicao_comprada

                quantidade_op_restante_apos_vender_comprado = quantidade_op - quantidade_vendida_da_posicao_comprada
                if quantidade_op_restante_apos_vender_comprado > 0:
                    logging.info(f"[CARTEIRA-DEBUG] VENDA {ticker}: Quantidade restante para venda a descoberto: {quantidade_op_restante_apos_vender_comprado}")
                    proporcao_restante = quantidade_op_restante_apos_vender_comprado / quantidade_op if quantidade_op else 0
                    valor_venda_descoberto = valor_op_bruto * proporcao_restante
                    logging.info(f"[CARTEIRA-DEBUG] VENDA {ticker}: Valor venda descoberto: {valor_venda_descoberto:.2f}")
                    carteira_temp[ticker]["custo_total"] += valor_venda_descoberto
                    carteira_temp[ticker]["quantidade"] -= quantidade_op_restante_apos_vender_comprado
                    logging.info(f"[CARTEIRA-DEBUG] VENDA {ticker}: Após venda descoberto -> Qtd: {carteira_temp[ticker]['quantidade']}, Custo: {carteira_temp[ticker]['custo_total']:.2f}")
                if carteira_temp[ticker]["quantidade"] == 0:
                    carteira_temp[ticker]["custo_total"] = 0.0
            else:
                logging.info(f"[CARTEIRA-DEBUG] VENDA {ticker}: Posição zero/vendida, fazendo venda a descoberto direta")
                carteira_temp[ticker]["quantidade"] -= quantidade_op
                carteira_temp[ticker]["custo_total"] += valor_op_bruto
                if carteira_temp[ticker]["quantidade"] == 0:
                    carteira_temp[ticker]["custo_total"] = 0.0

        # DEBUG: Log APÓS da operação
        logging.info(f"[CARTEIRA-DEBUG] APÓS op {op.get('id', 'N/A')}: {ticker} | Qtd: {carteira_temp[ticker]['quantidade']}, Custo: {carteira_temp[ticker]['custo_total']:.2f}, PM: {carteira_temp[ticker]['preco_medio']:.2f}")
        logging.info(f"[CARTEIRA-DEBUG] ========================")

        # Recalcula o preço médio final da posição
        if carteira_temp[ticker]["quantidade"] > 0:
            carteira_temp[ticker]["preco_medio"] = carteira_temp[ticker]["custo_total"] / carteira_temp[ticker]["quantidade"]
        elif carteira_temp[ticker]["quantidade"] < 0:
            if abs(carteira_temp[ticker]["quantidade"]) > 0 and carteira_temp[ticker]["custo_total"] != 0:
                carteira_temp[ticker]["preco_medio"] = carteira_temp[ticker]["custo_total"] / abs(carteira_temp[ticker]["quantidade"])
            elif op["operation"] == "sell":
                carteira_temp[ticker]["preco_medio"] = op["price"]
            else:
                carteira_temp[ticker]["preco_medio"] = 0.0
        else:
            carteira_temp[ticker]["preco_medio"] = 0.0
            carteira_temp[ticker]["custo_total"] = 0.0

    # DEBUG: Log do resultado final
    for ticker, dados in carteira_temp.items():
        logging.info(f"[CARTEIRA-DEBUG] RESULTADO FINAL {ticker}: Qtd: {dados['quantidade']}, Custo: {dados['custo_total']:.2f}, PM: {dados['preco_medio']:.2f}")

    # Atualiza a carteira no banco de dados para o usuário
    for ticker, dados in carteira_temp.items():
        if dados["quantidade"] == 0:
            continue  # Não insere/atualiza tickers zerados
        if ticker in precos_editados:
            preco_medio_final = precos_editados[ticker]['preco_medio']
            custo_total_final = dados["quantidade"] * preco_medio_final
            preco_editado = True
            print(f"[recalcular_carteira] Preservando preço editado para {ticker}: PM={preco_medio_final}")
        else:
            preco_medio_final = dados["preco_medio"]
            custo_total_final = dados["custo_total"]
            preco_editado = False
        atualizar_carteira(ticker, dados["quantidade"], preco_medio_final, custo_total_final, usuario_id=usuario_id, preco_editado_pelo_usuario=preco_editado)


def recalcular_resultados(usuario_id: int) -> None:
    """
    Recalcula os resultados mensais de um usuário, consolidando os resultados
    das operações fechadas e aplicando as regras fiscais.
    """
    logging.info(f"Iniciando recálculo de resultados mensais para o usuário {usuario_id}.")

    limpar_resultados_mensais_usuario_db(usuario_id=usuario_id)
    operacoes_fechadas = calcular_operacoes_fechadas(usuario_id=usuario_id)
    
    resultados_por_mes = defaultdict(lambda: {
        "swing_trade": {"resultado": 0.0, "vendas_total": 0.0, "custo_swing": 0.0},
        "day_trade": {"resultado": 0.0, "vendas_total": 0.0, "irrf": 0.0, "custo_day_trade": 0.0}
    })

    for op in operacoes_fechadas:
        mes = op['data_fechamento'].strftime("%Y-%m")
        if op['day_trade']:
            resultados_por_mes[mes]['day_trade']['resultado'] += op['resultado']
            resultados_por_mes[mes]['day_trade']['custo_day_trade'] += op['valor_compra']
        else:
            resultados_por_mes[mes]['swing_trade']['resultado'] += op['resultado']
            resultados_por_mes[mes]['swing_trade']['vendas_total'] += op['valor_venda']
            resultados_por_mes[mes]['swing_trade']['custo_swing'] += op['valor_compra']

    prejuizo_acumulado_swing = 0.0
    prejuizo_acumulado_day = 0.0

    for mes_str in sorted(resultados_por_mes.keys()):
        res_mes = resultados_por_mes[mes_str]
        
        vendas_swing = res_mes['swing_trade']['vendas_total']
        isento_swing = vendas_swing <= 20000.0
        
        resultado_swing = res_mes['swing_trade']['resultado']
        ganho_tributavel_swing = resultado_swing if not isento_swing and resultado_swing > 0 else 0
            
        valor_a_compensar_swing = min(prejuizo_acumulado_swing, ganho_tributavel_swing)
        ganho_final_swing = ganho_tributavel_swing - valor_a_compensar_swing
        prejuizo_acumulado_swing = (prejuizo_acumulado_swing - valor_a_compensar_swing) + abs(min(0, resultado_swing))
        
        imposto_swing = max(0, ganho_final_swing) * 0.15

        resultado_day = res_mes['day_trade']['resultado']
        valor_a_compensar_day = min(prejuizo_acumulado_day, max(0, resultado_day))
        ganho_final_day = resultado_day - valor_a_compensar_day
        prejuizo_acumulado_day = (prejuizo_acumulado_day - valor_a_compensar_day) + abs(min(0, resultado_day))

        imposto_bruto_day = max(0, ganho_final_day) * 0.20
        irrf_day = res_mes['day_trade']['irrf']
        imposto_day = max(0, imposto_bruto_day - irrf_day)

        resultado_dict = {
            "mes": mes_str,
            "vendas_swing": vendas_swing,
            "custo_swing": res_mes['swing_trade']['custo_swing'],
            "ganho_liquido_swing": resultado_swing,
            "isento_swing": isento_swing,
            "prejuizo_acumulado_swing": prejuizo_acumulado_swing,
            "ir_devido_swing": imposto_swing,
            "ir_pagar_swing": imposto_swing if imposto_swing >= 10 else 0,
            
            "vendas_day_trade": res_mes['day_trade']['vendas_total'],
            "custo_day_trade": res_mes['day_trade']['custo_day_trade'],
            "ganho_liquido_day": resultado_day,
            "prejuizo_acumulado_day": prejuizo_acumulado_day,
            "irrf_day": irrf_day,
            "ir_devido_day": imposto_bruto_day,
            "ir_pagar_day": imposto_day if imposto_day >= 10 else 0,
        }
        salvar_resultado_mensal(resultado_dict, usuario_id=usuario_id)

    logging.info(f"Resultados mensais para o usuário {usuario_id} recalculados e salvos.")

def listar_operacoes_service(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Serviço para listar todas as operações de um usuário, incluindo informações de importação.
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
    top_prejuizo = sorted(operacoes_prejuizo, key=lambda x: x.get("resultado", 0))[:5] # Ordena por menor resultado para

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
    Serviço para deletar todas as operações de um usuário e limpar todos os dados relacionados 
    (proventos, carteira, resultados, resumos, histórico de preços e importações).
    
    A limpeza das importações permite reutilizar os mesmos arquivos no futuro.
    """
    deleted_count = remover_todas_operacoes_usuario(usuario_id=usuario_id)

    # Limpa proventos recebidos e resumos de proventos
    limpar_usuario_proventos_recebidos_db(usuario_id=usuario_id)
    limpar_carteira_usuario_db(usuario_id=usuario_id)
    limpar_resultados_mensais_usuario_db(usuario_id=usuario_id)
    
    # Limpa operações fechadas
    limpar_operacoes_fechadas_usuario(usuario_id=usuario_id)
    
    # Limpa histórico de alterações de preço médio
    historico_removido = limpar_historico_preco_medio_usuario(usuario_id=usuario_id)
    
    # Limpa todas as importações do usuário para permitir reutilização dos arquivos
    importacoes_removidas = limpar_importacoes_usuario(usuario_id=usuario_id)
    
    # Se existirem funções para limpar resumos de proventos, chame aqui
    # limpar_resumo_anual_proventos_usuario_db(usuario_id=usuario_id)
    # limpar_resumo_mensal_proventos_usuario_db(usuario_id=usuario_id)
    # limpar_resumo_por_acao_proventos_usuario_db(usuario_id=usuario_id)

    return {
        "mensagem": f"{deleted_count} operações, {importacoes_removidas} importações, {historico_removido} registros de histórico de preços e todos os dados relacionados foram removidos com sucesso.",
        "deleted_count": deleted_count,
        "importacoes_removidas": importacoes_removidas,
        "historico_preco_removido": historico_removido
    }

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
        # ou o tipo de darf era inválido (já verificado), ou o status já era o new_status.
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
        if op.operation == "buy":
            total_investido_historico += op.quantity * op.price + op.fees
            operacoes_compra_total_quantidade += op.quantity
        elif op.operation == "sell":
            total_vendido_historico += op.quantity * op.price - op.fees
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

    # Get stock info including name
    acao_info = obter_acao_info_por_ticker(ticker_upper)
    nome_acao = acao_info.get('nome') if acao_info else None

    return ResultadoTicker(
        ticker=ticker_upper,
        nome_acao=nome_acao,
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

    # ProventoInfo espera objetos date. A transformação garante que as datas sejam objetos date.
    dados_transformados = _transformar_provento_db_para_modelo(provento_db)
    if not dados_transformados:
        # Isso aconteceria se provento_db fosse None e _transformar_provento_db_para_modelo retornasse None.
        raise HTTPException(status_code=500, detail="Erro ao buscar ou transformar provento recém-criado.")

    return ProventoInfo.model_validate(dados_transformados)


def listar_proventos_por_acao_service(id_acao: int) -> List[ProventoInfo]:
    """
    Lista todos os proventos para uma ação específica.
    Verifica se a ação existe antes de listar os proventos.
    """
    acao_existente = obter_acao_por_id(id_acao)
    if not acao_existente:
        raise HTTPException(status_code=404, detail=f"Ação com ID {id_acao} não encontrada.")

    proventos_db = obter_proventos_por_acao_id(id_acao)
    proventos_validados = []
    if proventos_db: # Add check if proventos_db can be None or empty
        for p_db_item in proventos_db:
            dados_transformados = _transformar_provento_db_para_modelo(p_db_item)
            if dados_transformados is not None:
                try:
                    proventos_validados.append(ProventoInfo.model_validate(dados_transformados))
                except Exception as e: # Idealmente, capturar pydantic.ValidationError
                    logging.error(f"Erro de validação para ProventoInfo (ação ID: {id_acao}) com dados do DB {p_db_item}: {e}", exc_info=True)
                    # Continuar processando outros proventos
    return proventos_validados


def listar_todos_proventos_service() -> List[ProventoInfo]:
    """
    Lista todos os proventos de todas as ações.
    """
    proventos_db = obter_todos_proventos()
    proventos_validados = []
    if proventos_db: # Add check if proventos_db can be None or empty
        for p_db_item in proventos_db:
            dados_transformados = _transformar_provento_db_para_modelo(p_db_item)
            if dados_transformados is not None:
                try:
                    proventos_validados.append(ProventoInfo.model_validate(dados_transformados))
                except Exception as e: # Idealmente, capturar pydantic.ValidationError
                    logging.error(f"Erro de validação para ProventoInfo com dados do DB {p_db_item}: {e}", exc_info=True)
                    # Continuar processando outros proventos
    return proventos_validados


# Refatorado para usar dados da tabela usuario_proventos_recebidos
def listar_proventos_recebidos_pelo_usuario_service(usuario_id: int) -> List[UsuarioProventoRecebidoDB]:
    """
    Lista os proventos que um usuário recebeu, buscando da tabela persistida.
    """
    proventos_db_dicts = obter_proventos_recebidos_por_usuario_db(usuario_id)

    proventos_validados = []
    for p_db_dict in proventos_db_dicts:
        try:
            # Corrigir valor_unitario_provento se vier como string com vírgula
            v = p_db_dict['valor_unitario_provento'] if 'valor_unitario_provento' in p_db_dict else None
            if isinstance(v, str):
                v = v.replace(',', '.')
                try:
                    v = float(v)
                except Exception:
                    v = 0.0
                p_db_dict['valor_unitario_provento'] = v
            proventos_validados.append(UsuarioProventoRecebidoDB.model_validate(p_db_dict))
        except Exception as e:
            logging.error(f"Erro ao validar provento recebido do DB ID {p_db_dict['id'] if 'id' in p_db_dict else None} para usuario {usuario_id}: {e}", exc_info=True)
            continue

    return proventos_validados


# --- Serviços de Resumo de Proventos (Refatorados) ---

def gerar_resumo_proventos_anuais_usuario_service(usuario_id: int) -> List[ResumoProventoAnual]:
    """
    Gera um resumo anual dos proventos recebidos por um usuário,
    utilizando dados agregados do banco de dados.
    """
    raw_summary = obter_resumo_anual_proventos_recebidos_db(usuario_id)
    if not raw_summary:
        return []

    resumo_por_ano = defaultdict(lambda: {
        "total_dividendos": 0.0,
        "total_jcp": 0.0,
        "total_outros": 0.0,
        "total_geral": 0.0,
        "acoes_dict": defaultdict(lambda: {
            "nome_acao": "",
            "total_recebido_na_acao": 0.0,
            "tipos": defaultdict(float)
        })
    })

    for item in raw_summary:
        ano = int(item['ano_pagamento'])
        ticker = item['ticker_acao']
        nome_acao = item['nome_acao'] if item['nome_acao'] else ticker
        tipo_provento = item['tipo_provento'].upper()
        total_recebido_ticker_tipo_ano = item['total_recebido_ticker_tipo_ano']

        resumo_por_ano[ano]['total_geral'] += total_recebido_ticker_tipo_ano
        if tipo_provento == "DIVIDENDO":
            resumo_por_ano[ano]['total_dividendos'] += total_recebido_ticker_tipo_ano
        elif "JCP" in tipo_provento or "JUROS SOBRE CAPITAL" in tipo_provento: # Ajuste para JCP
            resumo_por_ano[ano]['total_jcp'] += total_recebido_ticker_tipo_ano
        else:
            resumo_por_ano[ano]['total_outros'] += total_recebido_ticker_tipo_ano

        if not resumo_por_ano[ano]['acoes_dict'][ticker]['nome_acao']:
             resumo_por_ano[ano]['acoes_dict'][ticker]['nome_acao'] = nome_acao

        resumo_por_ano[ano]['acoes_dict'][ticker]['total_recebido_na_acao'] += total_recebido_ticker_tipo_ano
        resumo_por_ano[ano]['acoes_dict'][ticker]['tipos'][tipo_provento] += total_recebido_ticker_tipo_ano

    lista_resumo_anual_final = []
    for ano, dados_ano in sorted(resumo_por_ano.items(), key=lambda item: item[0], reverse=True):
        acoes_detalhadas_list = []
        for ticker, dados_acao in dados_ano['acoes_dict'].items():
            detalhes_por_tipo_list = [
                DetalheTipoProvento(tipo=tipo, valor_total_tipo=valor_tipo)
                for tipo, valor_tipo in dados_acao['tipos'].items()
            ]
            acoes_detalhadas_list.append({
                "ticker": ticker,
                "nome_acao": dados_acao["nome_acao"],
                "total_recebido_na_acao": dados_acao["total_recebido_na_acao"],
                "detalhes_por_tipo": detalhes_por_tipo_list
            })

        resumo_anual_obj = ResumoProventoAnual(
            ano=ano,
            total_dividendos=dados_ano["total_dividendos"],
            total_jcp=dados_ano["total_jcp"],
            total_outros=dados_ano["total_outros"],
            total_geral=dados_ano["total_geral"],
            acoes_detalhadas=acoes_detalhadas_list
        )
        lista_resumo_anual_final.append(resumo_anual_obj)

    return lista_resumo_anual_final


def gerar_resumo_proventos_mensais_usuario_service(usuario_id: int, ano_filtro: int) -> List[ResumoProventoMensal]:
    """
    Gera um resumo mensal dos proventos recebidos por um usuário para um ano específico,
    utilizando dados agregados do banco de dados.
    """
    raw_summary = obter_resumo_mensal_proventos_recebidos_db(usuario_id, ano_filtro)
    if not raw_summary:
        return []

    resumo_por_mes = defaultdict(lambda: {
        "total_dividendos": 0.0,
        "total_jcp": 0.0,
        "total_outros": 0.0,
        "total_geral": 0.0,
        "acoes_dict": defaultdict(lambda: {
            "nome_acao": "",
            "total_recebido_na_acao": 0.0,
            "tipos": defaultdict(float)
        })
    })

    for item in raw_summary:
        mes_str = item['mes_pagamento']
        ticker = item['ticker_acao']
        nome_acao = item['nome_acao'] if item['nome_acao'] else ticker
        tipo_provento = item['tipo_provento'].upper()
        total_recebido = item['total_recebido_ticker_tipo_mes']

        resumo_por_mes[mes_str]['total_geral'] += total_recebido
        if tipo_provento == "DIVIDENDO":
            resumo_por_mes[mes_str]['total_dividendos'] += total_recebido
        elif "JCP" in tipo_provento or "JUROS SOBRE CAPITAL" in tipo_provento:
            resumo_por_mes[mes_str]['total_jcp'] += total_recebido
        else:
            resumo_por_mes[mes_str]['total_outros'] += total_recebido

        if not resumo_por_mes[mes_str]['acoes_dict'][ticker]['nome_acao']:
            resumo_por_mes[mes_str]['acoes_dict'][ticker]['nome_acao'] = nome_acao

        resumo_por_mes[mes_str]['acoes_dict'][ticker]['total_recebido_na_acao'] += total_recebido
        resumo_por_mes[mes_str]['acoes_dict'][ticker]['tipos'][tipo_provento] += total_recebido

    lista_resumo_mensal_final = []
    for mes_str, dados_mes in sorted(resumo_por_mes.items(), key=lambda item: item[0], reverse=True):
        acoes_detalhadas_list = []
        for ticker, dados_acao in dados_mes['acoes_dict'].items():
            detalhes_por_tipo_list = [
                DetalheTipoProvento(tipo=tipo, valor_total_tipo=valor_tipo)
                for tipo, valor_tipo in dados_acao['tipos'].items()
            ]
            acoes_detalhadas_list.append({
                "ticker": ticker,
                "nome_acao": dados_acao["nome_acao"] or None,
                "total_recebido_na_acao": dados_acao["total_recebido_na_acao"],
                "detalhes_por_tipo": detalhes_por_tipo_list
            })

        resumo_mensal_obj = ResumoProventoMensal(
            mes=mes_str,
            total_dividendos=dados_mes["total_dividendos"],
            total_jcp=dados_mes["total_jcp"],
            total_outros=dados_mes["total_outros"],
            total_geral=dados_mes["total_geral"],
            acoes_detalhadas=acoes_detalhadas_list
        )
        lista_resumo_mensal_final.append(resumo_mensal_obj)

    return lista_resumo_mensal_final


def gerar_resumo_proventos_por_acao_usuario_service(usuario_id: int) -> List[ResumoProventoPorAcao]:
    """
    Gera um resumo dos proventos recebidos por um usuário, agrupados por ação,
    utilizando dados agregados do banco de dados.
    """
    raw_summary = obter_resumo_por_acao_proventos_recebidos_db(usuario_id)
    if not raw_summary:
        return []

    resumo_agregado_por_acao = defaultdict(lambda: {
        "nome_acao": "",
        "total_recebido_geral_acao": 0.0,
        "tipos_dict": defaultdict(float)
    })

    for item in raw_summary:
        ticker = item['ticker_acao']
        nome_acao = item['nome_acao']
        tipo_provento = item['tipo_provento'].upper()
        total_recebido_tipo = item['total_recebido_ticker_tipo']

        if not resumo_agregado_por_acao[ticker]['nome_acao'] and nome_acao:
             resumo_agregado_por_acao[ticker]['nome_acao'] = nome_acao

        resumo_agregado_por_acao[ticker]['total_recebido_geral_acao'] += total_recebido_tipo
        resumo_agregado_por_acao[ticker]['tipos_dict'][tipo_provento] += total_recebido_tipo

    lista_resumo_acao_final = []
    for ticker, dados_acao in resumo_agregado_por_acao.items():
        detalhes_por_tipo_list = [
            DetalheTipoProvento(tipo=tipo, valor_total_tipo=valor_tipo)
            for tipo, valor_tipo in dados_acao['tipos_dict'].items()
        ]

        resumo_acao_obj = ResumoProventoPorAcao(
            ticker_acao=ticker,
            nome_acao=dados_acao["nome_acao"] or None,
            total_recebido_geral_acao=dados_acao["total_recebido_geral_acao"],
            detalhes_por_tipo=detalhes_por_tipo_list
        )
        lista_resumo_acao_final.append(resumo_acao_obj)

    return sorted(lista_resumo_acao_final, key=lambda x: x.total_recebido_geral_acao, reverse=True)


# --- Serviços de Eventos Corporativos ---

def registrar_evento_corporativo_service(id_acao_url: int, evento_in: EventoCorporativoCreate) -> EventoCorporativoInfo:
    """
    Registra um novo evento corporativo para uma ação específica.
    """
    if id_acao_url != evento_in.id_acao:
        raise HTTPException(status_code=400, detail="ID da ação na URL não corresponde ao ID no corpo da requisição.")

    acao_existente = obter_acao_por_id(evento_in.id_acao)
    if not acao_existente:
        raise HTTPException(status_code=404, detail=f"Ação com ID {evento_in.id_acao} não encontrada.")

    # Os validadores em EventoCorporativoCreate já converteram as datas para objetos date ou None.
    # Para o banco, as datas precisam ser strings no formato ISO ou None.
    evento_data_db = {
        "id_acao": evento_in.id_acao,
        "evento": evento_in.evento,
        "razao": evento_in.razao, # Pode ser None
        "data_aprovacao": evento_in.data_aprovacao.isoformat() if evento_in.data_aprovacao else None,
        "data_registro": evento_in.data_registro.isoformat() if evento_in.data_registro else None,
        "data_ex": evento_in.data_ex.isoformat() if evento_in.data_ex else None,
    }

    new_evento_id = inserir_evento_corporativo(evento_data_db)
    evento_db = obter_evento_corporativo_por_id(new_evento_id)

    if not evento_db:
        raise HTTPException(status_code=500, detail="Erro ao buscar evento corporativo recém-criado.")

    # EventoCorporativoInfo espera objetos date, e obter_evento_corporativo_por_id retorna strings ISO do DB.
    # Pydantic model_validate irá analisar as strings ISO para objetos date automaticamente.
    return EventoCorporativoInfo.model_validate(evento_db)


def listar_eventos_corporativos_por_acao_service(id_acao: int) -> List[EventoCorporativoInfo]:
    """
    Lista todos os eventos corporativos para uma ação específica.
    """
    acao_existente = obter_acao_por_id(id_acao)
    if not acao_existente:
        raise HTTPException(status_code=404, detail=f"Ação com ID {id_acao} não encontrada.")

    eventos_db = obter_eventos_corporativos_por_acao_id(id_acao)
    # Pydantic model_validate irá analisar as strings ISO de data para objetos date.
    return [EventoCorporativoInfo.model_validate(e) for e in eventos_db]


# --- Serviço de Recálculo de Proventos Recebidos pelo Usuário (Rápido) ---
def recalcular_proventos_recebidos_rapido(usuario_id: int) -> Dict[str, Any]:
    import logging
    import traceback
    
    # Log detalhado da origem da chamada
    stack_trace = traceback.format_stack()
    caller_info = stack_trace[-2] if len(stack_trace) > 1 else "unknown"
    logging.info(f"[PROVENTO-TRACE] recalcular_proventos_recebidos_rapido chamado para usuário {usuario_id}. Origem: {caller_info.strip()}")
    
    print(f"[Proventos Rápido] Iniciando recálculo para usuário ID: {usuario_id}")

    limpar_usuario_proventos_recebidos_db(usuario_id)
    print(f"[Proventos Rápido] Registros antigos de proventos limpos para usuário ID: {usuario_id}")

    tickers = obter_tickers_operados_por_usuario(usuario_id)
    print(f"[Proventos Rápido] Tickers operados por usuário {usuario_id}: {tickers}")

    verificados = 0
    calculados = 0
    erros = 0

    for ticker in tickers:
        print(f"[Proventos Rápido] Processando ticker: {ticker} para usuário {usuario_id}")
        try:
            primeira_data = obter_primeira_data_operacao_usuario(usuario_id, ticker)
            if not primeira_data:
                print(f"[Proventos Rápido] Nenhuma operação encontrada para {ticker}. Pulando.")
                continue

            proventos = obter_proventos_por_ticker(ticker)
            proventos = [p for p in proventos if p.get("data_ex") and p["data_ex"] >= primeira_data]
        except Exception as e:
            print(f"[Proventos Rápido] Erro ao obter proventos para o ticker {ticker}: {e}")
            erros += 1
            continue

        for prov in proventos:
            try:
                verificados += 1
                data_ex = prov.get("data_ex")
                if not data_ex:
                    print(f"[Proventos Rápido] Provento ID {prov['id']} sem data_ex. Pulando.")
                    continue

                if isinstance(data_ex, str):
                    data_ex = date.fromisoformat(data_ex)

                operacoes = obter_operacoes_por_ticker_ate_data_db(usuario_id, ticker, data_ex.isoformat())
                quantidade = 0
                for op in operacoes:
                    if op["operation"].lower() == "buy":
                        quantidade += op["quantity"]
                    elif op["operation"].lower() == "sell":
                        quantidade -= op["quantity"]

                if quantidade > 0:
                    valor_str = str(prov["valor"]).replace(",", ".")
                    try:
                        valor_unitario = float(valor_str)
                    except ValueError:
                        print(f"[Proventos Rápido] valor inválido no provento ID {prov['id']} do ticker {ticker}: {prov['valor']}")
                        erros += 1
                        continue

                    valor_total = round(quantidade * valor_unitario, 2)
                    inserir_usuario_provento_recebido_db(usuario_id, prov["id"], quantidade, valor_total)
                    calculados += 1


            except Exception as e:
                print(f"[Proventos Rápido] Erro ao processar provento ID {prov['id'] if 'id' in prov else None} do ticker {ticker}: {e}")
                erros += 1

    print(f"[Proventos Rápido] Fim do recálculo. Verificados: {verificados}, Calculados: {calculados}, Erros: {erros}")
    return {
        "verificados": verificados,
        "calculados": calculados,
        "erros": erros
    }
# --- Serviço de Recálculo de Proventos Recebidos pelo Usuário ---

def recalcular_proventos_recebidos_para_usuario_service(usuario_id: int) -> Dict[str, Any]:
    """
    Limpa e recalcula todos os proventos que um usuário teria recebido,
    armazenando-os na tabela usuario_proventos_recebidos.
    """
    # 1. Limpar registros existentes para o usuário
    limpar_usuario_proventos_recebidos_db(usuario_id)

    # 2. Obter todos os proventos globais
    # A função listar_todos_proventos_service já retorna List[ProventoInfo] com datas e valor corretos
    proventos_globais: List[ProventoInfo] = listar_todos_proventos_service()

    proventos_calculados = 0
    proventos_ignorados_sem_data_ex = 0
    erros_insercao = 0
    # import logging # Descomente para logs detalhados
    # logging.basicConfig(level=logging.INFO)

    # 3. Iterar sobre proventos globais e calcular/inserir para o usuário
    for provento_global in proventos_globais:
        if provento_global.data_ex is None:
            proventos_ignorados_sem_data_ex += 1
            # logging.info(f"Provento ID {provento_global.id} pulado: data_ex ausente.")
            continue

        acao_info = obter_acao_por_id(provento_global.id_acao)

        if not acao_info or not acao_info.get('ticker'):
            # logging.warning(f"Provento ID {provento_global.id}: Ação ID {provento_global.id_acao} ou ticker não encontrado. Pulando.")
            continue

        ticker_da_acao = acao_info['ticker']
        nome_da_acao = acao_info.get('nome') # nome_acao pode ser None

        # data_ex já é um objeto date aqui, vindo de ProventoInfo
        # CORREÇÃO: Usar data_ex diretamente sem subtrair 1 dia
        data_para_saldo = provento_global.data_ex

        quantidade_na_data_ex = obter_saldo_acao_em_data(
            usuario_id=usuario_id,
            ticker=ticker_da_acao,
            data_limite=data_para_saldo
        )

        if quantidade_na_data_ex > 0:
            valor_unit_provento = provento_global.valor or 0.0 # valor já é float em ProventoInfo
            valor_total_recebido = quantidade_na_data_ex * valor_unit_provento

            dados_para_inserir = {
                'usuario_id': usuario_id,
                'provento_global_id': provento_global.id,
                'id_acao': provento_global.id_acao,
                'ticker_acao': ticker_da_acao,
                'nome_acao': nome_da_acao, # Pode ser None
                'tipo_provento': provento_global.tipo,
                'data_ex': provento_global.data_ex.isoformat(), # Convertendo date para string ISO
                'dt_pagamento': provento_global.dt_pagamento.isoformat() if provento_global.dt_pagamento else None, # Convertendo date para string ISO
                'valor_unitario_provento': valor_unit_provento,
                'quantidade_possuida_na_data_ex': quantidade_na_data_ex,
                'valor_total_recebido': valor_total_recebido,
                'data_calculo': dt.now().isoformat() # Usando dt (alias de datetime) para datetime.now()
            }

            try:
                inserir_usuario_provento_recebido_db(
                    usuario_id=usuario_id,
                    provento_global_id=provento_global.id,
                    quantidade=quantidade_na_data_ex,
                    valor_total=valor_total_recebido
                )
                proventos_calculados += 1
            except sqlite3.IntegrityError:
                erros_insercao += 1
                # logging.warning(f"Erro de integridade ao inserir provento recebido para usuario_id {usuario_id}, provento_global_id {provento_global.id}. Provavelmente duplicado.")
            except Exception as e:
                erros_insercao += 1
                # logging.error(f"Erro inesperado ao inserir provento recebido para usuario_id {usuario_id}, provento_global_id {provento_global.id}: {e}")


    return {
        "mensagem": "Recálculo de proventos recebidos concluído.",
        "proventos_processados_do_sistema": len(proventos_globais),
        "proventos_efetivamente_calculados_para_usuario": proventos_calculados,
        "proventos_globais_ignorados_sem_data_ex": proventos_ignorados_sem_data_ex,
        "erros_ao_inserir_duplicatas_ou_outros": erros_insercao
    }


# --- Funções de Cálculo Auxiliares ---

def obter_saldo_acao_em_data(usuario_id: int, ticker: str, data_limite: date) -> int:
    """
    Calcula o saldo (quantidade) de uma ação específica para um usuário em uma data limite.
    """
    data_limite_str = data_limite.isoformat()
    operacoes_db = obter_operacoes_por_ticker_ate_data_db(
        usuario_id=usuario_id,
        ticker=ticker.upper(),
        data_ate=data_limite_str
    )

    saldo = 0
    for op in operacoes_db:
        if op['operation'] == 'buy':
            saldo += op['quantity']
        elif op['operation'] == 'sell':
            saldo -= op['quantity']
    return saldo


def listar_todos_eventos_corporativos_service() -> List[EventoCorporativoInfo]:
    """
    Lista todos os eventos corporativos de todas as ações.
    """
    eventos_db = obter_todos_eventos_corporativos()
    # Pydantic model_validate irá analisar as strings ISO de data para objetos date.
    return [EventoCorporativoInfo.model_validate(e) for e in eventos_db]


# --- Funções de Importação ---

def processar_importacao_com_deteccao_duplicatas(
    operacoes: List[OperacaoCreate],
    usuario_id: int,
    nome_arquivo: str,
    conteudo_arquivo: bytes,
    nome_arquivo_original: str = None
) -> Dict[str, Any]:
    """
    Processa uma importação completa com detecção de duplicatas
    """
    inicio_tempo = time.time()
    
    # Calcular hash do arquivo
    hash_arquivo = calcular_hash_arquivo(conteudo_arquivo)
    
    # Verificar se arquivo já foi importado
    importacao_existente = verificar_arquivo_ja_importado(usuario_id, hash_arquivo)
    if importacao_existente:
        raise HTTPException(
            status_code=400, 
            detail=f"Este arquivo já foi importado em {importacao_existente['data_importacao']}. "
                   f"Importação ID: {importacao_existente['id']}"
        )
    
    # Registrar a importação
    importacao_id = inserir_importacao(
        usuario_id=usuario_id,
        nome_arquivo=nome_arquivo,
        nome_arquivo_original=nome_arquivo_original,
        tamanho_arquivo=len(conteudo_arquivo),
        total_operacoes_arquivo=len(operacoes),
        hash_arquivo=hash_arquivo
    )
    
    operacoes_importadas = 0
    operacoes_duplicadas = []
    erros_processamento = []
    
    try:
        for idx, operacao in enumerate(operacoes):
            try:
                # Verificar duplicata
                operacao_existente = detectar_operacao_duplicada(
                    usuario_id=usuario_id,
                    data=operacao.date.isoformat() if hasattr(operacao.date, 'isoformat') else operacao.date,
                    ticker=operacao.ticker,
                    operacao=operacao.operation,
                    quantidade=operacao.quantity,
                    preco=operacao.price
                )
                
                if operacao_existente:
                    # Operação duplicada encontrada
                    operacoes_duplicadas.append({
                        'linha_arquivo': idx + 1,
                        'data': operacao.date.isoformat() if hasattr(operacao.date, 'isoformat') else operacao.date,
                        'ticker': operacao.ticker,
                        'operacao': operacao.operation,
                        'quantidade': operacao.quantity,
                        'preco': operacao.price,
                        'motivo_duplicacao': "Operação idêntica já existe no banco de dados",
                        'operacao_existente_id': operacao_existente['id']
                    })
                    continue
                
                # Inserir operação
                inserir_operacao(
                    operacao=operacao.model_dump(),
                    usuario_id=usuario_id,
                    importacao_id=importacao_id
                )
                operacoes_importadas += 1
                
            except Exception as e:
                erros_processamento.append(f"Linha {idx + 1}: {str(e)}")
        
        # Calcular tempo de processamento
        tempo_processamento = int((time.time() - inicio_tempo) * 1000)
        
        # Atualizar status da importação
        status = "concluida" if not erros_processamento else "erro"
        observacoes = None
        if operacoes_duplicadas:
            observacoes = f"{len(operacoes_duplicadas)} operações duplicadas ignoradas"
        if erros_processamento:
            if observacoes:
                observacoes += f"; {len(erros_processamento)} erros de processamento"
            else:
                observacoes = f"{len(erros_processamento)} erros de processamento"
        
        atualizar_status_importacao(
            importacao_id=importacao_id,
            status=status,
            total_importadas=operacoes_importadas,
            total_duplicadas=len(operacoes_duplicadas),
            total_erro=len(erros_processamento),
            observacoes=observacoes,
            tempo_processamento_ms=tempo_processamento
        )
        
        # Recalcular carteira e resultados se houve operações importadas
        if operacoes_importadas > 0:
            recalcular_carteira(usuario_id=usuario_id)
            recalcular_resultados(usuario_id=usuario_id)
        
        # Obter dados atualizados da importação
        importacao_final = obter_importacao_por_id(importacao_id)
        
        return {
            'importacao': importacao_final,
            'operacoes_duplicadas': operacoes_duplicadas,
            'erros_processamento': erros_processamento,
            'sucesso': len(erros_processamento) == 0,
            'mensagem': f"Importação concluída: {operacoes_importadas} operações importadas, "
                       f"{len(operacoes_duplicadas)} duplicadas ignoradas, "
                       f"{len(erros_processamento)} erros"
        }
        
    except Exception as e:
        # Em caso de erro crítico, marcar importação como erro
        atualizar_status_importacao(
            importacao_id=importacao_id,
            status="erro",
            observacoes=f"Erro crítico durante processamento: {str(e)}"
        )
        raise HTTPException(status_code=500, detail=f"Erro durante importação: {str(e)}")


def listar_historico_importacoes_service(usuario_id: int, limite: int = 50) -> List[Dict[str, Any]]:
    """Lista o histórico de importações do usuário"""
    return listar_importacoes_usuario(usuario_id, limite)


def obter_detalhes_importacao_service(importacao_id: int, usuario_id: int) -> Dict[str, Any]:
    """Obtém detalhes completos de uma importação"""
    importacao = obter_importacao_por_id(importacao_id)
    if not importacao:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    
    if importacao['usuario_id'] != usuario_id:
        raise HTTPException(status_code=403, detail="Acesso negado a esta importação")
    
    # Obter operações da importação
    operacoes = obter_operacoes_por_importacao(importacao_id)
    
    return {
        "importacao": importacao,
        "operacoes": operacoes
    }


def reverter_importacao_service(importacao_id: int, usuario_id: int) -> Dict[str, Any]:
    """Reverte uma importação, removendo todas as operações importadas"""
    importacao = obter_importacao_por_id(importacao_id)
    if not importacao:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    
    if importacao['usuario_id'] != usuario_id:
        raise HTTPException(status_code=403, detail="Acesso negado a esta importação")
    
    if importacao['status'] != 'concluida':
        raise HTTPException(status_code=400, detail="Apenas importações concluídas podem ser revertidas")
    
    # Remover operações
    operacoes_removidas = remover_operacoes_por_importacao(importacao_id, usuario_id)
    
    # Atualizar status da importação
    atualizar_status_importacao(
        importacao_id=importacao_id,
        status="cancelada",
        observacoes=f"Importação revertida. {operacoes_removidas} operações removidas."
    )
    
    return {
        "mensagem": f"Importação {importacao_id} revertida com sucesso",
        "operacoes_removidas": operacoes_removidas
    }
def parse_date_to_iso(date_val):
    if not date_val:
        return None
    if isinstance(date_val, date):
        return date_val.isoformat()
    if isinstance(date_val, datetime):
        return date_val.date().isoformat()
    try:
        return datetime.strptime(str(date_val).split('T')[0], '%Y-%m-%d').date().isoformat()
    except Exception:
        try:
            return datetime.strptime(str(date_val), '%d/%m/%Y').date().isoformat()
        except Exception:
            return None

def analisar_duplicatas_service(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Serviço para analisar duplicatas de operações de um usuário.
    """
    return analisar_duplicatas_usuario(usuario_id)

def verificar_estrutura_importacao_service() -> Dict[str, Any]:
    """
    Serviço para verificar se a estrutura de importação está correta.
    Função temporária para debug.
    """
    return verificar_estrutura_importacao()

def limpar_importacoes_service(usuario_id: int) -> Dict[str, Any]:
    """
    Serviço para limpar todas as importações de um usuário.
    Isso permite reutilizar os mesmos arquivos de importação no futuro.
    """
    importacoes_removidas = limpar_importacoes_usuario(usuario_id)
    return {
        "mensagem": f"{importacoes_removidas} importações foram removidas com sucesso. Agora você pode reutilizar os mesmos arquivos.",
        "importacoes_removidas": importacoes_removidas
    }

def obter_preco_medio_ponderado_carteira(usuario_id: int) -> float:
    """
    Obtém o preço médio ponderado da carteira atual de um usuário.
    O preço médio é calculado como o custo total das ações dividido pela quantidade total de ações.
    Apenas ações com quantidade positiva são consideradas.
    
    Args:
        usuario_id: ID do usuário.
        
    Returns:
        float: Preço médio ponderado da carteira.
    """
    carteira_atual = obter_carteira_atual(usuario_id)
    
    if not carteira_atual:
        return 0.0
    
    custo_total = 0.0
    quantidade_total = 0.0
    
    for acao in carteira_atual:
        quantidade = acao["quantidade"] if "quantidade" in acao else 0
        preco_medio = acao["preco_medio"] if "preco_medio" in acao else 0.0
        
        if quantidade > 0:
            custo_total += quantidade * preco_medio
            quantidade_total += quantidade
    
    if quantidade_total == 0:
        return 0.0
    
    return custo_total / quantidade_total

def obter_prejuizo_acumulado_anterior(usuario_id: int, tipo: str, mes_atual: str = None) -> float:
    """
    Obtém o prejuízo acumulado de meses anteriores para um tipo específico.
    
    Args:
        usuario_id: ID do usuário
        tipo: Tipo de operação ('swing' ou 'day')
        mes_atual: Mês atual no formato YYYY-MM (opcional)
    
    Returns:
        float: Valor do prejuízo acumulado
    """
    from database import get_db
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        if mes_atual:
            # Buscar apenas meses anteriores ao mês atual
            if tipo == "swing":
                cursor.execute('''
                    SELECT COALESCE(prejuizo_acumulado_swing, 0.0) as prejuizo
                    FROM resultados_mensais 
                    WHERE usuario_id = ? AND mes < ?
                    ORDER BY mes DESC 
                    LIMIT 1
                ''', (usuario_id, mes_atual))
            else:  # day trade
                cursor.execute('''
                    SELECT COALESCE(prejuizo_acumulado_day, 0.0) as prejuizo
                    FROM resultados_mensais 
                    WHERE usuario_id = ? AND mes < ?
                    ORDER BY mes DESC 
                    LIMIT 1
                ''', (usuario_id, mes_atual))
        else:
            # Buscar o último mês disponível (comportamento antigo)
            if tipo == "swing":
                cursor.execute('''
                    SELECT COALESCE(prejuizo_acumulado_swing, 0.0) as prejuizo
                    FROM resultados_mensais 
                    WHERE usuario_id = ? 
                    ORDER BY mes DESC 
                    LIMIT 1
                ''', (usuario_id,))
            else:  # day trade
                cursor.execute('''
                    SELECT COALESCE(prejuizo_acumulado_day, 0.0) as prejuizo
                    FROM resultados_mensais 
                    WHERE usuario_id = ? 
                    ORDER BY mes DESC 
                    LIMIT 1
                ''', (usuario_id,))
        
        result = cursor.fetchone()
        # DEBUG: Log para verificar o que está sendo retornado
        import logging
        logging.info(f"[DEBUG] obter_prejuizo_acumulado_anterior: usuario_id={usuario_id}, tipo={tipo}, mes_atual={mes_atual}")
        logging.info(f"[DEBUG] Query result: {result}")
        if result:
            logging.info(f"[DEBUG] Prejuízo retornado: {result['prejuizo'] if 'prejuizo' in result else 0.0}")
            return result['prejuizo'] if 'prejuizo' in result else 0.0
        else:
            logging.info(f"[DEBUG] Prejuízo retornado: 0.0")
            return 0.0




# SUBSTITUIR NO SEU services.py:
# 1. A função calcular_operacoes_fechadas existente (está incompleta no arquivo atual)
# 2. A função _calcular_resultado_dia existente
# 3. A função _calcular_preco_medio_antes_operacao existente
# 4. ADICIONAR todas as novas funções auxiliares abaixo


def _processar_dia_operacoes_fechadas(ops_do_dia, posicao_comprada, posicao_vendida,
                                     operacoes_fechadas, usuario_id, estado_antes_do_dia, ticker):
    """
    Processa um dia completo separando adequadamente day trades de swing trades
    """
    import logging

    # Separa operações por tipo
    compras_dia = [op for op in ops_do_dia if op["operation"] == "buy"]
    vendas_dia = [op for op in ops_do_dia if op["operation"] == "sell"]

    # Calcula quantidades totais
    total_comprado = sum(op["quantity"] for op in compras_dia)
    total_vendido = sum(op["quantity"] for op in vendas_dia)

    # Quantidade de day trade (menor entre compra e venda do dia)
    quantidade_day_trade = min(total_comprado, total_vendido)

    logging.info(f"[DIA] {ticker}: Comprado={total_comprado}, Vendido={total_vendido}, DT={quantidade_day_trade}")

    if quantidade_day_trade == 0:
        # Não há day trade, processa tudo como swing trade
        for op in ops_do_dia:
            if op["operation"] == "buy":
                _processar_compra_swing_trade(op, posicao_comprada, posicao_vendida, operacoes_fechadas,
                                            usuario_id, estado_antes_do_dia, ticker)
            else:
                _processar_venda_swing_trade(op, posicao_comprada, posicao_vendida, operacoes_fechadas,
                                           usuario_id, estado_antes_do_dia, ticker)
    else:
        # Há day trade, precisa separar
        _processar_dia_misto_dt_st(ops_do_dia, posicao_comprada, posicao_vendida, operacoes_fechadas,
                                  usuario_id, estado_antes_do_dia, ticker, quantidade_day_trade)


def _processar_dia_misto_dt_st(ops_do_dia, posicao_comprada, posicao_vendida, operacoes_fechadas,
                              usuario_id, estado_antes_do_dia, ticker, quantidade_day_trade):
    """
    Processa um dia com mistura de day trade e swing trade
    CENÁRIO 3: Compra histórica + compra/venda no mesmo dia
    """
    import logging

    # FASE 1: Identifica e processa swing trades (vendas que fecham posições históricas)
    quantidade_swing_processada = 0

    for op in [op for op in ops_do_dia if op["operation"] == "sell"]:
        if estado_antes_do_dia["quantidade_comprada"] > quantidade_swing_processada:
            # Ainda há posição histórica para vender como swing trade
            qtd_swing_desta_venda = min(
                op["quantity"],
                estado_antes_do_dia["quantidade_comprada"] - quantidade_swing_processada
            )

            if qtd_swing_desta_venda > 0:
                # Processa como swing trade usando PM histórico
                _processar_venda_swing_parcial(
                    op, qtd_swing_desta_venda, posicao_comprada, operacoes_fechadas,
                    usuario_id, estado_antes_do_dia, ticker
                )
                quantidade_swing_processada += qtd_swing_desta_venda
                logging.info(f"[ST] {ticker}: Processado {qtd_swing_desta_venda} como swing trade")

    # FASE 2: Processa day trades com split proporcional
    total_compras = sum(op["quantity"] for op in ops_do_dia if op["operation"] == "buy")
    total_vendas = sum(op["quantity"] for op in ops_do_dia if op["operation"] == "sell")
    compras_para_dt = []
    vendas_para_dt = []

    if total_compras > 0:
        proporcao_dt_compra = quantidade_day_trade / total_compras
        for op in [op for op in ops_do_dia if op["operation"] == "buy"]:
            qtd_dt = int(op["quantity"] * proporcao_dt_compra)
            compras_para_dt.append({
                "op": op,
                "quantidade_dt": qtd_dt,
                "quantidade_restante": op["quantity"] - qtd_dt
            })
        # Ajuste resíduo
        residuo = quantidade_day_trade - sum(c["quantidade_dt"] for c in compras_para_dt)
        if residuo > 0 and compras_para_dt:
            compras_para_dt[-1]["quantidade_dt"] += residuo
            compras_para_dt[-1]["quantidade_restante"] -= residuo

    if total_vendas > 0:
        proporcao_dt_venda = quantidade_day_trade / total_vendas
        quantidade_swing_processada = 0  # De FASE 1
        for op in [op for op in ops_do_dia if op["operation"] == "sell"]:
            qtd_ja_usada_swing = min(op["quantity"], max(0, estado_antes_do_dia["quantidade_comprada"] - quantidade_swing_processada))
            quantidade_swing_processada += qtd_ja_usada_swing
            qtd_disponivel_dt = op["quantity"] - qtd_ja_usada_swing
            qtd_dt = int(qtd_disponivel_dt * proporcao_dt_venda) if qtd_disponivel_dt > 0 else 0
            vendas_para_dt.append({
                "op": op,
                "quantidade_dt": qtd_dt,
                "quantidade_swing": qtd_ja_usada_swing,
                "quantidade_restante": qtd_disponivel_dt - qtd_dt
            })
        # Ajuste resíduo para vendas
        residuo = quantidade_day_trade - sum(v["quantidade_dt"] for v in vendas_para_dt)
        if residuo > 0 and vendas_para_dt:
            vendas_para_dt[-1]["quantidade_dt"] += residuo
            vendas_para_dt[-1]["quantidade_restante"] -= residuo

    # Executa day trades
    if compras_para_dt and vendas_para_dt:
        _executar_day_trades(compras_para_dt, vendas_para_dt, operacoes_fechadas, usuario_id, ticker)

    # FASE 3: Processa o que sobrou (atualiza posições em aberto)
    for compra_info in compras_para_dt:  # Todas compras agora incluídas
        if compra_info["quantidade_restante"] > 0:
            _adicionar_a_posicao_comprada(compra_info["op"], compra_info["quantidade_restante"], posicao_comprada)

    for venda_info in vendas_para_dt:
        if venda_info["quantidade_restante"] > 0:
            _adicionar_a_posicao_vendida(venda_info["op"], venda_info["quantidade_restante"], posicao_vendida)
    # FASE 3: Processa o que sobrou (atualiza posições em aberto)
    for compra_info in compras_para_dt:
        if compra_info["quantidade_restante"] > 0:
            _adicionar_a_posicao_comprada(compra_info["op"], compra_info["quantidade_restante"], posicao_comprada)

    for venda_info in vendas_para_dt:
        if venda_info["quantidade_restante"] > 0:
            _adicionar_a_posicao_vendida(venda_info["op"], venda_info["quantidade_restante"], posicao_vendida)


def _processar_venda_swing_parcial(op, quantidade_swing, posicao_comprada, operacoes_fechadas,
                                  usuario_id, estado_antes_do_dia, ticker):
    """
    Processa uma venda parcial como swing trade usando PM histórico
    """
    preco_venda = op["price"]
    fees_proporcional = (op.get("fees", 0.0) / op["quantity"]) * quantidade_swing if op["quantity"] > 0 else 0.0
    preco_medio_historico = estado_antes_do_dia["preco_medio_comprado"]

    # Cria operação fechada de swing trade
    op_fechada = _criar_operacao_fechada_detalhada_v2(
        ticker=ticker,
        data_abertura=_obter_data_aproximada_primeira_compra(ticker, usuario_id),
        data_fechamento=op["date"],
        quantidade=quantidade_swing,
        preco_abertura=preco_medio_historico,
        preco_fechamento=preco_venda - (fees_proporcional / quantidade_swing if quantidade_swing > 0 else 0),
        tipo="compra-venda",
        day_trade=False,
        usuario_id=usuario_id
    )

    operacoes_fechadas.append(op_fechada)

    # Atualiza posição comprada
    custo_removido = quantidade_swing * preco_medio_historico
    posicao_comprada["quantidade"] -= quantidade_swing
    posicao_comprada["custo_total"] -= custo_removido
    if posicao_comprada["quantidade"] > 0:
        posicao_comprada["preco_medio"] = posicao_comprada["custo_total"] / posicao_comprada["quantidade"]
    else:
        posicao_comprada["preco_medio"] = 0.0
        posicao_comprada["custo_total"] = 0.0


def _executar_day_trades(compras_dt, vendas_dt, operacoes_fechadas, usuario_id, ticker):
    """
    Executa as operações de day trade calculando PM das compras e vendas
    """
    if not compras_dt or not vendas_dt:
        return

    # Calcula PM das compras de day trade (com fees adicionado ao custo)
    valor_total_compras = 0.0
    quantidade_total_compras = 0
    for compra_info in compras_dt:
        op = compra_info["op"]
        qtd = compra_info["quantidade_dt"]
        fees_proporcional = (op.get("fees", 0.0) / op["quantity"]) * qtd if op["quantity"] > 0 else 0.0
        valor_total_compras += qtd * op["price"] + fees_proporcional
        quantidade_total_compras += qtd

    pm_compras_dt = valor_total_compras / quantidade_total_compras if quantidade_total_compras > 0 else 0.0

    # Calcula PM das vendas de day trade (com fees subtraído do valor)
    valor_total_vendas = 0.0
    quantidade_total_vendas = 0
    for venda_info in vendas_dt:
        op = venda_info["op"]
        qtd = venda_info["quantidade_dt"]
        fees_proporcional = (op.get("fees", 0.0) / op["quantity"]) * qtd if op["quantity"] > 0 else 0.0
        valor_total_vendas += qtd * op["price"] - fees_proporcional
        quantidade_total_vendas += qtd

    pm_vendas_dt = valor_total_vendas / quantidade_total_vendas if quantidade_total_vendas > 0 else 0.0

    # Quantidade efetiva de day trade
    quantidade_dt_efetiva = min(quantidade_total_compras, quantidade_total_vendas)

    if quantidade_dt_efetiva > 0:
        # Cria operação fechada de day trade
        op_fechada = _criar_operacao_fechada_detalhada_v2(
            ticker=ticker,
            data_abertura=compras_dt[0]["op"]["date"],
            data_fechamento=vendas_dt[0]["op"]["date"],
            quantidade=quantidade_dt_efetiva,
            preco_abertura=pm_compras_dt,
            preco_fechamento=pm_vendas_dt,
            tipo="compra-venda",
            day_trade=True,
            usuario_id=usuario_id
        )

        operacoes_fechadas.append(op_fechada)


def _processar_compra_swing_trade(op, posicao_comprada, posicao_vendida, operacoes_fechadas,
                                 usuario_id, estado_antes_do_dia, ticker):
    """
    Processa uma compra como swing trade (sem day trade no dia)
    """
    quantidade = op["quantity"]
    preco = op["price"]
    fees = op.get("fees", 0.0)

    # Se há posição vendida para cobrir
    if posicao_vendida["quantidade"] > 0:
        qtd_a_cobrir = min(posicao_vendida["quantidade"], quantidade)
        preco_compra = preco + (fees / quantidade if quantidade > 0 else 0)
        preco_venda_original = posicao_vendida["preco_medio"]

        # Cria operação fechada de cobertura de venda a descoberto
        op_fechada = _criar_operacao_fechada_detalhada_v2(
            ticker=ticker,
            data_abertura=_obter_data_aproximada_primeira_venda_descoberto(ticker, usuario_id),
            data_fechamento=op["date"],
            quantidade=qtd_a_cobrir,
            preco_abertura=preco_venda_original,
            preco_fechamento=preco_compra,
            tipo="venda-compra",
            day_trade=False,
            usuario_id=usuario_id
        )

        operacoes_fechadas.append(op_fechada)

        # Atualiza posição vendida
        posicao_vendida["quantidade"] -= qtd_a_cobrir
        posicao_vendida["valor_total"] -= qtd_a_cobrir * preco_venda_original
        if posicao_vendida["quantidade"] > 0:
            posicao_vendida["preco_medio"] = posicao_vendida["valor_total"] / posicao_vendida["quantidade"]
        else:
            posicao_vendida["preco_medio"] = 0.0
            posicao_vendida["valor_total"] = 0.0

        quantidade -= qtd_a_cobrir

    # Adiciona o restante à posição comprada
    if quantidade > 0:
        _adicionar_a_posicao_comprada(op, quantidade, posicao_comprada)


def _processar_venda_swing_trade(op, posicao_comprada, posicao_vendida, operacoes_fechadas,
                                usuario_id, estado_antes_do_dia, ticker):
    """
    Processa uma venda como swing trade (sem day trade no dia)
    """
    quantidade = op["quantity"]
    preco = op["price"]
    fees = op.get("fees", 0.0)

    # Se há posição comprada para vender
    if posicao_comprada["quantidade"] > 0:
        qtd_a_vender = min(posicao_comprada["quantidade"], quantidade)
        preco_venda = preco - (fees / quantidade if quantidade > 0 else 0)

        # Para swing trade, usa preço médio histórico se disponível
        if estado_antes_do_dia["quantidade_comprada"] > 0:
            preco_compra = estado_antes_do_dia["preco_medio_comprado"]
        else:
            preco_compra = posicao_comprada["preco_medio"]

        # Cria operação fechada de swing trade
        op_fechada = _criar_operacao_fechada_detalhada_v2(
            ticker=ticker,
            data_abertura=_obter_data_aproximada_primeira_compra(ticker, usuario_id),
            data_fechamento=op["date"],
            quantidade=qtd_a_vender,
            preco_abertura=preco_compra,
            preco_fechamento=preco_venda,
            tipo="compra-venda",
            day_trade=False,
            usuario_id=usuario_id
        )

        operacoes_fechadas.append(op_fechada)

        # Atualiza posição comprada
        custo_a_remover = qtd_a_vender * posicao_comprada["preco_medio"]
        posicao_comprada["quantidade"] -= qtd_a_vender
        posicao_comprada["custo_total"] -= custo_a_remover
        if posicao_comprada["quantidade"] <= 0:
            posicao_comprada["custo_total"] = 0.0
            posicao_comprada["preco_medio"] = 0.0
        else:
            posicao_comprada["preco_medio"] = posicao_comprada["custo_total"] / posicao_comprada["quantidade"]

        quantidade -= qtd_a_vender

    # Venda a descoberto do restante
    if quantidade > 0:
        _adicionar_a_posicao_vendida(op, quantidade, posicao_vendida)


def _adicionar_a_posicao_comprada(op, quantidade, posicao_comprada):
    """
    Adiciona uma quantidade à posição comprada
    """
    custo_adicional = quantidade * op["price"] + op.get("fees", 0.0)
    posicao_comprada["quantidade"] += quantidade
    posicao_comprada["custo_total"] += custo_adicional
    if posicao_comprada["quantidade"] > 0:
        posicao_comprada["preco_medio"] = posicao_comprada["custo_total"] / posicao_comprada["quantidade"]


def _adicionar_a_posicao_vendida(op, quantidade, posicao_vendida):
    """
    Adiciona uma quantidade à posição vendida (venda a descoberto)
    """
    valor_venda = quantidade * op["price"] - op.get("fees", 0.0)
    posicao_vendida["quantidade"] += quantidade
    posicao_vendida["valor_total"] += valor_venda
    posicao_vendida["preco_medio"] = posicao_vendida["valor_total"] / posicao_vendida["quantidade"]


def _criar_operacao_fechada_detalhada_v2(ticker, data_abertura, data_fechamento, quantidade,
                                        preco_abertura, preco_fechamento, tipo, day_trade, usuario_id):
    """
    Cria uma operação fechada com todos os campos necessários
    """
    if tipo == "compra-venda":
        valor_compra = quantidade * preco_abertura
        valor_venda = quantidade * preco_fechamento
        resultado = valor_venda - valor_compra
    elif tipo == "venda-compra":
        valor_venda = quantidade * preco_abertura
        valor_compra = quantidade * preco_fechamento
        resultado = valor_venda - valor_compra
    else:
        raise ValueError(f"Tipo de operação desconhecido: {tipo}")

    # Calcula prejuízo anterior acumulado
    tipo_operacao = "day" if day_trade else "swing"
    mes_operacao = data_fechamento.strftime("%Y-%m") if hasattr(data_fechamento, 'strftime') else str(data_fechamento)[:7]
    prejuizo_anterior = obter_prejuizo_acumulado_anterior(usuario_id, tipo_operacao, mes_operacao)

    # Calcula percentual
    base_calculo = valor_compra if tipo == "compra-venda" else valor_venda
    percentual_lucro = (resultado / base_calculo * 100) if base_calculo > 0 else 0.0

    return {
        "ticker": ticker,
        "data_abertura": data_abertura,
        "data_fechamento": data_fechamento,
        "tipo": tipo,
        "quantidade": quantidade,
        "valor_compra": preco_abertura if tipo == "compra-venda" else preco_fechamento,
        "valor_venda": preco_fechamento if tipo == "compra-venda" else preco_abertura,
        "taxas_total": 0.0,  # Já incluídas nos preços
        "resultado": resultado,
        "percentual_lucro": percentual_lucro,
        "day_trade": day_trade,
        "prejuizo_anterior_acumulado": prejuizo_anterior,
        "operacoes_relacionadas": []
    }




def _obter_data_aproximada_primeira_compra(ticker, usuario_id):
    from database import get_db
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT MIN(date) as min_date
            FROM operacoes
            WHERE usuario_id = ? AND ticker = ? AND operation = 'buy'
        ''', (usuario_id, ticker))
        result = cursor.fetchone()
        return result['min_date'] if result and result['min_date'] else None  # Ou fallback para data_fechamento se None

def _obter_data_aproximada_primeira_venda_descoberto(ticker, usuario_id):
    from database import get_db
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT MIN(date) as min_date
            FROM operacoes
            WHERE usuario_id = ? AND ticker = ? AND operation = 'sell'
            AND (SELECT SUM(CASE WHEN operation = 'buy' THEN quantity ELSE -quantity END)
                 FROM operacoes o2 WHERE o2.usuario_id = operacoes.usuario_id
                 AND o2.ticker = operacoes.ticker AND o2.date < operacoes.date) < 0
        ''', (usuario_id, ticker))
        result = cursor.fetchone()
        return result['min_date'] if result and result['min_date'] else None

# VERSÃO CORRIGIDA DA FUNÇÃO _calcular_preco_medio_antes_operacao
def _calcular_preco_medio_antes_operacao(ticker: str, usuario_id: int, data_limite: str, operacao_id_limite: int) -> Optional[float]:
    """
    Calcula o preço médio da carteira de um ticker ANTES de uma operação específica.

    CORREÇÃO: Exclui TODAS as operações do mesmo dia da operação de fechamento
    para evitar que day trades interfiram no cálculo do swing trade.

    Args:
        ticker: Código da ação
        usuario_id: ID do usuário
        data_limite: Data da operação de fechamento (formato YYYY-MM-DD)
        operacao_id_limite: ID da operação de fechamento (para desempate em operações do mesmo dia)

    Returns:
        Preço médio calculado ou None se não houver posição
    """
    from database import get_db

    with get_db() as conn:
        cursor = conn.cursor()

        # CORREÇÃO: Buscar operações ANTES da data limite (exclui o dia inteiro)
        # Isso garante que day trades do mesmo dia não interfiram no cálculo swing trade
        cursor.execute('''
        SELECT operation, quantity, price, fees
        FROM operacoes
        WHERE usuario_id = ? AND ticker = ?
        AND date < ?
        ORDER BY date ASC, id ASC
        ''', (usuario_id, ticker, data_limite))

        operacoes = cursor.fetchall()

        if not operacoes:
            return None

        # Simular o cálculo da carteira até o momento da operação de fechamento
        quantidade_total = 0
        custo_total = 0.0

        for operation, quantity, price, fees in operacoes:
            if operation.lower() == 'buy':
                # Compra: adicionar ao estoque
                quantidade_total += quantity
                custo_total += (quantity * price + (fees or 0.0))

            elif operation.lower() == 'sell':
                # Venda: remover do estoque usando preço médio atual
                if quantidade_total > 0:
                    preco_medio_atual = custo_total / quantidade_total
                    custo_a_remover = quantity * preco_medio_atual

                    quantidade_total -= quantity
                    custo_total -= custo_a_remover

                    # Se quantidade ficar negativa, é venda a descoberto
                    if quantidade_total < 0:
                        # Para venda a descoberto, ajustar custo
                        custo_total = quantidade_total * preco_medio_atual

        # Retornar preço médio se há posição positiva
        if quantidade_total > 0:
            return custo_total / quantidade_total
        else:
            return None


# INSTRUÇÕES DE IMPLEMENTAÇÃO FINAL:

"""
PASSOS PARA CORRIGIR SEU services.py:

1. SUBSTITUA a função calcular_operacoes_fechadas existente (que está incompleta no seu arquivo)
   pela versão calcular_operacoes_fechadas acima

2. SUBSTITUA a função _calcular_resultado_dia existente
   pela versão _calcular_resultado_dia acima

3. SUBSTITUA a função _calcular_preco_medio_antes_operacao existente
   pela versão _calcular_preco_medio_antes_operacao acima

4. ADICIONE todas as novas funções auxiliares:
   - _processar_dia_operacoes_fechadas
   - _processar_dia_misto_dt_st
   - _processar_venda_swing_parcial
   - _executar_day_trades
   - _processar_compra_swing_trade
   - _processar_venda_swing_trade
   - _adicionar_a_posicao_comprada
   - _adicionar_a_posicao_vendida
   - _criar_operacao_fechada_detalhada_v2
   - _calcular_status_ir_operacao_fechada
   - _obter_data_aproximada_primeira_compra
   - _obter_data_aproximada_primeira_venda_descoberto

5. REMOVA a função _criar_operacao_fechada_detalhada existente se houver conflito
   (a nova versão é _criar_operacao_fechada_detalhada_v2)

APÓS AS ALTERAÇÕES, SEU CÓDIGO TERÁ:
✅ Separação correta de day trade vs swing trade no mesmo dia
✅ Suporte completo a vendas a descoberto
✅ Fees tratados corretamente (adicionados ao custo na compra, subtraídos na venda)
✅ IRRF calculado conforme legislação (1% sobre ganhos DT, 0.005% sobre vendas ST)
✅ Preço médio histórico preservado para swing trades
✅ Logs detalhados para troubleshooting

RESULTADOS ESPERADOS POR CENÁRIO:
- Cenário 1 (DT puro): 1 operação DT com PM correto
- Cenário 2 (ST puro): 1 operação ST com PM histórico
- Cenário 3 (misto): 2 operações separadas (1 ST + 1 DT)
- Cenário 4 (venda descoberto): 1 operação venda-compra
- Cenário 5 (com fees): Fees incluídos nos cálculos

Para testar: Execute operações que correspondam aos cenários e verifique
se os resultados batem com o esperado.
"""
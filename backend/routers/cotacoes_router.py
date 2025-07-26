from fastapi import APIRouter, HTTPException, Query, Depends, Path
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import logging

from database import (
    obter_cotacoes_por_ticker,
    obter_cotacoes_por_acao_id,
    obter_cotacao_mais_recente_por_ticker,
    obter_estatisticas_cotacoes,
    obter_id_acao_por_ticker,
    inserir_cotacao,
    inserir_cotacoes_lote,
    verificar_cotacoes_existentes
)
from schemas import CotacaoResponse, CotacaoCreate, EstatisticasCotacoes
from dependencies import get_current_user
from models import UsuarioResponse

# Configurar logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cotacoes",
    tags=["cotacoes"],
    responses={404: {"description": "Não encontrado"}}
)

@router.get("/ticker/{ticker}", response_model=List[CotacaoResponse])
async def obter_cotacoes_ticker(
    ticker: str,
    data_inicio: Optional[str] = Query(None, description="Data inicial no formato YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="Data final no formato YYYY-MM-DD"),
    data_unica: Optional[str] = Query(None, description="Data específica no formato YYYY-MM-DD (substitui range)"),
    limite: Optional[int] = Query(60, description="Número máximo de registros a retornar (padrão: 50)"),
    ultimos_dias: Optional[int] = Query(None, description="Buscar cotações dos últimos N dias")
):
    """
    Obtém cotações de uma ação específica pelo ticker.
    
    Parâmetros de filtro:
    - data_unica: Busca cotação de uma data específica
    - data_inicio/data_fim: Range de datas
    - ultimos_dias: Cotações dos últimos N dias
    - limite: Máximo de registros (padrão: 60)
    """
    try:
        from datetime import datetime, timedelta
        
        # Se data_unica foi especificada, usar apenas ela
        if data_unica:
            datetime.strptime(data_unica, '%Y-%m-%d')  # Validar formato
            data_inicio = data_unica
            data_fim = data_unica
            
        # Se ultimos_dias foi especificado, calcular range
        elif ultimos_dias:
            if ultimos_dias <= 0:
                raise HTTPException(status_code=400, detail="ultimos_dias deve ser maior que 0")
            
            data_fim = datetime.now().strftime('%Y-%m-%d')
            data_inicio = (datetime.now() - timedelta(days=ultimos_dias)).strftime('%Y-%m-%d')
            
        # Validar formato das datas se fornecidas
        if data_inicio:
            datetime.strptime(data_inicio, '%Y-%m-%d')
        if data_fim:
            datetime.strptime(data_fim, '%Y-%m-%d')
            
        # Validar que data_inicio <= data_fim
        if data_inicio and data_fim:
            if datetime.strptime(data_inicio, '%Y-%m-%d') > datetime.strptime(data_fim, '%Y-%m-%d'):
                raise HTTPException(
                    status_code=400, 
                    detail="data_inicio deve ser menor ou igual a data_fim"
                )
            
        cotacoes = obter_cotacoes_por_ticker(
            ticker=ticker.upper(),
            data_inicio=data_inicio,
            data_fim=data_fim
        )
        
        if not cotacoes:
            raise HTTPException(
                status_code=404, 
                detail=f"Nenhuma cotação encontrada para o ticker {ticker}"
            )
        
        # Aplicar limite se especificado
        if limite and limite > 0:
            cotacoes = cotacoes[:limite]
            
        return cotacoes
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
    except Exception as e:
        logger.error(f"Erro ao buscar cotações para {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/ticker/{ticker}/data/{data_especifica}", response_model=CotacaoResponse)
async def obter_cotacao_data_especifica(
    ticker: str,
    data_especifica: str = Path(..., description="Data no formato YYYY-MM-DD")
):
    """
    Obtém a cotação de uma ação para uma data específica.
    """
    try:
        # Validar formato da data
        datetime.strptime(data_especifica, '%Y-%m-%d')
        
        cotacoes = obter_cotacoes_por_ticker(
            ticker=ticker.upper(),
            data_inicio=data_especifica,
            data_fim=data_especifica
        )
        
        if not cotacoes:
            raise HTTPException(
                status_code=404, 
                detail=f"Nenhuma cotação encontrada para {ticker} na data {data_especifica}"
            )
            
        return cotacoes[0]  # Retorna apenas a primeira (e única) cotação
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar cotação para {ticker} em {data_especifica}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/ticker/{ticker}/ultimas/{quantidade}", response_model=List[CotacaoResponse])
async def obter_ultimas_cotacoes(
    ticker: str,
    quantidade: int = Path(..., ge=1, le=500, description="Quantidade de cotações (1-500)"),
    apenas_dias_uteis: bool = Query(False, description="Filtrar apenas dias úteis")
):
    """
    Obtém as últimas N cotações de uma ação, ordenadas da mais recente para a mais antiga.
    
    Args:
        ticker: Código da ação
        quantidade: Número de cotações a retornar (máximo 500)
        apenas_dias_uteis: Se True, filtra apenas dias úteis (seg-sex)
    """
    try:
        cotacoes = obter_cotacoes_por_ticker(ticker=ticker.upper())
        
        if not cotacoes:
            raise HTTPException(
                status_code=404, 
                detail=f"Nenhuma cotação encontrada para {ticker}"
            )
        
        # Filtrar dias úteis se solicitado
        if apenas_dias_uteis:
            cotacoes_filtradas = []
            for cotacao in cotacoes:
                # Converter string de data para objeto datetime para verificar dia da semana
                data_obj = datetime.strptime(cotacao['data'], '%Y-%m-%d') if isinstance(cotacao['data'], str) else cotacao['data']
                # Segunda = 0, Domingo = 6. Dias úteis = 0-4 (seg-sex)
                if data_obj.weekday() < 5:
                    cotacoes_filtradas.append(cotacao)
            cotacoes = cotacoes_filtradas
        
        # Aplicar limite
        cotacoes_limitadas = cotacoes[:quantidade]
        
        return cotacoes_limitadas
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar últimas cotações para {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/range-datas", response_model=List[CotacaoResponse])
async def obter_cotacoes_multiplas_acoes(
    tickers: str = Query(..., description="Tickers separados por vírgula (ex: PETR4,VALE3,ITUB4)"),
    data_inicio: Optional[str] = Query(None, description="Data inicial no formato YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="Data final no formato YYYY-MM-DD"),
    data_unica: Optional[str] = Query(None, description="Data específica no formato YYYY-MM-DD"),
    limite_por_acao: Optional[int] = Query(60, description="Máximo de registros por ação")
):
    """
    Obtém cotações de múltiplas ações em um período específico.
    Útil para comparações e análises de múltiplos ativos.
    """
    try:
        from datetime import timedelta
        
        # Processar lista de tickers
        lista_tickers = [ticker.strip().upper() for ticker in tickers.split(',')]
        
        if len(lista_tickers) > 20:  # Limitar a 20 ações por consulta
            raise HTTPException(
                status_code=400, 
                detail="Máximo de 20 tickers por consulta"
            )
        
        # Processar filtros de data
        if data_unica:
            datetime.strptime(data_unica, '%Y-%m-%d')
            data_inicio = data_unica
            data_fim = data_unica
        
        # Validar datas
        if data_inicio:
            datetime.strptime(data_inicio, '%Y-%m-%d')
        if data_fim:
            datetime.strptime(data_fim, '%Y-%m-%d')
            
        # Validar range de datas
        if data_inicio and data_fim:
            if datetime.strptime(data_inicio, '%Y-%m-%d') > datetime.strptime(data_fim, '%Y-%m-%d'):
                raise HTTPException(
                    status_code=400, 
                    detail="data_inicio deve ser menor ou igual a data_fim"
                )
        
        todas_cotacoes = []
        
        for ticker in lista_tickers:
            try:
                cotacoes_ticker = obter_cotacoes_por_ticker(
                    ticker=ticker,
                    data_inicio=data_inicio,
                    data_fim=data_fim
                )
                
                # Aplicar limite por ação
                if limite_por_acao and limite_por_acao > 0:
                    cotacoes_ticker = cotacoes_ticker[:limite_por_acao]
                
                todas_cotacoes.extend(cotacoes_ticker)
                
            except Exception as e:
                # Log do erro, mas continue com os outros tickers
                logger.warning(f"Erro ao buscar cotações de {ticker}: {e}")
                continue
        
        if not todas_cotacoes:
            raise HTTPException(
                status_code=404, 
                detail="Nenhuma cotação encontrada para os tickers especificados"
            )
        
        # Ordenar por ticker e data (mais recente primeiro)
        todas_cotacoes.sort(key=lambda x: (x.get('ticker', ''), x.get('data', '')), reverse=True)
        
        return todas_cotacoes
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar cotações múltiplas: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/ticker/{ticker}/mais-recente", response_model=CotacaoResponse)
async def obter_cotacao_mais_recente(ticker: str):
    """
    Obtém a cotação mais recente de uma ação pelo ticker.
    """
    try:
        cotacao = obter_cotacao_mais_recente_por_ticker(ticker.upper())
        
        if not cotacao:
            raise HTTPException(
                status_code=404,
                detail=f"Nenhuma cotação encontrada para o ticker {ticker}"
            )
            
        return cotacao
        
    except Exception as e:
        logger.error(f"Erro ao buscar cotação mais recente para {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/acao/{acao_id}", response_model=List[CotacaoResponse])
async def obter_cotacoes_acao_id(
    acao_id: int,
    data_inicio: Optional[str] = Query(None, description="Data inicial no formato YYYY-MM-DD"),
    data_fim: Optional[str] = Query(None, description="Data final no formato YYYY-MM-DD"),
    data_unica: Optional[str] = Query(None, description="Data específica no formato YYYY-MM-DD"),
    limite: Optional[int] = Query(60, description="Número máximo de registros a retornar"),
    ultimos_dias: Optional[int] = Query(None, description="Buscar cotações dos últimos N dias")
):
    """
    Obtém cotações de uma ação específica pelo ID da ação.
    
    Parâmetros de filtro:
    - data_unica: Busca cotação de uma data específica
    - data_inicio/data_fim: Range de datas
    - ultimos_dias: Cotações dos últimos N dias
    - limite: Máximo de registros (padrão: 60)
    """
    try:
        from datetime import timedelta
        
        # Se data_unica foi especificada, usar apenas ela
        if data_unica:
            datetime.strptime(data_unica, '%Y-%m-%d')
            data_inicio = data_unica
            data_fim = data_unica
            
        # Se ultimos_dias foi especificado, calcular range
        elif ultimos_dias:
            if ultimos_dias <= 0:
                raise HTTPException(status_code=400, detail="ultimos_dias deve ser maior que 0")
            
            data_fim = datetime.now().strftime('%Y-%m-%d')
            data_inicio = (datetime.now() - timedelta(days=ultimos_dias)).strftime('%Y-%m-%d')
            
        # Validar formato das datas se fornecidas
        if data_inicio:
            datetime.strptime(data_inicio, '%Y-%m-%d')
        if data_fim:
            datetime.strptime(data_fim, '%Y-%m-%d')
            
        # Validar que data_inicio <= data_fim
        if data_inicio and data_fim:
            if datetime.strptime(data_inicio, '%Y-%m-%d') > datetime.strptime(data_fim, '%Y-%m-%d'):
                raise HTTPException(
                    status_code=400, 
                    detail="data_inicio deve ser menor ou igual a data_fim"
                )
            
        cotacoes = obter_cotacoes_por_acao_id(
            acao_id=acao_id,
            data_inicio=data_inicio,
            data_fim=data_fim
        )
        
        if not cotacoes:
            raise HTTPException(
                status_code=404,
                detail=f"Nenhuma cotação encontrada para a ação ID {acao_id}"
            )
        
        # Aplicar limite se especificado
        if limite and limite > 0:
            cotacoes = cotacoes[:limite]
            
        return cotacoes
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
    except Exception as e:
        logger.error(f"Erro ao buscar cotações para ação ID {acao_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/estatisticas", response_model=EstatisticasCotacoes)
async def obter_estatisticas():
    """
    Obtém estatísticas gerais sobre as cotações armazenadas.
    """
    try:
        stats = obter_estatisticas_cotacoes()
        return stats
        
    except Exception as e:
        logger.error(f"Erro ao obter estatísticas: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.post("/ticker/{ticker}", response_model=Dict[str, Any])
async def criar_cotacao_ticker(
    ticker: str,
    cotacao_data: CotacaoCreate,
    current_user: UsuarioResponse = Depends(get_current_user)
):
    """
    Cria uma nova cotação para um ticker específico.
    Requer autenticação de usuário.
    """
    try:
        # Verificar se o ticker existe
        acao_id = obter_id_acao_por_ticker(ticker.upper())
        if not acao_id:
            raise HTTPException(
                status_code=404,
                detail=f"Ticker {ticker} não encontrado"
            )
        
        # Preparar dados da cotação
        cotacao_dict = cotacao_data.dict()
        cotacao_dict['acao_id'] = acao_id
        
        # Inserir cotação
        cotacao_id = inserir_cotacao(cotacao_dict)
        
        return {
            "message": f"Cotação criada com sucesso para {ticker}",
            "cotacao_id": cotacao_id,
            "ticker": ticker.upper(),
            "data": cotacao_data.data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar cotação para {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.post("/lote", response_model=Dict[str, Any])
async def criar_cotacoes_lote(
    cotacoes: List[CotacaoCreate],
    current_user: UsuarioResponse = Depends(get_current_user)
):
    """
    Cria múltiplas cotações em lote.
    Requer autenticação de usuário.
    """
    try:
        if not cotacoes:
            raise HTTPException(
                status_code=400,
                detail="Lista de cotações não pode estar vazia"
            )
        
        # Converter para o formato esperado pela função do database
        cotacoes_dict_list = []
        for cotacao in cotacoes:
            cotacao_dict = cotacao.dict()
            cotacoes_dict_list.append(cotacao_dict)
        
        # Inserir cotações em lote
        num_inseridas = inserir_cotacoes_lote(cotacoes_dict_list)
        
        return {
            "message": f"{num_inseridas} cotações inseridas com sucesso",
            "total_inseridas": num_inseridas,
            "total_recebidas": len(cotacoes)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar cotações em lote: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/verificar/{ticker}")
async def verificar_cotacoes_ticker(
    ticker: str,
    data_inicio: str = Query(..., description="Data inicial no formato YYYY-MM-DD"),
    data_fim: str = Query(..., description="Data final no formato YYYY-MM-DD")
):
    """
    Verifica se existem cotações para um ticker em um período específico.
    """
    try:
        # Validar formato das datas
        datetime.strptime(data_inicio, '%Y-%m-%d')
        datetime.strptime(data_fim, '%Y-%m-%d')
        
        # Verificar se o ticker existe
        acao_id = obter_id_acao_por_ticker(ticker.upper())
        if not acao_id:
            raise HTTPException(
                status_code=404,
                detail=f"Ticker {ticker} não encontrado"
            )
        
        # Verificar cotações existentes
        existem_cotacoes = verificar_cotacoes_existentes(acao_id, data_inicio, data_fim)
        
        return {
            "ticker": ticker.upper(),
            "periodo": f"{data_inicio} a {data_fim}",
            "existem_cotacoes": existem_cotacoes,
            "acao_id": acao_id
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao verificar cotações para {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/periodo/{data_inicio}/{data_fim}")
async def obter_cotacoes_periodo(
    data_inicio: str,
    data_fim: str,
    ticker: Optional[str] = Query(None, description="Filtrar por ticker específico"),
    limite: Optional[int] = Query(100, description="Número máximo de registros por ação")
):
    """
    Obtém cotações de um período específico, opcionalmente filtradas por ticker.
    """
    try:
        # Validar formato das datas
        datetime.strptime(data_inicio, '%Y-%m-%d')
        datetime.strptime(data_fim, '%Y-%m-%d')
        
        if ticker:
            # Buscar cotações para ticker específico
            cotacoes = obter_cotacoes_por_ticker(
                ticker=ticker.upper(),
                data_inicio=data_inicio,
                data_fim=data_fim
            )
            
            if limite and limite > 0:
                cotacoes = cotacoes[:limite]
                
            return {
                "periodo": f"{data_inicio} a {data_fim}",
                "ticker": ticker.upper(),
                "total_cotacoes": len(cotacoes),
                "cotacoes": cotacoes
            }
        else:
            # Implementar busca para todas as ações no período seria mais complexa
            # Por enquanto, retorna erro sugerindo especificar ticker
            raise HTTPException(
                status_code=400,
                detail="Para busca por período, especifique um ticker usando o parâmetro 'ticker'"
            )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar cotações do período {data_inicio} a {data_fim}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/resumo/{ticker}")
async def obter_resumo_cotacao(ticker: str):
    """
    Obtém um resumo das cotações de uma ação incluindo:
    - Cotação mais recente
    - Performance dos últimos períodos
    - Máximas e mínimas
    """
    try:
        # Cotação mais recente
        cotacao_atual = obter_cotacao_mais_recente_por_ticker(ticker.upper())
        
        if not cotacao_atual:
            raise HTTPException(
                status_code=404,
                detail=f"Nenhuma cotação encontrada para {ticker}"
            )
        
        # Cotações dos últimos 30 dias para análise
        from datetime import timedelta
        data_30_dias = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        cotacoes_30d = obter_cotacoes_por_ticker(
            ticker=ticker.upper(),
            data_inicio=data_30_dias
        )
        
        # Cotações dos últimos 365 dias para análise anual
        data_365_dias = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
        cotacoes_365d = obter_cotacoes_por_ticker(
            ticker=ticker.upper(),
            data_inicio=data_365_dias
        )
        
        # Calcular estatísticas
        resumo = {
            "ticker": ticker.upper(),
            "cotacao_atual": cotacao_atual,
            "resumo_30_dias": calcular_estatisticas_periodo(cotacoes_30d),
            "resumo_365_dias": calcular_estatisticas_periodo(cotacoes_365d),
            "total_registros": len(cotacoes_365d)
        }
        
        return resumo
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar resumo para {ticker}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@router.get("/comparacao")
async def comparar_cotacoes(
    tickers: str = Query(..., description="Tickers para comparar (ex: PETR4,VALE3)"),
    data_inicio: str = Query(..., description="Data inicial para comparação"),
    data_fim: Optional[str] = Query(None, description="Data final (padrão: hoje)")
):
    """
    Compara a performance de múltiplas ações em um período específico.
    Retorna dados normalizados para facilitar comparações.
    """
    try:
        from datetime import timedelta
        
        # Processar tickers
        lista_tickers = [ticker.strip().upper() for ticker in tickers.split(',')]
        
        if len(lista_tickers) > 10:
            raise HTTPException(status_code=400, detail="Máximo de 10 ações para comparação")
        
        # Validar datas
        datetime.strptime(data_inicio, '%Y-%m-%d')
        if data_fim:
            datetime.strptime(data_fim, '%Y-%m-%d')
        else:
            data_fim = datetime.now().strftime('%Y-%m-%d')
        
        resultados_comparacao = {}
        
        for ticker in lista_tickers:
            cotacoes = obter_cotacoes_por_ticker(
                ticker=ticker,
                data_inicio=data_inicio,
                data_fim=data_fim
            )
            
            if cotacoes:
                # Ordenar por data
                cotacoes_ordenadas = sorted(cotacoes, key=lambda x: x['data'])
                
                # Calcular performance
                preco_inicial = cotacoes_ordenadas[0]['fechamento']
                preco_final = cotacoes_ordenadas[-1]['fechamento']
                
                performance = None
                if preco_inicial and preco_final and preco_inicial > 0:
                    performance = ((preco_final - preco_inicial) / preco_inicial) * 100
                
                resultados_comparacao[ticker] = {
                    "preco_inicial": preco_inicial,
                    "preco_final": preco_final,
                    "performance_percentual": round(performance, 2) if performance is not None else None,
                    "total_pregoes": len(cotacoes_ordenadas),
                    "dados_normalizados": normalizar_cotacoes(cotacoes_ordenadas)
                }
        
        # Ranking de performance
        ranking = sorted(
            [(ticker, dados["performance_percentual"]) for ticker, dados in resultados_comparacao.items() if dados["performance_percentual"] is not None],
            key=lambda x: x[1],
            reverse=True
        )
        
        return {
            "periodo": f"{data_inicio} a {data_fim}",
            "tickers_analisados": lista_tickers,
            "resultados": resultados_comparacao,
            "ranking_performance": ranking
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na comparação de cotações: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

def calcular_estatisticas_periodo(cotacoes: List[Dict]) -> Dict[str, Any]:
    """
    Função auxiliar para calcular estatísticas de um período.
    """
    if not cotacoes:
        return {
            "total_pregoes": 0,
            "preco_maximo": None,
            "preco_minimo": None,
            "preco_medio": None,
            "volume_total": 0,
            "variacao_periodo": None
        }
    
    precos_fechamento = [c['fechamento'] for c in cotacoes if c['fechamento'] is not None]
    volumes = [c['volume'] for c in cotacoes if c['volume'] is not None]
    
    # Ordenar por data para calcular variação
    cotacoes_ordenadas = sorted(cotacoes, key=lambda x: x['data'])
    
    variacao_periodo = None
    if len(cotacoes_ordenadas) >= 2:
        preco_inicial = cotacoes_ordenadas[0]['fechamento']
        preco_final = cotacoes_ordenadas[-1]['fechamento']
        
        if preco_inicial and preco_final and preco_inicial > 0:
            variacao_periodo = ((preco_final - preco_inicial) / preco_inicial) * 100
    
    return {
        "total_pregoes": len(cotacoes),
        "preco_maximo": max(precos_fechamento) if precos_fechamento else None,
        "preco_minimo": min(precos_fechamento) if precos_fechamento else None,
        "preco_medio": sum(precos_fechamento) / len(precos_fechamento) if precos_fechamento else None,
        "volume_total": sum(volumes) if volumes else 0,
        "variacao_periodo": round(variacao_periodo, 2) if variacao_periodo is not None else None
    }

def normalizar_cotacoes(cotacoes: List[Dict]) -> List[Dict]:
    """
    Normaliza cotações para base 100 para facilitar comparações.
    """
    if not cotacoes:
        return []
    
    preco_base = cotacoes[0]['fechamento']
    if not preco_base or preco_base <= 0:
        return []
    
    cotacoes_normalizadas = []
    for cotacao in cotacoes:
        if cotacao['fechamento'] and cotacao['fechamento'] > 0:
            valor_normalizado = (cotacao['fechamento'] / preco_base) * 100
            cotacoes_normalizadas.append({
                "data": cotacao['data'],
                "valor_normalizado": round(valor_normalizado, 2),
                "preco_original": cotacao['fechamento']
            })
    
    return cotacoes_normalizadas

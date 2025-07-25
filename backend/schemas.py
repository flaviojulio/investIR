from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import date

class EquityPointSchema(BaseModel):
    date: date
    value: float

class ProfitabilityDetailsSchema(BaseModel):
    absolute: float
    percentage: float
    initial_portfolio_value: float
    final_portfolio_value: float
    cash_invested_in_period: float
    cash_returned_in_period: float
    net_investment_change: float

class PortfolioHistoryResponseSchema(BaseModel):
    equity_curve: List[EquityPointSchema]
    profitability: ProfitabilityDetailsSchema

# Schema for the request body if needed, but current endpoint uses query params.
# If operations were to be passed in body, we'd need a schema for that.

# Re-exporting Operacao from models if it's used directly in request/response bodies
# For now, this endpoint fetches operations internally.
# from backend.models import Operacao as OperacaoModel # Example if needed elsewhere

class BemDireitoAcaoSchema(BaseModel):
    """
    Schema for representing an equity asset for "Bens e Direitos" declaration.
    """
    ticker: str
    nome_empresa: Optional[str] = None # Changed to Optional as it might not always be available initially
    cnpj: Optional[str] = None # Changed to Optional for the same reason
    quantidade: int
    preco_medio: float
    valor_total_data_base: float
    valor_total_ano_anterior: float = 0.0  # Novo campo: valor total em 31/12 do ano anterior

# --- Schemas para Cotações ---

class CotacaoBase(BaseModel):
    """Schema base para cotações de ações."""
    data: date
    abertura: Optional[float] = None
    maxima: Optional[float] = None
    minima: Optional[float] = None
    fechamento: Optional[float] = None
    fechamento_ajustado: Optional[float] = None
    volume: Optional[int] = None
    dividendos: Optional[float] = 0.0
    splits: Optional[float] = 0.0

class CotacaoCreate(CotacaoBase):
    """Schema para criação de cotações."""
    acao_id: int

class CotacaoResponse(CotacaoBase):
    """Schema para resposta de cotações."""
    id: int
    acao_id: int
    ticker: Optional[str] = None
    nome: Optional[str] = None
    
    class Config:
        from_attributes = True

class EstatisticasGerais(BaseModel):
    """Schema para estatísticas gerais das cotações."""
    total_registros: int
    total_acoes: int
    data_inicial: Optional[str] = None
    data_final: Optional[str] = None

class EstatisticaPorAcao(BaseModel):
    """Schema para estatísticas por ação."""
    ticker: str
    nome: Optional[str] = None
    total_cotacoes: int
    primeira_data: Optional[str] = None
    ultima_data: Optional[str] = None

class EstatisticasCotacoes(BaseModel):
    """Schema para estatísticas completas das cotações."""
    estatisticas_gerais: EstatisticasGerais
    por_acao: List[EstatisticaPorAcao]

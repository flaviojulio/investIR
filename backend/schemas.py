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

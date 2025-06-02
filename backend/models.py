from pydantic import BaseModel, Field, EmailStr, field_validator
from pydantic import ConfigDict
from typing import List, Optional
from datetime import date, datetime

# Modelos para autenticação

class UsuarioBase(BaseModel):
    username: str
    email: EmailStr
    nome_completo: Optional[str] = None

class UsuarioCreate(UsuarioBase):
    senha: str

class UsuarioUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    nome_completo: Optional[str] = None
    senha: Optional[str] = None
    ativo: Optional[bool] = None

class UsuarioResponse(BaseModel):
    id: int
    username: str
    email: str
    nome_completo: str
    funcoes: List[str]
    data_criacao: Optional[datetime] = None
    data_atualizacao: Optional[datetime] = None
    ativo: Optional[bool] = True    
    model_config = ConfigDict(from_attributes=True)

class LoginRequest(BaseModel):
    username_ou_email: str
    senha: str

class LoginResponse(BaseModel):
    usuario: UsuarioResponse
    token: str

class FuncaoBase(BaseModel):
    nome: str
    descricao: Optional[str] = None

class FuncaoCreate(FuncaoBase):
    pass

class FuncaoResponse(FuncaoBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

class FuncaoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None

class OperacaoBase(BaseModel):
    date: date
    ticker: str
    operation: str
    quantity: int
    price: float
    fees: Optional[float] = 0.0

class OperacaoCreate(OperacaoBase):
    pass

class Operacao(OperacaoBase):
    id: int
    usuario_id: Optional[int] = None

class ResultadoMensal(BaseModel):
    mes: str  # Formato: YYYY-MM
    
    # Swing Trade
    vendas_swing: float = 0.0
    custo_swing: float = 0.0
    ganho_liquido_swing: float = 0.0
    isento_swing: bool = False
    ir_devido_swing: float = 0.0 # IR calculated before R$10 rule / final payment value
    ir_pagar_swing: float = 0.0  # Actual tax to be paid for DARF
    darf_codigo_swing: Optional[str] = None
    darf_competencia_swing: Optional[str] = None
    darf_valor_swing: Optional[float] = None # Actual value on the DARF document
    darf_vencimento_swing: Optional[date] = None
    status_darf_swing_trade: Optional[str] = Field(default=None) # e.g., 'Pendente', 'Pago'

    # Day Trade
    vendas_day_trade: float = 0.0 # Was Optional, now required with default
    custo_day_trade: float = 0.0 # New field
    ganho_liquido_day: float = 0.0
    ir_devido_day: float = 0.0 # IR calculated before IRRF and R$10 rule
    irrf_day: float = 0.0
    ir_pagar_day: float = 0.0 # Actual tax to be paid for DARF
    darf_codigo_day: Optional[str] = None # Renamed from darf_codigo
    darf_competencia_day: Optional[str] = None # Renamed from darf_competencia
    darf_valor_day: Optional[float] = None # Renamed from darf_valor
    darf_vencimento_day: Optional[date] = None # Renamed from darf_vencimento
    status_darf_day_trade: Optional[str] = Field(default=None) # e.g., 'Pendente', 'Pago'

    # Accumulated Losses
    prejuizo_acumulado_swing: float = 0.0
    prejuizo_acumulado_day: float = 0.0
    
    model_config = ConfigDict(from_attributes=True)

class CarteiraAtual(BaseModel):
    """
    Modelo para a carteira atual de ações.
    """
    ticker: str
    quantidade: int
    custo_total: float
    preco_medio: float

    model_config = ConfigDict(from_attributes=True)

class DARF(BaseModel):
    """
    Modelo para um DARF gerado.
    """
    codigo: str
    competencia: str
    valor: float
    vencimento: date

    model_config = ConfigDict(from_attributes=True)

# Modelo atualizado para a atualização da carteira
class AtualizacaoCarteira(BaseModel):
    """
    Modelo para atualização manual de um item da carteira.
    Permite alterar apenas a quantidade e o preço médio.
    """
    ticker: str
    quantidade: int
    preco_medio: float

    @field_validator('ticker')
    @classmethod
    def ticker_uppercase(cls, v: str) -> str:
        """Converte o ticker para maiúsculo"""
        return v.upper()

    @field_validator('quantidade')
    @classmethod
    def quantidade_positive(cls, v: int) -> int:
        """Valida se a quantidade é positiva ou zero"""
        if v < 0:
            raise ValueError('A quantidade deve ser um número positivo ou zero')
        return v

    @field_validator('preco_medio')
    @classmethod
    def preco_medio_positive(cls, v: float, values) -> float:
        """Valida se o preço médio é positivo ou zero, e coerente com a quantidade"""
        # Pydantic v2 values is a FieldValidationInfo object, access data via .data
        quantidade = values.data.get('quantidade')

        if v < 0:
            raise ValueError('O preço médio deve ser um número positivo ou zero')
        
        # Se a quantidade for zero, o preço médio também deve ser zero
        if quantidade == 0 and v != 0:
            raise ValueError('Se a quantidade for zero, o preço médio também deve ser zero')
        
        return v

# Novos modelos para operações fechadas
class OperacaoDetalhe(BaseModel):
    """
    Modelo para detalhes de uma operação individual.
    """
    id: int
    date: date
    operation: str
    quantity: int
    price: float
    fees: float
    valor_total: float

    model_config = ConfigDict(from_attributes=True)

class OperacaoFechada(BaseModel):
    """
    Modelo para uma operação fechada (compra seguida de venda ou vice-versa).
    """
    ticker: str
    data_abertura: date
    data_fechamento: date
    tipo: str  # "compra-venda" ou "venda-compra" (venda a descoberto)
    quantidade: int
    preco_abertura: float
    preco_fechamento: float
    taxas_total: float
    resultado: float  # Lucro ou prejuízo
    operacoes_relacionadas: List[OperacaoDetalhe]
    day_trade: bool  # Indica se é day trade
    status_ir: Optional[str] = None # e.g., "Isenta Swing", "Tributável Swing", "Tributável Day Trade"

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

    model_config = ConfigDict(from_attributes=True)

class ResultadoTicker(BaseModel):
    ticker: str
    quantidade_atual: Optional[int] = 0
    preco_medio_atual: Optional[float] = 0.0
    custo_total_atual: Optional[float] = 0.0
    total_investido_historico: float = 0.0  # Sum of (quantity * price + fees) for all buy operations
    total_vendido_historico: float = 0.0    # Sum of (quantity * price - fees) for all sell operations
    lucro_prejuizo_realizado_total: float = 0.0 # Sum of 'resultado' from operacoes_fechadas for this ticker
    operacoes_compra_total_quantidade: int = 0 # Sum of quantity for buy operations
    operacoes_venda_total_quantidade: int = 0  # Sum of quantity for sell operations
    
    model_config = ConfigDict(from_attributes=True)
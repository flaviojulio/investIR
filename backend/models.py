from pydantic import BaseModel, Field, EmailStr, field_validator
from pydantic import ConfigDict
from typing import List, Optional, Dict, Any # Added Dict, Any
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
    corretora_id: Optional[int] = None  # Novo campo opcional para vincular corretora

class OperacaoCreate(OperacaoBase):
    pass

class Operacao(OperacaoBase):
    id: int
    usuario_id: Optional[int] = None
    corretora_nome: Optional[str] = None  # Nome da corretora para exibição

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
    nome: Optional[str] = None # Nome da ação, para exibição
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
    valor_compra: float     # Changed from preco_abertura
    valor_venda: float      # Changed from preco_fechamento
    taxas_total: float
    resultado: float  # Lucro ou prejuízo
    percentual_lucro: float # Ensured this field is present
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

class AcaoInfo(BaseModel):
    """
    Modelo para informações de uma ação (ticker) da tabela 'acoes'.
    """
    ticker: str
    nome: Optional[str] = None
    razao_social: Optional[str] = None
    cnpj: Optional[str] = None
    ri: Optional[str] = None
    classificacao: Optional[str] = None
    isin: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Modelos para Proventos
class ProventoBase(BaseModel):
    id_acao: int
    tipo: str
    valor: Optional[float] = None  # Este será o tipo após a validação em ProventoCreate
    data_registro: Optional[date] = None
    data_ex: Optional[date] = None
    dt_pagamento: Optional[date] = None

class ProventoCreate(BaseModel): # Não herda de ProventoBase diretamente para permitir tipos de entrada diferentes
    id_acao: int
    tipo: str
    valor: str  # Entrada como string: "0,123" ou "0.123"
    data_registro: str  # Entrada como string: "DD/MM/YYYY"
    data_ex: str  # Entrada como string: "DD/MM/YYYY"
    dt_pagamento: str  # Entrada como string: "DD/MM/YYYY"

    @field_validator("valor", mode='before')
    @classmethod
    def validate_valor_format(cls, v: str) -> float:
        if isinstance(v, str):
            value_str = v.replace(",", ".")
            try:
                value_float = float(value_str)
                if value_float <= 0:
                    raise ValueError("O valor do provento deve ser positivo.")
                return value_float
            except ValueError:
                raise ValueError("Formato de valor inválido. Use '0,123' ou '0.123'.")
        # Se já for float (ou int), e positivo, permitir (embora o tipo seja str na anotação)
        elif isinstance(v, (float, int)):
            if v <=0:
                 raise ValueError("O valor do provento deve ser positivo.")
            return float(v)
        raise ValueError("Valor deve ser uma string ou número.")

    @field_validator("data_registro", "data_ex", "dt_pagamento", mode='before')
    @classmethod
    def validate_date_format(cls, v: str) -> date:
        if isinstance(v, str):
            try:
                return datetime.strptime(v, "%d/%m/%Y").date()
            except ValueError:
                raise ValueError("Formato de data inválido. Use DD/MM/YYYY.")
        # Se já for date object
        elif isinstance(v, date):
            return v
        raise ValueError("Data deve ser uma string no formato DD/MM/YYYY ou um objeto date.")

class ProventoInfo(ProventoBase):
    id: int
    # As datas já são 'date' de ProventoBase, FastAPI as serializará para "YYYY-MM-DD" (ISO 8601) por padrão.
    # model_config json_encoders é uma forma de forçar, mas geralmente não é necessário para 'date'.
    model_config = ConfigDict(from_attributes=True, json_encoders={date: lambda d: d.isoformat()})

class ProventoRecebidoUsuario(ProventoInfo):
    """
    Representa um provento que foi efetivamente recebido por um usuário,
    incluindo informações sobre a ação e a quantidade na data ex.
    Herda de ProventoInfo e adiciona campos específicos do contexto do usuário.
    """
    ticker_acao: str
    nome_acao: Optional[str] = None
    quantidade_na_data_ex: int
    valor_total_recebido: float
    # model_config é herdado de ProventoInfo (que herda de ProventoBase)


# Modelos para Eventos Corporativos
class EventoCorporativoBase(BaseModel):
    id_acao: int
    evento: str
    data_aprovacao: Optional[date] = None
    data_registro: Optional[date] = None
    data_ex: Optional[date] = None
    razao: Optional[str] = None

    def get_adjustment_factor(self) -> float:
        if self.razao and ":" in self.razao:
            try:
                numerador, denominador = map(float, self.razao.split(":"))
                print(f"Calculando fator de ajuste: {denominador} / {numerador} para o evento {self.evento}")
                return denominador / numerador
            except Exception:
                return 1.0
        return 1.0
    
    def get_bonus_quantity_increase(self, current_quantity: float) -> float:
        """
        Para eventos de Bonificação, retorna o acréscimo de ações:
        quantidade_bonificada = quantidade_antiga * (numerador / denominador)
        Exemplo: 1:10 → 100 * (1/10) = 10
        """
        if self.evento and self.evento.lower().startswith("bonific") and self.razao and ":" in self.razao:
            try:
                numerador, denominador = map(float, self.razao.split(":"))
                if denominador == 0:
                    return 0.0
                return current_quantity * (numerador / denominador)
            except Exception:
                return 0.0
        return 0.0
    
class EventoCorporativoCreate(BaseModel):
    id_acao: int
    evento: str
    data_aprovacao: Optional[str] = None # Entrada como string: "DD/MM/YYYY"
    data_registro: Optional[str] = None  # Entrada como string: "DD/MM/YYYY"
    data_ex: Optional[str] = None        # Entrada como string: "DD/MM/YYYY"
    razao: Optional[str] = None

    @field_validator("data_aprovacao", "data_registro", "data_ex", mode='before')
    @classmethod
    def validate_event_date_format(cls, v: Optional[str]) -> Optional[date]:
        if v is None or v == "":
            return None
        if isinstance(v, str):
            try:
                return datetime.strptime(v, "%d/%m/%Y").date()
            except ValueError:
                raise ValueError("Formato de data inválido. Use DD/MM/YYYY ou deixe em branco.")
        elif isinstance(v, date): # Permitir que objetos date passem diretamente
            return v
        raise ValueError("Data deve ser uma string no formato DD/MM/YYYY ou um objeto date.")

class EventoCorporativoInfo(EventoCorporativoBase):
    id: int
    model_config = ConfigDict(from_attributes=True, json_encoders={date: lambda d: d.isoformat() if d else None})

# Modelos para Resumos de Proventos

class DetalheTipoProvento(BaseModel):
    tipo: str
    valor_total_tipo: float

class ResumoProventoAnual(BaseModel):
    ano: int
    total_dividendos: float = 0.0
    total_jcp: float = 0.0
    total_outros: float = 0.0 # Para tipos de proventos que não são 'DIVIDENDO' ou 'JCP'
    total_geral: float = 0.0
    acoes_detalhadas: List[Dict[str, Any]]
    # Cada dict: {"ticker": str, "nome_acao": str, "total_recebido_na_acao": float, "detalhes_por_tipo": List[DetalheTipoProvento]}

class ResumoProventoMensal(BaseModel):
    mes: str # Formato "YYYY-MM"
    total_dividendos: float = 0.0
    total_jcp: float = 0.0
    total_outros: float = 0.0
    total_geral: float = 0.0
    acoes_detalhadas: List[Dict[str, Any]] # Mesma estrutura de acoes_detalhadas do ResumoProventoAnual

class ResumoProventoPorAcao(BaseModel):
    ticker_acao: str
    nome_acao: Optional[str] = None
    total_recebido_geral_acao: float = 0.0
    detalhes_por_tipo: List[DetalheTipoProvento]


# Modelo para a tabela usuario_proventos_recebidos
class UsuarioProventoRecebidoDB(BaseModel):
    id: int
    usuario_id: int
    provento_global_id: int
    id_acao: int
    ticker_acao: str
    nome_acao: Optional[str] = None
    tipo_provento: str
    data_ex: date # data_ex é obrigatória no provento global e, portanto, aqui também
    dt_pagamento: Optional[date] = None # dt_pagamento pode ser nulo
    valor_unitario_provento: float
    quantidade_possuida_na_data_ex: int
    valor_total_recebido: float
    data_calculo: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            date: lambda d: d.isoformat() if d else None,
            datetime: lambda dt: dt.isoformat() if dt else None
        }
    )

class Corretora(BaseModel):
    id: int | None = None
    nome: str
    cnpj: str
    model_config = ConfigDict(from_attributes=True)
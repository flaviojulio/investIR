// In lib/types.ts
export interface Operacao {
  id: number;
  date: string; // YYYY-MM-DD
  ticker: string;
  operation: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees: number;
}

export interface CarteiraItem {
  ticker: string;
  quantidade: number;
  preco_medio: number;
  custo_total: number;
}

export interface ResultadoMensal {
  mes: string; // YYYY-MM

  // Swing Trade
  vendas_swing: number;
  custo_swing: number; // Adicionado
  ganho_liquido_swing: number;
  isento_swing: boolean;
  ir_devido_swing: number; // Adicionado
  ir_pagar_swing: number;  // Adicionado
  darf_codigo_swing?: string | null;
  darf_competencia_swing?: string | null; // Adicionado
  darf_valor_swing?: number | null; // Nome padronizado (era darf_swing_trade_valor)
  darf_vencimento_swing?: string | null; // Adicionado (ou Date)
  status_darf_swing_trade?: string | null;

  // Day Trade
  vendas_day_trade: number; // Garantir que seja number, não opcional se sempre presente
  custo_day_trade: number; // Adicionado
  ganho_liquido_day: number;
  ir_devido_day: number;
  irrf_day: number; // Adicionado
  ir_pagar_day: number;
  darf_codigo_day?: string | null; // Adicionado
  darf_competencia_day?: string | null; // Adicionado
  darf_valor_day?: number | null; // Nome padronizado (era darf_day_trade_valor)
  darf_vencimento_day?: string | null; // Adicionado (ou Date)
  status_darf_day_trade?: string | null;

  // Accumulated Losses
  prejuizo_acumulado_swing: number; // Adicionado
  prejuizo_acumulado_day: number;   // Adicionado
}

export interface ResultadoTicker {
  ticker: string;
  quantidade_atual?: number;
  preco_medio_atual?: number;
  custo_total_atual?: number;
  total_investido_historico: number;
  total_vendido_historico: number;
  lucro_prejuizo_realizado_total: number;
  operacoes_compra_total_quantidade: number;
  operacoes_venda_total_quantidade: number;
}

// Added OperacaoDetalhe and OperacaoFechada
export interface OperacaoDetalhe {
  id?: number; 
  date: string;
  operation: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees: number;
  valor_total: number;
}

export interface OperacaoFechada {
  ticker: string;
  data_abertura: string; 
  data_fechamento: string; 
  tipo: string; 
  quantidade: number;
  valor_compra: number; 
  valor_venda: number;  
  taxas_total: number;
  resultado: number;
  percentual_lucro?: number; 
  operacoes_relacionadas: OperacaoDetalhe[]; 
  day_trade: boolean;
  status_ir?: string; 
}

// Types for Portfolio Equity History
export interface EquityDataPoint {
  date: string; // "YYYY-MM-DD" or "YYYY-MM" from API
  value: number;
}

export interface ProfitabilityDetails {
  absolute: number;
  percentage: number;
  initial_portfolio_value: number;
  final_portfolio_value: number;
  cash_invested_in_period: number;
  cash_returned_in_period: number;
  net_investment_change: number;
  // Note: The backend service might return 'capital_gain_loss' as 'absolute'.
  // If the API response uses 'capital_gain_loss', this interface should match.
  // Based on the backend router and schema, it uses 'absolute'.
}

export interface PortfolioHistoryResponse {
  equity_curve: EquityDataPoint[];
  profitability: ProfitabilityDetails;
}

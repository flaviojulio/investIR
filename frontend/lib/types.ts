// In lib/types.ts
export interface Operacao {
  id: number;
  date: string; // YYYY-MM-DD
  ticker: string;
  operation: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees: number;
  usuario_id?: number;
  corretora_id?: number | null;
  corretora_nome?: string | null; // Adicionado para refletir o backend
}

export interface CarteiraItem {
  ticker: string;
  nome?: string; // Nome da ação, para exibição
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

export interface AcaoInfo {
  ticker: string;
  nome?: string;
  razao_social?: string;
  cnpj?: string;
  ri?: string;
  classificacao?: string;
  isin?: string;
}

// Interfaces para Proventos do Usuário e Resumos

export interface ProventoRecebidoUsuario {
  id: number;
  id_acao: number;
  tipo: string;
  valor_unitario_provento: number; // Valor unitário do provento
  data_registro: string; // YYYY-MM-DD
  data_ex: string;       // YYYY-MM-DD
  dt_pagamento: string | null;  // YYYY-MM-DD or null
  ticker_acao: string;
  nome_acao?: string;
  quantidade_na_data_ex: number;
  valor_total_recebido: number;
}

export interface DetalheTipoProventoAPI {
  tipo: string;
  valor_total_tipo: number;
}

export interface AcaoDetalhadaResumoProventoAPI {
  ticker: string;
  nome_acao: string; // No backend é opcional, mas nos resumos anuais/mensais parece ser sempre preenchido. Confirmar se pode ser opcional.
                      // Por ora, mantendo como string obrigatória conforme o uso em ResumoProventoAnual/Mensal.
  total_recebido_na_acao: number;
  detalhes_por_tipo: DetalheTipoProventoAPI[];
}

export interface ResumoProventoAnualAPI {
  ano: number;
  total_dividendos: number;
  total_jcp: number;
  total_outros: number;
  total_geral: number;
  acoes_detalhadas: AcaoDetalhadaResumoProventoAPI[];
}

export interface ResumoProventoMensalAPI {
  mes: string; // "YYYY-MM"
  total_dividendos: number;
  total_jcp: number;
  total_outros: number;
  total_geral: number;
  acoes_detalhadas: AcaoDetalhadaResumoProventoAPI[];
}

export interface ResumoProventoPorAcaoAPI {
  ticker_acao: string;
  nome_acao?: string;
  total_recebido_geral_acao: number;
  detalhes_por_tipo: DetalheTipoProventoAPI[];
}

export interface Corretora {
  id: number;
  nome: string;
  cnpj: string;
}

export interface MonthlyEarnings {
  month: string; // Format: YYYY-MM
  total_earnings: number;
}

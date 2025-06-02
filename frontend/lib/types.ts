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
  vendas_swing: number;
  ganho_liquido_swing: number;
  isento_swing: boolean;
  ganho_liquido_day: number;
  ir_devido_day: number;
  ir_pagar_day: number;
  darf_codigo?: string;
  darf_vencimento?: string; // YYYY-MM-DD
  vendas_day_trade?: number;
  darf_swing_trade_valor?: number;
  darf_day_trade_valor?: number;
  status_darf_swing_trade?: string; // e.g., 'Pendente', 'Pago'
  status_darf_day_trade?: string; // e.g., 'Pendente', 'Pago'
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

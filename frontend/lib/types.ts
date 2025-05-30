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
}

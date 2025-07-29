// lib/types.ts - Tipos atualizados para compatibilidade com backend

// Tipos para Configurações de Usuário
export interface ConfiguracaoUsuario {
  id: number;
  usuario_id: number;
  nome_exibicao?: string;
  avatar_url?: string;
  tema: 'light' | 'dark';
  idioma: string;
  moeda_preferida: string;
  notificacoes_email: boolean;
  notificacoes_push: boolean;
  exibir_valores_totais: boolean;
  formato_data: string;
  precisao_decimal: number;
  configuracoes_dashboard: {
    widgets_visiveis: string[];
    ordem_widgets: string[];
    modo_visualizacao: string;
  };
  data_criacao?: string;
  data_atualizacao?: string;
}

export interface ConfiguracaoUsuarioUpdate {
  nome_exibicao?: string;
  avatar_url?: string;
  tema?: 'light' | 'dark';
  idioma?: string;
  moeda_preferida?: string;
  notificacoes_email?: boolean;
  notificacoes_push?: boolean;
  exibir_valores_totais?: boolean;
  formato_data?: string;
  precisao_decimal?: number;
  configuracoes_dashboard?: {
    widgets_visiveis?: string[];
    ordem_widgets?: string[];
    modo_visualizacao?: string;
  };
}

export interface PerfilUsuario {
  usuario: {
    id: number;
    username: string;
    email: string;
    nome_completo: string;
    cpf?: string;
    funcoes: string[];
    data_criacao?: string;
    ativo?: boolean;
  };
  configuracoes: ConfiguracaoUsuario;
}

// Tipos para Sistema de Mensageria
export interface Mensagem {
  id: number;
  usuario_id: number;
  titulo: string;
  conteudo: string;
  tipo: 'info' | 'success' | 'warning' | 'error';
  prioridade: 'baixa' | 'normal' | 'alta' | 'critica';
  categoria: string;
  remetente: string;
  lida: boolean;
  data_criacao: string;
  data_leitura?: string;
  acao_url?: string;
  acao_texto?: string;
  expirar_em?: string;
}

export interface MensagemCreate {
  usuario_id: number;
  titulo: string;
  conteudo: string;
  tipo?: 'info' | 'success' | 'warning' | 'error';
  prioridade?: 'baixa' | 'normal' | 'alta' | 'critica';
  categoria?: string;
  remetente?: string;
  acao_url?: string;
  acao_texto?: string;
  expirar_em?: string;
}

export interface EstatisticasMensagens {
  total: number;
  nao_lidas: number;
  por_tipo: Record<string, number>;
  por_prioridade: Record<string, number>;
  por_categoria: Record<string, number>;
}

export interface OperacaoFechada {
  id?: number;
  ticker: string;
  quantidade: number;
  data_abertura: string; // ISO string
  data_fechamento: string; // ISO string
  preco_medio_compra: number; // ✅ NOVO: Vem do backend
  preco_medio_venda: number; // ✅ NOVO: Vem do backend
  valor_compra: number;
  valor_venda: number;
  resultado: number;
  day_trade: boolean;
  tipo: string; // "compra-venda" ou "venda-compra"
  taxas_total: number;
  percentual_lucro: number;
  prejuizo_anterior_acumulado: number;
  operacoes_relacionadas: any[];
  status_ir: string;

  
  // Campos para modal DARF (opcionais, calculados no frontend)
  mes_operacao?: string;
  resultado_mensal_encontrado?: boolean;
  deve_gerar_darf?: boolean;
  status_darf?: string;
  prejuizo_anterior_disponivel?: number;
  valor_ir_devido?: number;
  valor_ir_pagar?: number;
}

export interface ResultadoMensal {
  mes: string; // YYYY-MM
  mes_formatado?: string; // Frontend calculated
  
  // Swing Trade
  vendas_swing: number;
  custo_swing: number;
  ganho_liquido_swing: number;
  isento_swing: boolean;
  prejuizo_acumulado_swing: number;
  ir_devido_swing: number;
  ir_pagar_swing: number;
  status_darf_swing_trade?: string;
  
  // Day Trade
  vendas_day_trade: number;
  custo_day_trade: number;
  ganho_liquido_day: number;
  prejuizo_acumulado_day: number;
  irrf_day: number;
  ir_devido_day: number;
  ir_pagar_day: number;
  status_darf_day_trade?: string;
  
  // Campos calculados no frontend
  tem_ir_swing?: boolean;
  tem_ir_day?: boolean;
  tem_darf_pendente?: boolean;
  valor_total_ir?: number;
}

export interface CarteiraItem {
  ticker: string;
  nome_acao?: string;
  quantidade: number;
  preco_medio: number;
  custo_total: number;
  valor_atual?: number;
  variacao_percentual?: number;
  lucro_prejuizo?: number;
  preco_editado_pelo_usuario?: boolean;
}

export interface Operacao {
  id?: number;
  date: string; // ISO string
  ticker: string;
  operation: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  corretora_id?: number;
  corretora_nome?: string;
  importacao_id?: number;
  usuario_id?: number;
}

// ✅ TIPOS PARA PROVENTOS (já corretos)
export interface ProventoRecebidoUsuario {
  id: number;
  id_acao: number;
  tipo: string; // Frontend usa 'tipo', backend retorna 'tipo_provento'
  valor_unitario_provento: number;
  data_registro: string;
  data_ex: string;
  dt_pagamento: string | null;
  ticker_acao: string;
  nome_acao?: string;
  quantidade_na_data_ex: number; // Frontend usa este, backend retorna 'quantidade_possuida_na_data_ex'
  valor_total_recebido: number;
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
  mes: string; // YYYY-MM
  total_dividendos: number;
  total_jcp: number;
  total_outros: number;
  total_geral: number;
  acoes_detalhadas: AcaoDetalhadaResumoProventoAPI[];
}

export interface AcaoDetalhadaResumoProventoAPI {
  ticker: string;
  nome_acao?: string;
  total_recebido_na_acao: number;
  detalhes_por_tipo: DetalheTipoProvento[];
}

export interface DetalheTipoProvento {
  tipo: string;
  valor_total_tipo: number;
}

// Outros tipos existentes...
export interface DARF {
  codigo: string;
  competencia: string;
  valor: number;
  vencimento: string;
}

export interface AcaoInfo {
  id: number;
  ticker: string;
  nome?: string;
}

export interface ProventoInfo {
  id: number;
  id_acao: number;
  tipo: string;
  valor: number;
  data_registro: string;
  data_ex: string;
  dt_pagamento?: string;
}

export interface EventoCorporativoInfo {
  id: number;
  id_acao: number;
  evento: string;
  razao?: string;
  data_aprovacao?: string;
  data_registro?: string;
  data_ex?: string;
}

export interface UsuarioResponse {
  id: number;
  username: string;
  email: string;
  nome_completo?: string;
  funcoes: string[];
  ativo: boolean;
  data_criacao: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
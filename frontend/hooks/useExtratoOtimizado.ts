import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, getProventosUsuarioDetalhado, getEventosCorporativosUsuario } from '@/lib/api';

interface OperacaoOtimizada {
  // Dados base da operação
  id: number;
  ticker: string;
  data_fechamento: string;
  data_abertura: string;
  quantidade: number;
  resultado: number;
  day_trade: boolean;
  status_ir: string;
  valor_compra: number;
  valor_venda: number;
  preco_medio_compra: number;
  preco_medio_venda: number;
  
  // Dados pré-calculados (novos)
  prejuizo_acumulado_ate: number;
  detalhes_compensacao: {
    valor_compensado: number;
    lucro_tributavel: number;
    tem_compensacao: boolean;
    eh_compensacao_parcial: boolean;
  };
  deve_gerar_darf: boolean;
  estatisticas_mes: {
    prejuizo_acumulado_swing: number;
    prejuizo_acumulado_day: number;
    ir_devido_swing: number;
    ir_devido_day: number;
  };
}

interface ProventoRecebido {
  id: number;
  ticker_acao: string;
  nome_acao: string;
  tipo: string;
  data_ex: string;
  dt_pagamento: string;
  valor_unitario_provento: number;
  valor_total_recebido: number;
  quantidade_na_data_ex: number;
}

interface EventoCorporativo {
  id: number;
  id_acao: number;
  evento: string;
  data_ex: string;
  data_registro: string;
  data_aprovacao: string;
  razao: string;
}

interface TimelineItem {
  id: number;
  date: string;
  ticker: string;
  operation: string;
  quantity: number;
  price: number;
  fees: number;
  visualBranch: 'left' | 'right';
  
  // Campos específicos por tipo
  resultado?: number;
  percentual_lucro?: number;
  valor_compra?: number;
  valor_venda?: number;
  day_trade?: boolean;
  data_fechamento?: string;
  
  // Campos para proventos
  ticker_acao?: string;
  nome_acao?: string;
  tipo?: string;
  valor?: number;
  data_ex?: string;
  quantidade_na_data_ex?: number;
  valor_total_recebido?: number;
  valor_unitario_provento?: number;
  provento?: boolean;
  
  // Campos para eventos corporativos
  razao?: string;
}

interface UseExtratoOtimizadoResult {
  timelineItems: TimelineItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useExtratoOtimizado(): UseExtratoOtimizadoResult {
  const [operacoesFechadas, setOperacoesFechadas] = useState<OperacaoOtimizada[]>([]);
  const [proventos, setProventos] = useState<ProventoRecebido[]>([]);
  const [eventos, setEventos] = useState<EventoCorporativo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para normalizar operações
  const normalizeOperation = useCallback((raw: string) => {
    const op = raw?.toString().trim().toUpperCase() || "";
    
    if (op.includes("DIVIDENDO")) return "dividend";
    if (op.includes("JCP") || op.includes("JUROS SOBRE CAPITAL")) return "jcp";
    if (op.includes("RENDIMENTO")) return "rendimento";
    if (op.includes("BONIFICACAO") || op.includes("BONIFICAÇÃO")) return "bonificacao";
    if (op.includes("DESDOBRAMENTO")) return "desdobramento";
    if (op.includes("AGRUPAMENTO")) return "agrupamento";
    if (op.includes("COMPRA")) return "buy";
    if (op.includes("VENDA")) return "sell";
    
    if (!op) {
      return "dividend"; // Assume como dividendo por padrão para proventos não identificados
    }
    
    return op.toLowerCase();
  }, []);

  // Fetch de dados otimizado - todas as APIs em paralelo
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🚀 [EXTRATO OTIMIZADO] Iniciando busca de dados...');
      
      // Buscar dados em paralelo para máxima performance
      const [operacoesResponse, proventosResponse, eventosResponse] = await Promise.allSettled([
        api.get('/operacoes/fechadas/otimizado'),
        getProventosUsuarioDetalhado(),
        getEventosCorporativosUsuario()
      ]);
      
      // Processar operações fechadas
      if (operacoesResponse.status === 'fulfilled') {
        setOperacoesFechadas(operacoesResponse.value.data);
        console.log('✅ [EXTRATO OTIMIZADO] Operações fechadas:', operacoesResponse.value.data.length);
      } else {
        console.error('❌ [EXTRATO OTIMIZADO] Erro ao buscar operações:', operacoesResponse.reason);
      }
      
      // Processar proventos
      if (proventosResponse.status === 'fulfilled') {
        const proventosData = Array.isArray(proventosResponse.value) ? proventosResponse.value : [];
        setProventos(proventosData);
        console.log('✅ [EXTRATO OTIMIZADO] Proventos:', proventosData.length);
      } else {
        console.error('❌ [EXTRATO OTIMIZADO] Erro ao buscar proventos:', proventosResponse.reason);
        setProventos([]);
      }
      
      // Processar eventos corporativos
      if (eventosResponse.status === 'fulfilled') {
        const eventosData = Array.isArray(eventosResponse.value) ? eventosResponse.value : [];
        setEventos(eventosData);
        console.log('✅ [EXTRATO OTIMIZADO] Eventos corporativos:', eventosData.length);
      } else {
        console.error('❌ [EXTRATO OTIMIZADO] Erro ao buscar eventos:', eventosResponse.reason);
        setEventos([]);
      }
      
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Erro desconhecido';
      console.error('🚨 [EXTRATO OTIMIZADO] Erro geral:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memoizar mapeamento dos tickers das operações para filtrar eventos
  const tickersOperacoes = useMemo(() => {
    const tickers = new Set<string>();
    operacoesFechadas.forEach(op => tickers.add(op.ticker));
    return tickers;
  }, [operacoesFechadas]);

  // Memoizar mapeamento de operações fechadas para timeline
  const mappedPosicoesFechadas = useMemo(() => {
    return operacoesFechadas.map((op) => ({
      id: op.id,
      date: op.data_fechamento,
      ticker: op.ticker,
      operation: 'fechamento',
      quantity: op.quantidade,
      price: op.valor_venda / op.quantidade, // Preço unitário de venda
      fees: 0,
      visualBranch: 'left' as const,
      resultado: op.resultado,
      valor_compra: op.valor_compra,
      valor_venda: op.valor_venda,
      day_trade: op.day_trade,
      percentual_lucro: ((op.resultado / op.valor_compra) * 100),
      data_fechamento: op.data_fechamento
    }));
  }, [operacoesFechadas]);

  // Memoizar mapeamento de proventos para timeline
  const mappedProventos = useMemo(() => {
    return proventos.map((p) => ({
      id: p.id,
      date: p.dt_pagamento || p.data_ex,
      ticker: p.ticker_acao,
      operation: normalizeOperation(p.tipo),
      quantity: p.quantidade_na_data_ex,
      price: p.valor_unitario_provento,
      fees: 0,
      nome_acao: p.nome_acao,
      provento: true,
      ticker_acao: p.ticker_acao,
      valor_unitario_provento: p.valor_unitario_provento,
      valor_total_recebido: p.valor_total_recebido,
      quantidade_na_data_ex: p.quantidade_na_data_ex,
      data_ex: p.data_ex,
      visualBranch: 'right' as const
    }));
  }, [proventos, normalizeOperation]);

  // Memoizar mapeamento de ID para ticker (baseado nos proventos e operações)
  const idToTickerMap = useMemo(() => {
    const map = new Map<number, string>();
    
    // Mapear a partir dos proventos (que têm tanto ticker quanto id_acao)
    proventos.forEach(prov => {
      if ((prov as any).id_acao && prov.ticker_acao) {
        const idAcao = (prov as any).id_acao;
        map.set(idAcao, prov.ticker_acao);
      }
    });
    
    // Adicionar mapeamentos conhecidos do banco
    const knownMappings = new Map([
      [4, 'BBAS3'],
      [9, 'ITUB4'], 
      [10, 'PETR4'],
      [24, 'VALE3'],
      [27, 'WEGE3']
    ]);
    
    knownMappings.forEach((ticker, idAcao) => {
      map.set(idAcao, ticker);
    });
    
    return map;
  }, [proventos]);

  // Memoizar mapeamento de eventos corporativos para timeline
  const mappedEventos = useMemo(() => {
    return eventos
      .filter(evento => {
        // Só incluir eventos de ações que o usuário possui/possuía
        const ticker = idToTickerMap.get(evento.id_acao);
        return ticker && tickersOperacoes.has(ticker);
      })
      .map((evento) => {
        const ticker = idToTickerMap.get(evento.id_acao) || `ID_${evento.id_acao}`;
        
        return {
          id: evento.id,
          date: evento.data_ex || evento.data_registro || evento.data_aprovacao,
          ticker: ticker,
          operation: normalizeOperation(evento.evento),
          quantity: 0,
          price: 0,
          fees: 0,
          nome_acao: evento.evento,
          razao: evento.razao || '',
          visualBranch: 'left' as const
        };
      });
  }, [eventos, idToTickerMap, tickersOperacoes, normalizeOperation]);

  // Memoizar items finais da timeline ordenados
  const timelineItems = useMemo(() => {
    const fechadas = mappedPosicoesFechadas;
    const provs = mappedProventos;
    const evts = mappedEventos;
    
    const all = [...fechadas, ...provs, ...evts];
    
    // Ordenar por data (mais recente primeiro)
    const sorted = all.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Decrescente (mais recente primeiro)
    });
    
    console.log('🎯 [EXTRATO OTIMIZADO] Timeline final:', {
      total: sorted.length,
      operacoes: fechadas.length,
      proventos: provs.length,
      eventos: evts.length
    });
    
    return sorted;
  }, [mappedPosicoesFechadas, mappedProventos, mappedEventos]);

  const refetch = useCallback(() => fetchData(), [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    timelineItems,
    isLoading,
    error,
    refetch,
  };
}
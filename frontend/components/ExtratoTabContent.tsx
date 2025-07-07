"use client";
import React, { useMemo } from "react";
import OperationTimeline from "@/components/OperationTimeline";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Operacao, OperacaoFechada, EventoCorporativoInfo } from "@/lib/types";
import type { ProventoRecebidoUsuario } from '@/lib/types';
import { useEffect, useState } from 'react';
import { getProventosUsuarioDetalhado, getEventosCorporativos } from '@/lib/api';

interface Props {
  operacoesAbertas: Operacao[];
  operacoesFechadas: OperacaoFechada[];
  proventos?: ProventoRecebidoUsuario[];
  eventos?: EventoCorporativoInfo[];
}

export default function ExtratoTabContent({
  operacoesAbertas,
  operacoesFechadas,
  proventos: proventosProp = [],
  eventos: eventosProp = []
}: Props) {
  // Estado para proventos detalhados
  const [proventos, setProventos] = useState<ProventoRecebidoUsuario[]>(proventosProp);
  const [proventosLoaded, setProventosLoaded] = useState(false);
  
  // Estado para eventos corporativos
  const [eventos, setEventos] = useState<EventoCorporativoInfo[]>(eventosProp);
  const [eventosLoaded, setEventosLoaded] = useState(false);

  useEffect(() => {
    // Se já temos proventos carregados, não precisa carregar novamente
    if (proventosLoaded) return;
    
    // Se temos proventos via prop, usar eles
    if (proventosProp && proventosProp.length > 0) {
      setProventos(proventosProp);
      setProventosLoaded(true);
      return;
    }
    
    // Se não temos proventos via prop, buscar do backend apenas uma vez
    getProventosUsuarioDetalhado().then((data) => {
      setProventos(Array.isArray(data) ? data : []);
      setProventosLoaded(true);
    }).catch((error) => {
      console.error('Erro ao carregar proventos detalhados:', error);
      setProventos([]);
      setProventosLoaded(true);
    });
  }, [proventosProp, proventosLoaded]);

  // Separado: efeito para atualizar proventos quando a prop mudar (apenas se tiver conteúdo)
  useEffect(() => {
    if (proventosProp && proventosProp.length > 0) {
      setProventos(proventosProp);
    }
  }, [proventosProp]);

  useEffect(() => {
    // Se já temos eventos carregados, não precisa carregar novamente
    if (eventosLoaded) return;
    
    // Se temos eventos via prop, usar eles
    if (eventosProp && eventosProp.length > 0) {
      setEventos(eventosProp);
      setEventosLoaded(true);
      return;
    }
    
    // Se não temos eventos via prop, buscar do backend apenas uma vez
    getEventosCorporativos().then((data) => {
      setEventos(Array.isArray(data) ? data : []);
      setEventosLoaded(true);
    }).catch((error) => {
      console.error('Erro ao carregar eventos corporativos:', error);
      setEventos([]);
      setEventosLoaded(true);
    });
  }, [eventosProp, eventosLoaded]);

  // Funções utilitárias para normalização
  function normalizeOperation(raw: string) {
    const op = raw?.toString().trim().toUpperCase() || "";
    
    // DEBUG: Log da normalização para identificar problemas
    if (!op) {
      console.log("⚠️ [ExtratoTabContent] normalizeOperation recebeu string vazia:", raw);
    }
    
    if (op.includes("DIVIDENDO")) return "dividend";
    if (op.includes("JCP") || op.includes("JUROS SOBRE CAPITAL")) return "jcp";
    if (op.includes("RENDIMENTO")) return "rendimento";
    if (op.includes("BONIFICACAO") || op.includes("BONIFICAÇÃO")) return "bonificacao";
    if (op.includes("DESDOBRAMENTO")) return "desdobramento";
    if (op.includes("AGRUPAMENTO")) return "agrupamento";
    if (op.includes("COMPRA")) return "buy";
    if (op.includes("VENDA")) return "sell";
    
    // Se chegou aqui e é string vazia, provavelmente é um provento não identificado
    if (!op) {
      console.log("⚠️ [ExtratoTabContent] Operação não identificada, assumindo como dividend");
      return "dividend"; // Assume como dividendo por padrão para proventos não identificados
    }
    
    return op.toLowerCase();
  }

  // Mapeia operações abertas (excluindo operações que fazem parte de posições fechadas)
  const mappedOperacoes = useMemo(() => {
    console.log("🔍 [ExtratoTabContent] operacoesAbertas recebidas:", operacoesAbertas);
    
    if (!Array.isArray(operacoesAbertas)) return [];
    
    // Criar um set de operações de venda que fazem parte de posições fechadas
    const vendasQueFormamPosicoesFechadas = new Set();
    
    operacoesFechadas?.forEach(fechada => {
      // Para cada posição fechada, marcar a venda correspondente para filtro
      const chaveVenda = `${fechada.ticker}-${fechada.data_fechamento}-${fechada.quantidade}-sell`;
      vendasQueFormamPosicoesFechadas.add(chaveVenda);
    });

    const result = operacoesAbertas
      .filter(op => {
        // Type assertion to handle imported CSV data with Portuguese property names
        const opAny = op as any;
        const normalizedOp = normalizeOperation(op.operation || opAny["Tipo de Movimentação"] || "");
        const opDate = (op.date || opAny["Data do Negócio"] || "").toString().trim().slice(0, 10);
        const opTicker = (op.ticker || opAny["Código de Negociação"] || "").toString().toUpperCase().trim();
        const opQuantity = Number(op.quantity || opAny["Quantidade"] || 0);
        
        // Criar chave única da operação
        const chaveOperacao = `${opTicker}-${opDate}-${opQuantity}-${normalizedOp}`;
        
        // Filtrar operações que são proventos (serão tratadas separadamente)
        if (["dividend", "jcp", "rendimento", "bonificacao"].includes(normalizedOp)) {
          return false;
        }
        
        // Filtrar vendas que fazem parte de posições fechadas
        if (vendasQueFormamPosicoesFechadas.has(chaveOperacao)) {
          return false;
        }
        
        return true;
      })
      .map(op => {
        const anyOp = op as any;
        const rawOperation = op.operation || anyOp["Tipo de Movimentação"] || "";
        const normalizedOperation = normalizeOperation(rawOperation);
        
        const mappedOp = {
          ...op,
          date: (op.date || anyOp["Data do Negócio"] || "").toString().trim().slice(0, 10),
          ticker: (op.ticker || anyOp["Código de Negociação"] || "").toString().toUpperCase().replace(/\s+/g, ""),
          operation: normalizedOperation,
          quantity: Number(op.quantity || anyOp["Quantidade"] || 0),
          price: Number(op.price || anyOp["Preço"] || 0),
          fees: op.fees ?? anyOp["Taxas"] ?? 0,
          category: normalizedOperation,
          visualBranch: "left" as const
        };
        
        // DEBUG: Log operações com valores zerados
        if (mappedOp.price === 0 || mappedOp.quantity === 0) {
          console.log("⚠️ [ExtratoTabContent] Operação com valor zerado encontrada:", {
            original: op,
            anyOp: anyOp,
            mapped: mappedOp
          });
        }
        
        return mappedOp;
      })
      .filter(op => !["dividend", "jcp", "rendimento", "bonificacao"].includes(op.operation));
    
    console.log("🔍 [ExtratoTabContent] mappedOperacoes resultado:", result);
    return result;
  }, [operacoesAbertas, operacoesFechadas]);

  // Mapeia proventos para a timeline
  const mappedProventos = useMemo(() => {
    console.log("🔍 [ExtratoTabContent] proventos recebidos:", proventos);
    
    const result = (proventos || []).map((p) => {
      // DEBUG: Log detalhado de cada provento
      console.log("🔍 [ExtratoTabContent] Mapeando provento individual:", p);
      
      // Type assertion para acessar campos que vêm do backend mas não estão na interface
      const pAny = p as any;
      const tipo = p.tipo || pAny.tipo_provento || "";
      const normalizedTipo = normalizeOperation(tipo);
      
      // Usar quantidade_possuida_na_data_ex que vem do backend, ou quantidade_na_data_ex como fallback
      const quantity = pAny.quantidade_possuida_na_data_ex || p.quantidade_na_data_ex || 0;
      
      const mappedProvento = {
        date: (p.dt_pagamento || p.data_ex || "").toString().slice(0, 10),
        ticker: (p.ticker_acao || "").toString().toUpperCase(),
        operation: normalizedTipo,
        quantity: quantity,
        price: p.valor_unitario_provento || 0,
        fees: 0,
        id: p.id || Math.floor(Math.random() * 1000000),
        nome_acao: p.nome_acao,
        provento: true,
        valor_unitario_provento: p.valor_unitario_provento,
        valor_total_recebido: p.valor_total_recebido, // Adicionar o valor total também
        visualBranch: "right" as const
      };
      
      // DEBUG: Log específico para verificar datas
      if (p.dt_pagamento) {
        console.log("🔍 [ExtratoTabContent] Verificação de data:", {
          dt_pagamento_original: p.dt_pagamento,
          date_mapeada: mappedProvento.date,
          ticker: p.ticker_acao
        });
      }
      
      // DEBUG: Log proventos com valores zerados
      if (mappedProvento.price === 0 || mappedProvento.quantity === 0) {
        console.log("⚠️ [ExtratoTabContent] Provento com valor zerado encontrado:", {
          original: p,
          mapped: mappedProvento,
          tipo_detectado: tipo,
          tipo_normalizado: normalizedTipo,
          quantidade_original: p.quantidade_na_data_ex,
          quantidade_possuida: pAny.quantidade_possuida_na_data_ex,
          quantidade_final: quantity
        });
      }
      
      return mappedProvento;
    });
    
    console.log("🔍 [ExtratoTabContent] mappedProventos resultado:", result);
    return result;
  }, [proventos]);

  // Mapeia posições encerradas
  const mappedPosicoesFechadas = useMemo(() => {
    console.log("🔍 [ExtratoTabContent] operacoesFechadas recebidas:", operacoesFechadas);
    
    if (!Array.isArray(operacoesFechadas)) return [];
    
    const result = operacoesFechadas.map((op) => {
      const mappedFechada = {
        id: Math.floor(Math.random() * 1000000), // Generate numeric ID
        date: op.data_fechamento,
        ticker: op.ticker,
        operation: 'fechamento',
        quantity: op.quantidade,
        price: op.valor_venda / op.quantidade, // Calculate unit price from total value
        fees: 0,
        visualBranch: 'left' as const,
        resultado: op.resultado,
        valor_compra: op.valor_compra,
        valor_venda: op.valor_venda,
        day_trade: op.day_trade,
        percentual_lucro: op.percentual_lucro,
        data_fechamento: op.data_fechamento,
        operacoes: op.operacoes_relacionadas || []      
      };
      
      // DEBUG: Log posições fechadas com valores zerados
      if (mappedFechada.price === 0 || mappedFechada.quantity === 0 || isNaN(mappedFechada.price)) {
        console.log("⚠️ [ExtratoTabContent] Posição fechada com valor zerado/inválido encontrada:", {
          original: op,
          mapped: mappedFechada,
          calculo_price: `${op.valor_venda} / ${op.quantidade} = ${op.valor_venda / op.quantidade}`
        });
      }
      
      return mappedFechada;
    });
    
    console.log("🔍 [ExtratoTabContent] mappedPosicoesFechadas resultado:", result);
    return result;
  }, [operacoesFechadas]);

  // Mapeia eventos corporativos (apenas das ações que o usuário possuía na data do evento)
  const mappedEventos = useMemo(() => {
    if (!Array.isArray(eventos)) return [];
    
    // Criar um mapa de ticker para ID de ação e vice-versa
    const tickerToAcaoId = new Map<string, number>();
    const acaoIdToTicker = new Map<number, string>();
    
    // Mapear a partir dos proventos (que têm tanto ticker quanto id_acao)
    proventos.forEach(prov => {
      if ((prov as any).id_acao && prov.ticker_acao) {
        const idAcao = (prov as any).id_acao;
        const ticker = prov.ticker_acao;
        tickerToAcaoId.set(ticker, idAcao);
        acaoIdToTicker.set(idAcao, ticker);
      }
    });
    
    // Obter todos os tickers das operações do usuário
    const tickersUsuario = new Set<string>();
    
    // Adicionar tickers das operações abertas
    operacoesAbertas.forEach(op => {
      tickersUsuario.add(op.ticker);
    });
    
    // Adicionar tickers das operações fechadas
    operacoesFechadas.forEach(pos => {
      tickersUsuario.add(pos.ticker);
    });
    
    // Função para verificar se o usuário possuía a ação na data do evento
    const possuiaAcaoNaData = (idAcao: number, dataEvento: string): boolean => {
      const ticker = acaoIdToTicker.get(idAcao);
      if (!ticker || !tickersUsuario.has(ticker)) return false;
      
      const dataEventoObj = new Date(dataEvento);
      
      // Verificar operações abertas (que ainda estão em carteira)
      const temOperacaoAberta = operacoesAbertas.some(op => 
        op.ticker === ticker && new Date(op.date) <= dataEventoObj
      );
      
      if (temOperacaoAberta) return true;
      
      // Verificar operações fechadas (se possuía ação naquela data)
      const possuiaNaDataFechada = operacoesFechadas.some(pos => {
        if (pos.ticker !== ticker) return false;
        
        const dataAbertura = new Date(pos.data_abertura);
        const dataFechamento = new Date(pos.data_fechamento);
        
        // Se o evento foi entre a abertura e fechamento da posição
        return dataAbertura <= dataEventoObj && dataEventoObj <= dataFechamento;
      });
      
      return possuiaNaDataFechada;
    };
    
    // Filtrar e mapear apenas eventos das ações que o usuário possuía
    const result = eventos
      .filter(evento => {
        const dataEvento = evento.data_ex || evento.data_registro || evento.data_aprovacao;
        if (!dataEvento) return false;
        
        // Só incluir eventos de ações que o usuário possui/possuía
        return possuiaAcaoNaData(evento.id_acao, dataEvento);
      })
      .map((evento) => {
        const ticker = acaoIdToTicker.get(evento.id_acao) || `ID_${evento.id_acao}`;
        
        const mappedEvento = {
          id: Math.floor(Math.random() * 1000000), // Generate numeric ID
          date: evento.data_ex || evento.data_registro || evento.data_aprovacao || new Date().toISOString(),
          ticker: ticker,
          operation: normalizeOperation(evento.evento),
          quantity: 0, // Eventos não têm quantidade fixa
          price: 0,    // Eventos não têm preço
          fees: 0,
          nome_acao: evento.evento,
          razao: evento.razao || '',
          visualBranch: 'left' as const
        };
        
        return mappedEvento;
      });
    
    console.log("🔍 [ExtratoTabContent] mappedEventos resultado:", result);
    console.log("🔍 [ExtratoTabContent] Eventos filtrados por posse:", {
      totalEventos: eventos.length,
      eventosDoUsuario: result.length,
      tickersUsuario: Array.from(tickersUsuario),
      mapeamentoIds: Object.fromEntries(acaoIdToTicker)
    });
    
    return result;
  }, [eventos, operacoesAbertas, operacoesFechadas, proventos]);

  // Junta todos os itens para a timeline
  const timelineItems = useMemo(() => {
    const ops = mappedOperacoes;
    const provs = mappedProventos;
    const fechadas = mappedPosicoesFechadas;
    const evts = mappedEventos;
    
    const all = [...ops, ...provs, ...fechadas, ...evts];
    const sorted = all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    console.log("🔍 [ExtratoTabContent] timelineItems finais:", sorted);
    console.log("🔍 [ExtratoTabContent] Items com valores zerados no timeline final:", 
      sorted.filter(item => 
        (item.price === 0 || item.price === null || item.price === undefined || isNaN(item.price)) ||
        (item.quantity === 0 || item.quantity === null || item.quantity === undefined)
      )
    );
    
    return sorted;
  }, [mappedOperacoes, mappedProventos, mappedPosicoesFechadas, mappedEventos]);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-5xl">
        <h3 className="text-lg font-semibold mb-4 text-center">Extrato da Sua Carteira</h3>
        <OperationTimeline items={timelineItems} />
      </div>
    </div>
  );
}
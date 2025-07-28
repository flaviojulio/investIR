"use client";
import React, { useMemo } from "react";
import OperationTimeline from "./OperationTimeline";
import OperationTable from "./OperationTable";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import type { Operacao, OperacaoFechada, EventoCorporativoInfo } from "@/lib/types";
import type { ProventoRecebidoUsuario } from '@/lib/types';
import { useEffect, useState } from 'react';

import { getProventosUsuarioDetalhado, getEventosCorporativosUsuario } from '@/lib/api';

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
  // Estado para controlar a visualização (timeline ou tabela)
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  
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
    console.log('🔍 [ExtratoTabContent] Buscando proventos do usuário...');
    getProventosUsuarioDetalhado().then((data) => {
      console.log('✅ [ExtratoTabContent] Proventos carregados:', data?.length || 0, 'items');
      setProventos(Array.isArray(data) ? data : []);
      setProventosLoaded(true);
    }).catch((error) => {
      console.error('🚨 [ExtratoTabContent] Erro ao carregar proventos:', error);
      setProventos([]);
      setProventosLoaded(true);
    });
  }, [proventosProp.length, proventosLoaded]); // Usar length ao invés do array completo

  // Buscar eventos corporativos já filtrados do backend
  useEffect(() => {
    // Se já temos eventos carregados, não precisa carregar novamente
    if (eventosLoaded) return;
    
    // Se temos eventos via prop, usar eles
    if (eventosProp && eventosProp.length > 0) {
      setEventos(eventosProp);
      setEventosLoaded(true);
      return;
    }
    
    // Buscar eventos corporativos já filtrados do backend
    console.log('🔍 [ExtratoTabContent] Buscando eventos corporativos...');
    
    getEventosCorporativosUsuario().then((eventosUsuario) => {
      console.log('✅ [ExtratoTabContent] Eventos corporativos carregados:', eventosUsuario?.length || 0, 'items');
      setEventos(eventosUsuario);
      setEventosLoaded(true);
    }).catch((error) => {
      console.error('🚨 [ExtratoTabContent] Erro ao carregar eventos corporativos:', error);
      setEventos([]);
      setEventosLoaded(true);
    });
  }, [eventosProp.length, eventosLoaded]); // Usar length ao invés do array completo

  // Funções utilitárias para normalização
  function normalizeOperation(raw: string) {
    const op = raw?.toString().trim().toUpperCase() || "";
    
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
      return "dividend"; // Assume como dividendo por padrão para proventos não identificados
    }
    
    return op.toLowerCase();
  }

  // Mapeia TODAS as operações (compras e vendas individuais) - COM resultados consolidados
  const mappedOperacoes = useMemo(() => {
    console.log('🔍 [ExtratoTabContent] mappedOperacoes - operacoesAbertas recebidas:', operacoesAbertas.length, 'itens');
    console.log('🔍 [ExtratoTabContent] operacoesFechadas recebidas:', operacoesFechadas.length, 'itens');
    
    if (!Array.isArray(operacoesAbertas)) return [];

    // Criar mapa de operações fechadas por ticker e data para enriquecer vendas
    const resultadosMap = new Map<string, any>();
    if (Array.isArray(operacoesFechadas)) {
      operacoesFechadas.forEach(opFechada => {
        const key = `${opFechada.ticker}_${opFechada.data_fechamento}`;
        resultadosMap.set(key, opFechada);
      });
    }

    const result = operacoesAbertas
      .filter(op => {
        // Type assertion to handle imported CSV data with Portuguese property names
        const opAny = op as any;
        const normalizedOp = normalizeOperation(op.operation || opAny["Tipo de Movimentação"] || "");
        
        console.log('🔍 [ExtratoTabContent] Processando operação:', {
          ticker: (op.ticker || opAny["Código de Negociação"] || "").toString().toUpperCase().trim(),
          operation: normalizedOp,
          originalOperation: op.operation || opAny["Tipo de Movimentação"]
        });
        
        // Filtrar apenas proventos (serão tratadas separadamente)
        // Manter TODAS as compras e vendas (não filtrar por posições fechadas)
        if (["dividend", "jcp", "rendimento"].includes(normalizedOp)) {
          console.log('🔍 [ExtratoTabContent] Operação filtrada por ser provento');
          return false;
        }
        
        return true;
      })
      .map(op => {
        const anyOp = op as any;
        const rawOperation = op.operation || anyOp["Tipo de Movimentação"] || "";
        const normalizedOperation = normalizeOperation(rawOperation);
        
        const baseOp = {
          ...op,
          id: op.id || Math.floor(Math.random() * 1000000),
          date: (op.date || anyOp["Data do Negócio"] || "").toString().trim().slice(0, 10),
          ticker: (op.ticker || anyOp["Código de Negociação"] || "").toString().toUpperCase().replace(/\s+/g, ""),
          operation: normalizedOperation,
          quantity: Number(op.quantity || anyOp["Quantidade"] || 0),
          price: Number(op.price || anyOp["Preço"] || 0),
          fees: op.fees ?? anyOp["Taxas"] ?? 0,
          category: normalizedOperation,
          visualBranch: "left" as const
        };

        // Se for uma venda, tentar enriquecer com resultado da operação fechada
        if (normalizedOperation === 'sell') {
          const key = `${baseOp.ticker}_${baseOp.date}`;
          const operacaoFechada = resultadosMap.get(key);
          
          if (operacaoFechada) {
            console.log('🎯 [ExtratoTabContent] Enriquecendo venda com resultado:', {
              ticker: baseOp.ticker,
              date: baseOp.date,
              resultado: operacaoFechada.resultado
            });
            
            return {
              ...baseOp,
              resultado: operacaoFechada.resultado,
              percentual_lucro: operacaoFechada.percentual_lucro,
              day_trade: operacaoFechada.day_trade,
              valor_compra: operacaoFechada.valor_compra,
              valor_venda: operacaoFechada.valor_venda,
              // Adicionar informações extras para a interface
              temResultado: true
            };
          }
        }
        
        return baseOp;
      });
    
    console.log('🔍 [ExtratoTabContent] Todas as operações mapeadas (compras e vendas com resultados):', result.length, 'itens');
    console.log('🔍 [ExtratoTabContent] Resultado final das operações:', result);
    
    return result;
    
    return result;
  }, [operacoesAbertas, operacoesFechadas]);

  // Mapeia proventos para a timeline
  const mappedProventos = useMemo(() => {
    console.log('🔍 [ExtratoTabContent] mappedProventos executando com proventos:', proventos.length, 'itens');
    if (!Array.isArray(proventos)) return [];
    
    const result = proventos.map((p) => {
      // Type assertion para acessar campos que vêm do backend mas não estão na interface
      const pAny = p as any;
      const tipo = p.tipo || pAny.tipo_provento || "";
      const normalizedTipo = normalizeOperation(tipo);
      
      // Usar quantidade_possuida_na_data_ex que vem do backend, ou quantidade_na_data_ex como fallback
      const quantity = pAny.quantidade_possuida_na_data_ex || p.quantidade_na_data_ex || 0;
      
      console.log('🔍 [ExtratoTabContent] Mapeando provento:', {
        ticker: p.ticker_acao,
        tipo: tipo,
        valor_unitario_provento: p.valor_unitario_provento,
        valor: pAny.valor,
        data_ex: p.data_ex,
        quantity: quantity
      });
      
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
      
      return mappedProvento;
    });
    
    console.log('✅ [ExtratoTabContent] Proventos mapeados para timeline:', result.length, 'itens');
    return result;
  }, [proventos]);

  // Mapeia eventos corporativos (apenas das ações que o usuário possuía na data do evento)
  const mappedEventos = useMemo(() => {
    if (!Array.isArray(eventos)) {
      return [];
    }
    
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
    
    // IMPORTANTE: Criar mapeamento adicional baseado nos IDs conhecidos do banco
    // Como sabemos que: BBAS3=ID4, ITUB4=ID9, PETR4=ID10, VALE3=ID24, WEGE3=ID27
    const knownMappings = new Map([
      [4, 'BBAS3'],
      [9, 'ITUB4'], 
      [10, 'PETR4'],
      [24, 'VALE3'],
      [27, 'WEGE3']
    ]);
    
    // Adicionar mapeamentos conhecidos
    knownMappings.forEach((ticker, idAcao) => {
      acaoIdToTicker.set(idAcao, ticker);
      tickerToAcaoId.set(ticker, idAcao);
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
      
      if (!ticker) {
        return false;
      }
      
      const dataEventoObj = new Date(dataEvento);
      
      // Verificar operações fechadas - se possuía ação na data_registro do evento
      const possuiaNaDataFechada = operacoesFechadas.some(pos => {
        if (pos.ticker !== ticker) return false;
        
        const dataAbertura = new Date(pos.data_abertura);
        const dataFechamento = new Date(pos.data_fechamento);
        
        // Se o evento foi entre a abertura e fechamento (EXCLUSIVO do fechamento)
        // Evento na data de fechamento NÃO deve ser incluído pois a posição já foi fechada
        const dentroDoPeríodo = dataAbertura <= dataEventoObj && dataEventoObj < dataFechamento;
        
        return dentroDoPeríodo;
      });
      
      // Verificar se tem posições abertas que incluem a data do evento
      const possuiaNaDataAberta = operacoesAbertas.some(op => {
        if (op.ticker !== ticker) return false;
        
        // Para operações abertas, verificar se a data de abertura é <= data do evento
        const dataAbertura = new Date(op.date);
        const possuiaNaData = dataAbertura <= dataEventoObj;
        
        return possuiaNaData;
      });
      
      const resultado = possuiaNaDataFechada || possuiaNaDataAberta;
      
      return resultado;
    };
    
    // Filtrar e mapear apenas eventos das ações que o usuário possuía
    const result = eventos
      .filter(evento => {
        // Usar data_registro como critério principal para verificar posse
        const dataEvento = evento.data_registro;
        if (!dataEvento) {
          return false;
        }
        
        // Só incluir eventos de ações que o usuário possui/possuía na data_registro
        const possui = possuiaAcaoNaData(evento.id_acao, dataEvento);
        return possui;
      })
      .map((evento) => {
        const ticker = acaoIdToTicker.get(evento.id_acao) || `ID_${evento.id_acao}`;
        
        const mappedEvento = {
          id: Math.floor(Math.random() * 1000000), // Generate numeric ID
          // Usar data_ex para exibição na timeline, mas data_registro foi usada para filtrar
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
    
    return result;
  }, [eventos, operacoesAbertas, operacoesFechadas, proventos]);

  // Junta todos os itens para a timeline
  const timelineItems = useMemo(() => {
    const ops = mappedOperacoes;
    const provs = mappedProventos;
    const evts = mappedEventos;
    
    console.log('🔍 [ExtratoTabContent] Combinando itens para timeline:');
    console.log('  - Operações (compras/vendas com resultados):', ops.length);
    console.log('  - Proventos:', provs.length);
    console.log('  - Eventos corporativos:', evts.length);
    
    const all = [...ops, ...provs, ...evts];
    
    // Ordenação simples por data (sem necessidade de lógica especial para posições fechadas)
    const sorted = all.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      return dateA - dateB;
    });
    
    console.log('✅ [ExtratoTabContent] Total de itens na timeline:', sorted.length);
    
    return sorted;
  }, [mappedOperacoes, mappedProventos, mappedEventos]);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-6xl">
        {/* Cabeçalho com controles de visualização */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Extrato da Sua Carteira</h3>
            <p className="text-sm text-gray-600 mt-1">
              Visualize todas as suas operações, proventos e eventos corporativos
            </p>
          </div>
          
          {/* Controles de visualização */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-2 transition-all ${
                viewMode === 'timeline' 
                  ? 'bg-white shadow-sm text-gray-800' 
                  : 'hover:bg-gray-200'
              }`}
            >
              <span>�</span>
              <span className="hidden sm:inline">Timeline</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 transition-all ${
                viewMode === 'table' 
                  ? 'bg-white shadow-sm text-gray-800' 
                  : 'hover:bg-gray-200'
              }`}
            >
              <span>📋</span>
              <span className="hidden sm:inline">Tabela</span>
            </Button>
          </div>
        </div>

        {/* Estatísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Operações</p>
                <p className="text-2xl font-bold text-gray-900">{timelineItems.length}</p>
              </div>
              <span className="text-2xl">📈</span>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Operações</p>
                <p className="text-2xl font-bold text-blue-600">{mappedOperacoes.length}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <div className="h-4 w-4 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Operações Encerradas</p>
                <p className="text-2xl font-bold text-orange-600">{mappedOperacoes.filter(op => op.operation === 'sell').length}</p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <div className="h-4 w-4 bg-orange-500 rounded-full"></div>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Proventos</p>
                <p className="text-2xl font-bold text-blue-600">{mappedProventos.length}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <div className="h-4 w-4 bg-blue-500 rounded-full"></div>
              </div>
            </div>
          </Card>
        </div>

        {/* Conteúdo principal - Timeline ou Tabela */}
        <div className="w-full">
          {viewMode === 'timeline' ? (
            <OperationTimeline items={timelineItems} />
          ) : (
            <OperationTable items={timelineItems} />
          )}
        </div>
      </div>
    </div>
  );
}
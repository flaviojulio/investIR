"use client";
import React, { useMemo } from "react";
import OperationTimeline from "@/components/OperationTimeline";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Operacao, OperacaoFechada } from "@/lib/types";
import type { ProventoRecebidoUsuario } from '@/lib/types';
import { useEffect, useState } from 'react';
import { getProventosUsuarioDetalhado } from '@/lib/api';

interface Props {
  operacoesAbertas: Operacao[];
  operacoesFechadas: OperacaoFechada[];
  proventos?: ProventoRecebidoUsuario[];
}

export default function ExtratoTabContent({
  operacoesAbertas,
  operacoesFechadas,
  proventos: proventosProp = []
}: Props) {
  // Estado para proventos detalhados
  const [proventos, setProventos] = useState<ProventoRecebidoUsuario[]>(proventosProp);

  useEffect(() => {
    // Se não vier prop, busca do backend
    if (!proventosProp || proventosProp.length === 0) {
      getProventosUsuarioDetalhado().then((data) => {
        setProventos(Array.isArray(data) ? data : []);
      });
    } else {
      setProventos(proventosProp);
    }
  }, [proventosProp]);

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
    return op.toLowerCase();
  }

  // Mapeia operações abertas (excluindo operações que fazem parte de posições fechadas)
  const mappedOperacoes = useMemo(() => {
    if (!Array.isArray(operacoesAbertas)) return [];
    
    // Criar um set de operações de venda que fazem parte de posições fechadas
    const vendasQueFormamPosicoesFechadas = new Set();
    
    operacoesFechadas?.forEach(fechada => {
      // Para cada posição fechada, marcar a venda correspondente para filtro
      const chaveVenda = `${fechada.ticker}-${fechada.data_fechamento}-${fechada.quantidade}-sell`;
      vendasQueFormamPosicoesFechadas.add(chaveVenda);
      
      console.log(`[DEBUG] Marcando para filtro: ${chaveVenda}`);
    });

    return operacoesAbertas
      .filter(op => {
        // Type assertion to handle imported CSV data with Portuguese property names
        const opAny = op as any;
        const normalizedOp = normalizeOperation(op.operation || opAny["Tipo de Movimentação"] || "");
        const opDate = (op.date || opAny["Data do Negócio"] || "").toString().trim().slice(0, 10);
        const opTicker = (op.ticker || opAny["Código de Negociação"] || "").toString().toUpperCase().trim();
        const opQuantity = Number(op.quantity || opAny["Quantidade"] || 0);
        
        // Criar chave única da operação
        const chaveOperacao = `${opTicker}-${opDate}-${opQuantity}-${normalizedOp}`;
        
        console.log(`[DEBUG] Verificando operação: ${chaveOperacao}, incluir: ${!vendasQueFormamPosicoesFechadas.has(chaveOperacao)}`);
        
        // Filtrar operações que são proventos (serão tratadas separadamente)
        if (["dividend", "jcp", "rendimento", "bonificacao"].includes(normalizedOp)) {
          return false;
        }
        
        // Filtrar vendas que fazem parte de posições fechadas
        if (vendasQueFormamPosicoesFechadas.has(chaveOperacao)) {
          console.log(`[DEBUG] Filtrando venda duplicada: ${chaveOperacao}`);
          return false;
        }
        
        return true;
      })
      .map(op => {
        const anyOp = op as any;
        const rawOperation = op.operation || anyOp["Tipo de Movimentação"] || "";
        const normalizedOperation = normalizeOperation(rawOperation);
        return {
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
      })
      .filter(op => !["dividend", "jcp", "rendimento", "bonificacao"].includes(op.operation));
  }, [operacoesAbertas, operacoesFechadas]);

  // Mapeia proventos para a timeline
  const mappedProventos = useMemo(() => {
    return (proventos || []).map((p) => {
      const tipo = p.tipo || "";
      const normalizedTipo = normalizeOperation(tipo);
      return {
        date: (p.dt_pagamento || p.data_ex || "").toString().slice(0, 10),
        ticker: (p.ticker_acao || "").toString().toUpperCase(),
        operation: normalizedTipo,
        quantity: p.quantidade_na_data_ex || 0,
        price: p.valor_unitario_provento || 0,
        fees: 0,
        id: p.id || Math.floor(Math.random() * 1000000),
        nome_acao: p.nome_acao,
        provento: true,
        valor_unitario_provento: p.valor_unitario_provento,
        visualBranch: "right" as const
      };
    });
  }, [proventos]);

  // Mapeia posições encerradas
  const mappedPosicoesFechadas = useMemo(() => {
    if (!Array.isArray(operacoesFechadas)) return [];
    return operacoesFechadas.map((op) => ({
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
    }));
  }, [operacoesFechadas]);

  // Junta todos os itens para a timeline
  const timelineItems = useMemo(() => {
    const ops = mappedOperacoes;
    const provs = mappedProventos;
    const fechadas = mappedPosicoesFechadas;
    
    const all = [...ops, ...provs, ...fechadas];
    return all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [mappedOperacoes, mappedProventos, mappedPosicoesFechadas]);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-5xl">
        <h3 className="text-lg font-semibold mb-4 text-center">Extrato da Sua Carteira</h3>
        <OperationTimeline items={timelineItems} />
      </div>
    </div>
  );
}
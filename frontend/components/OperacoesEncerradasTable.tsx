"use client";

import {
  getCompensacaoInfo,
  calcularPrejuizoAcumuladoAteOperacao,
  calcularDetalhesCompensacao,
  calcularPrejuizoRestanteAposCompensacao, // ✅ NOVA FUNÇÃO
  useOperacoesComStatusCorrigido,
  deveGerarDarf,
  debugLogicaFiscal,
  calcularCompensacaoMensal, // ✅ DESCOMENTAR ESTA LINHA
  getCompensacaoInfoMensal, // ✅ ADICIONAR ESTA LINHA
  type CompensacaoInfo,
  type DetalhesCompensacao,
  type PrejuizoAcumuladoInfo,
} from "@/lib/fiscal-utils";

import { useOperacoesOtimizadas } from "@/hooks/useOperacoesOtimizadas";

import { DarfComprehensiveModal } from "@/components/DarfComprehensiveModal";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Building2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Hash,
  DollarSign,
  Search,
  Sparkles,
  BarChart3,
  Target,
  Info,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calculator,
  Shield,
  Link,
  Crown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import type { OperacaoFechada, ResultadoMensal } from "@/lib/types";

// Tipo para operação com índice sequencial
type OperacaoComIndice = OperacaoFechada & {
  sequentialIndex: number;
};
import { DarfDetailsModal } from "@/components/DarfDetailsModal";

const getPrecoMedioCompra = (op: OperacaoFechada): number => {
  // Primeiro tenta usar o campo direto do backend
  if (op.preco_medio_compra && op.preco_medio_compra > 0) {
    return op.preco_medio_compra;
  }

  // Fallback: usar preco_medio_compra se disponível
  if (op.preco_medio_compra && op.preco_medio_compra > 0) {
    return op.preco_medio_compra;
  }

  // Último fallback: calcular manualmente
  if (op.valor_compra && op.quantidade && op.quantidade > 0) {
    return op.valor_compra / op.quantidade;
  }

  return 0;
};

const getPrecoMedioVenda = (op: OperacaoFechada): number => {
  // Primeiro tenta usar o campo direto do backend
  if (op.preco_medio_venda && op.preco_medio_venda > 0) {
    return op.preco_medio_venda;
  }

  // Fallback: usar preco_medio_venda se disponível
  if (op.preco_medio_venda && op.preco_medio_venda > 0) {
    return op.preco_medio_venda;
  }

  // Último fallback: calcular manualmente
  if (op.valor_venda && op.quantidade && op.quantidade > 0) {
    return op.valor_venda / op.quantidade;
  }

  return 0;
};

// Formatting helpers
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

const formatDate = (dateString: string) => {
  const dateOnly = dateString.split("T")[0];
  const [year, month, day] = dateOnly.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateShort = (dateString: string) => {
  const dateOnly = dateString.split("T")[0];
  const [year, month, day] = dateOnly.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

const getMonthName = (dateString: string): string => {
  const months = [
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ];
  const date = new Date(dateString);
  return months[date.getMonth()];
};

// DARF status helper - Optimized to prevent browser freezing
const getDarfStatusForOperation = (
  op: OperacaoFechada,
  darfStatusMap?: Map<string, string>,
  resultadosMensais?: ResultadoMensal[]
): string | null => {
  try {
    // Early validation to prevent errors
    if (!op || !op.data_fechamento || !op.ticker) {
      return null;
    }

    // Use cached API field first (most efficient)
    if (op.deve_gerar_darf !== undefined && !op.deve_gerar_darf) {
      return null;
    }

    // Quick status check to avoid expensive operations
    if (
      op.status_ir !== "Tributável Day Trade" &&
      op.status_ir !== "Tributável Swing"
    ) {
      return null;
    }

    const operationKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}`;

    // PRIORITY 1: User manual status (fastest)
    if (darfStatusMap?.has(operationKey)) {
      return darfStatusMap.get(operationKey) || null;
    }

    // PRIORITY 2: Backend status (cached lookup)
    const mesOperacao = op.data_fechamento.substring(0, 7);
    const resultadoMensal = resultadosMensais?.find(rm => rm.mes === mesOperacao);
    
    if (resultadoMensal) {
      const statusBackend = op.day_trade
        ? resultadoMensal.status_darf_day_trade
        : resultadoMensal.status_darf_swing_trade;

      if (statusBackend) {
        return statusBackend.toLowerCase();
      }
    }

    // PRIORITY 3: Default status
    return "pendente";
  } catch (error) {
    console.error('[getDarfStatusForOperation] Error:', error);
    return null;
  }
};

interface OperacoesEncerradasTableProps {
  operacoesFechadas?: OperacaoFechada[];
  resultadosMensais?: ResultadoMensal[];
  onUpdateDashboard?: () => void;
}

// Removido: interface OperacaoFechada

// ✅ VERIFICAR se esta interface não referencia ResultadoMensal desnecessariamente
interface OperationRowProps {
  op: OperacaoFechada;
  index: number;
  isExpanded: boolean;
  toggleRow: (rowKey: string) => void;
  isProfit: boolean;
  getStatusBadge: (
    status: string,
    isProfit: boolean,
    op: OperacaoFechada,
    operacoesFechadas: OperacaoFechada[]
  ) => React.JSX.Element;
  getDarfBadge: (
    darfStatus: string | null,
    op: OperacaoFechada
  ) => React.JSX.Element | null;
  getDarfStatusForOperation: (
    op: OperacaoFechada,
    darfStatusMap?: Map<string, string>,
    resultadosMensais?: ResultadoMensal[]
  ) => string | null;
  shouldShowDarf: (op: OperacaoFechada) => boolean;
  darfStatusMap: Map<string, string>;
  handleOpenDarfModal: (op: OperacaoFechada) => void;
  operacoesFechadas: OperacaoFechada[];
  resultadosMensais?: ResultadoMensal[]; // ✅ Tornar opcional se não usado
}

// Subcomponent: Filters
const Filters = ({
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  filterMonth,
  setFilterMonth,
  filterStatus,
  setFilterStatus,
  uniqueMonths,
  uniqueStatuses,
}: {
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  filterType: string;
  setFilterType: React.Dispatch<React.SetStateAction<string>>;
  filterMonth: string;
  setFilterMonth: React.Dispatch<React.SetStateAction<string>>;
  filterStatus: string;
  setFilterStatus: React.Dispatch<React.SetStateAction<string>>;
  uniqueMonths: string[];
  uniqueStatuses: string[];
}) => (
  <div className="mb-6 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl p-4 border border-indigo-200">
    <div className="flex flex-wrap gap-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-indigo-500" />
        <Input
          placeholder="Pesquisar por ação, data, resultado ou tipo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12 border-2 border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 rounded-xl transition-all duration-300 bg-white"
        />
      </div>
      <Select value={filterType} onValueChange={setFilterType}>
        <SelectTrigger className="w-[180px] h-12 border-2 border-indigo-200 focus:border-indigo-500 rounded-xl bg-white">
          <SelectValue placeholder="Filtrar por tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="day_trade">Day Trade</SelectItem>
          <SelectItem value="swing_trade">Swing Trade</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filterMonth} onValueChange={setFilterMonth}>
        <SelectTrigger className="w-[180px] h-12 border-2 border-indigo-200 focus:border-indigo-500 rounded-xl bg-white">
          <SelectValue placeholder="Filtrar por mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os meses</SelectItem>
          {uniqueMonths.map((month) => (
            <SelectItem key={month} value={month}>
              {month.replace("-", "/")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className="w-[180px] h-12 border-2 border-indigo-200 focus:border-indigo-500 rounded-xl bg-white">
          <SelectValue placeholder="Filtrar por status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          {uniqueStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
);

// Subcomponent: TableHeader
const TableHeader = ({
  sortConfig,
  requestSort,
}: {
  sortConfig: { key: string; direction: "ascending" | "descending" };
  requestSort: (key: string) => void;
}) => (
  <div className="bg-gradient-to-r from-gray-50 to-indigo-50 border border-indigo-200 rounded-t-xl">
    <div className="grid grid-cols-12 gap-4 py-4 px-6 text-sm font-semibold text-gray-700">
      <div className="col-span-1"></div>
      <div
        className="col-span-1 cursor-pointer hover:text-indigo-600 flex items-center transition-colors group"
        onClick={() => requestSort("id")}
      >
        <Hash className="h-4 w-4 mr-1 text-indigo-500" />
        ID
        {sortConfig.key === "id" ? (
          sortConfig.direction === "ascending" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-indigo-600" />
          ) : (
            <ArrowDown className="ml-1 h-3 w-3 text-indigo-600" />
          )
        ) : (
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-70" />
        )}
      </div>
      <div className="col-span-2 flex items-center gap-1">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        Ativo
      </div>
      <div
        className="col-span-2 cursor-pointer hover:text-indigo-600 flex items-center transition-colors group"
        onClick={() => requestSort("data_fechamento")}
      >
        <Calendar className="h-4 w-4 mr-1 text-indigo-500" />
        Data
        {sortConfig.key === "data_fechamento" ? (
          sortConfig.direction === "ascending" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-indigo-600" />
          ) : (
            <ArrowDown className="ml-1 h-3 w-3 text-indigo-600" />
          )
        ) : (
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-70" />
        )}
      </div>
      <div
        className="col-span-3 cursor-pointer hover:text-indigo-600 flex items-center justify-end transition-colors group"
        onClick={() => requestSort("resultado")}
      >
        Resultado
        <DollarSign className="h-4 w-4 ml-1 text-indigo-500" />
        {sortConfig.key === "resultado" ? (
          sortConfig.direction === "ascending" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-indigo-600" />
          ) : (
            <ArrowDown className="ml-1 h-3 w-3 text-indigo-600" />
          )
        ) : (
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-70" />
        )}
      </div>
      <div
        className="col-span-3 cursor-pointer hover:text-indigo-600 flex items-center transition-colors group"
        onClick={() => requestSort("status_ir")}
      >
        <FileText className="h-4 w-4 mr-1 text-indigo-500" />
        Status Fiscal
        {sortConfig.key === "status_ir" ? (
          sortConfig.direction === "ascending" ? (
            <ArrowUp className="ml-1 h-3 w-3 text-indigo-600" />
          ) : (
            <ArrowDown className="ml-1 h-3 w-3 text-indigo-600" />
          )
        ) : (
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-70" />
        )}
      </div>
    </div>
  </div>
);

// Subcomponent: ExpandedContent - Optimized to prevent browser freezing
const ExpandedContent = React.memo(({ 
  op, 
  isProfit, 
  getStatusBadge, 
  getDarfBadge, 
  getDarfStatusForOperation, 
  shouldShowDarf, 
  darfStatusMap, 
  handleOpenDarfModal, 
  operacoesFechadas, 
  resultadosMensais 
}: {
  op: OperacaoFechada;
  isProfit: boolean;
  getStatusBadge: any;
  getDarfBadge: any;
  getDarfStatusForOperation: any;
  shouldShowDarf: any;
  darfStatusMap: Map<string, string>;
  handleOpenDarfModal: any;
  operacoesFechadas: OperacaoFechada[];
  resultadosMensais?: ResultadoMensal[];
}) => {
  // Early return if data is invalid to prevent rendering issues
  if (!op || !op.ticker || !op.data_fechamento) {
    return <div className="p-4 text-red-500 text-sm">Dados da operação inválidos</div>;
  }

  // 🚀 OTIMIZAÇÃO: Usar dados pré-calculados se disponíveis
  const prejuizoInfo = useMemo(() => {
    if (isProfit) return null;
    
    // Usar dados pré-calculados se disponíveis
    if (op.prejuizo_acumulado_ate !== undefined) {
      return {
        prejuizoAteOperacao: op.prejuizo_acumulado_ate,
        prejuizoAnterior: Math.max(0, op.prejuizo_acumulado_ate - Math.abs(op.resultado || 0))
      };
    }
    
    // Fallback para cálculo tradicional (apenas se necessário)
    try {
      return calcularPrejuizoAcumuladoAteOperacao(op, operacoesFechadas);
    } catch (error) {
      console.error('[ExpandedContent] Error calculating prejuizo info:', error);
      return null;
    }
  }, [op.prejuizo_acumulado_ate, op.resultado, isProfit]); // Dependências otimizadas

  const compensacaoDetalhes = useMemo(() => {
    if (!isProfit) return null;
    
    // Usar dados pré-calculados se disponíveis
    if (op.detalhes_compensacao) {
      return {
        lucroOperacao: Math.max(0, op.resultado || 0),
        prejuizoAnteriorDisponivel: op.detalhes_compensacao.valor_compensado,
        valorCompensado: op.detalhes_compensacao.valor_compensado,
        lucroTributavel: op.detalhes_compensacao.lucro_tributavel,
        prejuizoRestante: 0, // Será calculado se necessário
        operacoesAnteriores: [],
        historicoPrejuizos: []
      };
    }
    
    // Fallback para cálculo tradicional (apenas se necessário)
    if (!["Lucro Compensado", "Tributável Day Trade", "Tributável Swing"].includes(op.status_ir || "")) {
      return null;
    }
    
    try {
      return calcularDetalhesCompensacao(op, operacoesFechadas);
    } catch (error) {
      console.error('[ExpandedContent] Error calculating compensation details:', error);
      return null;
    }
  }, [op.detalhes_compensacao, op.resultado, op.status_ir, isProfit]); // Dependências otimizadas

  const prejuizoRestante = useMemo(() => {
    // Skip if no compensation details or no compensation value
    if (!compensacaoDetalhes?.valorCompensado || compensacaoDetalhes.valorCompensado <= 0) {
      return null;
    }
    
    // Para dados otimizados, não precisamos calcular separadamente
    if (op.detalhes_compensacao) {
      return null; // Dados já estão nos detalhes de compensação
    }
    
    try {
      return calcularPrejuizoRestanteAposCompensacao(op, operacoesFechadas);
    } catch (error) {
      console.error('[ExpandedContent] Error calculating prejuizo restante:', error);
      return null;
    }
  }, [compensacaoDetalhes?.valorCompensado, op.detalhes_compensacao]); // Dependências otimizadas

  // Check if this is a DARF operation (optimized check)
  const isDarfOperation = useMemo(() => {
    // 🚀 OTIMIZAÇÃO: Usar campo pré-calculado se disponível
    if (op.deve_gerar_darf !== undefined) {
      return Boolean(op.deve_gerar_darf);
    }
    
    // Fallback para verificação tradicional
    try {
      return shouldShowDarf(op);
    } catch (error) {
      console.error('[ExpandedContent] Error checking DARF operation:', error);
      return false;
    }
  }, [op.deve_gerar_darf, op.status_ir]);
  
  return (
    <div className="bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 py-6 px-6 border-t border-indigo-200">
      <div className="grid grid-cols-12 gap-6 text-sm">
        {/* Operation Details Card */}
        <div className="col-span-6 lg:col-span-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-lg">
                Detalhes da Operação
              </p>
              <p className="text-sm text-gray-600">
                Dados completos da negociação
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-indigo-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 border-b border-indigo-100">
              <h4 className="font-semibold text-indigo-800 text-sm flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Informações da Negociação
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium border ${
                    op.day_trade
                      ? "bg-orange-100 text-orange-800 border-orange-300"
                      : "bg-blue-100 text-blue-800 border-blue-300"
                  }`}
                >
                  {op.day_trade ? "Day Trade" : "Swing Trade"}
                </span>
              </h4>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Calendar className="h-3 w-3 text-purple-600" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                      Data de Fechamento
                    </span>
                  </div>
                  <span className="text-sm font-bold text-purple-900">
                    {formatDate(op.data_fechamento)}
                  </span>
                </div>
                <div className="flex flex-col p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Hash className="h-3 w-3 text-orange-600" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                      Quantidade
                    </span>
                  </div>
                  <span className="text-sm font-bold text-orange-800">
                    {formatNumber(op.quantidade)}
                  </span>
                </div>
                <div className="flex flex-col p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-green-600">
                      Preço Médio de Compra
                    </span>
                  </div>
                  <span className="text-sm font-bold text-green-800">
                    {formatCurrency(getPrecoMedioCompra(op))}
                  </span>
                </div>
                <div className="flex flex-col p-3 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingDown className="h-3 w-3 text-cyan-600" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-cyan-600">
                      Preço Médio de Venda
                    </span>
                  </div>
                  <span className="text-sm font-bold text-cyan-800">
                    {formatCurrency(getPrecoMedioVenda(op))}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <div
                  className={`flex flex-col rounded-xl border-2 shadow-lg ${
                    isProfit
                      ? "p-3 bg-gradient-to-br from-green-100 to-emerald-100 border-green-300"
                      : "p-2 bg-gradient-to-br from-red-100 to-rose-100 border-red-300"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center gap-2 ${
                      isProfit ? "mb-3" : "mb-2"
                    }`}
                  >
                    {isProfit ? (
                      <TrendingUp className="h-5 w-5 text-green-700" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-700" />
                    )}
                    <span
                      className={`font-semibold uppercase tracking-wide ${
                        isProfit
                          ? "text-sm text-green-700"
                          : "text-xs text-red-700"
                      }`}
                    >
                      Resultado Final da Operação
                    </span>
                  </div>
                  <div className="text-center">
                    <span
                      className={`font-black ${
                        isProfit
                          ? "text-2xl text-green-800"
                          : "text-lg text-red-800"
                      }`}
                    >
                      {isProfit ? "+" : "-"}
                      {formatCurrency(Math.abs(op.resultado)) + " "}
                      {(() => {
                        const valorInvestido = op.valor_compra || 0;
                        const percentual =
                          valorInvestido > 0
                            ? (op.resultado / valorInvestido) * 100
                            : 0;

                        return valorInvestido > 0 ? (
                          <span
                            className={`text-xs font-semibold ${
                              isProfit ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            ({isProfit ? "+" : ""}
                            {percentual.toFixed(2)}%)
                          </span>
                        ) : null;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fiscal Details Card */}
        <div className="col-span-12 lg:col-span-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-lg">
                Informações Fiscais
              </p>
              <p className="text-sm text-gray-600">
                Situação tributária e Imposto de Renda
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-purple-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-3 border-b border-purple-100">
              <h4 className="font-semibold text-purple-800 text-sm flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Situação tributária
              </h4>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                        Status Fiscal
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {getStatusBadge("", isProfit, op, operacoesFechadas)}
                      {shouldShowDarf(op) && (() => {
                      try {
                        const darfStatus = getDarfStatusForOperation(op, darfStatusMap, resultadosMensais);
                        return getDarfBadge(darfStatus, op);
                      } catch (error) {
                        console.error('[ExpandedContent] Error rendering DARF badge:', error);
                        return null;
                      }
                    })()}
                    </div>
                    <div className="text-xs text-indigo-700 leading-relaxed space-y-1">
                      <div>
                        <span className="font-semibold">Tributação:</span>{" "}
                        {op.status_ir === "Isento" && "Operação isenta de imposto de renda"}
                        {op.status_ir === "Tributável Day Trade" && "Sujeita a IR de 20% sobre o lucro"}
                        {op.status_ir === "Tributável Swing" && "Sujeita a IR de 15% sobre o lucro"}
                        {op.status_ir === "Prejuízo Acumulado" && "Prejuízo para compensação em outras operações"}
                        {op.status_ir === "Lucro Compensado" && "Lucro compensado por prejuízos em outras operações de mesmo tipo"}
                        {!op.status_ir && "Status não definido"}
                      </div>
                    </div>
                  </div>

                  {/* Restante do conteúdo fiscal será lazy loaded conforme necessário */}
                  {!isProfit && prejuizoInfo && (
                    <div className="flex flex-col p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="h-4 w-4 text-orange-600" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                          Acúmulo de Prejuízo ({op.day_trade ? "Day Trade" : "Swing Trade"})
                        </span>
                      </div>
                      <div className="bg-white/60 rounded-lg p-3 border border-orange-300/50 mt-4">
                        <div className="text-center">
                          <div className="text-xs text-orange-600 mb-1">
                            Prejuízo Acumulado até esta Operação ({op.day_trade ? "Day Trade" : "Swing Trade"})
                          </div>
                          <div className="text-red-700 font-bold text-lg bg-red-100 rounded px-2 py-1">
                            {formatCurrency(prejuizoInfo.prejuizoAteOperacao)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DARF Button - Simplified event handling to prevent accordion interference */}
                  {isDarfOperation && (
                    <div className="flex items-center justify-center mt-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDarfModal(op);
                        }}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Ver Detalhes Completos do DARF
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom memoization comparison to prevent unnecessary re-renders for DARF operations
  return (
    prevProps.op.ticker === nextProps.op.ticker &&
    prevProps.op.data_fechamento === nextProps.op.data_fechamento &&
    prevProps.op.resultado === nextProps.op.resultado &&
    prevProps.op.status_ir === nextProps.op.status_ir &&
    prevProps.op.deve_gerar_darf === nextProps.op.deve_gerar_darf &&
    prevProps.isProfit === nextProps.isProfit &&
    prevProps.darfStatusMap.size === nextProps.darfStatusMap.size
  );
});

// Subcomponent: OperationRow
const OperationRow = React.memo(({
  op,
  index,
  isExpanded,
  toggleRow,
  isProfit,
  getStatusBadge,
  getDarfBadge,
  getDarfStatusForOperation,
  shouldShowDarf,
  darfStatusMap,
  handleOpenDarfModal,
  operacoesFechadas,
  resultadosMensais, // ✅ Usar apenas a prop da interface oficial
}: OperationRowProps) => {
  // ✅ Usar a interface oficial
  const rowKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${index}`;

  return (
    <div
      className={`border-b border-gray-100 last:border-b-0 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-all duration-200 ${
        index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
      }`}
    >
      {/* Main Row */}
      <div
        className="grid grid-cols-12 gap-4 py-5 px-6 cursor-pointer"
        onClick={() => toggleRow(rowKey)}
      >
        <div className="col-span-1 flex items-center">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-indigo-500 transition-transform duration-200" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400 transition-transform duration-200" />
          )}
        </div>

        <div className="col-span-1 flex items-center">
          <span className="text-sm text-gray-600 font-medium">
            #{(op as OperacaoComIndice).sequentialIndex || index + 1}
          </span>
        </div>

        <div className="col-span-2 flex items-center">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-semibold text-lg">
                {op.ticker}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {op.ticker}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                    op.day_trade
                      ? "bg-orange-50 text-orange-700 border-orange-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}
                >
                  {op.day_trade ? "Day Trade" : "Swing Trade"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-2 text-center">
          <p className="text-sm text-gray-700">
            {formatDate(op.data_fechamento)}
          </p>
        </div>

        <div className="col-span-3 flex items-center justify-end">
          <div className="text-right">
            <p
              className={`text-sm font-bold ${
                isProfit ? "text-green-600" : "text-red-600"
              }`}
            >
              {isProfit ? "+" : ""}
              {formatCurrency(op.resultado)}
            </p>
            <p className="text-xs text-gray-500">
              {isProfit ? "Lucro" : "Prejuízo"}
            </p>
          </div>
        </div>

        <div className="col-span-3 flex items-center justify-start">
          <div className="flex items-center gap-2 min-h-[32px]">
            {getStatusBadge(
              "", // Não precisamos mais passar status, função usa getFinalStatus
              isProfit,
              op,
              operacoesFechadas
            )}
            {shouldShowDarf(op) && (() => {
              try {
                const darfStatus = getDarfStatusForOperation(op, darfStatusMap, resultadosMensais);
                return getDarfBadge(darfStatus, op);
              } catch (error) {
                console.error('[OperationRow] Error rendering DARF badge:', error);
                return null;
              }
            })()}
          </div>
        </div>
      </div>

      {/* Expanded Row - Lazy Loaded with error boundary */}
      {isExpanded && (
        <div className="expanded-content-wrapper">
          {(() => {
            try {
              return (
                <ExpandedContent
                  op={op}
                  isProfit={isProfit}
                  getStatusBadge={getStatusBadge}
                  getDarfBadge={getDarfBadge}
                  getDarfStatusForOperation={getDarfStatusForOperation}
                  shouldShowDarf={shouldShowDarf}
                  darfStatusMap={darfStatusMap}
                  handleOpenDarfModal={handleOpenDarfModal}
                  operacoesFechadas={operacoesFechadas}
                  resultadosMensais={resultadosMensais}
                />
              );
            } catch (error) {
              console.error('[OperationRow] Error rendering expanded content:', error);
              return (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-700 text-sm">Erro ao carregar detalhes da operação</p>
                  <p className="text-red-600 text-xs mt-1">Tente recarregar a página</p>
                </div>
              );
            }
          })()}
        </div>
      )}
    </div>
  );
});

// Subcomponent: PaginationControls
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

const PaginationControls = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationControlsProps) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-gradient-to-r from-gray-50 to-indigo-50 border-t border-indigo-200">
      <div className="text-sm text-gray-600">
        Mostrando <span className="font-medium">{startItem}</span> a <span className="font-medium">{endItem}</span> de <span className="font-medium">{totalItems}</span> operações
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-1">
          {getVisiblePages().map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="px-2 py-1 text-sm text-gray-400">...</span>
              ) : (
                <Button
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page as number)}
                  className={`h-8 w-8 p-0 ${
                    currentPage === page
                      ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                      : "border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {page}
                </Button>
              )}
            </div>
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Subcomponent: SummaryCards
// ✅ ATUALIZAR a interface e o card:
interface SummaryCardsProps {
  totalResultadoOperacoes: number;
  totalLucros: number;
  totalPrejuizosDisponiveis: {
    swing: number;
    dayTrade: number;
    total: number;
  }; // ✅ TIPO CORRETO: objeto ao invés de number
  operacoesTributaveis: number;
}

const SummaryCards = ({
  totalResultadoOperacoes,
  totalLucros,
  totalPrejuizosDisponiveis, // ✅ Agora é um objeto
  operacoesTributaveis,
}: SummaryCardsProps) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
    {/* Card 1: Resultado Total */}
    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 border border-white/30">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-indigo-100 rounded-lg flex items-center justify-center">
          <Target className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600">Resultado Total</p>
          <p
            className={`text-sm font-bold ${
              totalResultadoOperacoes >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {formatCurrency(totalResultadoOperacoes)}
          </p>
        </div>
      </div>
    </div>

    {/* Card 2: Total Lucros */}
    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 border border-white/30">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
          <TrendingUp className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600">Total Lucros</p>
          <p className="text-sm font-bold text-green-700">
            {formatCurrency(totalLucros)}
          </p>
        </div>
      </div>
    </div>

    {/* Card 3: Prejuízos Disponíveis para Compensação - VERSÃO REFORMULADA */}
    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 border border-white/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
          <TrendingDown className="h-4 w-4 text-red-600" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-600">Prejuízos p/ Compensação</p>
          <p className="text-sm font-bold text-red-700">
            {formatCurrency(totalPrejuizosDisponiveis.total)}
          </p>
        </div>
      </div>

      {/* Detalhamento por tipo */}
      {(totalPrejuizosDisponiveis.swing > 0 || totalPrejuizosDisponiveis.dayTrade > 0) && (
        <div className="space-y-2 mt-2 pt-2 border-t border-gray-200">
          {totalPrejuizosDisponiveis.swing > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Swing
              </span>
              <span className="text-xs font-semibold text-blue-700">
                {formatCurrency(totalPrejuizosDisponiveis.swing)}
              </span>
            </div>
          )}
          {totalPrejuizosDisponiveis.dayTrade > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-orange-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                Day Trade
              </span>
              <span className="text-xs font-semibold text-orange-700">
                {formatCurrency(totalPrejuizosDisponiveis.dayTrade)}
              </span>
            </div>
          )}
        </div>
      )}

    </div>

    {/* Card 4: Operações Tributáveis */}
    <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 border border-white/30">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
          <FileText className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600">
            Operações Tributáveis
          </p>
          <p className="text-sm font-bold text-purple-700">
            {operacoesTributaveis}
          </p>
        </div>
      </div>
    </div>
  </div>
);

// Main Component
export default function OperacoesEncerradasTable(
  props: OperacoesEncerradasTableProps
) {
  // Handler for DARF status change
  const handleDarfStatusChange = (operationKey: string, newStatus: string) => {
    setDarfStatusMap((prev) => {
      const updated = new Map(prev);
      updated.set(operationKey, newStatus);
      return updated;
    });

    // ✅ OPCIONAL: Fechar modal após atualização (se desejar)
    // setIsDarfModalOpen(false);
  };
  // Wrapper for dashboard update
  const handleUpdateDashboard = () => {
    if (typeof onUpdateDashboard === "function") {
      onUpdateDashboard();
    }
  };
  // DARF modal state and handler
  const [isDarfModalOpen, setIsDarfModalOpen] = useState(false);
  const [selectedOpForDarf, setSelectedOpForDarf] =
    useState<OperacaoFechada | null>(null);
  const [selectedResultadoMensalForDarf, setSelectedResultadoMensalForDarf] =
    useState<ResultadoMensal | null>(null);

  const handleOpenDarfModal = (op: OperacaoFechada) => {
    setSelectedOpForDarf(op);
    setIsDarfModalOpen(true);
  };

  // Função para atualizar status do DARF na tabela quando mudado no modal
  const handleDarfStatusUpdate = (mes: string, tipo: "swing" | "daytrade", novoStatus: string) => {
    // Encontrar todas as operações do mesmo mês e tipo para atualizar
    const operacoesParaAtualizar = operacoesComStatusCorrigido.filter(op => {
      const opMes = op.mes_operacao || op.data_fechamento.substring(0, 7);
      const isDayTrade = op.day_trade || false;
      const tipoOperacao = isDayTrade ? "daytrade" : "swing";
      
      return opMes === mes && tipoOperacao === tipo;
    });

    // Criar novo mapa com os status atualizados
    const novoMapa = new Map(darfStatusMap);
    
    operacoesParaAtualizar.forEach(op => {
      const operationKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}`;
      novoMapa.set(operationKey, novoStatus.toLowerCase());
    });

    setDarfStatusMap(novoMapa);
  };
  // DARF status map state (default empty Map)
  const [darfStatusMap, setDarfStatusMap] = useState<Map<string, string>>(
    new Map()
  );
  // ✅ COMPONENTE BADGE DARF - Implementação simplificada
  const DarfBadge = ({ darfStatus, op }: { darfStatus: string | null; op: OperacaoFechada }) => {
    if (!darfStatus) return null;

    const mesOperacao = getMonthName(op.data_fechamento);

    if (darfStatus === "pago") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold border border-green-300 bg-green-100 text-green-700 ml-1 flex items-center gap-1">
          <span>✅</span>
          DARF {mesOperacao}
        </span>
      );
    }
    
    if (darfStatus === "pendente") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold border border-yellow-300 bg-yellow-100 text-yellow-700 ml-1 flex items-center gap-1">
          <span>⏳</span>
          DARF {mesOperacao}
        </span>
      );
    }
    
    if (darfStatus === "vencido") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold border border-red-300 bg-red-100 text-red-700 ml-1 flex items-center gap-1">
          <span>⚠️</span>
          DARF Vencido
        </span>
      );
    }

    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold border border-gray-300 bg-gray-100 text-gray-700 ml-1 flex items-center gap-1">
        <span>📄</span>
        DARF
      </span>
    );
  };

  // Wrapper function para compatibilidade
  const getDarfBadge = (darfStatus: string | null, op: OperacaoFechada) => {
    return <DarfBadge darfStatus={darfStatus} op={op} />;
  };

  // Helper to render status badge - Simplified without circular dependencies
  const getStatusBadge = (
    status: string,
    isProfit: boolean,
    op: OperacaoFechada,
    operacoesFechadas: OperacaoFechada[]
  ) => {
    try {
      const badges = [];

      // ✅ USAR LÓGICA UNIFICADA para determinar status final
      const statusFinal = op.status_ir || "";
      
      // ✅ COMPONENTE BADGE STATUS - Implementação direta
      const StatusBadge = ({ status }: { status: string }) => {
        if (status === "Isento") {
          return (
            <span className="px-2 py-1 rounded-full text-xs font-semibold border border-green-300 bg-green-100 text-green-700">
              Isento
            </span>
          );
        }
        
        if (status === "Tributável Day Trade") {
          return (
            <span className="px-2 py-1 rounded-full text-xs font-semibold border border-orange-300 bg-orange-100 text-orange-700">
              Tributável
            </span>
          );
        }
        
        if (status === "Tributável Swing") {
          return (
            <span className="px-2 py-1 rounded-full text-xs font-semibold border border-blue-300 bg-blue-100 text-blue-700">
              Tributável
            </span>
          );
        }
        
        if (status === "Prejuízo Acumulado") {
          return (
            <span className="px-2 py-1 rounded-full text-xs font-semibold border border-red-300 bg-red-100 text-red-700">
              Prejuízo
            </span>
          );
        }
        
        if (status === "Lucro Compensado") {
          return (
            <span className="px-2 py-1 rounded-full text-xs font-semibold border border-green-300 bg-green-100 text-green-700">
              Compensado
            </span>
          );
        }
        
        return (
          <span className="px-2 py-1 rounded-full text-xs font-semibold border border-gray-300 bg-gray-100 text-gray-700">
            {status || "N/A"}
          </span>
        );
      };

      // Badge principal
      badges.push(
        <StatusBadge key="status-principal" status={statusFinal} />
      );

      // ✅ LÓGICA EXISTENTE: Badge adicional para compensação parcial
      if (
        isProfit &&
        (statusFinal === "Tributável Day Trade" ||
          statusFinal === "Tributável Swing")
      ) {
        try {
          const compensacaoInfo = getCompensacaoInfo(op, operacoesFechadas);

          if (compensacaoInfo?.ehCompensacaoParcial) {
            const CompensacaoPartialBadge = () => (
              <span className="px-2 py-1 rounded-full text-xs font-semibold border border-purple-300 bg-purple-100 text-purple-700 ml-1">
                Compensado Parcial
              </span>
            );
            badges.push(
              <CompensacaoPartialBadge key="compensacao-parcial" />
            );
          }
        } catch (error) {
          console.error('[getStatusBadge] Error calculating compensation info:', error);
        }
      }

      return <div className="flex items-center gap-1 flex-wrap">{badges}</div>;
    } catch (error) {
      console.error('[getStatusBadge] Error rendering status badge:', error);
      return <div className="text-xs text-gray-500">Erro</div>;
    }
  };

  // Expanded rows state and handler
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((rowKey: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey);
      } else {
        newSet.add(rowKey);
      }
      return newSet;
    });
  }, []);

  const {
    operacoesFechadas = [],
    resultadosMensais = [],
    onUpdateDashboard = () => {},
  } = props;

  // 🚀 USAR NOVA API OTIMIZADA
  const { operacoes: operacoesOtimizadas, isLoading: isLoadingOtimizadas, error: errorOtimizadas } = useOperacoesOtimizadas();
  
  // Fallback para API antiga se necessário (SEMPRE chamar o hook)
  const operacoesFallback = useOperacoesComStatusCorrigido(operacoesFechadas, resultadosMensais);
  
  // Escolher qual usar baseado na disponibilidade
  const operacoesComStatusCorrigido = operacoesOtimizadas.length > 0 
    ? operacoesOtimizadas 
    : operacoesFallback;

  console.log('🚀 [TABELA] Usando operações:', {
    otimizadas: operacoesOtimizadas.length,
    fallback: operacoesFallback.length,
    isLoading: isLoadingOtimizadas,
    error: errorOtimizadas,
    usando: operacoesOtimizadas.length > 0 ? 'otimizada' : 'fallback'
  });

  // Performance: Logs de debug removidos para melhorar performance com muitas operações

  // Helper to determine final status of operation (unified logic) - Simplified
  const getFinalStatus = (op: OperacaoFechada): string => {
    try {
      const statusApi = op.status_ir || "";
      
      // ✅ CORREÇÃO FINAL: Confiar COMPLETAMENTE nos dados da API
      // O backend já fez TODA a lógica de compensação, detecção de inconsistências
      // e cálculo correto. O frontend só deve exibir os dados.
      return statusApi; // Usar status já calculado e corrigido da API
    } catch (error) {
      console.error('[getFinalStatus] Error getting final status:', error);
      return "";
    }
  };

  // Helper to determine if operation should show DARF - Optimized
  const shouldShowDarf = (op: any): boolean => {
    try {
      // 🚀 OTIMIZAÇÃO: Priorizar campo pré-calculado da API otimizada
      if (op.deve_gerar_darf !== undefined) {
        const deveGerar = Boolean(op.deve_gerar_darf);
        console.log(`🎯 [DARF] ${op.ticker}: API otimizada → ${deveGerar}`);
        return deveGerar;
      }
      
      // ✅ FALLBACK CORRETO: Usar função deveGerarDarf com lógica completa
      const mesOperacao = op.data_fechamento?.substring(0, 7);
      const resultadoMensal = resultadosMensais?.find(rm => rm.mes === mesOperacao);
      const deveGerar = deveGerarDarf(op, resultadoMensal);
      
      console.log(`🔄 [DARF] ${op.ticker}: Fallback → ${deveGerar}`);
      return deveGerar;
    } catch (error) {
      console.error('[shouldShowDarf] Error checking DARF requirement:', error);
      return false;
    }
  };

  // States and memos...
  // (The rest of the state declarations, useEffects, and helpers remain the same as in the original code, but now we use subcomponents in the render.)

  // Add missing processedOperacoes definition
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  
  // Pagination state - Reduzido para melhor performance
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  // Add any other states needed for sorting, expansion, etc. (not shown for brevity)

  // Unique months and statuses for filters
  const uniqueMonths = useMemo(() => {
    const months = operacoesComStatusCorrigido.map((op) =>
      op.data_fechamento.substring(0, 7)
    );
    return Array.from(new Set(months));
  }, [operacoesComStatusCorrigido]);

  const uniqueStatuses = useMemo(() => {
    const statuses = operacoesComStatusCorrigido
      .map((op) => op.status_ir || "")
      .filter((status) => status !== "");
    return Array.from(new Set(statuses));
  }, [operacoesComStatusCorrigido]);

  // Main processedOperacoes memo
  const processedOperacoes = useMemo(() => {
    let ops = operacoesComStatusCorrigido
      ? [...operacoesComStatusCorrigido]
      : [];

    if (filterType !== "all") {
      ops = ops.filter((op) =>
        filterType === "day_trade" ? op.day_trade : !op.day_trade
      );
    }
    if (filterMonth !== "all") {
      ops = ops.filter(
        (op) =>
          op.data_fechamento &&
          op.data_fechamento.substring(0, 7) === filterMonth
      );
    }
    if (filterStatus !== "all") {
      ops = ops.filter((op) => (op.status_ir || "") === filterStatus);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      ops = ops.filter(
        (op) =>
          op.ticker.toLowerCase().includes(term) ||
          (op.data_fechamento &&
            op.data_fechamento.toLowerCase().includes(term)) ||
          op.resultado.toString().toLowerCase().includes(term) ||
          (op.day_trade ? "day trade" : "swing trade").includes(term)
      );
    }
    return ops;
  }, [
    operacoesComStatusCorrigido,
    filterType,
    filterMonth,
    filterStatus,
    searchTerm,
  ]);

  // Sorting state and logic
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "ascending" | "descending";
  }>({ key: "id", direction: "descending" });

  const requestSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // Toggle direction
        return {
          key,
          direction:
            prev.direction === "ascending" ? "descending" : "ascending",
        };
      }
      return { key, direction: "descending" };
    });
  };

  // Add sorting to processedOperacoes with sequential index
  const sortedOperacoes = useMemo(() => {
    let ops = [...processedOperacoes];
    
    // First, sort by ID ascending to get consistent ordering for sequential numbering
    // This way older operations get lower numbers (#1, #2, #3...)
    ops.sort((a, b) => (a.id || 0) - (b.id || 0));
    
    // Add sequential index (starting from 1 for oldest operations)
    const opsWithIndex = ops.map((op, index) => ({
      ...op,
      sequentialIndex: index + 1
    }));
    
    // Then apply user-requested sorting
    if (!sortConfig.key) return opsWithIndex;
    
    return opsWithIndex.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      // Handle special case for sequential index
      if (sortConfig.key === "id") {
        aValue = a.sequentialIndex;
        bValue = b.sequentialIndex;
      } else {
        aValue = (a as any)[sortConfig.key];
        bValue = (b as any)[sortConfig.key];
      }
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        if (sortConfig.direction === "ascending") {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }
      if (typeof aValue === "number" && typeof bValue === "number") {
        if (sortConfig.direction === "ascending") {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }
      return 0;
    });
  }, [processedOperacoes, sortConfig]);

  // Pagination logic
  const totalPages = Math.ceil(sortedOperacoes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOperacoes = sortedOperacoes.slice(startIndex, endIndex);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterMonth, filterStatus]);

  const totalResultadoOperacoes = processedOperacoes.reduce(
    (acc, op) => acc + op.resultado,
    0
  );
  const totalLucros = processedOperacoes
    .filter((op) => op.resultado > 0)
    .reduce((acc, op) => acc + op.resultado, 0);

  // ✅ CORREÇÃO: Segregar prejuízos DT e ST
  const totalPrejuizosDisponiveis = useMemo(() => {
    if (
      !resultadosMensais ||
      resultadosMensais.length === 0 ||
      !operacoesComStatusCorrigido
    ) {
      console.log("⚠️ [PREJUÍZOS] Dados insuficientes para cálculo");
      return { swing: 0, dayTrade: 0, total: 0 };
    }

    // Log dos dados mensais
    console.log("📊 [PREJUÍZOS] Processando", resultadosMensais?.length || 0, "meses de resultados");

    // NOVA ABORDAGEM: Usar dados dos resultados mensais ao invés de calcular compensações
    // Os resultados mensais já têm os valores corretos calculados pelo backend
    console.log("� [DEBUG PREJUÍZOS] Resultados mensais:", resultadosMensais);

    // Pegar prejuízos do último mês (SEPARADOS) - não modificar o array original
    const mesesOrdenados = [...resultadosMensais].sort((a, b) =>
      b.mes.localeCompare(a.mes)
    );
    const ultimoMes = mesesOrdenados[0];

    if (!ultimoMes) {
      console.log("⚠️ [PREJUÍZOS] Último mês não encontrado");
      return { swing: 0, dayTrade: 0, total: 0 };
    }

    // ✅ CORREÇÃO: Usar prejuízos acumulados diretamente do backend
    // O backend já calcula corretamente considerando compensações
    const prejuizoDisponivelSwing = ultimoMes?.prejuizo_acumulado_swing || 0;
    const prejuizoDisponivelDay = ultimoMes?.prejuizo_acumulado_day || 0;

    const resultado = {
      swing: Math.max(0, prejuizoDisponivelSwing),
      dayTrade: Math.max(0, prejuizoDisponivelDay),
      total: Math.max(0, prejuizoDisponivelSwing) + Math.max(0, prejuizoDisponivelDay),
    };

    // Log resumido apenas se houver prejuízos ou em caso de erro
    if (resultado.total > 0 || (ultimoMes.prejuizo_acumulado_swing === undefined)) {
      console.log(`💰 [PREJUÍZOS] ${ultimoMes.mes}: Swing R$ ${resultado.swing.toLocaleString('pt-BR')}, Day R$ ${resultado.dayTrade.toLocaleString('pt-BR')}, Total R$ ${resultado.total.toLocaleString('pt-BR')}`);
    }

    return resultado;
  }, [resultadosMensais, operacoesComStatusCorrigido]);

  const operacoesTributaveis = processedOperacoes.filter((op) =>
    op.status_ir?.includes("Tributável")
  ).length;

  const hasOriginalData = operacoesFechadas.length > 0;
  const hasFilteredResults = processedOperacoes.length > 0;

  if (!hasOriginalData) {
    return (
      <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                Operações Encerradas
              </CardTitle>
              <CardDescription className="text-indigo-100">
                Histórico de suas operações de compra e venda finalizadas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-12">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-6">
              <Building2 className="h-12 w-12 text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Comece sua jornada!
            </h3>
            <p className="text-gray-600 text-lg mb-4">
              Suas operações finalizadas aparecerão aqui
            </p>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Execute algumas operações de compra e venda para ver o histórico e
              análise de resultados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasFilteredResults) {
    return (
      <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">
                  Operações Encerradas
                </CardTitle>
                <CardDescription className="text-indigo-100">
                  Histórico de suas operações de compra e venda finalizadas
                </CardDescription>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-white/80" />
                <span className="text-xs font-medium text-white/80 uppercase tracking-wide">
                  Resultado Total:
                </span>
                <span className="text-sm font-bold text-white">R$ 0,00</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Filters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterType={filterType}
            setFilterType={setFilterType}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            uniqueMonths={uniqueMonths}
            uniqueStatuses={uniqueStatuses}
          />
          <div className="text-center py-12">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Nenhuma operação encontrada
            </h3>
            <p className="text-gray-600 mb-4">
              Ajuste os filtros ou tente outros termos de pesquisa
            </p>
            <Button
              onClick={() => {
                setSearchTerm("");
                setFilterType("all");
                setFilterMonth("all");
                setFilterStatus("all");
              }}
              variant="outline"
              className="rounded-xl border-2 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50"
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">
                  Operações Encerradas
                </CardTitle>
                <CardDescription className="text-indigo-100">
                  Histórico de suas operações de compra e venda finalizadas
                </CardDescription>
              </div>
            </div>
            <SummaryCards
              totalResultadoOperacoes={totalResultadoOperacoes}
              totalLucros={totalLucros}
              totalPrejuizosDisponiveis={totalPrejuizosDisponiveis} // ✅ NOME CORRETO
              operacoesTributaveis={operacoesTributaveis}
            />
          </div>
        </CardHeader>
        <CardContent className="p-6 pb-0">
          <Filters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterType={filterType}
            setFilterType={setFilterType}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            uniqueMonths={uniqueMonths}
            uniqueStatuses={uniqueStatuses}
          />
          <TableHeader sortConfig={sortConfig} requestSort={requestSort} />
          <div className="border border-indigo-200 border-t-0 overflow-hidden">
            {paginatedOperacoes.map((op, index) => {
              const globalIndex = startIndex + index;
              return (
                <OperationRow
                  key={`${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${globalIndex}`} // Simplified key without DARF status
                  op={op}
                  index={globalIndex}
                  isExpanded={expandedRows.has(
                    `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${globalIndex}`
                  )}
                  toggleRow={toggleRow}
                  isProfit={op.resultado >= 0}
                  getStatusBadge={getStatusBadge}
                  getDarfBadge={getDarfBadge}
                  getDarfStatusForOperation={getDarfStatusForOperation}
                  shouldShowDarf={shouldShowDarf}
                  darfStatusMap={darfStatusMap}
                  handleOpenDarfModal={handleOpenDarfModal}
                  operacoesFechadas={operacoesComStatusCorrigido}
                  resultadosMensais={resultadosMensais} // ✅ Apenas uma vez
                />
              );
            })}
          </div>
        </CardContent>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedOperacoes.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </Card>

      {isDarfModalOpen && selectedOpForDarf && (
        <DarfComprehensiveModal
          isOpen={isDarfModalOpen}
          onClose={() => setIsDarfModalOpen(false)}
          operacoesFechadas={operacoesComStatusCorrigido}
          mes={selectedOpForDarf.mes_operacao || selectedOpForDarf.data_fechamento.substring(0, 7)}
          tipo={selectedOpForDarf.day_trade ? "daytrade" : "swing"}
          onStatusUpdate={handleDarfStatusUpdate}
        />
      )}
    </>
  );
}

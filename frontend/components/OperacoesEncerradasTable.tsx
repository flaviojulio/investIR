"use client";

import {
  getCompensacaoInfo,
  calcularPrejuizoAcumuladoAteOperacao,
  calcularDetalhesCompensacao,
  useOperacoesComStatusCorrigido,
  deveGerarDarf,
  debugLogicaFiscal,
  calcularCompensacaoMensal, // ✅ DESCOMENTAR ESTA LINHA
  getCompensacaoInfoMensal, // ✅ ADICIONAR ESTA LINHA
  type CompensacaoInfo,
  type DetalhesCompensacao,
  type PrejuizoAcumuladoInfo,
} from "@/lib/fiscal-utils";

import React, { useState, useEffect, useMemo } from "react";
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

// DARF status helper
const getDarfStatusForOperation = (
  op: OperacaoFechada,
  darfStatusMap?: Map<string, string>,
  resultadosMensais?: ResultadoMensal[]
): string | null => {
  // ✅ NOVA VERIFICAÇÃO: Só mostra DARF se realmente deve gerar
  const mesOperacao = op.data_fechamento.substring(0, 7);
  const resultadoMensal = resultadosMensais?.find(
    (rm) => rm.mes === mesOperacao
  );

  if (!deveGerarDarf(op, resultadoMensal)) {
    console.log(`🚫 [DARF] ${op.ticker}: Não deve gerar DARF`, {
      valorTributavel: op.day_trade
        ? resultadoMensal?.ir_devido_day || 0
        : resultadoMensal?.ir_devido_swing || 0,
    });
    return null; // Não deve mostrar badge de DARF
  }

  // Só mostra DARF para operações que realmente devem tributar
  if (
    op.status_ir !== "Tributável Day Trade" &&
    op.status_ir !== "Tributável Swing"
  ) {
    return null;
  }

  const operationKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}`;

  // ✅ PRIORIDADE 1: Status manual do usuário
  if (darfStatusMap && darfStatusMap.has(operationKey)) {
    const status = darfStatusMap.get(operationKey);
    console.log("🎯 [DARF STATUS] Status do mapa encontrado:", status);
    return status;
  }

  // ✅ PRIORIDADE 2: Status do backend
  if (resultadoMensal) {
    const statusBackend = op.day_trade
      ? resultadoMensal.status_darf_day_trade
      : resultadoMensal.status_darf_swing_trade;

    console.log("🎯 [DARF STATUS] Status do backend:", {
      mesOperacao,
      isDayTrade: op.day_trade,
      statusBackend,
    });

    if (statusBackend) {
      return statusBackend.toLowerCase(); // "Pago" → "pago"
    }
  }

  // ✅ PRIORIDADE 3: Status padrão
  return "pendente";
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
  ) => JSX.Element;
  getDarfBadge: (
    darfStatus: string | null,
    op: OperacaoFechada
  ) => JSX.Element | null;
  getDarfStatusForOperation: (
    op: OperacaoFechada,
    darfStatusMap?: Map<string, string>,
    resultadosMensais?: ResultadoMensal[]
  ) => string | null;
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
      <div className="col-span-3 flex items-center gap-1">
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

// Subcomponent: OperationRow
const OperationRow = ({
  op,
  index,
  isExpanded,
  toggleRow,
  isProfit,
  getStatusBadge,
  getDarfBadge,
  getDarfStatusForOperation,
  darfStatusMap,
  handleOpenDarfModal,
  operacoesFechadas,
  resultadosMensais, // ✅ Usar apenas a prop da interface oficial
}: OperationRowProps) => {
  // ✅ Usar a interface oficial
  const rowKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${index}`;
  console.log("🔍 [DEBUG] Campos da operação:", {
    // Campos diretos do backend
    preco_medio_compra: op.preco_medio_compra,
    preco_medio_venda: op.preco_medio_venda,
    // Campos calculados
    getPrecoMedioCompra: getPrecoMedioCompra(op),
    getPrecoMedioVenda: getPrecoMedioVenda(op),
  });

  return (
    <div
      key={rowKey}
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

        <div className="col-span-3 flex items-center">
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
              op.resultado === 0 ? "Isento" : op.status_ir || "",
              isProfit,
              op,
              operacoesFechadas
            )}
            {(op.status_ir === "Tributável Day Trade" ||
              op.status_ir === "Tributável Swing") &&
              getDarfBadge(
                getDarfStatusForOperation(op, darfStatusMap, resultadosMensais), // ✅ Ordem correta
                op
              )}
          </div>
        </div>
      </div>

      {/* Expanded Row */}
      {isExpanded && (
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
                    {/* Card de Preço de Compra */}
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

                    {/* Card de Preço de Venda */}
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

                  {/* ✅ RESULTADO FINAL COM PERCENTUAL CORRIGIDO */}
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
                          {/* ✅ PERCENTUAL COM LÓGICA CORRIGIDA */}
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

                        {/* Badges */}
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          {getStatusBadge(
                            op.status_ir || "",
                            isProfit,
                            op,
                            operacoesFechadas
                          )}
                          {(op.status_ir === "Tributável Day Trade" ||
                            op.status_ir === "Tributável Swing") &&
                            getDarfBadge(
                              getDarfStatusForOperation(
                                op,
                                darfStatusMap,
                                resultadosMensais
                              ), // ✅ Ordem correta
                              op
                            )}
                        </div>
                        {/* Descrições */}
                        <div className="text-xs text-indigo-700 leading-relaxed space-y-1">
                          <div>
                            <span className="font-semibold">Tributação:</span>{" "}
                            {op.status_ir === "Isento" &&
                              "Operação isenta de imposto de renda"}
                            {op.status_ir === "Tributável Day Trade" &&
                              "Sujeita a IR de 20% sobre o lucro"}
                            {op.status_ir === "Tributável Swing" &&
                              "Sujeita a IR de 15% sobre o lucro"}
                            {op.status_ir === "Prejuízo Acumulado" &&
                              "Prejuízo para compensação em outras operações"}
                            {op.status_ir === "Lucro Compensado" &&
                              "Lucro compensado por prejuízos em outras operações de mesmo tipo"}
                            {!op.status_ir &&
                              (() => {
                                console.log(
                                  "[DEBUG] Operação sem status_ir definido:",
                                  op
                                );
                                return "Status não definido";
                              })()}
                          </div>
                        </div>
                      </div>

                      {/* Prejuízo Accumulation Card */}
                      {!isProfit && (
                        <div className="flex flex-col p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <Info className="h-4 w-4 text-orange-600" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                              Acúmulo de Prejuízo (
                              {op.day_trade ? "Day Trade" : "Swing Trade"})
                            </span>
                          </div>
                          <div className="text-xs text-orange-700 leading-relaxed space-y-3">
                            {(() => {
                              const tipoOperacao = op.day_trade
                                ? "day trade"
                                : "swing trade";

                              // ✅ CORRIGIDO: Buscar prejuízo do MESMO TIPO apenas
                              const prejuizoDisponivelCorreto = useMemo(() => {
                                if (
                                  !resultadosMensais ||
                                  resultadosMensais.length === 0
                                )
                                  return 0;

                                const mesOperacao =
                                  op.data_fechamento.substring(0, 7);

                                // 1️⃣ Buscar o resultado mensal para esta operação
                                const resultadoMes = resultadosMensais.find(
                                  (rm) => rm.mes === mesOperacao
                                );

                                if (resultadoMes) {
                                  // ✅ SEGREGAÇÃO: Retorna apenas prejuízo do mesmo tipo
                                  return op.day_trade
                                    ? resultadoMes.prejuizo_acumulado_day || 0
                                    : resultadoMes.prejuizo_acumulado_swing ||
                                        0;
                                }

                                // 2️⃣ Se não encontrou o mês, buscar o último mês anterior
                                const mesesAnteriores = resultadosMensais
                                  .filter((rm) => rm.mes < mesOperacao)
                                  .sort((a, b) => b.mes.localeCompare(a.mes));

                                if (mesesAnteriores.length > 0) {
                                  const ultimoMesAnterior = mesesAnteriores[0];
                                  // ✅ SEGREGAÇÃO: Retorna apenas prejuízo do mesmo tipo
                                  return op.day_trade
                                    ? ultimoMesAnterior.prejuizo_acumulado_day ||
                                        0
                                    : ultimoMesAnterior.prejuizo_acumulado_swing ||
                                        0;
                                }

                                return 0;
                              }, [op, resultadosMensais]);

                              return (
                                <>
                                  {/* Card principal corrigido */}
                                  <div className="bg-white/60 rounded-lg p-3 border border-orange-300/50 mt-4">
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                      <div className="text-center flex-1">
                                        <div className="text-xs text-orange-600 mb-1">
                                          Prejuízo Acumulado{" "}
                                          {op.day_trade
                                            ? "Day Trade"
                                            : "Swing Trade"}
                                        </div>
                                        <div className="text-red-700 font-bold text-lg bg-red-100 rounded px-2 py-1">
                                          {formatCurrency(
                                            prejuizoDisponivelCorreto
                                          )}
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1">
                                          {prejuizoDisponivelCorreto > 0
                                            ? `Baseado nos resultados mensais oficiais`
                                            : "Primeira operação com prejuízo"}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* ✅ NOVA SEÇÃO: Explicação da segregação */}
                                  <div className="bg-blue-100 border border-blue-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-blue-600">⚖️</span>
                                      <span className="font-semibold text-blue-800 text-xs">
                                        Regra de Segregação Fiscal
                                      </span>
                                    </div>
                                    <div className="text-xs text-blue-700 space-y-1">
                                      <div>
                                        • <strong>Day Trade:</strong> Só
                                        compensa prejuízos de Day Trade
                                      </div>
                                      <div>
                                        • <strong>Swing Trade:</strong> Só
                                        compensa prejuízos de Swing Trade
                                      </div>
                                      <div className="mt-2 p-2 bg-blue-50 rounded">
                                        <strong>⚠️ Importante:</strong> Não há
                                        compensação cruzada entre os tipos
                                      </div>
                                    </div>
                                  </div>

                                  {/* Explicação da compensação futura */}
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <div className="flex items-start gap-2">
                                      <div className="text-green-600 mt-0.5">
                                        ✨
                                      </div>
                                      <div className="text-green-700 text-xs leading-relaxed">
                                        <div className="font-semibold mb-1">
                                          Compensação futura:
                                        </div>
                                        <div>
                                          Quando você tiver lucros em operações
                                          de{" "}
                                          <span className="font-bold">
                                            {tipoOperacao}
                                          </span>
                                          , este saldo de{" "}
                                          <span className="font-bold text-red-700">
                                            {formatCurrency(
                                              prejuizoDisponivelCorreto
                                            )}
                                          </span>{" "}
                                          será automaticamente descontado,
                                          reduzindo ou eliminando o imposto a
                                          pagar.
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* ✅ PROFIT COMPENSATION CARD - CORRIGIDO COM SEGREGAÇÃO */}
                      {isProfit &&
                        (op.status_ir === "Lucro Compensado" ||
                          op.status_ir === "Tributável Day Trade" ||
                          op.status_ir === "Tributável Swing") &&
                        (() => {
                          const detalhes = calcularDetalhesCompensacao(
                            op,
                            operacoesFechadas
                          );
                          const tipoOperacao = op.day_trade
                            ? "Day Trade"
                            : "Swing Trade";

                          // Se não há compensação, não mostrar o card
                          if (detalhes.valorCompensado <= 0) return null;

                          return (
                            <div className="flex flex-col p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm">
                              <div className="flex items-center gap-2 mb-4">
                                {detalhes.lucroTributavel === 0 ? (
                                  <>
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    <span className="text-sm font-bold uppercase tracking-wide text-green-700">
                                      ✅ Compensação Total de Prejuízo
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Info className="h-5 w-5 text-orange-600" />
                                    <span className="text-sm font-bold uppercase tracking-wide text-orange-700">
                                      ⚖️ Compensação Parcial de Prejuízo
                                    </span>
                                  </>
                                )}
                              </div>

                              <div className="text-xs leading-relaxed space-y-3">
                                {/* ✅ ITEM 4: Card de compensação com segregação */}
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-yellow-600">⚖️</span>
                                    <span className="font-semibold text-yellow-800">
                                      Compensação {tipoOperacao}
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="text-xs">
                                      • <strong>Tipo de operação:</strong>{" "}
                                      {tipoOperacao}
                                    </div>
                                    <div className="text-xs">
                                      • <strong>Lucro da operação:</strong>{" "}
                                      {formatCurrency(detalhes.lucroOperacao)}
                                    </div>
                                    <div className="text-xs">
                                      •{" "}
                                      <strong>
                                        Prejuízo disponível (mesmo tipo):
                                      </strong>{" "}
                                      {formatCurrency(
                                        detalhes.prejuizoAnteriorDisponivel
                                      )}
                                    </div>
                                    <div className="text-xs">
                                      • <strong>Valor compensado:</strong>{" "}
                                      {formatCurrency(detalhes.valorCompensado)}
                                    </div>
                                    <div className="text-xs">
                                      •{" "}
                                      <strong>
                                        Lucro tributável restante:
                                      </strong>{" "}
                                      {formatCurrency(detalhes.lucroTributavel)}
                                    </div>
                                  </div>
                                </div>

                                {/* Card de explicação da regra fiscal */}
                                <div className="text-xs bg-blue-100 border border-blue-200 rounded p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-blue-600">💡</span>
                                    <strong className="text-blue-800">
                                      Regra Fiscal Importante:
                                    </strong>
                                  </div>
                                  <div className="text-blue-700">
                                    Prejuízos de <strong>Day Trade</strong> só
                                    compensam lucros de{" "}
                                    <strong>Day Trade</strong>.<br />
                                    Prejuízos de <strong>Swing Trade</strong> só
                                    compensam lucros de{" "}
                                    <strong>Swing Trade</strong>.<br />
                                    <em>
                                      Não há compensação cruzada entre os tipos.
                                    </em>
                                  </div>
                                </div>

                                {/* Status final */}
                                <div
                                  className={`rounded-xl p-3 ${
                                    detalhes.lucroTributavel === 0
                                      ? "bg-green-100 border border-green-300"
                                      : "bg-blue-100 border border-blue-300"
                                  }`}
                                >
                                  <div className="text-center">
                                    <div
                                      className={`font-bold text-sm ${
                                        detalhes.lucroTributavel === 0
                                          ? "text-green-800"
                                          : "text-blue-800"
                                      }`}
                                    >
                                      {detalhes.lucroTributavel === 0
                                        ? "🎉 OPERAÇÃO TOTALMENTE COMPENSADA"
                                        : "📊 COMPENSAÇÃO PARCIAL APLICADA"}
                                    </div>
                                    {detalhes.lucroTributavel === 0 ? (
                                      <div className="text-xs text-green-700 mt-1">
                                        Imposto de Renda:{" "}
                                        <strong>R$ 0,00</strong>
                                      </div>
                                    ) : (
                                      <div className="text-xs text-blue-700 mt-1">
                                        IR sobre{" "}
                                        {formatCurrency(
                                          detalhes.lucroTributavel
                                        )}{" "}
                                        ={" "}
                                        <strong>
                                          {formatCurrency(
                                            detalhes.lucroTributavel *
                                              (op.day_trade ? 0.2 : 0.15)
                                          )}
                                        </strong>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                      {/* DARF Button */}
                      {(op.status_ir === "Tributável Day Trade" ||
                        op.status_ir === "Tributável Swing") && (
                        <div className="flex items-center justify-center mt-2">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation(); // ✅ Prevenir chamadas duplicadas por bubbling
                              handleOpenDarfModal(op);
                            }}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Ver Detalhes do DARF
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
      )}
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

    {/* Card 3: Prejuízo Acumulado - VERSÃO SEGREGADA */}
    <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="h-4 w-4 text-red-600" />
        <span className="text-sm font-semibold text-red-800">
          Prejuízos Acumulados (Disponíveis)
        </span>
      </div>

      <div className="space-y-3">
        {/* Swing Trade */}
        <div className="bg-white/60 rounded-lg p-3 border border-red-200">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-red-700">
              Swing Trade
            </span>
            <span className="text-sm font-bold text-red-900">
              {formatCurrency(totalPrejuizosDisponiveis.swing)}
            </span>
          </div>
          {totalPrejuizosDisponiveis.swing > 0 && (
            <div className="text-xs text-red-600">
              Compensa apenas lucros de Swing Trade
            </div>
          )}
        </div>

        {/* Day Trade */}
        <div className="bg-white/60 rounded-lg p-3 border border-red-200">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-red-700">Day Trade</span>
            <span className="text-sm font-bold text-red-900">
              {formatCurrency(totalPrejuizosDisponiveis.dayTrade)}
            </span>
          </div>
          {totalPrejuizosDisponiveis.dayTrade > 0 && (
            <div className="text-xs text-red-600">
              Compensa apenas lucros de Day Trade
            </div>
          )}
        </div>

        {/* Total (apenas informativo) */}
        <hr className="border-red-300" />
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-red-700">
            Total Disponível
          </span>
          <span className="text-lg font-bold text-red-900">
            {formatCurrency(totalPrejuizosDisponiveis.total)}
          </span>
        </div>
      </div>
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
    console.log("🔄 [DARF STATUS] Atualizando:", { operationKey, newStatus });

    setDarfStatusMap((prev) => {
      const updated = new Map(prev);
      updated.set(operationKey, newStatus);
      console.log(
        "🔄 [DARF STATUS] Map atualizado:",
        Array.from(updated.entries())
      );
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
    console.log("📂 [DARF MODAL] Abrindo modal para operação:", {
      ticker: op.ticker,
      data_abertura: op.data_abertura,
      data_fechamento: op.data_fechamento,
      quantidade: op.quantidade,
      operationKey: `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}`,
      status_ir: op.status_ir,
    });

    setSelectedOpForDarf(op);
    setIsDarfModalOpen(true);
  };
  // DARF status map state (default empty Map)
  const [darfStatusMap, setDarfStatusMap] = useState<Map<string, string>>(
    new Map()
  );
  // Helper to render DARF badge
  // ✅ CORREÇÃO 3: Badge do DARF com ícones e cores corretas
  const getDarfBadge = (darfStatus: string | null, op: OperacaoFechada) => {
    if (!darfStatus) return null;

    let color = "gray";
    let bg = "bg-gray-100";
    let text = "DARF";
    let icon = "📄";

    if (darfStatus === "pago") {
      color = "green";
      bg = "bg-green-100";
      text = "DARF Pago";
      icon = "✅";
    } else if (darfStatus === "pendente") {
      color = "amber";
      bg = "bg-amber-100";
      text = "DARF Pendente";
      icon = "⏳";
    } else if (darfStatus === "vencido") {
      color = "red";
      bg = "bg-red-100";
      text = "DARF Vencido";
      icon = "⚠️";
    }

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold border border-${color}-300 ${bg} text-${color}-700 ml-1 flex items-center gap-1`}
      >
        <span>{icon}</span>
        {text}
      </span>
    );
  };

  // Helper to render status badge
  const getStatusBadge = (
    status: string,
    isProfit: boolean,
    op: OperacaoFechada,
    operacoesFechadas: OperacaoFechada[]
  ) => {
    const badges = [];

    // ✅ NOVA VERIFICAÇÃO: Confirmar se realmente deve ser tributável
    let statusFinal = status;
    if (
      isProfit &&
      (status === "Tributável Day Trade" || status === "Tributável Swing")
    ) {
      // Verificar com o resultado mensal se realmente deve tributar
      const mesOperacao = op.data_fechamento.substring(0, 7);
      const resultadoMensal = resultadosMensais.find(
        (rm) => rm.mes === mesOperacao
      );

      if (resultadoMensal && !deveGerarDarf(op, resultadoMensal)) {
        statusFinal = "Lucro Compensado";
        console.log(
          `🔄 [BADGE CORRIGIDO] ${op.ticker}: ${status} → ${statusFinal}`
        );
      }
    }

    // Badge principal do status fiscal
    let color = "gray";
    let bg = "bg-gray-100";
    let text = statusFinal;

    if (statusFinal === "Isento") {
      color = "green";
      bg = "bg-green-100";
      text = "Isento";
    } else if (statusFinal === "Tributável Day Trade") {
      color = "orange";
      bg = "bg-orange-100";
      text = "Tributável";
    } else if (statusFinal === "Tributável Swing") {
      color = "blue";
      bg = "bg-blue-100";
      text = "Tributável";
    } else if (statusFinal === "Prejuízo Acumulado") {
      color = "red";
      bg = "bg-red-100";
      text = "Prejuízo";
    } else if (statusFinal === "Lucro Compensado") {
      color = "emerald";
      bg = "bg-emerald-100";
      text = "Compensado";
    }

    // Badge principal
    badges.push(
      <span
        key="status-principal"
        className={`px-2 py-1 rounded-full text-xs font-semibold border border-${color}-300 ${bg} text-${color}-700`}
      >
        {text}
      </span>
    );

    // ✅ NOVA LÓGICA: Badge adicional para compensação parcial
    if (
      isProfit &&
      (statusFinal === "Tributável Day Trade" ||
        statusFinal === "Tributável Swing")
    ) {
      const compensacaoInfo = getCompensacaoInfo(op, operacoesFechadas);

      if (compensacaoInfo.ehCompensacaoParcial) {
        badges.push(
          <span
            key="compensacao-parcial"
            className="px-2 py-1 rounded-full text-xs font-semibold border border-purple-300 bg-purple-100 text-purple-700 ml-1"
          >
            Compensado Parcial
          </span>
        );
      }
    }

    return <div className="flex items-center gap-1 flex-wrap">{badges}</div>;
  };

  // Expanded rows state and handler
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (rowKey: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey);
      } else {
        newSet.add(rowKey);
      }
      return newSet;
    });
  };

  const {
    operacoesFechadas = [],
    resultadosMensais = [],
    onUpdateDashboard = () => {},
  } = props;

  const operacoesComStatusCorrigido = useOperacoesComStatusCorrigido(
    operacoesFechadas,
    resultadosMensais
  );

  // States and memos...
  // (The rest of the state declarations, useEffects, and helpers remain the same as in the original code, but now we use subcomponents in the render.)

  // Add missing processedOperacoes definition
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
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
  }>({ key: "data_fechamento", direction: "descending" });

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

  // Add sorting to processedOperacoes
  const sortedOperacoes = useMemo(() => {
    const ops = [...processedOperacoes];
    if (!sortConfig.key) return ops;
    return ops.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
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
    )
      return { swing: 0, dayTrade: 0, total: 0 };

    // Calcular compensações usadas POR TIPO
    const compensacoesUsadas = operacoesComStatusCorrigido.reduce(
      (acc, op) => {
        if (
          op.resultado > 0 &&
          (op.status_ir === "Lucro Compensado" ||
            op.status_ir?.includes("Tributável"))
        ) {
          const detalhes = calcularDetalhesCompensacao(
            op,
            operacoesComStatusCorrigido
          );

          // Segregar por tipo de operação
          if (op.day_trade) {
            acc.dayTrade += detalhes.valorCompensado;
          } else {
            acc.swing += detalhes.valorCompensado;
          }
        }
        return acc;
      },
      { swing: 0, dayTrade: 0 }
    );

    // Pegar prejuízos do último mês (SEPARADOS)
    const ultimoMes = resultadosMensais.sort((a, b) =>
      b.mes.localeCompare(a.mes)
    )[0];

    const prejuizoTotalSwing = ultimoMes?.prejuizo_acumulado_swing || 0;
    const prejuizoTotalDay = ultimoMes?.prejuizo_acumulado_day || 0;

    // Calcular disponível de cada tipo SEPARADAMENTE
    const prejuizoDisponivelSwing = Math.max(
      0,
      prejuizoTotalSwing - compensacoesUsadas.swing
    );
    const prejuizoDisponivelDay = Math.max(
      0,
      prejuizoTotalDay - compensacoesUsadas.dayTrade
    );

    console.log("🔍 [PREJUÍZOS SEGREGADOS]", {
      swing: {
        total: prejuizoTotalSwing,
        usado: compensacoesUsadas.swing,
        disponivel: prejuizoDisponivelSwing,
      },
      dayTrade: {
        total: prejuizoTotalDay,
        usado: compensacoesUsadas.dayTrade,
        disponivel: prejuizoDisponivelDay,
      },
    });

    return {
      swing: prejuizoDisponivelSwing,
      dayTrade: prejuizoDisponivelDay,
      total: prejuizoDisponivelSwing + prejuizoDisponivelDay,
    };
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
          <TableHeader sortConfig={sortConfig} requestSort={requestSort} />
          <div className="border border-indigo-200 border-t-0 rounded-b-xl overflow-hidden">
            {sortedOperacoes.map((op, index) => (
              <OperationRow
                key={`${op.ticker}-${
                  op.data_fechamento
                }-${index}-${getDarfStatusForOperation(
                  op,
                  darfStatusMap,
                  resultadosMensais
                )}`} // ✅ Ordem correta
                op={op}
                index={index}
                isExpanded={expandedRows.has(
                  `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${index}`
                )}
                toggleRow={toggleRow}
                isProfit={op.resultado >= 0}
                getStatusBadge={getStatusBadge}
                getDarfBadge={getDarfBadge}
                getDarfStatusForOperation={getDarfStatusForOperation}
                darfStatusMap={darfStatusMap}
                handleOpenDarfModal={handleOpenDarfModal}
                operacoesFechadas={operacoesComStatusCorrigido}
                resultadosMensais={resultadosMensais} // ✅ Apenas uma vez
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {isDarfModalOpen && selectedOpForDarf && (
        <DarfDetailsModal
          isOpen={isDarfModalOpen}
          onClose={() => setIsDarfModalOpen(false)}
          operacaoFechada={selectedOpForDarf}
          tipoDarf={selectedOpForDarf.day_trade ? "daytrade" : "swing"}
          onUpdateDashboard={handleUpdateDashboard}
          onDarfStatusChange={handleDarfStatusChange}
          operacoesFechadas={operacoesComStatusCorrigido}
        />
      )}
    </>
  );
}

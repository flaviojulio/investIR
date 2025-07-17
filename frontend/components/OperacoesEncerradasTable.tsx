"use client";

import {
  getCompensacaoInfo,
  calcularPrejuizoAcumuladoAteOperacao,
  calcularDetalhesCompensacao,
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
  resultadosMensais?: ResultadoMensal[] // ✅ ADICIONAR este parâmetro
): string | null => {
  // Só mostra DARF para operações tributáveis
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
  if (resultadosMensais && Array.isArray(resultadosMensais)) {
    const mesOperacao = op.data_fechamento.substring(0, 7);
    const resultadoMensal = resultadosMensais.find(
      (rm) => rm.mes === mesOperacao
    );

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
  }

  // ✅ PRIORIDADE 3: Status padrão
  return "pendente";
};

interface OperacoesEncerradasTableProps {
  operacoesFechadas?: OperacaoFechada[];
  resultadosMensais?: ResultadoMensal[];
  onUpdateDashboard?: () => void;
}

interface OperacaoFechada {
  ticker: string;
  quantidade: number;
  resultado: number;
  day_trade: boolean;
  data_fechamento: string;
  data_abertura?: string;
  status_ir?: string;
  valor_compra?: number;
  valor_venda?: number;
  prejuizo_anterior_acumulado?: number;
  preco_abertura?: number;
  preco_fechamento?: number;
  // ...outros campos possíveis
}

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
  ) => JSX.Element; // ✅ ATUALIZADA
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
  resultadosMensais: ResultadoMensal[];
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
  if (op.ticker === "VALE3") {
    console.log("🔍 [CARDS DEBUG] Dados da operação VALE3:", {
      ticker: op.ticker,
      quantidade: op.quantidade,
      preco_abertura: op.preco_abertura, // ✅ Existe
      preco_fechamento: op.preco_fechamento, // ✅ Existe
      valor_compra: op.valor_compra,
      valor_venda: op.valor_venda,
      resultado: op.resultado,
      // Campos extras para diagnóstico
      day_trade: op.day_trade,
      data_fechamento: op.data_fechamento,
      status_ir: op.status_ir,
    });
  }
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
                    <div className="flex flex-col p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-green-600">
                          Preço Médio de Compra
                        </span>
                      </div>
                      <span className="text-sm font-bold text-green-800">
                        {formatCurrency(
                          op.preco_abertura && op.preco_abertura > 0
                            ? op.preco_abertura
                            : op.valor_compra && op.quantidade
                            ? op.valor_compra / op.quantidade
                            : 0
                        )}
                      </span>
                    </div>

                    <div className="flex flex-col p-3 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingDown className="h-3 w-3 text-cyan-600" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-600">
                          Preço de Venda
                        </span>
                      </div>
                      <span className="text-sm font-bold text-cyan-800">
                        {formatCurrency(
                          op.preco_fechamento && op.preco_fechamento > 0
                            ? op.preco_fechamento
                            : op.valor_venda && op.quantidade
                            ? op.valor_venda / op.quantidade
                            : 0
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Resultado Final */}
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
                          {/* ✅ ADICIONAR apenas estas linhas: */}
                          {(() => {
                            const valorInvestido =
                              op.valor_compra ||
                              (op.preco_abertura && op.preco_abertura > 0
                                ? op.preco_abertura * op.quantidade
                                : 0);
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
                              Acúmulo de Prejuízo
                            </span>
                          </div>
                          <div className="text-xs text-orange-700 leading-relaxed space-y-3">
                            {(() => {
                              const tipoOperacao = op.day_trade
                                ? "day trade"
                                : "swing trade";

                              // ✅ NOVO CÁLCULO: Prejuízo acumulado até esta operação
                              const {
                                prejuizoAnterior,
                                prejuizoAteOperacao,
                                operacoesAnteriores,
                              } = calcularPrejuizoAcumuladoAteOperacao(
                                op,
                                operacoesFechadas
                              );

                              const mesOperacao = op.data_fechamento.substring(
                                0,
                                7
                              );
                              const diaOperacao = op.data_fechamento.substring(
                                0,
                                10
                              );

                              // Operações do mesmo dia para mostrar fluxo
                              const operacoesMesmoDia = operacoesFechadas
                                .filter(
                                  (opDia) =>
                                    opDia.data_fechamento.substring(0, 10) ===
                                      diaOperacao &&
                                    (opDia.day_trade
                                      ? "day trade"
                                      : "swing trade") === tipoOperacao
                                )
                                .sort((a, b) =>
                                  a.data_fechamento.localeCompare(
                                    b.data_fechamento
                                  )
                                );

                              const isMultiplasOperacoesDia =
                                operacoesMesmoDia.length > 1;

                              // Fluxo sequencial do dia (se houver múltiplas operações)
                              let fluxoDia = [];
                              if (isMultiplasOperacoesDia) {
                                const indexOperacaoAtual =
                                  operacoesMesmoDia.findIndex(
                                    (opDia) =>
                                      opDia.ticker === op.ticker &&
                                      opDia.data_fechamento ===
                                        op.data_fechamento &&
                                      opDia.resultado === op.resultado
                                  );

                                let saldoSequencial = prejuizoAnterior; // ✅ Usar prejuízo anterior correto
                                fluxoDia = operacoesMesmoDia.map(
                                  (opSeq, idx) => {
                                    const saldoAnterior = saldoSequencial;

                                    // Adicionar prejuízo ou subtrair compensação
                                    if (opSeq.resultado < 0) {
                                      saldoSequencial += Math.abs(
                                        opSeq.resultado
                                      );
                                    } else if (
                                      opSeq.resultado > 0 &&
                                      saldoSequencial > 0
                                    ) {
                                      const compensacao = Math.min(
                                        saldoSequencial,
                                        opSeq.resultado
                                      );
                                      saldoSequencial -= compensacao;
                                    }

                                    return {
                                      operacao: opSeq,
                                      index: idx,
                                      saldoAnterior,
                                      saldoAtual: saldoSequencial,
                                      isOperacaoAtual:
                                        idx === indexOperacaoAtual,
                                    };
                                  }
                                );
                              }

                              return (
                                <>
                                  {/* Fluxo do dia (se múltiplas operações) */}
                                  {isMultiplasOperacoesDia && (
                                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="text-purple-600">
                                          🔄
                                        </div>
                                        <span className="font-semibold text-purple-800 text-xs">
                                          {operacoesMesmoDia.length} operações
                                          em{" "}
                                          {diaOperacao
                                            .split("-")
                                            .reverse()
                                            .join("/")}
                                        </span>
                                      </div>
                                      <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {fluxoDia.map((fluxo, idx) => (
                                          <div
                                            key={idx}
                                            className={`flex items-center justify-between p-2 rounded text-xs ${
                                              fluxo.isOperacaoAtual
                                                ? "bg-orange-100 border border-orange-300"
                                                : "bg-white/60"
                                            }`}
                                          >
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                                                  fluxo.isOperacaoAtual
                                                    ? "bg-orange-500 text-white"
                                                    : "bg-purple-200 text-purple-700"
                                                }`}
                                              >
                                                {idx + 1}
                                              </span>
                                              <span className="font-medium">
                                                {fluxo.operacao.ticker}
                                              </span>
                                              <span
                                                className={`${
                                                  fluxo.operacao.resultado >= 0
                                                    ? "text-green-600"
                                                    : "text-red-600"
                                                }`}
                                              >
                                                {fluxo.operacao.resultado >= 0
                                                  ? "+"
                                                  : ""}
                                                {formatCurrency(
                                                  fluxo.operacao.resultado
                                                )}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className="text-purple-600 font-medium text-xs">
                                                {formatCurrency(
                                                  fluxo.saldoAnterior
                                                )}
                                              </span>
                                              <span className="text-gray-400">
                                                →
                                              </span>
                                              <span
                                                className={`font-bold text-xs ${
                                                  fluxo.isOperacaoAtual
                                                    ? "text-orange-700"
                                                    : "text-purple-700"
                                                }`}
                                              >
                                                {formatCurrency(
                                                  fluxo.saldoAtual
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* ✅ CARD PRINCIPAL CORRIGIDO */}
                                  <div className="bg-white/60 rounded-lg p-3 border border-orange-300/50 mt-4">
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                      <div className="text-center flex-1">
                                        <div className="text-xs text-orange-600 mb-1">
                                          Prejuízo Acumulado até esta Operação
                                        </div>
                                        <div className="text-red-700 font-bold text-lg bg-red-100 rounded px-2 py-1">
                                          {formatCurrency(prejuizoAteOperacao)}
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1">
                                          {operacoesAnteriores.length > 0 ? (
                                            <>
                                              Anterior:{" "}
                                              {formatCurrency(prejuizoAnterior)}{" "}
                                              + Esta op:{" "}
                                              {formatCurrency(
                                                Math.abs(op.resultado)
                                              )}
                                            </>
                                          ) : (
                                            "Primeira operação com prejuízo"
                                          )}
                                        </div>
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
                                              prejuizoAteOperacao
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

                      {/* Profit Compensation Card */}
                      {/* Profit Compensation Card - VERSÃO SUPER DIDÁTICA */}
                      {isProfit &&
                        (op.status_ir === "Lucro Compensado" ||
                          op.status_ir === "Tributável Day Trade" ||
                          op.status_ir === "Tributável Swing") &&
                        (() => {
                          const compensacaoInfo = getCompensacaoInfo(
                            op,
                            operacoesFechadas
                          );

                          // Só mostra o card se tem compensação (total ou parcial)
                          if (!compensacaoInfo.temCompensacao) return null;

                          return (
                            <div className="flex flex-col p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm">
                              <div className="flex items-center gap-2 mb-4">
                                {compensacaoInfo.ehCompensacaoTotal ? (
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

                              <div className="text-xs leading-relaxed space-y-4">
                                {(() => {
                                  const tipoOperacao = op.day_trade
                                    ? "day trade"
                                    : "swing trade";
                                  const detalhes = calcularDetalhesCompensacao(
                                    op,
                                    operacoesFechadas
                                  );

                                  return (
                                    <>
                                      {/* 🎯 SEÇÃO 1: RESUMO VISUAL COM ÍCONES */}
                                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-3">
                                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                            <span className="text-white text-sm font-bold">
                                              💰
                                            </span>
                                          </div>
                                          <span className="font-bold text-blue-800 text-sm">
                                            Resumo da Operação
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                          <div className="bg-white/80 rounded-lg p-3 text-center border border-blue-200">
                                            <div className="text-2xl mb-1">
                                              💵
                                            </div>
                                            <div className="text-blue-600 font-medium text-xs">
                                              Lucro Operação
                                            </div>
                                            <div className="font-black text-green-700 text-sm">
                                              {formatCurrency(
                                                detalhes.lucroOperacao
                                              )}
                                            </div>
                                          </div>

                                          <div className="bg-white/80 rounded-lg p-3 text-center border border-blue-200">
                                            <div className="text-2xl mb-1">
                                              📉
                                            </div>
                                            <div className="text-blue-600 font-medium text-xs">
                                              Prejuízo Disponível
                                            </div>
                                            <div className="font-black text-red-700 text-sm">
                                              {formatCurrency(
                                                detalhes.prejuizoAnteriorDisponivel
                                              )}
                                            </div>
                                          </div>

                                          <div className="bg-white/80 rounded-lg p-3 text-center border border-blue-200">
                                            <div className="text-2xl mb-1">
                                              ⚖️
                                            </div>
                                            <div className="text-blue-600 font-medium text-xs">
                                              Tipo Operação
                                            </div>
                                            <div className="font-black text-blue-700 text-sm capitalize">
                                              {tipoOperacao}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* 🧮 SEÇÃO 2: CALCULADORA VISUAL */}
                                      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-3">
                                          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                                            <Calculator className="h-4 w-4 text-white" />
                                          </div>
                                          <span className="font-bold text-orange-800 text-sm">
                                            Calculadora da Compensação
                                          </span>
                                        </div>

                                        <div className="space-y-2">
                                          {/* Linha 1: Lucro */}
                                          <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg border border-green-300">
                                            <div className="flex items-center gap-2">
                                              <span className="text-green-600 text-lg">
                                                ➕
                                              </span>
                                              <span className="text-green-800 font-medium">
                                                Lucro da operação
                                              </span>
                                            </div>
                                            <span className="font-black text-green-900 text-sm">
                                              {formatCurrency(
                                                detalhes.lucroOperacao
                                              )}
                                            </span>
                                          </div>

                                          {/* Linha 2: Prejuízo */}
                                          <div className="flex items-center justify-between p-3 bg-red-100 rounded-lg border border-red-300">
                                            <div className="flex items-center gap-2">
                                              <span className="text-red-600 text-lg">
                                                ➖
                                              </span>
                                              <span className="text-red-800 font-medium">
                                                Prejuízo disponível para
                                                compensar
                                              </span>
                                            </div>
                                            <span className="font-black text-red-900 text-sm">
                                              {formatCurrency(
                                                detalhes.prejuizoAnteriorDisponivel
                                              )}
                                            </span>
                                          </div>

                                          {/* Linha 3: Resultado */}
                                          <div className="border-t-2 border-orange-300 pt-2 mt-3">
                                            <div className="flex items-center justify-between p-3 bg-orange-100 rounded-lg border-2 border-orange-400">
                                              <div className="flex items-center gap-2">
                                                <span className="text-orange-600 text-lg">
                                                  💡
                                                </span>
                                                <span className="text-orange-800 font-bold">
                                                  Valor compensado
                                                </span>
                                              </div>
                                              <span className="font-black text-orange-900 text-lg">
                                                {formatCurrency(
                                                  detalhes.valorCompensado
                                                )}
                                              </span>
                                            </div>

                                            {/* Lucro tributável (se houver) */}
                                            {detalhes.lucroTributavel > 0 && (
                                              <div className="flex items-center justify-between p-3 bg-blue-100 rounded-lg border border-blue-300 mt-2">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-blue-600 text-lg">
                                                    📊
                                                  </span>
                                                  <span className="text-blue-800 font-medium">
                                                    Lucro tributável restante
                                                  </span>
                                                </div>
                                                <span className="font-black text-blue-900 text-sm">
                                                  {formatCurrency(
                                                    detalhes.lucroTributavel
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* 💳 SEÇÃO 3: SALDO RESTANTE COM VISUAL MELHORADO */}
                                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-3">
                                          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                                            <span className="text-white text-sm">
                                              💳
                                            </span>
                                          </div>
                                          <span className="font-bold text-purple-800 text-sm">
                                            Saldo para Futuras Compensações
                                          </span>
                                        </div>

                                        <div className="text-center bg-white/60 rounded-lg p-4 border border-purple-300">
                                          <div className="text-purple-600 text-xs mb-2 uppercase font-semibold tracking-wide">
                                            Prejuízo restante de {tipoOperacao}
                                          </div>

                                          <div className="relative">
                                            <div className="text-3xl font-black text-purple-800 bg-purple-100 rounded-xl py-3 px-4 shadow-inner">
                                              {formatCurrency(
                                                detalhes.prejuizoRestante
                                              )}
                                            </div>
                                            {detalhes.prejuizoRestante ===
                                              0 && (
                                              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                                <span className="text-4xl">
                                                  ✨
                                                </span>
                                              </div>
                                            )}
                                          </div>

                                          <div className="text-purple-600 text-xs mt-3 leading-relaxed">
                                            {detalhes.prejuizoRestante > 0 ? (
                                              <>
                                                <div className="font-medium mb-1">
                                                  💡 Disponível para compensar:
                                                </div>
                                                <div>
                                                  Futuros lucros de{" "}
                                                  <strong>
                                                    {tipoOperacao}
                                                  </strong>{" "}
                                                  serão automaticamente
                                                  deduzidos deste saldo,
                                                  reduzindo o IR devido.
                                                </div>
                                              </>
                                            ) : (
                                              <>
                                                <div className="font-medium mb-1">
                                                  🎉 Saldo zerado!
                                                </div>
                                                <div>
                                                  Todo o prejuízo anterior foi
                                                  utilizado nesta compensação.
                                                  Próximas operações lucrativas
                                                  serão totalmente tributáveis.
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* 📋 SEÇÃO 4: HISTÓRICO DE PREJUÍZOS (SE HOUVER) */}
                                      {detalhes.historicoPrejuizos.length > 0 &&
                                        detalhes.prejuizoRestante > 0 && (
                                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
                                            <div className="flex items-center gap-2 mb-3">
                                              <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                                                <span className="text-white text-sm">
                                                  📋
                                                </span>
                                              </div>
                                              <span className="font-bold text-gray-800 text-sm">
                                                Prejuízos Ainda Disponíveis (
                                                {
                                                  detalhes.historicoPrejuizos
                                                    .length
                                                }
                                                )
                                              </span>
                                            </div>

                                            <div className="space-y-2 max-h-28 overflow-y-auto">
                                              {detalhes.historicoPrejuizos.map(
                                                (item, idx) => (
                                                  <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 shadow-sm"
                                                  >
                                                    <div className="flex items-center gap-3">
                                                      <span className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center text-xs font-bold text-red-600">
                                                        {idx + 1}
                                                      </span>
                                                      <div>
                                                        <span className="font-bold text-gray-800">
                                                          {item.ticker}
                                                        </span>
                                                        <div className="text-xs text-gray-500">
                                                          {new Date(
                                                            item.data
                                                          ).toLocaleDateString(
                                                            "pt-BR"
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                    <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                                                      {formatCurrency(
                                                        item.valor
                                                      )}
                                                    </span>
                                                  </div>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        )}

                                      {/* 🎯 SEÇÃO 5: STATUS FINAL COM DESTAQUE VISUAL */}
                                      <div
                                        className={`rounded-xl p-4 border-3 shadow-lg ${
                                          compensacaoInfo.ehCompensacaoTotal
                                            ? "bg-gradient-to-r from-green-100 to-emerald-100 border-green-400"
                                            : "bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-400"
                                        }`}
                                      >
                                        <div className="text-center space-y-3">
                                          {/* Título com ícone grande */}
                                          <div className="flex items-center justify-center gap-3 mb-3">
                                            <div
                                              className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                                                compensacaoInfo.ehCompensacaoTotal
                                                  ? "bg-green-500"
                                                  : "bg-blue-500"
                                              }`}
                                            >
                                              <span className="text-white">
                                                {compensacaoInfo.ehCompensacaoTotal
                                                  ? "✅"
                                                  : "⚖️"}
                                              </span>
                                            </div>
                                            <div>
                                              <div
                                                className={`font-black text-lg ${
                                                  compensacaoInfo.ehCompensacaoTotal
                                                    ? "text-green-800"
                                                    : "text-blue-800"
                                                }`}
                                              >
                                                {compensacaoInfo.ehCompensacaoTotal
                                                  ? "OPERAÇÃO TOTALMENTE COMPENSADA"
                                                  : "COMPENSAÇÃO PARCIAL APLICADA"}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Explicação detalhada */}
                                          <div
                                            className={`text-xs leading-relaxed p-3 rounded-lg ${
                                              compensacaoInfo.ehCompensacaoTotal
                                                ? "bg-green-50 text-green-800 border border-green-200"
                                                : "bg-blue-50 text-blue-800 border border-blue-200"
                                            }`}
                                          >
                                            {compensacaoInfo.ehCompensacaoTotal ? (
                                              <>
                                                <div className="font-bold mb-2">
                                                  🎉 Resultado fiscal final:
                                                </div>
                                                <div className="space-y-1">
                                                  <div>
                                                    • Todo o lucro de{" "}
                                                    <strong>
                                                      {formatCurrency(
                                                        detalhes.lucroOperacao
                                                      )}
                                                    </strong>{" "}
                                                    foi compensado
                                                  </div>
                                                  <div>
                                                    • Prejuízos anteriores de{" "}
                                                    <strong>
                                                      {tipoOperacao}
                                                    </strong>{" "}
                                                    utilizados:{" "}
                                                    <strong>
                                                      {formatCurrency(
                                                        detalhes.valorCompensado
                                                      )}
                                                    </strong>
                                                  </div>
                                                  <div>
                                                    •{" "}
                                                    <span className="bg-green-200 px-2 py-1 rounded font-bold">
                                                      Imposto de Renda: R$ 0,00
                                                    </span>
                                                  </div>
                                                </div>
                                              </>
                                            ) : (
                                              <>
                                                <div className="font-bold mb-2">
                                                  📊 Resultado fiscal final:
                                                </div>
                                                <div className="space-y-1">
                                                  <div>
                                                    • Compensado:{" "}
                                                    <strong>
                                                      {formatCurrency(
                                                        detalhes.valorCompensado
                                                      )}
                                                    </strong>{" "}
                                                    (prejuízos anteriores)
                                                  </div>
                                                  <div>
                                                    • Tributável:{" "}
                                                    <strong>
                                                      {formatCurrency(
                                                        detalhes.lucroTributavel
                                                      )}
                                                    </strong>{" "}
                                                    (sujeito a IR de{" "}
                                                    <strong>
                                                      {op.day_trade
                                                        ? "20%"
                                                        : "15%"}
                                                    </strong>
                                                    )
                                                  </div>
                                                  <div>
                                                    •{" "}
                                                    <span className="bg-blue-200 px-2 py-1 rounded font-bold">
                                                      Imposto devido:{" "}
                                                      {formatCurrency(
                                                        detalhes.lucroTributavel *
                                                          (op.day_trade
                                                            ? 0.2
                                                            : 0.15)
                                                      )}
                                                    </span>
                                                  </div>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* 💡 SEÇÃO 6: DICA EDUCATIVA MELHORADA */}
                                      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-4 shadow-sm">
                                        <div className="flex items-start gap-3">
                                          <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-white text-sm">
                                              💡
                                            </span>
                                          </div>
                                          <div className="text-yellow-800 text-xs leading-relaxed">
                                            <div className="font-bold mb-2 text-sm">
                                              🎓 Como funciona a compensação
                                              fiscal:
                                            </div>
                                            <div className="space-y-2">
                                              <div className="flex items-start gap-2">
                                                <span className="text-yellow-600 font-bold">
                                                  1.
                                                </span>
                                                <div>
                                                  A Receita Federal permite
                                                  compensar prejuízos com lucros{" "}
                                                  <strong>do mesmo tipo</strong>{" "}
                                                  ({tipoOperacao})
                                                </div>
                                              </div>
                                              <div className="flex items-start gap-2">
                                                <span className="text-yellow-600 font-bold">
                                                  2.
                                                </span>
                                                <div>
                                                  A compensação é{" "}
                                                  <strong>automática</strong> e
                                                  reduz o imposto devido
                                                </div>
                                              </div>
                                              <div className="flex items-start gap-2">
                                                <span className="text-yellow-600 font-bold">
                                                  3.
                                                </span>
                                                <div>
                                                  Prejuízos não utilizados ficam
                                                  disponíveis para{" "}
                                                  <strong>
                                                    futuras operações
                                                  </strong>
                                                </div>
                                              </div>
                                              {detalhes.prejuizoRestante >
                                                0 && (
                                                <div className="bg-yellow-100 rounded-lg p-2 mt-2 border border-yellow-300">
                                                  <strong>
                                                    💰 Seu saldo atual:
                                                  </strong>{" "}
                                                  {formatCurrency(
                                                    detalhes.prejuizoRestante
                                                  )}
                                                  disponível para compensar em
                                                  futuras operações lucrativas
                                                  de{" "}
                                                  <strong>
                                                    {tipoOperacao}
                                                  </strong>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })()}
                      {/* DARF Button */}
                      {(op.status_ir === "Tributável Day Trade" ||
                        op.status_ir === "Tributável Swing") && (
                        <div className="flex items-center justify-center mt-2">
                          <Button
                            onClick={() => handleOpenDarfModal(op)}
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
const SummaryCards = ({
  totalResultadoOperacoes,
  totalLucros,
  totalPrejuizos,
  operacoesTributaveis,
}: {
  totalResultadoOperacoes: number;
  totalLucros: number;
  totalPrejuizos: number;
  operacoesTributaveis: number;
}) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-white/80" />
        <div>
          <div className="text-xs font-medium text-white/80 uppercase tracking-wide">
            Total
          </div>
          <div
            className={`text-sm font-bold ${
              totalResultadoOperacoes >= 0 ? "text-green-200" : "text-red-200"
            }`}
          >
            {formatCurrency(totalResultadoOperacoes)}
          </div>
        </div>
      </div>
    </div>
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-green-300" />
        <div>
          <div className="text-xs font-medium text-white/80 uppercase tracking-wide">
            Lucros
          </div>
          <div className="text-sm font-bold text-green-200">
            {formatCurrency(totalLucros)}
          </div>
        </div>
      </div>
    </div>
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
      <div className="flex items-center gap-2">
        <TrendingDown className="h-4 w-4 text-red-300" />
        <div>
          <div className="text-xs font-medium text-white/80 uppercase tracking-wide">
            Prejuízos
          </div>
          <div className="text-sm font-bold text-red-200">
            {formatCurrency(totalPrejuizos)}
          </div>
        </div>
      </div>
    </div>
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-yellow-300" />
        <div>
          <div className="text-xs font-medium text-white/80 uppercase tracking-wide">
            Tributáveis
          </div>
          <div className="text-sm font-bold text-yellow-200">
            {operacoesTributaveis}
          </div>
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

    // Find the matching ResultadoMensal
    if (resultadosMensais && Array.isArray(resultadosMensais)) {
      const mesAno = op.data_fechamento.substring(0, 7);
      const resultadoMensal = resultadosMensais.find((rm) => rm.mes === mesAno);

      console.log("📊 [DARF MODAL] Resultado mensal encontrado:", {
        mesAno,
        resultadoMensal: resultadoMensal ? "encontrado" : "não encontrado",
        resultadoMensalData: resultadoMensal,
      });

      setSelectedResultadoMensalForDarf(resultadoMensal || null);
    } else {
      setSelectedResultadoMensalForDarf(null);
    }

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

    // Badge principal do status fiscal
    let color = "gray";
    let bg = "bg-gray-100";
    let text = status;

    if (status === "Isento") {
      color = "green";
      bg = "bg-green-100";
      text = "Isento";
    } else if (status === "Tributável Day Trade") {
      color = "orange";
      bg = "bg-orange-100";
      text = "Tributável";
    } else if (status === "Tributável Swing") {
      color = "blue";
      bg = "bg-blue-100";
      text = "Tributável";
    } else if (status === "Prejuízo Acumulado") {
      color = "red";
      bg = "bg-red-100";
      text = "Prejuízo";
    } else if (status === "Lucro Compensado") {
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
      (status === "Tributável Day Trade" || status === "Tributável Swing")
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
    const months = operacoesFechadas.map((op) =>
      op.data_fechamento.substring(0, 7)
    );
    return Array.from(new Set(months));
  }, [operacoesFechadas]);

  const uniqueStatuses = useMemo(() => {
    const statuses = operacoesFechadas
      .map((op) => op.status_ir || "")
      .filter((status) => status !== "");
    return Array.from(new Set(statuses));
  }, [operacoesFechadas]);

  // Main processedOperacoes memo
  const processedOperacoes = useMemo(() => {
    let ops = operacoesFechadas ? [...operacoesFechadas] : [];

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
  }, [operacoesFechadas, filterType, filterMonth, filterStatus, searchTerm]);

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
  const totalPrejuizos = processedOperacoes
    .filter((op) => op.resultado < 0)
    .reduce((acc, op) => acc + Math.abs(op.resultado), 0);
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
              totalPrejuizos={totalPrejuizos}
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
                operacoesFechadas={operacoesFechadas}
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
          resultadoMensal={selectedResultadoMensalForDarf}
          tipoDarf={selectedOpForDarf.day_trade ? "daytrade" : "swing"}
          onUpdateDashboard={handleUpdateDashboard}
          onDarfStatusChange={handleDarfStatusChange}
          operacoesFechadas={operacoesFechadas}
        />
      )}
    </>
  );
}

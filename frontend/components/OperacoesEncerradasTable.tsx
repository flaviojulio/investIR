"use client";

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
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import type { OperacaoFechada, ResultadoMensal } from "@/lib/types";
import { DarfDetailsModal } from "@/components/DarfDetailsModal";

// Formatting helpers
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const formatDate = (dateString: string) => {
  const dateOnly = dateString.split("T")[0];
  const [year, month, day] = dateOnly.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatDateShort = (dateString: string) => {
  const dateOnly = dateString.split("T")[0];
  const [year, month, day] = dateOnly.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

const getMonthName = (dateString: string): string => {
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const date = new Date(dateString);
  return months[date.getMonth()];
};

// DARF status helper
const getDarfStatusForOperation = (
  op: OperacaoFechada,
  darfStatusMap?: Map<string, string>
): string | null => {
  if (op.status_ir !== "Tributável Day Trade" && op.status_ir !== "Tributável Swing") {
    return null;
  }

  const operationKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}`;
  if (darfStatusMap && darfStatusMap.has(operationKey)) {
    return darfStatusMap.get(operationKey) || null;
  }

  if (op.ticker === "VALE3" && op.day_trade) return "pago";
  if (op.ticker === "PETR4" && !op.day_trade) return "pendente";
  return op.resultado > 1000 ? "pago" : "pendente";
};

interface OperacoesEncerradasTableProps {
  operacoesFechadas?: OperacaoFechada[];
  resultadosMensais?: ResultadoMensal[];
  onUpdateDashboard?: () => void;
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
}: {
  op: OperacaoFechada;
  index: number;
  isExpanded: boolean;
  toggleRow: (rowKey: string) => void;
  isProfit: boolean;
  getStatusBadge: (status: string, isProfit: boolean) => JSX.Element;
  getDarfBadge: (darfStatus: string | null, op: OperacaoFechada) => JSX.Element | null;
  getDarfStatusForOperation: (op: OperacaoFechada, darfStatusMap?: Map<string, string>) => string | null;
  darfStatusMap: Map<string, string>;
  handleOpenDarfModal: (op: OperacaoFechada) => void;
  operacoesFechadas: OperacaoFechada[];
}) => {
  const rowKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${index}`;

  // DEBUG for specific operations
  if (op.data_fechamento?.includes("2023-03")) {
    console.log("📅 OPERAÇÃO MARÇO 2023:", {
      index,
      ticker: op.ticker,
      data_fechamento: op.data_fechamento,
      resultado: op.resultado,
      day_trade: op.day_trade,
      status_ir: op.status_ir,
      prejuizo_anterior_acumulado: op.prejuizo_anterior_acumulado,
      isProfit,
    });

    if (op.ticker === "ITUB4") {
      console.log("🔍 [ITUB4 MARÇO DETALHADO]:");
      console.log("- Dados brutos do backend:", JSON.stringify(op, null, 2));
      console.log("- Cálculo isProfit:", `${op.resultado} >= 0 = ${isProfit}`);
      console.log("- Vai exibir como:", isProfit ? "LUCRO" : "PREJUÍZO");
      console.log("- Valor que será mostrado: R$", Math.abs(op.resultado).toFixed(2));
    }
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
            {getStatusBadge(op.status_ir || "", isProfit)}
            {(op.status_ir === "Tributável Day Trade" ||
              op.status_ir === "Tributável Swing") &&
              getDarfBadge(
                getDarfStatusForOperation(op, darfStatusMap),
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
            <div className="col-span-12 lg:col-span-6">
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
                          Preço Médio
                        </span>
                      </div>
                      <span className="text-sm font-bold text-green-800">
                        {formatCurrency(op.valor_compra)}
                      </span>
                    </div>
                    <div className="flex flex-col p-3 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingDown className="h-3 w-3 text-cyan-600" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-600">
                          Valor de Venda
                        </span>
                      </div>
                      <span className="text-sm font-bold text-cyan-800">
                        {formatCurrency(op.valor_venda)}
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
                          {formatCurrency(Math.abs(op.resultado))}
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
                          {getStatusBadge(op.status_ir || "", isProfit)}
                          {(op.status_ir === "Tributável Day Trade" ||
                            op.status_ir === "Tributável Swing") &&
                            getDarfBadge(
                              getDarfStatusForOperation(op, darfStatusMap),
                              op
                            )}
                        </div>

                        {/* Descrições */}
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
                              const mesOperacao = op.data_fechamento.substring(0, 7);
                              const diaOperacao = op.data_fechamento.substring(0, 10);
                              const tipoOperacao = op.day_trade ? "day trade" : "swing trade";

                              const operacoesMesmoTipo = operacoesFechadas.filter((opMes) =>
                                opMes.data_fechamento.substring(0, 7) === mesOperacao &&
                                (opMes.day_trade ? "day trade" : "swing trade") === tipoOperacao &&
                                opMes.data_fechamento <= op.data_fechamento &&
                                opMes !== op
                              );

                              const operacoesMesmoDia = operacoesFechadas.filter((opDia) =>
                                opDia.data_fechamento.substring(0, 10) === diaOperacao &&
                                (opDia.day_trade ? "day trade" : "swing trade") === tipoOperacao
                              ).sort((a, b) => a.data_fechamento.localeCompare(b.data_fechamento));

                              const lucrosJaCompensados = operacoesMesmoTipo
                                .filter((opMes) => opMes.resultado > 0 && opMes.status_ir === "Lucro Compensado")
                                .reduce((sum, opMes) => sum + opMes.resultado, 0);

                              const prejuizoAnteriorOriginal = op.prejuizo_anterior_acumulado || 0;
                              const prejuizoAnteriorDisponivel = Math.max(0, prejuizoAnteriorOriginal - lucrosJaCompensados);
                              const totalPrejuizosMes = operacoesFechadas.filter((opMes) =>
                                opMes.data_fechamento.substring(0, 7) === mesOperacao &&
                                (opMes.day_trade ? "day trade" : "swing trade") === tipoOperacao &&
                                opMes.resultado < 0
                              ).reduce((sum, opMes) => sum + Math.abs(opMes.resultado), 0);
                              const prejuizoTotalAcumulado = prejuizoAnteriorDisponivel + totalPrejuizosMes;
                              const isMultiplasOperacoesDia = operacoesMesmoDia.length > 1;

                              let fluxoDia = [];
                              if (isMultiplasOperacoesDia) {
                                const indexOperacaoAtual = operacoesMesmoDia.findIndex((opDia) =>
                                  opDia.ticker === op.ticker &&
                                  opDia.data_fechamento === op.data_fechamento &&
                                  opDia.resultado === op.resultado
                                );

                                let saldoSequencial = prejuizoAnteriorDisponivel;
                                fluxoDia = operacoesMesmoDia.map((opSeq, idx) => {
                                  const saldoAnterior = saldoSequencial;
                                  if (opSeq.resultado < 0) {
                                    saldoSequencial += Math.abs(opSeq.resultado);
                                  } else if (opSeq.resultado > 0 && saldoSequencial > 0) {
                                    const compensacao = Math.min(saldoSequencial, opSeq.resultado);
                                    saldoSequencial -= compensacao;
                                  }
                                  return {
                                    operacao: opSeq,
                                    index: idx,
                                    saldoAnterior,
                                    saldoAtual: saldoSequencial,
                                    isOperacaoAtual: idx === indexOperacaoAtual,
                                  };
                                });
                              }

                              return (
                                <>
                                  {isMultiplasOperacoesDia && (
                                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="text-purple-600">🔄</div>
                                        <span className="font-semibold text-purple-800 text-xs">
                                          {operacoesMesmoDia.length} operações em {diaOperacao.split('-').reverse().join('/')}
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
                                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                                                fluxo.isOperacaoAtual
                                                  ? "bg-orange-500 text-white"
                                                  : "bg-purple-200 text-purple-700"
                                              }`}>
                                                {idx + 1}
                                              </span>
                                              <span className="font-medium">{fluxo.operacao.ticker}</span>
                                              <span className={`${
                                                fluxo.operacao.resultado >= 0 ? 'text-green-600' : 'text-red-600'
                                              }`}>
                                                {fluxo.operacao.resultado >= 0 ? '+' : ''}{formatCurrency(fluxo.operacao.resultado)}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className="text-purple-600 font-medium text-xs">
                                                {formatCurrency(fluxo.saldoAnterior)}
                                              </span>
                                              <span className="text-gray-400">→</span>
                                              <span className={`font-bold text-xs ${
                                                fluxo.isOperacaoAtual ? 'text-orange-700' : 'text-purple-700'
                                              }`}>
                                                {formatCurrency(fluxo.saldoAtual)}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="bg-white/60 rounded-lg p-3 border border-orange-300/50 mt-4">
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                      <div className="text-center flex-1">
                                        Prejuízo Total Acumulado
                                        <div className="text-red-700 font-bold text-lg bg-red-100 rounded px-2 py-1">
                                          {formatCurrency(prejuizoTotalAcumulado)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <div className="flex items-start gap-2">
                                      <div className="text-green-600 mt-0.5">✨</div>
                                      <div className="text-green-700 text-xs leading-relaxed">
                                        <div className="font-semibold mb-1">Compensação futura:</div>
                                        <div>
                                          Quando você tiver lucros em operações de <span className="font-bold">{tipoOperacao}</span>,
                                          este saldo de <span className="font-bold text-red-700">{formatCurrency(prejuizoTotalAcumulado)}</span> será
                                          automaticamente descontado, reduzindo ou eliminando o imposto a pagar.
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
                      {isProfit && (op.prejuizo_anterior_acumulado || 0) > 0 && (
                        <div className="flex flex-col p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Info className="h-4 w-4 text-green-600" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-green-600">
                              Compensação de Prejuízo
                            </span>
                          </div>
                          <div className="text-xs text-green-700 leading-relaxed">
                            {(() => {
                              const prejuizoAnterior = op.prejuizo_anterior_acumulado || 0;
                              const lucroOperacao = op.resultado;
                              const tipoOperacao = op.day_trade ? "day trade" : "swing trade";

                              if (prejuizoAnterior > 0) {
                                const prejuizoCompensado = Math.min(lucroOperacao, prejuizoAnterior);
                                const prejuizoRestante = prejuizoAnterior - prejuizoCompensado;
                                const lucroTributavel = Math.max(0, lucroOperacao - prejuizoAnterior);

                                return (
                                  <>
                                    <div className="mb-2">
                                      <span className="font-bold">Cálculo da Compensação:</span>
                                    </div>
                                    <div className="space-y-1 mb-3 text-xs">
                                      <div>• Lucro da operação: <span className="font-bold text-green-800">{formatCurrency(lucroOperacao)}</span></div>
                                      <div>• Prejuízo anterior acumulado: <span className="font-bold text-red-600">{formatCurrency(prejuizoAnterior)}</span></div>
                                      <div className="border-t pt-1 mt-1">
                                        <div>• Prejuízo compensado: <span className="font-bold text-orange-600">{formatCurrency(prejuizoCompensado)}</span></div>
                                        {prejuizoRestante > 0 && <div>• Prejuízo restante: <span className="font-bold text-red-600">{formatCurrency(prejuizoRestante)}</span></div>}
                                        {lucroTributavel > 0 && <div>• Lucro tributável: <span className="font-bold text-green-800">{formatCurrency(lucroTributavel)}</span></div>}
                                      </div>
                                    </div>
                                    <div className="text-xs">
                                      {(() => {
                                        const statusBased = {
                                          "Lucro Compensado": {
                                            totalText: `<span class="font-semibold text-green-700">Compensação Total:</span> Todo o lucro de <span class="font-semibold text-green-700">${formatCurrency(lucroOperacao)}</span> foi descontado de prejuízo anterior de <span class="font-bold">${tipoOperacao}</span>, resultando em <span class="font-bold">operação isenta de IR</span>.`,
                                            parcialText: `<span class="font-semibold text-orange-700">Compensação Parcial:</span> ${formatCurrency(prejuizoCompensado)} do lucro foi usado para compensar o saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>. O restante (${formatCurrency(lucroTributavel)}) está sujeito a tributação de ${op.day_trade ? "20%" : "15%"}.`,
                                          },
                                          "Tributável Swing": {
                                            totalText: `<span class="font-semibold text-green-700">Operação Compensada:</span> Todo o lucro de <span class="font-semibold text-green-700">${formatCurrency(lucroOperacao)}</span> foi descontado de prejuízo anterior de <span class="font-bold">${tipoOperacao}</span>. <span class="font-bold">IR = R$ 0,00</span> (isenta por compensação).`,
                                            parcialText: `<span class="font-semibold text-blue-700">Compensação + Tributação:</span> ${formatCurrency(prejuizoCompensado)} do lucro compensaram o saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>. O restante (${formatCurrency(lucroTributavel)}) está sujeito a <span class="font-bold">IR de 15%</span> = ${formatCurrency(lucroTributavel * 0.15)}.`,
                                          },
                                          "Tributável Day Trade": {
                                            totalText: `<span class="font-semibold text-green-700">Day Trade Compensado:</span> Todo o lucro de <span class="font-bold">${formatCurrency(lucroOperacao)}</span> foi descontado de prejuízo anterior de <span class="font-bold">${tipoOperacao}</span>. <span class="font-bold">IR = R$ 0,00</span> (isenta por compensação).`,
                                            parcialText: `<span class="font-semibold text-blue-700">Compensação + Tributação:</span> ${formatCurrency(prejuizoCompensado)} do lucro compensou o saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>. O restante (${formatCurrency(lucroTributavel)}) está sujeito a <span class="font-bold">IR de 20%</span> = ${formatCurrency(lucroTributavel * 0.2)}.`,
                                          },
                                          Isento: {
                                            totalText: `<span class="font-semibold text-green-700">Isenta com Compensação:</span> Esta operação é isenta de IR e ainda compensou ${formatCurrency(prejuizoCompensado)} do saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>.`,
                                            parcialText: `<span class="font-semibold text-green-700">Isenta com Compensação:</span> Esta operação é isenta de IR e ainda compensou ${formatCurrency(prejuizoCompensado)} do saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>.`,
                                          },
                                        };

                                        const currentStatus = op.status_ir || "Outros";
                                        const statusConfig = statusBased[currentStatus] || {
                                          totalText: `<span class="font-semibold text-green-700">Compensação Total:</span> Todo o lucro foi descontado de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>.`,
                                          parcialText: `<span class="font-semibold text-orange-700">Compensação Parcial:</span> ${formatCurrency(prejuizoCompensado)} do lucro foi usado para abater do saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>.`,
                                        };

                                        const textToShow = lucroTributavel > 0 ? statusConfig.parcialText : statusConfig.totalText;

                                        return <div dangerouslySetInnerHTML={{ __html: textToShow }} />;
                                      })()}
                                    </div>
                                  </>
                                );
                              }
                              return <div className="text-xs">Este lucro foi compensado por prejuízos acumulados de operações de <span className="font-bold">{tipoOperacao}</span>.</div>;
                            })()}
                          </div>
                        </div>
                      )}

                      {/* DARF Button */}
                      {(op.status_ir === "Tributável Day Trade" || op.status_ir === "Tributável Swing") && (
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
            className={`text-sm font-bold ${totalResultadoOperacoes >= 0 ? "text-green-200" : "text-red-200"}`}
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
export default function OperacoesEncerradasTable(props: OperacoesEncerradasTableProps) {
  // Handler for DARF status change
  const handleDarfStatusChange = (operationKey: string, newStatus: string) => {
    setDarfStatusMap(prev => {
      const updated = new Map(prev);
      updated.set(operationKey, newStatus);
      return updated;
    });
    setIsDarfModalOpen(false); // Optionally close modal after status change
  };
  // Wrapper for dashboard update
  const handleUpdateDashboard = () => {
    if (typeof onUpdateDashboard === "function") {
      onUpdateDashboard();
    }
  };
  // DARF modal state and handler
  const [isDarfModalOpen, setIsDarfModalOpen] = useState(false);
  const [selectedOpForDarf, setSelectedOpForDarf] = useState<OperacaoFechada | null>(null);
  const [selectedResultadoMensalForDarf, setSelectedResultadoMensalForDarf] = useState<ResultadoMensal | null>(null);

  const handleOpenDarfModal = (op: OperacaoFechada) => {
    setSelectedOpForDarf(op);
    // Find the matching ResultadoMensal if needed (by month/year)
    if (resultadosMensais && Array.isArray(resultadosMensais)) {
      const mesAno = op.data_fechamento.substring(0, 7);
      const resultadoMensal = resultadosMensais.find(rm => rm.mes === mesAno);
      setSelectedResultadoMensalForDarf(resultadoMensal || null);
    } else {
      setSelectedResultadoMensalForDarf(null);
    }
    setIsDarfModalOpen(true);
  };
  // DARF status map state (default empty Map)
  const [darfStatusMap, setDarfStatusMap] = useState<Map<string, string>>(new Map());
  // Helper to render DARF badge
  const getDarfBadge = (darfStatus: string | null, op: OperacaoFechada) => {
    if (!darfStatus) return null;
    let color = "gray";
    let bg = "bg-gray-100";
    let text = "DARF";
    if (darfStatus === "pago") {
      color = "green"; bg = "bg-green-100"; text = "DARF Pago";
    } else if (darfStatus === "pendente") {
      color = "yellow"; bg = "bg-yellow-100"; text = "DARF Pendente";
    } else if (darfStatus === "isento") {
      color = "blue"; bg = "bg-blue-100"; text = "Isento";
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border border-${color}-300 ${bg} text-${color}-700 ml-1`}>
        {text}
      </span>
    );
  };
  // Helper to render status badge
  const getStatusBadge = (status: string, isProfit: boolean) => {
    let color = "gray";
    let bg = "bg-gray-100";
    let text = status;
    if (status === "Isento") {
      color = "green"; bg = "bg-green-100"; text = "Isento";
    } else if (status === "Tributável Day Trade") {
      color = "orange"; bg = "bg-orange-100"; text = "Day Trade";
    } else if (status === "Tributável Swing") {
      color = "blue"; bg = "bg-blue-100"; text = "Swing Trade";
    } else if (status === "Prejuízo Acumulado") {
      color = "red"; bg = "bg-red-100"; text = "Prejuízo";
    } else if (status === "Lucro Compensado") {
      color = "emerald"; bg = "bg-emerald-100"; text = "Compensado";
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border border-${color}-300 ${bg} text-${color}-700`}>
        {text}
      </span>
    );
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

  const { operacoesFechadas = [], resultadosMensais = [], onUpdateDashboard = () => {} } = props;

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
    const months = operacoesFechadas.map(op => op.data_fechamento.substring(0, 7));
    return Array.from(new Set(months));
  }, [operacoesFechadas]);

  const uniqueStatuses = useMemo(() => {
    const statuses = operacoesFechadas.map(op => op.status_ir || "");
    return Array.from(new Set(statuses));
  }, [operacoesFechadas]);

  // Main processedOperacoes memo
  const processedOperacoes = useMemo(() => {
    let ops = [...operacoesFechadas];
    // Filter by type
    if (filterType !== "all") {
      ops = ops.filter(op => (filterType === "day_trade" ? op.day_trade : !op.day_trade));
    }
    // Filter by month
    if (filterMonth !== "all") {
      ops = ops.filter(op => op.data_fechamento.substring(0, 7) === filterMonth);
    }
    // Filter by status
    if (filterStatus !== "all") {
      ops = ops.filter(op => (op.status_ir || "") === filterStatus);
    }
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      ops = ops.filter(op =>
        op.ticker.toLowerCase().includes(term) ||
        op.data_fechamento.toLowerCase().includes(term) ||
        (op.resultado + "").toLowerCase().includes(term) ||
        (op.day_trade ? "day trade" : "swing trade").includes(term)
      );
    }
    // TODO: Add sorting logic if needed
    return ops;
  }, [operacoesFechadas, filterType, filterMonth, filterStatus, searchTerm]);

  // Sorting state and logic
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "ascending" | "descending" }>({ key: "data_fechamento", direction: "descending" });

  const requestSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // Toggle direction
        return { key, direction: prev.direction === "ascending" ? "descending" : "ascending" };
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

  const totalResultadoOperacoes = processedOperacoes.reduce((acc, op) => acc + op.resultado, 0);
  const totalLucros = processedOperacoes.filter((op) => op.resultado > 0).reduce((acc, op) => acc + op.resultado, 0);
  const totalPrejuizos = processedOperacoes.filter((op) => op.resultado < 0).reduce((acc, op) => acc + Math.abs(op.resultado), 0);
  const operacoesTributaveis = processedOperacoes.filter((op) => op.status_ir?.includes("Tributável")).length;

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
              <CardTitle className="text-2xl font-bold">Operações Encerradas</CardTitle>
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
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Comece sua jornada!</h3>
            <p className="text-gray-600 text-lg mb-4">Suas operações finalizadas aparecerão aqui</p>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Execute algumas operações de compra e venda para ver o histórico e análise de resultados
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
                <CardTitle className="text-2xl font-bold">Operações Encerradas</CardTitle>
                <CardDescription className="text-indigo-100">
                  Histórico de suas operações de compra e venda finalizadas
                </CardDescription>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-white/80" />
                <span className="text-xs font-medium text-white/80 uppercase tracking-wide">Resultado Total:</span>
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
            <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhuma operação encontrada</h3>
            <p className="text-gray-600 mb-4">Ajuste os filtros ou tente outros termos de pesquisa</p>
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
                <CardTitle className="text-2xl font-bold">Operações Encerradas</CardTitle>
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
                key={op.id ? op.id : `${op.ticker}-${op.data_fechamento}-${index}`}
                op={op}
                index={index}
                isExpanded={expandedRows.has(`${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${index}`)}
                toggleRow={toggleRow}
                isProfit={op.resultado >= 0}
                getStatusBadge={getStatusBadge}
                getDarfBadge={getDarfBadge}
                getDarfStatusForOperation={getDarfStatusForOperation}
                darfStatusMap={darfStatusMap}
                handleOpenDarfModal={handleOpenDarfModal}
                operacoesFechadas={operacoesFechadas}
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
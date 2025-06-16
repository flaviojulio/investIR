"use client";

import React, { useState, useEffect, useMemo } from "react"; // useMemo was missing in user's code, but likely needed for sorting/filtering logic
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
  Clock // Clock was not used in the prototype, but keeping it if user intended it
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { OperacaoFechada, ResultadoMensal } from "@/lib/types";
import { DarfDetailsModal } from "@/components/DarfDetailsModal"; // Added import
import OperacoesEncerradasTable from '@/components/OperacoesEncerradasTable';

// Mock formatting functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatDateShort = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  });
};

// Mock data
const mockOperacoes: OperacaoFechada[] = [
  {
    ticker: "BBDC4",
    data_abertura: "2025-06-18T00:00:00",
    data_fechamento: "2025-06-19T00:00:00",
    quantidade: 50,
    valor_compra: 25.00,
    valor_venda: 24.00,
    resultado: 48.00,
    day_trade: false,
    status_ir: "Isento"
  },
  {
    ticker: "ITSA4",
    data_abertura: "2025-05-08T00:00:00",
    data_fechamento: "2025-05-09T00:00:00",
    quantidade: 100,
    valor_compra: 11.00,
    valor_venda: 10.00,
    resultado: -104.00,
    day_trade: true,
    status_ir: "Prejuízo Acumulado"
  },
  {
    ticker: "BBAS3",
    data_abertura: "2025-04-23T00:00:00",
    data_fechamento: "2025-04-24T00:00:00",
    quantidade: 100,
    valor_compra: 25.00,
    valor_venda: 28.00,
    resultado: 297.00,
    day_trade: false,
    status_ir: "Isento"
  },
  {
    ticker: "VALE3",
    data_abertura: "2025-03-03T00:00:00",
    data_fechamento: "2025-03-04T00:00:00",
    quantidade: 100,
    valor_compra: 65.00,
    valor_venda: 70.00,
    resultado: 490.00,
    day_trade: true,
    status_ir: "Tributável Day Trade"
  },
  {
    ticker: "PETR4",
    data_abertura: "2025-02-18T00:00:00",
    data_fechamento: "2025-02-19T00:00:00",
    quantidade: 5000,
    valor_compra: 25.00,
    valor_venda: 40.00,
    resultado: 74981.67,
    day_trade: false,
    status_ir: "Tributável Swing"
  }
];

interface OperacoesEncerradasTableProps {
  operacoesFechadas?: OperacaoFechada[];
  resultadosMensais?: ResultadoMensal[];
  onUpdateDashboard?: () => void;
}

export default function OperacoesEncerradasTable({
  operacoesFechadas = mockOperacoes,
  resultadosMensais = [],
  onUpdateDashboard = () => {}
}: OperacoesEncerradasTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "ascending" | "descending";
  }>({ key: "data_fechamento", direction: "descending" });
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [processedOperacoes, setProcessedOperacoes] = useState<OperacaoFechada[]>(operacoesFechadas);
  const [isDarfModalOpen, setIsDarfModalOpen] = useState(false);
  const [selectedOpForDarf, setSelectedOpForDarf] = useState<OperacaoFechada | null>(null);
  const [selectedResultadoMensalForDarf, setSelectedResultadoMensalForDarf] = useState<ResultadoMensal | null>(null);

  useEffect(() => {
    let newProcessedData = [...operacoesFechadas];

    // Filtering
    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      newProcessedData = newProcessedData.filter((op) => {
        const tipoTrade = op.day_trade ? "day trade" : "swing trade";
        return (
          op.ticker.toLowerCase().includes(lowercasedSearchTerm) ||
          formatDate(op.data_fechamento).toLowerCase().includes(lowercasedSearchTerm) ||
          op.resultado.toString().toLowerCase().includes(lowercasedSearchTerm) ||
          tipoTrade.toLowerCase().includes(lowercasedSearchTerm) ||
          (op.status_ir && op.status_ir.toLowerCase().includes(lowercasedSearchTerm))
        );
      });
    }

    // Sorting
    if (sortConfig !== null) {
      newProcessedData.sort((a, b) => {
        const getKeyValue = (item: OperacaoFechada, key: string) => {
          if (key === "day_trade") return item.day_trade;
          if (key === "status_ir") return item.status_ir || "";
          if (key === "data_fechamento") return new Date(item.data_fechamento).getTime();
          if (key === "resultado") return item.resultado;
          const value = (item as any)[key];
          return typeof value === "number" ? value : String(value || "").toLowerCase();
        };

        const valA = getKeyValue(a, sortConfig.key);
        const valB = getKeyValue(b, sortConfig.key);

        let comparison = 0;
        if (valA > valB) {
          comparison = 1;
        } else if (valA < valB) {
          comparison = -1;
        }
        return sortConfig.direction === "descending" ? comparison * -1 : comparison;
      });
    }

    setProcessedOperacoes(newProcessedData);
  }, [operacoesFechadas, searchTerm, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const toggleRow = (rowKey: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowKey)) {
      newExpanded.delete(rowKey);
    } else {
      newExpanded.add(rowKey);
    }
    setExpandedRows(newExpanded);
  };

  const isPreviousMonthOrEarlier = (dateString: string): boolean => {
    try {
      const operationDate = new Date(dateString.split("T")[0]);
      if (isNaN(operationDate.getTime())) return false;

      const currentDate = new Date();
      const opYear = operationDate.getFullYear();
      const opMonth = operationDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();

      if (opYear < currentYear) return true;
      if (opYear === currentYear && opMonth < currentMonth) return true;
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleDarfClick = (op: OperacaoFechada) => {
    console.log("DARF clicked for operation:", op);
  };

  const getStatusBadge = (status: string, isProfit: boolean) => {
    const baseClasses = "px-3 py-1 text-xs font-medium rounded-full border";

    switch (status) {
      case "Isento":
        return (
          <span className={`${baseClasses} bg-emerald-50 text-emerald-700 border-emerald-200`}>
            Isento
          </span>
        );
      case "Tributável Day Trade":
      case "Tributável Swing":
        return (
          <span className={`${baseClasses} bg-red-50 text-red-700 border-red-200`}>
            Tributável
          </span>
        );
      case "Lucro Compensado":
        return (
          <span className={`${baseClasses} bg-blue-50 text-blue-700 border-blue-200`}>
            Compensado
          </span>
        );
      case "Prejuízo Acumulado":
        return (
          <span className={`${baseClasses} bg-orange-50 text-orange-700 border-orange-200`}>
            Prejuízo Acum.
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-gray-50 text-gray-700 border-gray-200`}>
            {status || "N/A"}
          </span>
        );
    }
  };

  const handleOpenDarfModal = (operation: OperacaoFechada) => {
    setSelectedOpForDarf(operation);
    // Find the corresponding ResultadoMensal for the operation's month
    const operationMonthYear = operation.data_fechamento.substring(0, 7); // Extract YYYY-MM
    const relevantResultadoMensal = resultadosMensais.find(rm => rm.mes === operationMonthYear);
    setSelectedResultadoMensalForDarf(relevantResultadoMensal || null);
    setIsDarfModalOpen(true);
  };

  const totalResultadoOperacoes = processedOperacoes.reduce((acc, op) => acc + op.resultado, 0);

  if (!processedOperacoes || processedOperacoes.length === 0) { // Changed to check processedOperacoes
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-gray-900">Operações Encerradas</CardTitle>
          <CardDescription className="text-gray-600">
            Histórico de suas operações de compra e venda finalizadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
         <div className="w-full sm:w-80 my-4"> {/* Search input even when no data */}
            <Input
              placeholder="Pesquisar por ação, data ou resultado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhuma operação encerrada encontrada {searchTerm ? "para o filtro atual" : ""}</p>
            <p className="text-gray-400 text-sm mt-2">Suas operações finalizadas aparecerão aqui</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="border-b border-gray-100 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"> {/* Changed items-center to items-start */}
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900">Operações Encerradas</CardTitle>
            <CardDescription className="text-gray-600 mt-1">
              {processedOperacoes.length} operação{processedOperacoes.length !== 1 ? 'ões' : ''} encontrada{processedOperacoes.length !== 1 ? 's' : ''}
              {searchTerm && operacoesFechadas.length !== processedOperacoes.length ? ` (de ${operacoesFechadas.length} no total)` : ''}
            </CardDescription>
            <p className={`mt-2 text-sm font-semibold ${totalResultadoOperacoes >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              Resultado Total (Filtrado): {formatCurrency(totalResultadoOperacoes)}
            </p>
          </div>
          <div className="w-full sm:w-80">
            <Input
              placeholder="Pesquisar por ação, data ou resultado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-gray-50/80 border-b border-gray-100">
          <div className="grid grid-cols-12 gap-4 py-4 px-6 text-sm font-medium text-gray-700">
            <div className="col-span-1"></div>
            <div className="col-span-3">Ativo</div>
            <div
              className="col-span-2 cursor-pointer hover:text-gray-900 flex items-center transition-colors"
              onClick={() => requestSort("data_fechamento")}
            >
              Data
              {sortConfig?.key === "data_fechamento" ? (
                sortConfig.direction === "ascending" ? (
                  <ArrowUp className="ml-1 h-3 w-3" />
                ) : (
                  <ArrowDown className="ml-1 h-3 w-3" />
                )
              ) : (
                <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40" />
              )}
            </div>
            <div
              className="col-span-3 cursor-pointer hover:text-gray-900 flex items-center justify-end transition-colors"
              onClick={() => requestSort("resultado")}
            >
              Resultado
              {sortConfig?.key === "resultado" ? (
                sortConfig.direction === "ascending" ? (
                  <ArrowUp className="ml-1 h-3 w-3" />
                ) : (
                  <ArrowDown className="ml-1 h-3 w-3" />
                )
              ) : (
                <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40" />
              )}
            </div>
            <div
              className="col-span-3 cursor-pointer hover:text-gray-900 flex items-center transition-colors"
              onClick={() => requestSort("status_ir")}
            >
              Status Fiscal
              {sortConfig?.key === "status_ir" ? (
                sortConfig.direction === "ascending" ? (
                  <ArrowUp className="ml-1 h-3 w-3" />
                ) : (
                  <ArrowDown className="ml-1 h-3 w-3" />
                )
              ) : (
                <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40" />
              )}
            </div>
          </div>
        </div>

        {/* Accordion Rows */}
        <div>
          {processedOperacoes.map((op, index) => {
            const rowKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${index}`;
            const isExpanded = expandedRows.has(rowKey);
            const isProfit = op.resultado >= 0;

            return (
              <div key={rowKey} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                {/* Main Row */}
                <div
                  className="grid grid-cols-12 gap-4 py-5 px-6 cursor-pointer"
                  onClick={() => toggleRow(rowKey)}
                >
                  <div className="col-span-1 flex items-center">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>

                  <div className="col-span-3 flex items-center">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-white text-xs font-bold">{op.ticker.slice(0, 2)}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{op.ticker}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          {op.day_trade ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                              Day Trade
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              Swing
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{formatDateShort(op.data_fechamento)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{new Date(op.data_fechamento).getFullYear()}</div>
                    </div>
                  </div>

                  <div className="col-span-3 flex items-center justify-end">
                    <div className="text-right">
                      <div className={`text-lg font-bold flex items-center justify-end ${
                        isProfit ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {isProfit ? (
                          <TrendingUp className="h-4 w-4 mr-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 mr-1" />
                        )}
                        {formatCurrency(op.resultado)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatNumber(op.quantidade)} ações
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex items-center justify-start" onClick={(e) => e.stopPropagation()}>
                    {getStatusBadge(op.status_ir, isProfit)}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="bg-gray-50/30 border-t border-gray-100">
                    <div className="px-6 py-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Conditional Card: Prejuízo or Lucro/DARF Info */}
                        {op.resultado < 0 ? (
                          // Card para PREJUÍZO
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center space-x-2 mb-3">
                              {/* You can choose an appropriate icon for loss/warning */}
                              <TrendingDown className="h-4 w-4 text-red-500" />
                              <h4 className="font-medium text-gray-900 text-sm">Situação do Prejuízo</h4>
                            </div>
                            <div className="space-y-2 text-sm">
                              <p className="text-gray-700">
                                Esta operação resultou em um prejuízo de <span className="font-semibold text-red-600">{formatCurrency(op.resultado)}</span>.
                              </p>
                              <p className="text-gray-600 mt-1">
                                Status Fiscal: <span className="font-semibold">{op.status_ir || "N/A"}</span>.
                              </p>
                              {op.status_ir === "Prejuízo Acumulado" && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Este prejuízo pode ser utilizado para abater lucros futuros tributáveis do mesmo tipo (Swing Trade ou Day Trade), reduzindo o imposto devido.
                                </p>
                              )}
                              {op.status_ir === "Lucro Compensado" && (
                                 // This status is less likely for a losing op, but if backend sets it, explain.
                                <p className="text-xs text-gray-500 mt-1">
                                  Este prejuízo foi registrado, e pode ter sido utilizado para compensar lucros em outros momentos, conforme apuração mensal.
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          // Card para LUCRO ou resultado zero
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center space-x-2 mb-3">
                              <FileText className="h-4 w-4 text-green-500" />
                              <h4 className="font-medium text-gray-900 text-sm">Informações do Imposto de Renda</h4>
                            </div>
                            <div className="space-y-2 text-sm">
                              <p className="text-gray-700">
                                Resultado da Operação: <span className="font-semibold text-emerald-600">{formatCurrency(op.resultado)}</span>.
                              </p>
                              <p className="text-gray-600 mt-1">
                                Status Fiscal: <span className="font-semibold">{op.status_ir || "N/A"}</span>.
                              </p>
                              {op.status_ir === "Isento" && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Esta operação é isenta de Imposto de Renda, geralmente aplicável a vendas de Swing Trade abaixo de R$20.000,00 no mês (verifique as regras vigentes).
                                </p>
                              )}
                              {["Tributável Day Trade", "Tributável Swing"].includes(op.status_ir || "") && (
                                <>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Esta operação é tributável. O imposto devido é consolidado mensalmente.
                                  </p>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 h-auto text-sm text-blue-600 hover:text-blue-700 mt-2"
                                    onClick={() => handleOpenDarfModal(op)}
                                  >
                                    Ver Detalhes do DARF Mensal
                                  </Button>
                                </>
                              )}
                               {op.status_ir === "Lucro Compensado" && (
                                <p className="text-xs text-gray-500 mt-1">
                                  O lucro desta operação foi compensado por prejuízos acumulados anteriormente, não gerando imposto a pagar sobre este resultado específico. Verifique o DARF mensal para o consolidado.
                                   <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 h-auto text-sm text-blue-600 hover:text-blue-700 mt-1 ml-1"
                                    onClick={() => handleOpenDarfModal(op)}
                                  >
                                    Ver Detalhes do DARF Mensal
                                  </Button>
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Detalhes da Negociação */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-3">
                            <Hash className="h-4 w-4 text-green-500" />
                            <h4 className="font-medium text-gray-900 text-sm">Detalhes da Negociação</h4>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Quantidade:</span>
                              <span className="font-medium text-gray-900">{formatNumber(op.quantidade)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Preço de Compra:</span>
                              <span className="font-medium text-gray-900">{formatCurrency(op.valor_compra)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Preço de Venda:</span>
                              <span className="font-medium text-gray-900">{formatCurrency(op.valor_venda)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Resultado Financeiro */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-3">
                            <DollarSign className="h-4 w-4 text-purple-500" />
                            <h4 className="font-medium text-gray-900 text-sm">Resultado Financeiro</h4>
                          </div>
                          <div className="space-y-3">
                            <div className="text-center">
                              <div className={`text-2xl font-bold ${
                                isProfit ? "text-emerald-600" : "text-red-600"
                              }`}>
                                {formatCurrency(op.resultado)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {isProfit ? "Lucro obtido" : "Prejuízo registrado"}
                              </div>
                            </div>
                            <div className="pt-2 border-t border-gray-100">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Status Fiscal:</span>
                                <div>{getStatusBadge(op.status_ir, isProfit)}</div>
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
          })}
        </div>
      </CardContent>
    </Card>

    {isDarfModalOpen && selectedOpForDarf && selectedResultadoMensalForDarf && (
      <DarfDetailsModal
        isOpen={isDarfModalOpen}
        onClose={() => setIsDarfModalOpen(false)}
        operacaoFechada={selectedOpForDarf}
        resultadoMensal={selectedResultadoMensalForDarf}
        tipoDarf={selectedOpForDarf.day_trade ? 'daytrade' : 'swing'}
        onUpdateDashboard={onUpdateDashboard}
      />
    )}
  </>);
}

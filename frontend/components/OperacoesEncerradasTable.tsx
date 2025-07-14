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
import type { OperacaoFechada, ResultadoMensal } from "@/lib/types";
import { DarfDetailsModal } from "@/components/DarfDetailsModal";

// Mock formatting functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat("pt-BR").format(value);
};

const formatDate = (dateString: string) => {
  // Remove a parte de tempo se existir e força interpretação como data local
  const dateOnly = dateString.split("T")[0];
  const [year, month, day] = dateOnly.split("-");

  // Cria a data forçando interpretação local (evita problemas de timezone)
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateShort = (dateString: string) => {
  // Remove a parte de tempo se existir e força interpretação como data local
  const dateOnly = dateString.split("T")[0];
  const [year, month, day] = dateOnly.split("-");

  // Cria a data forçando interpretação local (evita problemas de timezone)
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
};

// Mock data
const mockOperacoes: OperacaoFechada[] = [
  {
    ticker: "BBDC4",
    data_abertura: "2025-06-18T00:00:00",
    data_fechamento: "2025-06-19T00:00:00",
    tipo: "compra",
    quantidade: 50,
    valor_compra: 25.0,
    valor_venda: 24.0,
    taxas_total: 2.0,
    resultado: 48.0,
    day_trade: false,
    status_ir: "Isento",
    operacoes_relacionadas: [],
  },
  {
    ticker: "ITSA4",
    data_abertura: "2025-05-08T00:00:00",
    data_fechamento: "2025-05-09T00:00:00",
    tipo: "compra",
    quantidade: 100,
    valor_compra: 11.0,
    valor_venda: 10.0,
    taxas_total: 4.0,
    resultado: -104.0,
    day_trade: true,
    status_ir: "Prejuízo Acumulado",
    operacoes_relacionadas: [],
  },
  {
    ticker: "BBAS3",
    data_abertura: "2025-04-23T00:00:00",
    data_fechamento: "2025-04-24T00:00:00",
    tipo: "compra",
    quantidade: 100,
    valor_compra: 25.0,
    valor_venda: 28.0,
    taxas_total: 3.0,
    resultado: 297.0,
    day_trade: false,
    status_ir: "Isento",
    operacoes_relacionadas: [],
  },
  {
    ticker: "VALE3",
    data_abertura: "2025-03-03T00:00:00",
    data_fechamento: "2025-03-04T00:00:00",
    tipo: "compra",
    quantidade: 100,
    valor_compra: 65.0,
    valor_venda: 70.0,
    taxas_total: 10.0,
    resultado: 490.0,
    day_trade: true,
    status_ir: "Tributável Day Trade",
    operacoes_relacionadas: [],
  },
  {
    ticker: "PETR4",
    data_abertura: "2025-02-18T00:00:00",
    data_fechamento: "2025-02-19T00:00:00",
    tipo: "compra",
    quantidade: 5000,
    valor_compra: 25.0,
    valor_venda: 40.0,
    taxas_total: 18.33,
    resultado: 74981.67,
    day_trade: false,
    status_ir: "Tributável Swing",
    operacoes_relacionadas: [],
  },
];

// Função para simular o status do DARF baseado na operação (movida para fora do componente)
const getDarfStatusForOperation = (
  op: OperacaoFechada,
  darfStatusMap?: Map<string, string>
): string | null => {
  if (
    op.status_ir !== "Tributável Day Trade" &&
    op.status_ir !== "Tributável Swing"
  ) {
    return null;
  }

  // Gera uma chave única para a operação
  const operationKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}`;

  // Verifica se há um status personalizado no mapa
  if (darfStatusMap && darfStatusMap.has(operationKey)) {
    const customStatus = darfStatusMap.get(operationKey);
    return customStatus || null;
  }

  // Simulação: VALE3 day trade tem DARF pago, PETR4 swing trade tem DARF pendente
  if (op.ticker === "VALE3" && op.day_trade) {
    return "pago";
  } else if (op.ticker === "PETR4" && !op.day_trade) {
    return "pendente";
  }

  // Para outras operações tributáveis, simula status baseado no resultado
  return op.resultado > 1000 ? "pago" : "pendente";
};

interface OperacoesEncerradasTableProps {
  operacoesFechadas?: OperacaoFechada[];
  resultadosMensais?: ResultadoMensal[];
  onUpdateDashboard?: () => void;
}

export default function OperacoesEncerradasTable({
  operacoesFechadas = mockOperacoes,
  resultadosMensais = [],
  onUpdateDashboard = () => {},
}: OperacoesEncerradasTableProps) {
  
  // DEBUG: Log das operações recebidas
  console.log("🎯 OPERAÇÕES FECHADAS RECEBIDAS:", {
    total: operacoesFechadas?.length || 0,
    operacoes_marco_2023: operacoesFechadas?.filter(op => 
      op.data_fechamento?.includes("2023-03")
    ) || [],
    todas_operacoes: operacoesFechadas
  });

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "ascending" | "descending";
  }>({ key: "data_fechamento", direction: "descending" });
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [processedOperacoes, setProcessedOperacoes] =
    useState<OperacaoFechada[]>(operacoesFechadas);
  const [isDarfModalOpen, setIsDarfModalOpen] = useState(false);
  const [selectedOpForDarf, setSelectedOpForDarf] =
    useState<OperacaoFechada | null>(null);
  const [selectedResultadoMensalForDarf, setSelectedResultadoMensalForDarf] =
    useState<ResultadoMensal | null>(null);

  // Estado para controlar mudanças no status do DARF
  const [darfStatusMap, setDarfStatusMap] = useState<Map<string, string>>(
    new Map()
  );

  // Inicializa o mapa de status DARF com os valores padrão
  useEffect(() => {
    const initialMap = new Map<string, string>();
    operacoesFechadas.forEach((op) => {
      if (
        op.status_ir === "Tributável Day Trade" ||
        op.status_ir === "Tributável Swing"
      ) {
        const operationKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}`;

        // Primeiro, tenta pegar o status dos resultados mensais
        const operationMonthYear = op.data_fechamento.substring(0, 7);
        const relevantResultadoMensal = resultadosMensais.find(
          (rm) => rm.mes === operationMonthYear
        );

        if (relevantResultadoMensal) {
          const statusFromResultado = op.day_trade
            ? relevantResultadoMensal.status_darf_day_trade
            : relevantResultadoMensal.status_darf_swing_trade;

          if (statusFromResultado) {
            initialMap.set(operationKey, statusFromResultado);
          }
        }
      }
    });

    setDarfStatusMap(initialMap);
  }, [operacoesFechadas, resultadosMensais]);

  // Função para atualizar o status do DARF de uma operação
  const updateDarfStatus = (op: OperacaoFechada, newStatus: string) => {
    const operationKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}`;
    setDarfStatusMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(operationKey, newStatus);
      return newMap;
    });
  };

  // Função para atualizar o status DARF baseado nos dados do resultado mensal
  const updateDarfStatusFromResultado = (
    op: OperacaoFechada,
    resultadoMensal: ResultadoMensal
  ) => {
    const operationKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}`;
    const tipoDarf = op.day_trade ? "daytrade" : "swing";

    let newStatus = "pendente";
    if (tipoDarf === "daytrade") {
      newStatus =
        resultadoMensal.status_darf_day_trade?.toLowerCase() || "pendente";
    } else {
      newStatus =
        resultadoMensal.status_darf_swing_trade?.toLowerCase() || "pendente";
    }

    setDarfStatusMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(operationKey, newStatus);
      return newMap;
    });
  };

  useEffect(() => {
    let newProcessedData = [...operacoesFechadas];

    // Filtering
    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      newProcessedData = newProcessedData.filter((op) => {
        const tipoTrade = op.day_trade ? "day trade" : "swing trade";
        return (
          op.ticker.toLowerCase().includes(lowercasedSearchTerm) ||
          formatDate(op.data_fechamento)
            .toLowerCase()
            .includes(lowercasedSearchTerm) ||
          op.resultado
            .toString()
            .toLowerCase()
            .includes(lowercasedSearchTerm) ||
          tipoTrade.toLowerCase().includes(lowercasedSearchTerm) ||
          (op.status_ir &&
            op.status_ir.toLowerCase().includes(lowercasedSearchTerm))
        );
      });
    }

    // Sorting
    if (sortConfig !== null) {
      newProcessedData.sort((a, b) => {
        const getKeyValue = (item: OperacaoFechada, key: string) => {
          if (key === "day_trade") return item.day_trade;
          if (key === "status_ir") return item.status_ir || "";
          if (key === "data_fechamento")
            return new Date(item.data_fechamento).getTime();
          if (key === "resultado") return item.resultado;
          const value = (item as any)[key];
          return typeof value === "number"
            ? value
            : String(value || "").toLowerCase();
        };

        const valA = getKeyValue(a, sortConfig.key);
        const valB = getKeyValue(b, sortConfig.key);

        let comparison = 0;
        if (valA > valB) {
          comparison = 1;
        } else if (valA < valB) {
          comparison = -1;
        }
        return sortConfig.direction === "descending"
          ? comparison * -1
          : comparison;
      });
    }

    setProcessedOperacoes(newProcessedData);
    
    // DEBUG: Log das operações processadas
    console.log("📊 OPERAÇÕES PROCESSADAS:", {
      total: newProcessedData?.length || 0,
      operacoes_marco_2023: newProcessedData?.filter(op => 
        op.data_fechamento?.includes("2023-03")
      ) || [],
      comparacao_original_vs_processado: {
        original_marco: operacoesFechadas?.filter(op => 
          op.data_fechamento?.includes("2023-03")
        )?.length || 0,
        processado_marco: newProcessedData?.filter(op => 
          op.data_fechamento?.includes("2023-03")
        )?.length || 0
      }
    });
  }, [operacoesFechadas, searchTerm, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
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

  const getStatusBadge = (status: string, isProfit: boolean) => {
    const baseClasses =
      "px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200";

    switch (status) {
      case "Isento":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span
                  className={`${baseClasses} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`}
                >
                  <CheckCircle2 className="h-3 w-3 inline mr-1" />
                  Isento
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Operação isenta de IR (geralmente vendas de swing trade abaixo
                  de R$ 20.000/mês)
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case "Tributável Day Trade":
      case "Tributável Swing":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span
                  className={`${baseClasses} bg-red-50 text-red-700 border-red-200 hover:bg-red-100`}
                >
                  <Crown className="h-3 w-3 inline mr-1" />
                  Tributável
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Operação sujeita ao pagamento de IR. Verifique o DARF mensal
                  correspondente.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case "Lucro Compensado":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span
                  className={`${baseClasses} bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100`}
                >
                  <BarChart3 className="h-3 w-3 inline mr-1" />
                  Compensado
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Lucro compensado por prejuízos acumulados em operações
                  anteriores
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case "Prejuízo Acumulado":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span
                  className={`${baseClasses} bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100`}
                >
                  <Clock className="h-3 w-3 inline mr-1" />
                  Prejuízo Acum.
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Prejuízo registrado para compensação futura com lucros do
                  mesmo tipo
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return (
          <span
            className={`${baseClasses} bg-gray-50 text-gray-700 border-gray-200`}
          >
            {status || "N/A"}
          </span>
        );
    }
  };

  // Helper para obter o nome do mês em português
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

  // Helper to render DARF badge - MODERNIZADO
  const getDarfBadge = (
    darfStatus: string | null | undefined,
    op?: OperacaoFechada
  ) => {
    if (!darfStatus || !op) return null;

    const monthName = getMonthName(op.data_fechamento);
    const darfText = `DARF ${monthName}`;

    let tooltip = `DARF de ${monthName}`;
    let colorClass = "bg-gray-100 text-gray-700 border-gray-200";
    let icon = <FileText className="h-3 w-3" />;

    if (darfStatus.toLowerCase() === "pago") {
      tooltip = `DARF de ${monthName} pago! ✅`;
      colorClass =
        "bg-green-100 text-green-700 border-green-200 hover:bg-green-150";
      icon = <CheckCircle2 className="h-3 w-3" />;
    } else if (darfStatus.toLowerCase() === "pendente") {
      tooltip = `DARF de ${monthName} pendente de pagamento ⏰`;
      colorClass =
        "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-150";
      icon = <Clock className="h-3 w-3" />;
    } else {
      tooltip = `Status do DARF de ${monthName}: ${darfStatus}`;
    }

    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold border transition-all duration-200 flex items-center gap-1 ${colorClass}`}
            >
              {icon}
              {darfText}
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="center"
            className="bg-white border border-gray-200 shadow-xl rounded-lg"
          >
            <p className="font-medium">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const handleOpenDarfModal = (operation: OperacaoFechada) => {
    setSelectedOpForDarf(operation);
    const operationMonthYear = operation.data_fechamento.substring(0, 7);
    const relevantResultadoMensal = resultadosMensais.find(
      (rm) => rm.mes === operationMonthYear
    );
    setSelectedResultadoMensalForDarf(relevantResultadoMensal || null);
    setIsDarfModalOpen(true);
  };

  // Função para atualizar o dashboard e sincronizar status do DARF
  const handleUpdateDashboard = () => {
    // Chama a função original passada como prop
    onUpdateDashboard();
    // O useEffect acima vai automaticamente sincronizar o status quando resultadosMensais for atualizado
  };

  // Função específica para atualizar o status DARF quando alterado no modal
  const handleDarfStatusChange = (newStatus: string) => {
    if (selectedOpForDarf) {
      const operationKey = `${selectedOpForDarf.ticker}-${selectedOpForDarf.data_abertura}-${selectedOpForDarf.data_fechamento}-${selectedOpForDarf.quantidade}`;
      setDarfStatusMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(operationKey, newStatus.toLowerCase());
        return newMap;
      });
    }
  };

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

  const hasOriginalData = operacoesFechadas && operacoesFechadas.length > 0;
  const hasFilteredResults =
    processedOperacoes && processedOperacoes.length > 0;

  // Estado vazio - sem dados originais
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

  // Estado vazio - sem resultados filtrados
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

            {/* Resumo zerado quando filtrado */}
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
          {/* Barra de pesquisa */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Pesquisar por ação, data, resultado ou tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 rounded-xl transition-all duration-300"
              />
            </div>
          </div>

          {/* Estado vazio filtrado */}
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
              onClick={() => setSearchTerm("")}
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
        {/* Header modernizado com gradiente */}
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

            {/* Cards de resumo no header */}
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
                        totalResultadoOperacoes >= 0
                          ? "text-green-200"
                          : "text-red-200"
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
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Barra de pesquisa modernizada */}
          <div className="mb-6 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl p-4 border border-indigo-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-indigo-500" />
              <Input
                placeholder="Pesquisar por ação, data, resultado ou tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-2 border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 rounded-xl transition-all duration-300 bg-white"
              />
            </div>
          </div>

          {/* Header da tabela modernizado */}
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
                {sortConfig?.key === "data_fechamento" ? (
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
                {sortConfig?.key === "resultado" ? (
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
                {sortConfig?.key === "status_ir" ? (
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

          {/* Accordion Rows modernizados */}
          <div className="border border-indigo-200 border-t-0 rounded-b-xl overflow-hidden">
            {processedOperacoes.map((op, index) => {
              const rowKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${index}`;
              const isExpanded = expandedRows.has(rowKey);
              const isProfit = op.resultado >= 0;

              // DEBUG: Log para operações de março 2023
              if (op.data_fechamento?.includes("2023-03")) {
                console.log("📅 OPERAÇÃO MARÇO 2023:", {
                  index,
                  ticker: op.ticker,
                  data_fechamento: op.data_fechamento,
                  resultado: op.resultado,
                  day_trade: op.day_trade,
                  status_ir: op.status_ir,
                  prejuizo_anterior_acumulado: op.prejuizo_anterior_acumulado,
                  isProfit
                });

                // Log específico para ITUB4
                if (op.ticker === "ITUB4") {
                  console.log("🔍 [ITUB4 MARÇO DETALHADO]:");
                  console.log("- Dados brutos do backend:", JSON.stringify(op, null, 2));
                  console.log("- Cálculo isProfit:", `${op.resultado} >= 0 = ${isProfit}`);
                  console.log("- Vai exibir como:", isProfit ? "LUCRO" : "PREJUÍZO");
                  console.log("- Valor que será mostrado: R$", Math.abs(op.resultado).toFixed(2));
                }
              }

              // ...existing code...
              return (
                <div
                  key={op.id ? op.id : `${op.ticker}-${op.data_fechamento}-${index}`}
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

                  {/* Expanded Row - Detalhes da operação */}
                  {isExpanded && (
                    <div className="bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 py-6 px-6 border-t border-indigo-200">
                      <div className="grid grid-cols-12 gap-6 text-sm">
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

                              {/* Card Resultado Final - Ocupa toda a largura */}
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
                              {" "}
                              <div className="space-y-4">
                                <div className="flex flex-col gap-4">
                                  <div className="flex flex-col p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                      <Shield className="h-4 w-4 text-indigo-600" />
                                      <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                                        Status Fiscal
                                      </span>
                                    </div>

                                    {/* Linha com badges */}
                                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                                      {getStatusBadge(
                                        op.status_ir || "",
                                        isProfit
                                      )}
                                      {(op.status_ir ===
                                        "Tributável Day Trade" ||
                                        op.status_ir === "Tributável Swing") &&
                                        getDarfBadge(
                                          getDarfStatusForOperation(
                                            op,
                                            darfStatusMap
                                          ),
                                          op
                                        )}
                                    </div>

                                    {/* Descrições */}
                                    <div className="text-xs text-indigo-700 leading-relaxed space-y-1">
                                      <div>
                                        <span className="font-semibold">
                                          Tributação:
                                        </span>{" "}
                                        {op.status_ir === "Isento" &&
                                          "Operação isenta de imposto de renda"}
                                        {op.status_ir ===
                                          "Tributável Day Trade" &&
                                          "Sujeita a IR de 20% sobre o lucro"}
                                        {op.status_ir === "Tributável Swing" &&
                                          "Sujeita a IR de 15% sobre o lucro"}
                                        {op.status_ir ===
                                          "Prejuízo Acumulado" &&
                                          "Prejuízo para compensação em outras operações"}
                                        {op.status_ir === "Lucro Compensado" &&
                                          "Lucro compensado por prejuízos em outras operações de mesmo tipo"}
                                        {!op.status_ir && "Status não definido"}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Card de Acúmulo de Prejuízo - apenas para operações com resultado negativo */}
                                  {!isProfit && (
                                    <div className="flex flex-col p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200 shadow-sm">
                                      <div className="flex items-center gap-2 mb-3">
                                        <Info className="h-4 w-4 text-orange-600" />
                                        <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                                          Acúmulo de Prejuízo
                                        </span>
                                      </div>

                                      {/* Cálculo simplificado */}
                                      <div className="text-xs text-orange-700 leading-relaxed space-y-3">
                                        {(() => {
                                          // Calcular valores
                                          const mesOperacao = op.data_fechamento.substring(0, 7);
                                          const diaOperacao = op.data_fechamento.substring(0, 10);
                                          const tipoOperacao = op.day_trade ? "day trade" : "swing trade";
                                          
                                          const operacoesMesmoTipo = operacoesFechadas.filter(opMes => 
                                            opMes.data_fechamento.substring(0, 7) === mesOperacao &&
                                            (opMes.day_trade ? "day trade" : "swing trade") === tipoOperacao &&
                                            opMes.data_fechamento <= op.data_fechamento &&
                                            opMes !== op
                                          );
                                          
                                          const operacoesMesmoDia = operacoesFechadas.filter(opDia => 
                                            opDia.data_fechamento.substring(0, 10) === diaOperacao &&
                                            (opDia.day_trade ? "day trade" : "swing trade") === tipoOperacao
                                          ).sort((a, b) => a.data_fechamento.localeCompare(b.data_fechamento));
                                          
                                          const lucrosJaCompensados = operacoesMesmoTipo
                                            .filter(opMes => opMes.resultado > 0 && opMes.status_ir === "Lucro Compensado")
                                            .reduce((sum, opMes) => sum + opMes.resultado, 0);
                                          
                                          const prejuizoAnteriorOriginal = op.prejuizo_anterior_acumulado || 0;
                                          const prejuizoAnteriorDisponivel = Math.max(0, prejuizoAnteriorOriginal - lucrosJaCompensados);
                                          const totalPrejuizosMes = operacoesFechadas.filter(opMes =>
                                            opMes.data_fechamento.substring(0, 7) === mesOperacao &&
                                            (opMes.day_trade ? "day trade" : "swing trade") === tipoOperacao &&
                                            opMes.resultado < 0
                                          ).reduce((sum, opMes) => sum + Math.abs(opMes.resultado), 0);
                                          const prejuizoTotalAcumulado = prejuizoAnteriorDisponivel + totalPrejuizosMes;
                                          const isMultiplasOperacoesDia = operacoesMesmoDia.length > 1;
                                          
                                          // Calcular fluxo sequencial apenas se múltiplas operações
                                          let fluxoDia = [];
                                          if (isMultiplasOperacoesDia) {
                                            const indexOperacaoAtual = operacoesMesmoDia.findIndex(opDia => 
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
                                                isOperacaoAtual: idx === indexOperacaoAtual
                                              };
                                            });
                                          }
                                          
                                          return (
                                            <>
                                              {/* Controle Sequencial - apenas se múltiplas operações */}
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


                                              {/* Prejuízo Total Acumulado - movido para baixo */}
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

                                              {/* Dica sobre compensação futura */}
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
                                  {/* Card de Compensação de Lucro - para TODAS as operações com lucro que têm prejuízo anterior */}
                                  {(() => {
                                    // Debug para ITUB4 - verificar se o card está sendo exibido incorretamente
                                    if (op.ticker === "ITUB4" && op.data_fechamento && op.data_fechamento.includes("2023-03")) {
                                      console.log("🎯 [ITUB4 CARD CONDITION] Verificando se deve exibir card de compensação:");
                                      console.log("- isProfit:", isProfit);
                                      console.log("- op.prejuizo_anterior_acumulado:", op.prejuizo_anterior_acumulado);
                                      console.log("- (op.prejuizo_anterior_acumulado || 0) > 0:", (op.prejuizo_anterior_acumulado || 0) > 0);
                                      console.log("- Condição final (isProfit && prejuizo > 0):", isProfit && (op.prejuizo_anterior_acumulado || 0) > 0);
                                      console.log("- ⚠️ Se op.resultado é negativo, isProfit deveria ser FALSE!");
                                    }
                                    
                                    return isProfit && (op.prejuizo_anterior_acumulado || 0) > 0;
                                  })() && (
                                      <div className="flex flex-col p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Info className="h-4 w-4 text-green-600" />
                                          <span className="text-xs font-semibold uppercase tracking-wide text-green-600">
                                            Compensação de Prejuízo
                                          </span>
                                        </div>
                                        <div className="text-xs text-green-700 leading-relaxed">
                                          {(() => {
                                            // Debug específico para ITUB4 em março/2023
                                            if (op.ticker === "ITUB4" && op.data_fechamento && op.data_fechamento.includes("2023-03")) {
                                              console.log("🔍 [DEBUG ITUB4 MARÇO] Operação encontrada:");
                                              console.log("- Ticker:", op.ticker);
                                              console.log("- Data fechamento:", op.data_fechamento);
                                              console.log("- Quantidade:", op.quantidade);
                                              console.log("- Day trade:", op.day_trade);
                                              console.log("- Resultado (bruto do backend):", op.resultado);
                                              console.log("- Status IR:", op.status_ir);
                                              console.log("- Prejuízo anterior acumulado:", op.prejuizo_anterior_acumulado);
                                              console.log("- isProfit (calculado frontend):", isProfit);
                                              console.log("- Valor compra:", op.valor_compra);
                                              console.log("- Valor venda:", op.valor_venda);
                                              console.log("- Operação completa:", JSON.stringify(op, null, 2));
                                            }

                                            // Usar diretamente o prejuízo anterior acumulado vindo do backend
                                            const prejuizoAnterior =
                                              op.prejuizo_anterior_acumulado ||
                                              0;
                                            const lucroOperacao = op.resultado;
                                            const tipoOperacao = op.day_trade
                                              ? "day trade"
                                              : "swing trade";

                                            // Debug adicional para ITUB4
                                            if (op.ticker === "ITUB4" && op.data_fechamento && op.data_fechamento.includes("2023-03")) {
                                              console.log("🧮 [CÁLCULO ITUB4] Variáveis do cálculo:");
                                              console.log("- prejuizoAnterior:", prejuizoAnterior);
                                              console.log("- lucroOperacao:", lucroOperacao);
                                              console.log("- tipoOperacao:", tipoOperacao);
                                              console.log("- Math.abs(op.resultado):", Math.abs(op.resultado));
                                              
                                              console.log("🚨 [PROBLEMA IDENTIFICADO] ITUB4:");
                                              console.log("- op.resultado (valor original do backend):", op.resultado);
                                              console.log("- lucroOperacao (usado no card):", lucroOperacao);
                                              console.log("- SE o backend retorna PREJUÍZO (-500), lucroOperacao deveria ser negativo!");
                                              console.log("- MAS está sendo tratado como se fosse positivo (625)");
                                              console.log("- VERIFICAÇÃO: op.resultado é positivo?", op.resultado > 0);
                                              console.log("- Se op.resultado for -500, isso explica o bug!");
                                            }

                                            // DEBUG: Log para investigar o problema do ITUB4
                                            if (op.ticker === "ITUB4" && op.data_fechamento?.includes("2023-03")) {
                                              console.log("🔍 DEBUG ITUB4 Março 2023:", {
                                                ticker: op.ticker,
                                                data_fechamento: op.data_fechamento,
                                                resultado: op.resultado,
                                                lucroOperacao,
                                                prejuizoAnterior,
                                                tipoOperacao,
                                                day_trade: op.day_trade,
                                                status_ir: op.status_ir,
                                                operacao_completa: op
                                              });
                                            }

                                            if (prejuizoAnterior > 0) {
                                              // Calcular quanto do prejuízo foi compensado
                                              const prejuizoCompensado =
                                                Math.min(
                                                  lucroOperacao,
                                                  prejuizoAnterior
                                                );
                                              const prejuizoRestante =
                                                prejuizoAnterior -
                                                prejuizoCompensado;
                                              const lucroTributavel = Math.max(
                                                0,
                                                lucroOperacao - prejuizoAnterior
                                              );

                                              return (
                                                <>
                                                  <div className="mb-2">
                                                    <span className="font-bold">
                                                      Cálculo da Compensação:
                                                    </span>
                                                  </div>
                                                  <div className="space-y-1 mb-3 text-xs">
                                                    <div>
                                                      • Lucro da operação:{" "}
                                                      <span className="font-bold text-green-800">
                                                        {(() => {
                                                          // Debug para ITUB4 - capturar o valor exato sendo exibido
                                                          if (op.ticker === "ITUB4" && op.data_fechamento && op.data_fechamento.includes("2023-03")) {
                                                            console.log("💰 [ITUB4 DISPLAY] Valor sendo exibido como 'Lucro da operação':");
                                                            console.log("- lucroOperacao (variável):", lucroOperacao);
                                                            console.log("- formatCurrency(lucroOperacao):", formatCurrency(lucroOperacao));
                                                            console.log("- op.resultado (original):", op.resultado);
                                                            console.log("- ⚠️ ERRO: Se op.resultado é negativo, NÃO deveria aparecer aqui!");
                                                          }
                                                          return formatCurrency(lucroOperacao);
                                                        })()}
                                                      </span>
                                                    </div>
                                                    <div>
                                                      • Prejuízo anterior
                                                      acumulado:{" "}
                                                      <span className="font-bold text-red-600">
                                                        {formatCurrency(
                                                          prejuizoAnterior
                                                        )}
                                                      </span>
                                                    </div>
                                                    <div className="border-t pt-1 mt-1">
                                                      <div>
                                                        • Prejuízo compensado:{" "}
                                                        <span className="font-bold text-orange-600">
                                                          {formatCurrency(
                                                            prejuizoCompensado
                                                          )}
                                                        </span>
                                                      </div>
                                                      {prejuizoRestante > 0 && (
                                                        <div>
                                                          • Prejuízo restante:{" "}
                                                          <span className="font-bold text-red-600">
                                                            {formatCurrency(
                                                              prejuizoRestante
                                                            )}
                                                          </span>
                                                        </div>
                                                      )}
                                                      {lucroTributavel > 0 && (
                                                        <div>
                                                          • Lucro tributável:{" "}
                                                          <span className="font-bold text-green-800">
                                                            {formatCurrency(
                                                              lucroTributavel
                                                            )}
                                                          </span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="text-xs">
                                                    {(() => {
                                                      // Adaptar o texto baseado no status da operação
                                                      const statusBased = {
                                                        "Lucro Compensado": {
                                                          totalText: `<span class="font-semibold text-green-700">Compensação Total:</span> Todo o lucro de <span class="font-semibold text-green-700">${formatCurrency(
                                                            lucroOperacao
                                                          )}</span> foi descontado de prejuízo anterior de <span class="font-semibold text-green-700">${tipoOperacao}</span>, resultando em <span class="font-bold">operação isenta de IR</span>.`,
                                                          parcialText: `<span class="font-semibold text-orange-700">Compensação Parcial:</span> ${formatCurrency(
                                                            prejuizoCompensado
                                                          )} do lucro foi usado para compensar o saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>. O restante (${formatCurrency(
                                                            lucroTributavel
                                                          )}) está sujeito a tributação de ${
                                                            op.day_trade
                                                              ? "20%"
                                                              : "15%"
                                                          }.`,
                                                        },
                                                        "Tributável Swing": {
                                                          totalText: `<span class="font-semibold text-green-700">Operação Compensada:</span> Todo o lucro de <span class="font-semibold text-green-700">${formatCurrency(
                                                            lucroOperacao
                                                          )}</span> foi descontado de prejuízo anterior de <span class="font-bold">${tipoOperacao}</span>. <span class="font-bold">IR = R$ 0,00</span> (isenta por compensação).`,
                                                          parcialText: `<span class="font-semibold text-blue-700">Compensação + Tributação:</span> ${formatCurrency(
                                                            prejuizoCompensado
                                                          )} do lucro compensaram o saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>. O restante (${formatCurrency(
                                                            lucroTributavel
                                                          )}) está sujeito a <span class="font-bold">IR de 15%</span> = ${formatCurrency(
                                                            lucroTributavel *
                                                              0.15
                                                          )}.`,
                                                        },
                                                        "Tributável Day Trade":
                                                          {
                                                            totalText: `<span class="font-semibold text-green-700">Day Trade Compensado:</span> Todo o lucro de <span className="font-bold">${formatCurrency(
                                                              lucroOperacao
                                                            )}</span> foi descontado de prejuízo anteriore de <span class="font-bold">${tipoOperacao}</span>. <span class="font-bold">IR = R$ 0,00</span> (isenta por compensação).`,
                                                            parcialText: `<span class="font-semibold text-blue-700">Compensação + Tributação:</span> ${formatCurrency(
                                                              prejuizoCompensado
                                                            )} do lucro compensou o saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>. O restante (${formatCurrency(
                                                              lucroTributavel
                                                            )}) está sujeito a <span class="font-bold">IR de 20%</span> = ${formatCurrency(
                                                              lucroTributavel *
                                                                0.2
                                                            )}.`,
                                                          },
                                                        Isento: {
                                                          totalText: `<span class="font-semibold text-green-700">Isenta com Compensação:</span> Esta operação é isenta de IR e ainda compensou ${formatCurrency(
                                                            prejuizoCompensado
                                                          )} do saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>.`,
                                                          parcialText: `<span class="font-semibold text-green-700">Isenta com Compensação:</span> Esta operação é isenta de IR e ainda compensou ${formatCurrency(
                                                            prejuizoCompensado
                                                          )} do saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>.`,
                                                        },
                                                      };

                                                      const currentStatus =
                                                        op.status_ir ||
                                                        "Outros";
                                                      const statusConfig = (
                                                        statusBased as any
                                                      )[currentStatus] || {
                                                        totalText: `<span class="font-semibold text-green-700">Compensação Total:</span> Todo o lucro foi descontado de  prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>.`,
                                                        parcialText: `<span class="font-semibold text-orange-700">Compensação Parcial:</span> ${formatCurrency(
                                                          prejuizoCompensado
                                                        )} do lucro foi usado para abater do saldo de prejuízos anteriores de <span class="font-bold">${tipoOperacao}</span>.`,
                                                      };

                                                      const textToShow =
                                                        lucroTributavel > 0
                                                          ? statusConfig.parcialText
                                                          : statusConfig.totalText;

                                                      return (
                                                        <div
                                                          dangerouslySetInnerHTML={{
                                                            __html: textToShow,
                                                          }}
                                                        />
                                                      );
                                                    })()}
                                                  </div>
                                                </>
                                              );
                                            } else {
                                              return (
                                                <div className="text-xs">
                                                  Este lucro foi compensado por
                                                  prejuízos acumulados de
                                                  operações de{" "}
                                                  <span className="font-bold">
                                                    {tipoOperacao}
                                                  </span>
                                                  .
                                                </div>
                                              );
                                            }
                                          })()}
                                        </div>
                                      </div>
                                    )}

                                  {/* Botão de detalhes do DARF no lugar do card de operações relacionadas */}
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
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalhes do DARF */}
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

"use client";

import React, { useState, useEffect } from "react"; // Ensure useEffect is imported
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OperacaoFechada, ResultadoMensal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DarfDetailsModal } from "./DarfDetailsModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileText, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils"; // Import centralized formatters

// Helper functions (now imported from utils.ts)
// const formatCurrency = ... (removed)
// const formatNumber = ... (removed)
// const formatDate = ... (removed)

interface OperacoesEncerradasTableProps {
  operacoesFechadas: OperacaoFechada[];
  resultadosMensais: ResultadoMensal[];
  onUpdateDashboard: () => void;
}

export function OperacoesEncerradasTable({
  operacoesFechadas,
  resultadosMensais,
  onUpdateDashboard,
}: OperacoesEncerradasTableProps) {
  const [isDarfModalOpen, setIsDarfModalOpen] = useState(false);
  const [selectedOpForDarf, setSelectedOpForDarf] =
    useState<OperacaoFechada | null>(null);
  const [selectedResultadoMensalForDarf, setSelectedResultadoMensalForDarf] =
    useState<ResultadoMensal | null>(null);
  const [selectedDarfType, setSelectedDarfType] = useState<
    "swing" | "daytrade"
  >("daytrade");

  // New state for sorting
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "ascending" | "descending";
  } | null>(null);

  // New state for search term
  const [searchTerm, setSearchTerm] = useState<string>("");

  // New state for data to be displayed in the table
  const [processedOperacoes, setProcessedOperacoes] =
    useState<OperacaoFechada[]>(operacoesFechadas);

  useEffect(() => {
    let newProcessedData = [...operacoesFechadas];

    // 1. Filtering based on searchTerm
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

    // 2. Sorting based on sortConfig
    if (sortConfig !== null) {
      newProcessedData.sort((a, b) => {
        const getKeyValue = (item: OperacaoFechada, key: string) => {
          if (key === "day_trade") return item.day_trade;
          if (key === "status_ir") return item.status_ir || "";
          if (key === "data_fechamento")
            return new Date(item.data_fechamento).getTime();
          if (key === "resultado") return item.resultado;
          // Fallback for direct properties, ensure they exist or handle potential undefined
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
  }, [operacoesFechadas, searchTerm, sortConfig]); // Removed formatDate from dependency array

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
      return false; // Error parsing date
    }
  };

  const handleDarfClick = (op: OperacaoFechada) => {
    const mesFechamento = op.data_fechamento.substring(0, 7); // YYYY-MM
    const tipoDarfAtual: "swing" | "daytrade" = op.day_trade
      ? "daytrade"
      : "swing";

    const resultadoMensalCorrespondente = resultadosMensais.find(
      (rm) => rm.mes === mesFechamento
    );

    if (resultadoMensalCorrespondente) {
      setSelectedOpForDarf(op);
      setSelectedResultadoMensalForDarf(resultadoMensalCorrespondente);
      setSelectedDarfType(tipoDarfAtual);
      setIsDarfModalOpen(true);
    } else {
      console.error(
        `ResultadoMensal não encontrado para o mês ${mesFechamento} da operação.`,
        op
      );
      // Consider adding a toast notification here for the user
      // toast({ title: "Erro", description: "Dados mensais de imposto não encontrados para esta operação.", variant: "destructive" });
    }
  };

  if (!operacoesFechadas || operacoesFechadas.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Operações Encerradas</CardTitle>
          <CardDescription>
            Histórico de suas operações de compra e venda finalizadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Nenhuma operação encerrada encontrada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Operações Encerradas</CardTitle>
        <CardDescription>
          Histórico de suas operações de compra e venda finalizadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="mb-4">
          <Input
            placeholder="Buscar em todas as colunas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ação</TableHead>
              <TableHead
                onClick={() => requestSort("data_fechamento")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Data Fech.
                  {sortConfig?.key === "data_fechamento" ? (
                    sortConfig.direction === "ascending" ? (
                      <ArrowUp className="ml-2 h-4 w-4" />
                    ) : (
                      <ArrowDown className="ml-2 h-4 w-4" />
                    )
                  ) : (
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Preço Abert.</TableHead>
              <TableHead className="text-right">Preço Fech.</TableHead>
              <TableHead
                onClick={() => requestSort("resultado")}
                className="cursor-pointer hover:bg-muted/50 text-right"
              >
                <div className="flex items-center justify-end">
                  Resultado
                  {sortConfig?.key === "resultado" ? (
                    sortConfig.direction === "ascending" ? (
                      <ArrowUp className="ml-2 h-4 w-4" />
                    ) : (
                      <ArrowDown className="ml-2 h-4 w-4" />
                    )
                  ) : (
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead
                onClick={() => requestSort("day_trade")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Tipo
                  {sortConfig?.key === "day_trade" ? (
                    sortConfig.direction === "ascending" ? (
                      <ArrowUp className="ml-2 h-4 w-4" />
                    ) : (
                      <ArrowDown className="ml-2 h-4 w-4" />
                    )
                  ) : (
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead
                onClick={() => requestSort("status_ir")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Status IR
                  {sortConfig?.key === "status_ir" ? (
                    sortConfig.direction === "ascending" ? (
                      <ArrowUp className="ml-2 h-4 w-4" />
                    ) : (
                      <ArrowDown className="ml-2 h-4 w-4" />
                    )
                  ) : (
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  )}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedOperacoes.map((op, index) => {
              // Use processedOperacoes here
              // const isDarfLinkActive logic might need to be re-evaluated or moved if it depends on the original op.status_ir string
              // For now, the switch statement handles display based on op.status_ir from processedOperacoes

              // Construct a more unique key
              const rowKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${index}`;

              return (
                <TableRow key={rowKey}>
                  <TableCell>
                    <Badge variant="outline">{op.ticker}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(op.data_fechamento)}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(op.quantidade)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(op.valor_compra)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(op.valor_venda)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      op.resultado >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(op.resultado)}
                  </TableCell>
                  <TableCell>
                    {op.day_trade && (
                      <Badge
                        variant="secondary"
                        className="bg-yellow-200 text-black border-yellow-200"
                      >
                        DT
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      let statusIrContent;
                      // isDarfActionable should use op.status_ir from the current 'op' in the map
                      const isDarfActionable =
                        op.status_ir === "Tributável" &&
                        isPreviousMonthOrEarlier(op.data_fechamento);

                      switch (op.status_ir) {
                        case "Isento":
                          statusIrContent = (
                            <Badge variant="secondary">Isento</Badge>
                          );
                          break;
                        case "Tributável Day Trade":
                        case "Tributável Swing":
                          const isActionableForIcon = isPreviousMonthOrEarlier(
                            op.data_fechamento
                          );

                          let monthlyDarfStatusForIcon: string | undefined | null = null;
                          if (isActionableForIcon) {
                            const mesFechamento = op.data_fechamento.substring(0,7);
                            const resultadoMensalCorrespondente =
                              resultadosMensais.find(
                                (rm) => rm.mes === mesFechamento
                              );
                            if (resultadoMensalCorrespondente) {
                              if (op.status_ir === "Tributável Day Trade") {
                                monthlyDarfStatusForIcon = resultadoMensalCorrespondente.status_darf_day_trade;
                              } else { // Tributável Swing
                                monthlyDarfStatusForIcon = resultadoMensalCorrespondente.status_darf_swing_trade;
                              }
                            }
                          }

                          statusIrContent = (
                            <div className="flex items-center space-x-1 justify-start">
                              <Badge variant="destructive">Tributável</Badge>
                              {isActionableForIcon && (
                                <TooltipProvider>
                                  <Tooltip delayDuration={300}>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleDarfClick(op)}
                                      >
                                        <FileText
                                          className={`h-4 w-4 ${
                                            monthlyDarfStatusForIcon === "Pago"
                                              ? "text-green-600"
                                              : "text-blue-600"
                                          }`}
                                        />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Consultar DARF</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          );
                          break;
                        case "Lucro Compensado":
                          statusIrContent = (
                            <TooltipProvider>
                              <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                  <Badge variant="default">
                                    Lucro Compensado
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    O lucro desta operação foi compensado por
                                    prejuízos acumulados e não gerou imposto a
                                    pagar neste mês.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                          break;
                        case "Prejuízo Acumulado":
                          statusIrContent = (
                            <Badge
                              variant="outline"
                              className="border-orange-500 text-orange-500"
                            >
                              Prejuízo Acumulado
                            </Badge>
                          );
                          break;
                        default:
                          statusIrContent = (
                            <span className="text-xs">
                              {op.status_ir || "-"}
                            </span>
                          );
                      }
                      return statusIrContent;
                    })()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      {selectedOpForDarf && selectedResultadoMensalForDarf && (
        <DarfDetailsModal
          isOpen={isDarfModalOpen}
          onClose={() => {
            setIsDarfModalOpen(false);
            setSelectedOpForDarf(null);
            setSelectedResultadoMensalForDarf(null);
          }}
          operacaoFechada={selectedOpForDarf}
          resultadoMensal={selectedResultadoMensalForDarf}
          tipoDarf={selectedDarfType}
          onUpdateDashboard={onUpdateDashboard}
        />
      )}
    </Card>
  );
}

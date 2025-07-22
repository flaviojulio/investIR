"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { OperacaoFechada } from "@/lib/types";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils";
import {
  FileText,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Calculator,
  Calendar,
  Info,
  TrendingUp,
  TrendingDown,
  Building,
  Lightbulb,
  HelpCircle,
  BarChart3,
} from "lucide-react";

interface DarfDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  operacaoFechada?: OperacaoFechada | null;
  tipoDarf: "swing" | "daytrade";
  onUpdateDashboard: () => void;
  onDarfStatusChange?: (operationKey: string, newStatus: string) => void;
  operacoesFechadas?: OperacaoFechada[];
}

export function DarfDetailsModal({
  isOpen,
  onClose,
  operacaoFechada,
  tipoDarf,
  onUpdateDashboard,
  onDarfStatusChange,
  operacoesFechadas = [],
}: DarfDetailsModalProps) {
  const { toast } = useToast();
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isMarkingPendente, setIsMarkingPendente] = useState(false);

  if (!isOpen || !operacaoFechada) {
    return null;
  }

  // ✅ CORREÇÃO: Usar apenas dados da API de operações fechadas
  const handleMarkAsPaid = async () => {
    if (!operacaoFechada || !operacaoFechada.mes_operacao || !tipoDarf) {
      toast({
        title: "❌ Erro",
        description: "Dados insuficientes para marcar DARF como pago.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800",
      });
      return;
    }

    setIsMarkingPaid(true);
    try {
      // ✅ USANDO: mes_operacao diretamente da operação fechada
      await api.put(
        `/impostos/darf_status/${operacaoFechada.mes_operacao}/${tipoDarf}`,
        { status: "Pago" }
      );

      toast({
        title: "✅ DARF Pago!",
        description: `DARF ${
          tipoDarf === "swing" ? "Swing Trade" : "Day Trade"
        } para ${formatMonthYear(
          operacaoFechada.mes_operacao
        )} marcado como pago com sucesso.`,
        className: "bg-green-50 border-green-200 text-green-800",
      });

      // Callback para atualizar status na tabela
      if (onDarfStatusChange && operacaoFechada) {
        const operationKey = `${operacaoFechada.ticker}-${operacaoFechada.data_abertura}-${operacaoFechada.data_fechamento}-${operacaoFechada.quantidade}`;
        onDarfStatusChange(operationKey, "pago");
      }

      onUpdateDashboard();
      onClose();
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.detail || `Erro ao marcar DARF como pago.`;
      toast({
        title: "❌ Erro no pagamento",
        description:
          typeof errorMsg === "string"
            ? errorMsg
            : "Ocorreu um erro inesperado.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800",
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleMarkAsPendente = async () => {
    if (!operacaoFechada || !operacaoFechada.mes_operacao || !tipoDarf) {
      toast({
        title: "❌ Erro",
        description: "Dados insuficientes para marcar DARF como pendente.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800",
      });
      return;
    }

    setIsMarkingPendente(true);
    try {
      // ✅ USANDO: mes_operacao diretamente da operação fechada
      await api.put(
        `/impostos/darf_status/${operacaoFechada.mes_operacao}/${tipoDarf}`,
        { status: "Pendente" }
      );

      toast({
        title: "🔄 Status Atualizado",
        description: `DARF ${
          tipoDarf === "swing" ? "Swing Trade" : "Day Trade"
        } para ${formatMonthYear(operacaoFechada.mes_operacao)} marcado como pendente.`,
        className: "bg-blue-50 border-blue-200 text-blue-800",
      });

      // Callback para atualizar status na tabela
      if (onDarfStatusChange && operacaoFechada) {
        const operationKey = `${operacaoFechada.ticker}-${operacaoFechada.data_abertura}-${operacaoFechada.data_fechamento}-${operacaoFechada.quantidade}`;
        onDarfStatusChange(operationKey, "pendente");
      }

      onUpdateDashboard();
      onClose();
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.detail || `Erro ao marcar DARF como pendente.`;
      toast({
        title: "❌ Erro na atualização",
        description:
          typeof errorMsg === "string"
            ? errorMsg
            : "Ocorreu um erro inesperado.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800",
      });
    } finally {
      setIsMarkingPendente(false);
    }
  };

  // ✅ FUNÇÃO: Gerar PDF do DARF
  const handleGeneratePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("DARF - Documento de Arrecadação Federal", 20, 30);

    doc.setFontSize(12);
    doc.text(`Código: ${darfCodigo}`, 20, 50);
    doc.text(`Competência: ${formatMonthYear(darfCompetencia)}`, 20, 60);
    doc.text(`Valor: ${formatCurrency(darfValorMensal)}`, 20, 70);
    doc.text(`Vencimento: ${formatDate(darfVencimento)}`, 20, 80);
    doc.text(`Status: ${darfStatus}`, 20, 90);

    doc.text("Detalhes da Operação:", 20, 110);
    doc.text(`Ticker: ${operacaoFechada.ticker}`, 30, 120);
    doc.text(`Quantidade: ${operacaoFechada.quantidade.toLocaleString()}`, 30, 130);
    doc.text(`Resultado: ${formatCurrency(operacaoFechada.resultado)}`, 30, 140);
    doc.text(`Tipo: ${tipoDarf === "swing" ? "Swing Trade" : "Day Trade"}`, 30, 150);

    doc.save(`DARF-${darfCompetencia}-${tipoDarf}.pdf`);

    toast({
      title: "📥 Download Concluído",
      description: "Arquivo DARF baixado com sucesso para seus arquivos.",
      className: "bg-blue-50 border-blue-200 text-blue-800",
    });
  };

  // ✅ CORREÇÃO: Usar campos corretos da operação fechada
  const darfCodigo = "6015"; // Código padrão para IR sobre ganho de capital

  const darfCompetencia = operacaoFechada.mes_operacao || operacaoFechada.data_fechamento.substring(0, 7);

  const darfValorMensal = operacaoFechada.valor_ir_pagar || 0;

  // ✅ Calcular vencimento baseado na competência
  const darfVencimento = (() => {
    if (!darfCompetencia) return new Date().toISOString().split("T")[0];

    const [ano, mes] = darfCompetencia.split("-").map(Number);

    // Próximo mês
    let proxMes = mes + 1;
    let proxAno = ano;
    if (proxMes > 12) {
      proxMes = 1;
      proxAno += 1;
    }

    // Último dia do próximo mês
    const ultimoDia = new Date(proxAno, proxMes, 0).getDate();
    const vencimento = new Date(proxAno, proxMes - 1, ultimoDia);

    // Ajustar para dia útil (se for sábado ou domingo, volta para sexta)
    while (vencimento.getDay() === 0 || vencimento.getDay() === 6) {
      vencimento.setDate(vencimento.getDate() - 1);
    }

    return vencimento.toISOString().split("T")[0];
  })();

  const darfStatus = operacaoFechada.status_darf || "Pendente";

  // ✅ Log para debug
  console.log("🔍 [DARF MODAL] Dados utilizados:", {
    darfValorMensal,
    darfStatus,
    operacaoFechada: {
      valor_ir_pagar: operacaoFechada?.valor_ir_pagar,
      valor_ir_devido: operacaoFechada?.valor_ir_devido,
      status_darf: operacaoFechada?.status_darf,
      mes_operacao: operacaoFechada?.mes_operacao,
    },
    tipoDarf,
    condicoes: {
      temValor: darfValorMensal !== undefined && darfValorMensal !== null,
      valorMaiorQue10: darfValorMensal >= 10.0,
      statusNaoPago: darfStatus !== "Pago",
      statusPago: darfStatus === "Pago",
    },
  });

  // ✅ CORREÇÃO: Condições dos botões baseadas nos dados da operação
  const shouldShowMarkAsPaidButton =
    darfValorMensal && darfValorMensal >= 10.0 && darfStatus !== "Pago";
  const shouldShowMarkAsPendenteButton =
    darfValorMensal && darfValorMensal >= 10.0 && darfStatus === "Pago";

  // Determinar cor e ícone do status
  const getStatusDisplay = (status: string | null | undefined) => {
    switch (status) {
      case "Pago":
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          text: "Pago",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          textColor: "text-green-800",
        };
      case "Pendente":
      default:
        return {
          icon: <Clock className="h-5 w-5 text-orange-600" />,
          text: "Pendente",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
          textColor: "text-orange-800",
        };
    }
  };

  const statusDisplay = getStatusDisplay(darfStatus);
  const tipoLabel = tipoDarf === "swing" ? "Swing Trade" : "Day Trade";
  const aliquota = tipoDarf === "swing" ? "15%" : "20%";

  // Cor do cabeçalho baseada no status
  const getHeaderColor = () => {
    if (operacaoFechada.status_ir === "Prejuízo Acumulado") {
      return "bg-gradient-to-r from-amber-500 to-orange-600";
    } else if (operacaoFechada.status_ir === "Lucro Compensado") {
      return "bg-gradient-to-r from-green-500 to-emerald-600";
    } else {
      return "bg-gradient-to-r from-blue-500 to-indigo-600";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-white border border-gray-200 shadow-2xl rounded-xl p-0">
        {/* Cabeçalho com gradiente */}
        <DialogHeader className={`relative ${getHeaderColor()} text-white p-6 m-0`}>
          <div className="relative z-10">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                {operacaoFechada.status_ir === "Prejuízo Acumulado" ? (
                  <TrendingDown className="h-4 w-4 text-white" />
                ) : operacaoFechada.status_ir === "Lucro Compensado" ? (
                  <TrendingUp className="h-4 w-4 text-white" />
                ) : (
                  <FileText className="h-4 w-4 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold text-white mb-1">
                  {operacaoFechada.status_ir === "Prejuízo Acumulado"
                    ? `Controle de Prejuízo ${tipoLabel}`
                    : operacaoFechada.status_ir === "Lucro Compensado"
                    ? `Compensação ${tipoLabel}`
                    : `DARF ${tipoLabel}`}
                </DialogTitle>
                <DialogDescription
                  className={
                    operacaoFechada.status_ir === "Prejuízo Acumulado"
                      ? "text-amber-100 text-sm"
                      : operacaoFechada.status_ir === "Lucro Compensado"
                      ? "text-green-100 text-sm"
                      : "text-blue-100 text-sm"
                  }
                >
                  {operacaoFechada.status_ir === "Prejuízo Acumulado"
                    ? "Controle de prejuízo acumulado para compensação futura"
                    : operacaoFechada.status_ir === "Lucro Compensado"
                    ? "Análise de compensação e situação fiscal"
                    : "Documento de Arrecadação Federal"}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="h-3 w-3 text-white/70" />
              <span className="text-white/90 text-xs">
                {operacaoFechada.status_ir === "Prejuízo Acumulado"
                  ? `Prejuízo em: ${formatMonthYear(darfCompetencia)}`
                  : operacaoFechada.status_ir === "Lucro Compensado"
                  ? `Compensação em: ${formatMonthYear(darfCompetencia)}`
                  : `Competência: ${formatMonthYear(darfCompetencia)}`}
              </span>
            </div>
          </div>
          <div className="absolute inset-0 bg-black/10"></div>
        </DialogHeader>

        <div className="px-4 space-y-4 max-h-[calc(90vh-12rem)] overflow-y-auto">
          {/* Detalhes do DARF */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="h-3 w-3 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-800 text-sm flex-1">
                DARF - Operação Individual
              </h4>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ml-auto ${statusDisplay.bgColor} ${statusDisplay.borderColor} ${statusDisplay.textColor} border flex items-center gap-1`}
              >
                {statusDisplay.icon}
                {statusDisplay.text}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Código DARF:</span>
                  <span className="font-medium text-gray-800">{darfCodigo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Competência:</span>
                  <span className="font-medium text-gray-800">
                    {formatMonthYear(darfCompetencia)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Vencimento:</span>
                  <span className="font-medium text-gray-800">
                    {formatDate(darfVencimento)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Alíquota:</span>
                  <span className="font-medium text-gray-800">{aliquota}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">IR Devido:</span>
                  <span className="font-medium text-gray-800">
                    {formatCurrency(operacaoFechada.valor_ir_devido || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-semibold">IR a Pagar:</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(darfValorMensal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detalhes da Operação */}
          <div className="bg-gradient-to-br from-gray-50 to-green-50 border border-green-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-3 w-3 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-800 text-sm">
                Detalhes da Operação
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ticker:</span>
                  <span className="font-medium text-gray-800">
                    {operacaoFechada.ticker}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantidade:</span>
                  <span className="font-medium text-gray-800">
                    {operacaoFechada.quantidade.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Preço Médio Compra:</span>
                  <span className="font-medium text-gray-800">
                    {formatCurrency(operacaoFechada.preco_medio_compra)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Preço Médio Venda:</span>
                  <span className="font-medium text-gray-800">
                    {formatCurrency(operacaoFechada.preco_medio_venda)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor Compra:</span>
                  <span className="font-medium text-gray-800">
                    {formatCurrency(operacaoFechada.valor_compra)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor Venda:</span>
                  <span className="font-medium text-gray-800">
                    {formatCurrency(operacaoFechada.valor_venda)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Resultado:</span>
                  <span
                    className={`font-bold ${
                      operacaoFechada.resultado >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(operacaoFechada.resultado)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium text-gray-800">
                    {operacaoFechada.day_trade ? "Day Trade" : "Swing Trade"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Accordeons Didáticos */}
          <div className="space-y-3">
            {/* Cálculo Fiscal Detalhado */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="calculo-fiscal" className="border border-blue-200 rounded-lg bg-blue-50">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800">
                      Como foi calculado o imposto?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4 text-sm">
                    <div className="bg-white p-4 rounded-lg border border-blue-200">
                      <h5 className="font-semibold text-blue-800 mb-2">Cálculo do IR:</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Resultado da operação:</span>
                          <span className="font-medium">{formatCurrency(operacaoFechada.resultado)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Alíquota aplicada:</span>
                          <span className="font-medium">{aliquota}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Prejuízo anterior disponível:</span>
                          <span className="font-medium">{formatCurrency(operacaoFechada.prejuizo_anterior_disponivel || 0)}</span>
                        </div>
                        <hr className="border-blue-200" />
                        <div className="flex justify-between font-semibold">
                          <span className="text-blue-800">IR devido:</span>
                          <span className="text-blue-800">{formatCurrency(operacaoFechada.valor_ir_devido || 0)}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-red-700">IR a pagar:</span>
                          <span className="text-red-700">{formatCurrency(darfValorMensal)}</span>
                        </div>
                      </div>
                    </div>

                    {operacaoFechada.prejuizo_anterior_disponivel > 0 && (
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <h6 className="font-medium text-amber-800 mb-1">Compensação de Prejuízos</h6>
                            <p className="text-xs text-amber-700">
                              Você tinha {formatCurrency(operacaoFechada.prejuizo_anterior_disponivel)} 
                              em prejuízos acumulados que foram utilizados para compensar o lucro desta operação.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Status IR Explicativo */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="status-explicativo" className="border border-purple-200 rounded-lg bg-purple-50">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-purple-800">
                      O que significa "{operacaoFechada.status_ir}"?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3 text-sm">
                    {operacaoFechada.status_ir === "Tributável Swing" && (
                      <div className="bg-white p-4 rounded-lg border border-purple-200">
                        <h5 className="font-semibold text-purple-800 mb-2">Tributável Swing Trade</h5>
                        <div className="space-y-2 text-purple-700">
                          <p>• Esta operação gerou lucro e está sujeita ao Imposto de Renda</p>
                          <p>• Alíquota: 15% sobre o ganho líquido</p>
                          <p>• Prazo para pagamento: até o último dia útil do mês seguinte</p>
                          <p>• Você deve gerar e pagar o DARF correspondente</p>
                        </div>
                      </div>
                    )}

                    {operacaoFechada.status_ir === "Tributável Day Trade" && (
                      <div className="bg-white p-4 rounded-lg border border-purple-200">
                        <h5 className="font-semibold text-purple-800 mb-2">Tributável Day Trade</h5>
                        <div className="space-y-2 text-purple-700">
                          <p>• Esta operação day trade gerou lucro tributável</p>
                          <p>• Alíquota: 20% sobre o ganho líquido</p>
                          <p>• Prazo para pagamento: até o último dia útil do mês seguinte</p>
                          <p>• Day trade tem alíquota maior que swing trade</p>
                        </div>
                      </div>
                    )}

                    {operacaoFechada.status_ir === "Lucro Compensado" && (
                      <div className="bg-white p-4 rounded-lg border border-purple-200">
                        <h5 className="font-semibold text-purple-800 mb-2">Lucro Compensado</h5>
                        <div className="space-y-2 text-purple-700">
                          <p>• Esta operação teve lucro, mas foi compensado com prejuízos anteriores</p>
                          <p>• Não há IR a pagar neste momento</p>
                          <p>• O prejuízo acumulado foi reduzido pelo lucro desta operação</p>
                          <p>• Continue acompanhando suas operações futuras</p>
                        </div>
                      </div>
                    )}

                    {operacaoFechada.status_ir === "Prejuízo Acumulado" && (
                      <div className="bg-white p-4 rounded-lg border border-purple-200">
                        <h5 className="font-semibold text-purple-800 mb-2">Prejuízo Acumulado</h5>
                        <div className="space-y-2 text-purple-700">
                          <p>• Esta operação resultou em prejuízo</p>
                          <p>• O prejuízo será acumulado para compensar lucros futuros</p>
                          <p>• Não há IR a pagar</p>
                          <p>• Mantenha o controle para aproveitar a compensação</p>
                        </div>
                      </div>
                    )}

                    {operacaoFechada.status_ir === "Isento" && (
                      <div className="bg-white p-4 rounded-lg border border-purple-200">
                        <h5 className="font-semibold text-purple-800 mb-2">Isento</h5>
                        <div className="space-y-2 text-purple-700">
                          <p>• Esta operação está isenta de Imposto de Renda</p>
                          <p>• Pode ser devido à isenção de vendas até R$ 20.000/mês</p>
                          <p>• Ou porque não houve ganho tributável</p>
                          <p>• Não é necessário gerar DARF</p>
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Guia de Preenchimento */}
            {darfValorMensal > 0 && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="guia-preenchimento" className="border border-green-200 rounded-lg bg-green-50">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">
                        Guia de Preenchimento do DARF
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 text-sm">
                      {/* Instruções passo a passo */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                          <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            1
                          </div>
                          <div>
                            <span className="font-medium text-green-800">
                              Acesse o site da Receita Federal
                            </span>
                            <p className="text-xs text-green-600 mt-1">
                              Entre em gov.br/receitafederal ou use o app "Receita Federal"
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                          <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            2
                          </div>
                          <div>
                            <span className="font-medium text-green-800">
                              Navegue até Pagamentos
                            </span>
                            <p className="text-xs text-green-600 mt-1">
                              Localize "Pagamentos" → "Impostos e Tributos"
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                          <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            3
                          </div>
                          <div>
                            <span className="font-medium text-green-800">
                              Selecione DARF
                            </span>
                            <p className="text-xs text-green-600 mt-1">
                              Escolha a opção "DARF" na lista de tributos
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                          <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            4
                          </div>
                          <div>
                            <span className="font-medium text-green-800">
                              Preencha os dados
                            </span>
                            <div className="text-xs text-green-600 mt-2 space-y-1">
                              <div className="grid grid-cols-2 gap-2 p-2 bg-green-50 rounded border">
                                <div>
                                  <strong>Código:</strong> {darfCodigo}
                                </div>
                                <div>
                                  <strong>Competência:</strong> {darfCompetencia}
                                </div>
                                <div>
                                  <strong>Vencimento:</strong> {formatDate(darfVencimento)}
                                </div>
                                <div>
                                  <strong>Valor:</strong> {formatCurrency(darfValorMensal)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Dicas e Lembretes */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="dicas-lembretes" className="border border-orange-200 rounded-lg bg-orange-50">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-orange-800">
                      Dicas e Lembretes Importantes
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3 text-sm">
                    <div className="bg-white p-4 rounded-lg border border-orange-200">
                      <h5 className="font-semibold text-orange-800 mb-3">📋 Checklist Importante:</h5>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1.5"></div>
                          <span className="text-orange-700">Pague sempre até o último dia útil do mês seguinte</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1.5"></div>
                          <span className="text-orange-700">Guarde o comprovante de pagamento do DARF</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1.5"></div>
                          <span className="text-orange-700">Inclua os dados na Declaração de IR anual</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1.5"></div>
                          <span className="text-orange-700">Mantenha controle de prejuízos para compensação</span>
                        </div>
                      </div>
                    </div>

                    {darfValorMensal >= 10 && (
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <h6 className="font-medium text-red-800 mb-1">⚠️ Atenção ao Prazo!</h6>
                            <p className="text-xs text-red-700">
                              O vencimento é em <strong>{formatDate(darfVencimento)}</strong>. 
                              Após essa data, haverá multa e juros por atraso.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h6 className="font-medium text-blue-800 mb-1">💡 Dica Pro:</h6>
                          <p className="text-xs text-blue-700">
                            Use nosso sistema para acompanhar todas suas operações e 
                            ter controle total sobre seus impostos de renda!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-gray-50 border-t border-gray-200 mt-auto">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            {/* Botão de Download PDF */}
            <Button
              onClick={handleGeneratePDF}
              variant="outline"
              className="rounded-lg border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-sm"
            >
              <div className="flex items-center gap-2">
                <Download className="h-3 w-3" />
                Baixar PDF
              </div>
            </Button>

            {/* Botão de Marcar como Pendente (se pago) */}
            {shouldShowMarkAsPendenteButton && (
              <Button
                onClick={handleMarkAsPendente}
                disabled={isMarkingPendente}
                className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
              >
                {isMarkingPendente ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                    Marcando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Marcar como Pendente
                  </div>
                )}
              </Button>
            )}

            {/* Botão de Marcar como Pago (se pendente) */}
            {shouldShowMarkAsPaidButton && (
              <Button
                onClick={handleMarkAsPaid}
                disabled={isMarkingPaid}
                className="rounded-lg bg-green-500 hover:bg-green-600 text-white transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
              >
                {isMarkingPaid ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                    Marcando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    Marcar como Pago
                  </div>
                )}
              </Button>
            )}

            <DialogClose asChild>
              <Button
                variant="outline"
                className="rounded-lg border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 text-sm"
              >
                Fechar
              </Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
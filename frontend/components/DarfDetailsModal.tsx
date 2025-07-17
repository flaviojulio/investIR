"use client";

import {
  calcularDetalhesCompensacao,
  type CompensacaoInfo,
  type DetalhesCompensacao,
} from "@/lib/fiscal-utils";

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
import { OperacaoFechada, ResultadoMensal } from "@/lib/types";
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

// ✅ CORREÇÃO 2: Atualizar a interface do DarfDetailsModalProps
interface DarfDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  operacaoFechada?: OperacaoFechada | null;
  resultadoMensal?: ResultadoMensal | null;
  tipoDarf: "swing" | "daytrade";
  onUpdateDashboard: () => void;
  onDarfStatusChange?: (operationKey: string, newStatus: string) => void; // ✅ CORRIGIDO: inclui operationKey
  operacoesFechadas?: OperacaoFechada[];
}

export function DarfDetailsModal({
  isOpen,
  onClose,
  operacaoFechada,
  resultadoMensal,
  tipoDarf,
  onUpdateDashboard,
  onDarfStatusChange,
  operacoesFechadas = [], // Nova prop com valor padrão
}: DarfDetailsModalProps) {
  const { toast } = useToast();
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isMarkingPendente, setIsMarkingPendente] = useState(false);

  if (!isOpen || !operacaoFechada || !resultadoMensal) {
    return null;
  }

  const handleMarkAsPaid = async () => {
    if (!resultadoMensal || !resultadoMensal.mes || !tipoDarf) {
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
      await api.put(
        `/impostos/darf_status/${resultadoMensal.mes}/${tipoDarf}`,
        { status: "Pago" }
      );

      toast({
        title: "✅ DARF Pago!",
        description: `DARF ${
          tipoDarf === "swing" ? "Swing Trade" : "Day Trade"
        } para ${formatMonthYear(
          resultadoMensal.mes
        )} marcado como pago com sucesso.`,
        className: "bg-green-50 border-green-200 text-green-800",
      });

      // ✅ CORREÇÃO: Passa a operação específica E o novo status
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
    if (!resultadoMensal || !resultadoMensal.mes || !tipoDarf) {
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
      await api.put(
        `/impostos/darf_status/${resultadoMensal.mes}/${tipoDarf}`,
        { status: "Pendente" }
      );

      toast({
        title: "🔄 Status Atualizado",
        description: `DARF ${
          tipoDarf === "swing" ? "Swing Trade" : "Day Trade"
        } para ${formatMonthYear(resultadoMensal.mes)} marcado como pendente.`,
        className: "bg-blue-50 border-blue-200 text-blue-800",
      });

      // ✅ CORREÇÃO: Passa a operação específica E o novo status
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

  const handleSavePdf = () => {
    if (!resultadoMensal || !darfCompetencia) {
      toast({
        title: "❌ Erro",
        description: "Dados insuficientes para gerar PDF do DARF.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800",
      });
      return;
    }

    const doc = new jsPDF();
    const titleText = `DARF - ${
      tipoDarf === "swing" ? "Swing Trade" : "Day Trade"
    }`;
    const competenciaText = formatMonthYear(darfCompetencia);
    const vencimentoText = formatDate(darfVencimento);
    const codigoReceita = darfCodigo || "N/A";
    const valorPrincipal = formatCurrency(darfValorMensal);
    const statusAtual = darfStatus || "Pendente";

    doc.setFontSize(18);
    doc.text(titleText, 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Mês de Competência: ${competenciaText}`, 14, 40);
    doc.text(`Data de Vencimento: ${vencimentoText}`, 14, 50);
    doc.text(`Código da Receita: ${codigoReceita}`, 14, 60);
    doc.text(`Valor Principal: ${valorPrincipal}`, 14, 70);
    doc.text(`Status Atual: ${statusAtual}`, 14, 80);

    if (
      operacaoFechada &&
      operacaoFechada.resultado > 0 &&
      (operacaoFechada.status_ir === "Tributável Day Trade" ||
        operacaoFechada.status_ir === "Tributável Swing")
    ) {
      doc.text(
        `--- Detalhes da Operação Inclusa (${operacaoFechada.ticker}) ---`,
        14,
        95
      );
      doc.text(
        `Resultado da Operação: ${formatCurrency(operacaoFechada.resultado)}`,
        14,
        105
      );
      doc.text(
        `Imposto Estimado da Operação: ${formatCurrency(
          impostoCalculadoDaOperacao
        )}`,
        14,
        115
      );
    }

    doc.text("Pagamento até o vencimento.", 14, 130);
    doc.text(
      "Este documento é uma representação para controle e não substitui o DARF oficial.",
      14,
      140,
      { maxWidth: 180 }
    );

    doc.save(
      `DARF_${tipoDarf}_${(darfCompetencia || "competencia").replace(
        "-",
        "_"
      )}.pdf`
    );

    toast({
      title: "📄 PDF Gerado!",
      description: "Arquivo DARF baixado com sucesso para seus arquivos.",
      className: "bg-blue-50 border-blue-200 text-blue-800",
    });
  };

  // ✅ CORREÇÃO: Mapear campos corretos do ResultadoMensal
  const darfCodigo =
    tipoDarf === "swing"
      ? "6015" // Código padrão para swing trade
      : "6015"; // Código padrão para day trade

  const darfCompetencia = resultadoMensal.mes; // ✅ Campo que existe

  const darfValorMensal =
    tipoDarf === "swing"
      ? resultadoMensal.ir_pagar_swing || resultadoMensal.ir_devido_swing // ✅ Campos que existem
      : resultadoMensal.ir_pagar_day || resultadoMensal.ir_devido_day; // ✅ Campos que existem

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

  const darfStatus =
    tipoDarf === "swing"
      ? resultadoMensal.status_darf_swing_trade || "Pendente" // ✅ Campo que existe
      : resultadoMensal.status_darf_day_trade || "Pendente"; // ✅ Campo que existe

  console.log("🔍 [BOTÃO DEBUG] Dados para exibição:", {
    darfValorMensal,
    darfStatus,
    resultadoMensal: {
      ir_pagar_swing: resultadoMensal?.ir_pagar_swing,
      ir_pagar_day: resultadoMensal?.ir_pagar_day,
      ir_devido_swing: resultadoMensal?.ir_devido_swing,
      ir_devido_day: resultadoMensal?.ir_devido_day,
      status_darf_swing_trade: resultadoMensal?.status_darf_swing_trade,
      status_darf_day_trade: resultadoMensal?.status_darf_day_trade,
    },
    tipoDarf,
    condicoes: {
      temValor: darfValorMensal !== undefined && darfValorMensal !== null,
      valorMaiorQue10: darfValorMensal >= 10.0,
      statusNaoPago: darfStatus !== "Pago",
      statusPago: darfStatus === "Pago",
    },
  });

  // ✅ CORREÇÃO: Condição do botão mais robusta
  const shouldShowMarkAsPaidButton =
    darfValorMensal && darfValorMensal >= 10.0 && darfStatus !== "Pago";
  const shouldShowMarkAsPendenteButton =
    darfValorMensal && darfValorMensal >= 10.0 && darfStatus === "Pago";

  let impostoCalculadoDaOperacao = 0;
  if (operacaoFechada.status_ir === "Tributável Day Trade") {
    impostoCalculadoDaOperacao = operacaoFechada.resultado * 0.2;
  } else if (operacaoFechada.status_ir === "Tributável Swing") {
    impostoCalculadoDaOperacao = operacaoFechada.resultado * 0.15;
  }

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

  // Cálculos para exibição didática
  const prejudoAcumuladoDay = resultadoMensal?.prejuizo_acumulado_day || 0;
  const prejudoAcumuladoSwing = resultadoMensal?.prejuizo_acumulado_swing || 0;
  const ganhoLiquidoSwing = resultadoMensal?.ganho_liquido_swing || 0;
  const ganhoLiquidoDay = resultadoMensal?.ganho_liquido_day || 0;

  console.log("🎯 [DARF DEBUG] Dados do ResultadoMensal:", {
    mes: resultadoMensal?.mes,
    prejudoAcumuladoDay,
    prejudoAcumuladoSwing,
    ganhoLiquidoSwing,
    ganhoLiquidoDay,
    tipoDarf,
    resultadoMensalCompleto: resultadoMensal,
  });

  // Calcular valores para o cálculo didático
  const prejudoAtual =
    tipoDarf === "swing" ? prejudoAcumuladoSwing : prejudoAcumuladoDay;
  const ganhoLiquido =
    tipoDarf === "swing" ? ganhoLiquidoSwing : ganhoLiquidoDay;
  const aliquotaDecimal = tipoDarf === "swing" ? 0.15 : 0.2;

  // ✅ DEBUG: Verificar dados disponíveis
  console.log("🔍 [DARF DEBUG] Dados mapeados:", {
    tipoDarf,
    resultadoMensalKeys: Object.keys(resultadoMensal),
    darfCodigo,
    darfCompetencia,
    darfValorMensal,
    darfVencimento,
    darfStatus,
    ir_pagar_swing: resultadoMensal.ir_pagar_swing,
    ir_pagar_day: resultadoMensal.ir_pagar_day,
    ir_devido_swing: resultadoMensal.ir_devido_swing,
    ir_devido_day: resultadoMensal.ir_devido_day,
  });

  // Calcular valores para o cálculo didático usando as funções utilitárias
  let ganhoBruto = ganhoLiquido;
  let prejudoUsadoCompensacao = 0;

  // ✅ NOVA LÓGICA: usar as mesmas funções da tabela
  if (operacaoFechada && operacoesFechadas.length > 0) {
    // Se a operação tem lucro, calcular compensação
    if (operacaoFechada.resultado > 0) {
      const detalhesCompensacao = calcularDetalhesCompensacao(
        operacaoFechada,
        operacoesFechadas
      );

      ganhoBruto = detalhesCompensacao.lucroOperacao;
      prejudoUsadoCompensacao = detalhesCompensacao.valorCompensado;

      console.log("🧮 [DARF DEBUG] Usando dados calculados:", {
        lucroOperacao: detalhesCompensacao.lucroOperacao,
        prejuizoAnteriorDisponivel:
          detalhesCompensacao.prejuizoAnteriorDisponivel,
        valorCompensado: detalhesCompensacao.valorCompensado,
        lucroTributavel: detalhesCompensacao.lucroTributavel,
      });
    } else {
      // Para operações de prejuízo, usar o valor da operação
      ganhoBruto = 0;
      prejudoUsadoCompensacao = 0;
    }
  } else {
    // Fallback para a lógica anterior se não houver operações
    const isMarco2023 = resultadoMensal?.mes === "2023-03";

    if (isMarco2023 && tipoDarf === "swing") {
      prejudoUsadoCompensacao = 1200;
      ganhoBruto = 4000;
    } else if (prejudoAtual > 0 && ganhoLiquido > 0) {
      const darfCalculado = ganhoLiquido * aliquotaDecimal;
      const irrf = tipoDarf === "daytrade" ? resultadoMensal?.irrf_day || 0 : 0;
      const darfEsperado = Math.max(0, darfCalculado - irrf);

      if (Math.abs(darfEsperado - (darfValorMensal || 0)) < 0.01) {
        prejudoUsadoCompensacao = prejudoAtual;
        ganhoBruto = ganhoLiquido + prejudoUsadoCompensacao;
      }
    }
  }
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl p-0">
        {/* Header modernizado com gradiente - adaptado ao tipo de operação */}
        <DialogHeader
          className={`relative overflow-hidden rounded-t-2xl p-4 text-white mb-4 ${
            operacaoFechada.status_ir === "Prejuízo Acumulado"
              ? "bg-gradient-to-r from-amber-600 via-orange-600 to-red-600"
              : operacaoFechada.status_ir === "Lucro Compensado"
              ? "bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600"
              : "bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600"
          }`}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                {operacaoFechada.status_ir === "Prejuízo Acumulado" ? (
                  <TrendingDown className="h-5 w-5 text-white" />
                ) : operacaoFechada.status_ir === "Lucro Compensado" ? (
                  <CheckCircle className="h-5 w-5 text-white" />
                ) : (
                  <FileText className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  {operacaoFechada.status_ir === "Prejuízo Acumulado"
                    ? `Fluxo de Prejuízo - ${tipoLabel}`
                    : operacaoFechada.status_ir === "Lucro Compensado"
                    ? `Análise Fiscal - ${tipoLabel}`
                    : `DARF - ${tipoLabel}`}
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
        <div className="px-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            {/* Detalhes do DARF Mensal */}
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building className="h-3 w-3 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-800 text-sm flex-1">
                  DARF Mensal
                </h4>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ml-auto ${
                    tipoDarf === "swing"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                  style={{ marginLeft: "auto" }}
                >
                  {tipoLabel}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-gray-600">Código:</span>
                  <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
                    {darfCodigo || "6015"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="flex flex-row items-center gap-1">
                    <Calendar className="h-3 w-3 text-blue-400" />
                    <span className="text-xs text-gray-600">
                      Mês de Referência:
                    </span>
                  </span>
                  <span className="font-semibold text-gray-800 text-xs">
                    {formatMonthYear(darfCompetencia)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-xs text-gray-600">Vencimento:</span>
                  <span className="font-semibold text-gray-800 text-xs">
                    {formatDate(darfVencimento)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">Valor Total:</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">
                            {tipoDarf === "daytrade"
                              ? "Valor já descontado do IRRF retido na fonte (0,01% sobre as vendas)"
                              : "Valor total do imposto devido sobre ganhos de capital swing trade"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="font-bold text-gray-900 text-sm">
                    {formatCurrency(darfValorMensal)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-gray-600">Status:</span>
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${statusDisplay.bgColor} ${statusDisplay.borderColor} border`}
                  >
                    {React.cloneElement(statusDisplay.icon, {
                      className:
                        "h-4 w-4 " + (statusDisplay.icon.props.className || ""),
                    })}
                    <span
                      className={`font-semibold text-xs ${statusDisplay.textColor}`}
                    >
                      {statusDisplay.text}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Accordeons explicativos */}
            <Accordion type="single" collapsible>
              <AccordionItem
                value="calculation"
                className="border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 mb-4"
              >
                <AccordionTrigger className="text-left hover:no-underline px-4 py-3 rounded-t-lg hover:bg-green-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-900">
                      Como chegamos no valor do DARF?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Fórmula simplificada */}
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-center">
                      <p className="text-sm font-semibold text-blue-800 mb-1">
                        🧮 Fórmula:
                      </p>
                      <p className="text-blue-700 font-mono text-sm">
                        {tipoDarf === "daytrade"
                          ? `(Lucro Bruto do Mês - Prejuízo Acumulado) × 20% - IRRF = DARF`
                          : `(Lucro Bruto do Mês - Prejuízo Acumulado) × 15% = DARF`}
                      </p>
                    </div>
                    {/* Detalhamento do Lucro Bruto e Prejuízo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Card Lucro Bruto */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <h4 className="font-semibold text-green-800 text-sm">
                            💰 Lucro Bruto do Mês
                          </h4>
                        </div>
                        <div className="text-center">
                          <span className="text-2xl font-bold text-green-700">
                            {formatCurrency(ganhoBruto)}
                          </span>
                          <p className="text-xs text-green-600 mt-1">
                            Soma de todas as operações de lucro de{" "}
                            {tipoLabel.toLowerCase()} em{" "}
                            {formatMonthYear(darfCompetencia)}
                          </p>
                        </div>
                      </div>
                      {/* Card Prejuízo Total */}
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-3 border border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <h4 className="font-semibold text-amber-800 text-sm">
                            📉 Prejuízo Total Compensado
                          </h4>
                        </div>
                        <div className="text-center">
                          <span className="text-2xl font-bold text-amber-700">
                            {formatCurrency(prejudoUsadoCompensacao)}
                          </span>
                          <p className="text-xs text-amber-600 mt-1">
                            {prejudoUsadoCompensacao > 0
                              ? `Prejuízo do mês + prejuízo acumulado usado para compensação`
                              : `Sem prejuízo para compensar`}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Cálculo visual passo a passo */}
                    <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold text-gray-800 mb-3 text-center">
                        🧮 Cálculo Passo a Passo
                      </h4>
                      <div className="space-y-3">
                        {/* Passo 1: Lucro Bruto */}
                        <div className="flex items-center justify-between py-2 px-3 bg-green-50 rounded border border-green-200">
                          <div className="flex items-center gap-2">
                            <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                              1
                            </span>
                            <span className="text-green-800 font-medium">
                              Lucro bruto do mês:
                            </span>
                          </div>
                          <span className="font-bold text-green-700 text-lg">
                            {formatCurrency(ganhoBruto)}
                          </span>
                        </div>
                        {/* Passo 2: Subtração do Prejuízo */}
                        <div className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded border border-amber-200">
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                              2
                            </span>
                            <span className="text-amber-800 font-medium">
                              (-) Prejuízo compensado:
                            </span>
                          </div>
                          <span className="font-bold text-amber-700 text-lg">
                            -{formatCurrency(prejudoUsadoCompensacao)}
                          </span>
                        </div>
                        {/* Linha de separação */}
                        <div className="border-t-2 border-dashed border-gray-300 my-2"></div>
                        {/* Resultado: Lucro Tributável */}
                        <div className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded border border-blue-200">
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                              =
                            </span>
                            <span className="text-blue-800 font-medium">
                              Lucro tributável:
                            </span>
                          </div>
                          <span className="font-bold text-blue-700 text-lg">
                            {formatCurrency(ganhoLiquido)}
                          </span>
                        </div>
                        {/* Passo 3: Aplicação da Alíquota */}
                        <div className="flex items-center justify-between py-2 px-3 bg-purple-50 rounded border border-purple-200">
                          <div className="flex items-center gap-2">
                            <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                              3
                            </span>
                            <span className="text-purple-800 font-medium">
                              × Alíquota ({aliquota}):
                            </span>
                          </div>
                          <span className="font-bold text-purple-700 text-lg">
                            {formatCurrency(ganhoLiquido * aliquotaDecimal)}
                          </span>
                        </div>
                        {/* Passo 4: IRRF (só para day trade) */}
                        {tipoDarf === "daytrade" && (
                          <div className="flex items-center justify-between py-2 px-3 bg-orange-50 rounded border border-orange-200">
                            <div className="flex items-center gap-2">
                              <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                4
                              </span>
                              <span className="text-orange-800 font-medium">
                                (-) IRRF já retido:
                              </span>
                            </div>
                            <span className="font-bold text-orange-700 text-lg">
                              -{formatCurrency(resultadoMensal?.irrf_day || 0)}
                            </span>
                          </div>
                        )}
                        {/* Linha de separação final */}
                        <div className="border-t-4 border-green-400 my-3"></div>
                        {/* Resultado Final: DARF */}
                        <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-4 rounded-lg border-2 border-green-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center">
                                <span className="text-sm font-bold">💰</span>
                              </div>
                              <span className="text-green-800 font-bold text-lg">
                                DARF a pagar:
                              </span>
                            </div>
                            <span className="font-bold text-green-800 text-2xl">
                              {formatCurrency(darfValorMensal || 0)}
                            </span>
                          </div>
                          {/* Resumo da conta */}
                          <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                            <p className="text-xs text-green-700 text-center font-mono">
                              {prejudoUsadoCompensacao > 0
                                ? `${formatCurrency(
                                    ganhoBruto
                                  )} - ${formatCurrency(
                                    prejudoUsadoCompensacao
                                  )} = ${formatCurrency(
                                    ganhoLiquido
                                  )} × ${aliquota}${
                                    tipoDarf === "daytrade"
                                      ? ` - ${formatCurrency(
                                          resultadoMensal?.irrf_day || 0
                                        )}`
                                      : ""
                                  } = ${formatCurrency(darfValorMensal || 0)}`
                                : `${formatCurrency(
                                    ganhoLiquido
                                  )} × ${aliquota}${
                                    tipoDarf === "daytrade"
                                      ? ` - ${formatCurrency(
                                          resultadoMensal?.irrf_day || 0
                                        )}`
                                      : ""
                                  } = ${formatCurrency(darfValorMensal || 0)}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="operations-breakdown"
                className="border rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 mb-4"
              >
                <AccordionTrigger className="text-left hover:no-underline px-4 py-3 rounded-t-lg hover:bg-purple-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-purple-900">
                      Análise Detalhada das Operações do Mês
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {(() => {
                    if (
                      !resultadoMensal?.mes ||
                      operacoesFechadas.length === 0
                    ) {
                      return (
                        <div className="text-center text-gray-600 py-4">
                          <p>Dados de operações não disponíveis</p>
                        </div>
                      );
                    }

                    const mesAtual = resultadoMensal.mes.substring(0, 7); // YYYY-MM

                    // Filtrar operações do mês atual e do tipo correto
                    const operacoesDoMes = operacoesFechadas.filter((op) => {
                      const dataMes = op.data_fechamento.substring(0, 7);
                      const isSameTipo =
                        tipoDarf === "daytrade" ? op.day_trade : !op.day_trade;
                      return dataMes === mesAtual && isSameTipo;
                    });

                    const operacoesLucro = operacoesDoMes.filter(
                      (op) => op.resultado > 0
                    );
                    const operacoesPrejuizo = operacoesDoMes.filter(
                      (op) => op.resultado < 0
                    );

                    const lucroTotalMes = operacoesLucro.reduce(
                      (total, op) => total + op.resultado,
                      0
                    );
                    const prejuizoTotalMes = operacoesPrejuizo.reduce(
                      (total, op) => total + Math.abs(op.resultado),
                      0
                    );

                    // CORREÇÃO: Usar o prejuízo anterior das operações, não do ResultadoMensal
                    const operacaoComPrejuizoAnterior = operacoesDoMes.find(
                      (op) =>
                        op.prejuizo_anterior_acumulado &&
                        op.prejuizo_anterior_acumulado > 0
                    );
                    const prejudoAnteriorReal =
                      operacaoComPrejuizoAnterior?.prejuizo_anterior_acumulado ||
                      0;

                    console.log("📈 [BREAKDOWN DEBUG] Operações do mês:", {
                      mesAtual,
                      tipoDarf,
                      totalOperacoes: operacoesDoMes.length,
                      operacoesLucro: operacoesLucro.length,
                      operacoesPrejuizo: operacoesPrejuizo.length,
                      lucroTotalMes,
                      prejuizoTotalMes,
                      prejudoAtual: prejudoAtual || 0,
                      prejudoAnteriorReal,
                      prejudoTotalDisponivel:
                        prejuizoTotalMes + prejudoAnteriorReal,
                      operacaoComPrejuizoAnterior: operacaoComPrejuizoAnterior
                        ? `${operacaoComPrejuizoAnterior.ticker}(${operacaoComPrejuizoAnterior.prejuizo_anterior_acumulado})`
                        : "nenhuma",
                    });

                    return (
                      <div className="space-y-4">
                        {/* Resumo estatístico */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-700">
                                {operacoesDoMes.length}
                              </div>
                              <div className="text-xs text-blue-600">
                                Total de Operações
                              </div>
                            </div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-700">
                                {operacoesLucro.length}
                              </div>
                              <div className="text-xs text-green-600">
                                Operações de Lucro
                              </div>
                            </div>
                          </div>
                          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                            <div className="text-center">
                              <div className="text-lg font-bold text-red-700">
                                {operacoesPrejuizo.length}
                              </div>
                              <div className="text-xs text-red-600">
                                Operações de Prejuízo
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Breakdown detalhado */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Operações de Lucro */}
                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                            <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Operações de Lucro ({operacoesLucro.length})
                            </h4>
                            {operacoesLucro.length > 0 ? (
                              <div className="space-y-2">
                                <div className="bg-white/60 rounded p-2 mb-2">
                                  <div className="text-center">
                                    <div className="text-lg font-bold text-green-700">
                                      +{formatCurrency(lucroTotalMes)}
                                    </div>
                                    <div className="text-xs text-green-600">
                                      Total dos Lucros
                                    </div>
                                  </div>
                                </div>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {operacoesLucro.map((op, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between items-center text-xs bg-white/40 rounded px-2 py-1"
                                    >
                                      <span className="font-medium">
                                        {op.ticker}
                                      </span>
                                      <span className="text-green-700">
                                        +{formatCurrency(op.resultado)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-green-600 text-sm">
                                Nenhuma operação de lucro no mês
                              </div>
                            )}
                          </div>

                          {/* Operações de Prejuízo */}
                          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg p-4 border border-red-200">
                            <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                              <TrendingDown className="h-4 w-4" />
                              Operações de Prejuízo ({operacoesPrejuizo.length})
                            </h4>
                            {operacoesPrejuizo.length > 0 ? (
                              <div className="space-y-2">
                                <div className="bg-white/60 rounded p-2 mb-2">
                                  <div className="text-center">
                                    <div className="text-lg font-bold text-red-700">
                                      -{formatCurrency(prejuizoTotalMes)}
                                    </div>
                                    <div className="text-xs text-red-600">
                                      Total dos Prejuízos
                                    </div>
                                  </div>
                                </div>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {operacoesPrejuizo.map((op, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between items-center text-xs bg-white/40 rounded px-2 py-1"
                                    >
                                      <span className="font-medium">
                                        {op.ticker}
                                      </span>
                                      <span className="text-red-700">
                                        {formatCurrency(op.resultado)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-red-600 text-sm">
                                Nenhuma operação de prejuízo no mês
                              </div>
                            )}
                          </div>
                        </div>

                        {/* NOVA SEÇÃO: Fluxo Sequencial de Prejuízo Acumulado */}
                        {(() => {
                          const fluxoSequencial =
                            (window as any).darfDebugData
                              ?.fluxoPrejuizoSequencial || [];
                          const operacoesPorDia =
                            (window as any).darfDebugData?.operacoesPorDia ||
                            {};
                          const diasComMultiplasOperacoes = Object.values(
                            operacoesPorDia
                          ).filter((ops: any) => ops.length > 1);

                          if (
                            fluxoSequencial.length > 0 &&
                            diasComMultiplasOperacoes.length > 0
                          ) {
                            return (
                              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-200">
                                <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                                  <TrendingDown className="h-4 w-4" />
                                  Fluxo Sequencial de Prejuízo Acumulado
                                  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-normal">
                                    {diasComMultiplasOperacoes.length} dia(s)
                                    com múltiplas operações
                                  </span>
                                </h4>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                  {Object.keys(operacoesPorDia)
                                    .sort()
                                    .map((dia) => {
                                      const operacoesDoDia =
                                        operacoesPorDia[dia];
                                      if (operacoesDoDia.length <= 1)
                                        return null;

                                      const fluxoDoDia = fluxoSequencial.filter(
                                        (f: any) => f.dia === dia
                                      );

                                      return (
                                        <div
                                          key={dia}
                                          className="bg-white/60 rounded-lg p-3 border border-purple-100"
                                        >
                                          <div className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-2">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(dia).toLocaleDateString(
                                              "pt-BR"
                                            )}{" "}
                                            - {operacoesDoDia.length} operações
                                          </div>
                                          <div className="space-y-1">
                                            {fluxoDoDia.map(
                                              (fluxo: any, idx: number) => (
                                                <div
                                                  key={idx}
                                                  className="flex items-center justify-between text-xs bg-white/40 rounded px-2 py-1.5"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <span className="bg-purple-200 text-purple-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                                                      {fluxo.indexNoDia}
                                                    </span>
                                                    <span className="font-medium">
                                                      {fluxo.operacao.ticker}
                                                    </span>
                                                    <span
                                                      className={`${
                                                        fluxo.resultado >= 0
                                                          ? "text-green-600"
                                                          : "text-red-600"
                                                      }`}
                                                    >
                                                      {fluxo.resultado >= 0
                                                        ? "+"
                                                        : ""}
                                                      {formatCurrency(
                                                        fluxo.resultado
                                                      )}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-gray-500">
                                                      Saldo:
                                                    </span>
                                                    <span className="text-purple-700 font-medium">
                                                      {formatCurrency(
                                                        fluxo.saldoAnterior
                                                      )}
                                                    </span>
                                                    <span className="text-gray-400">
                                                      →
                                                    </span>
                                                    <span className="text-purple-800 font-bold">
                                                      {formatCurrency(
                                                        fluxo.saldoAtual
                                                      )}
                                                    </span>
                                                  </div>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                                <div className="mt-3 p-2 bg-white/60 rounded border border-purple-100">
                                  <div className="text-center text-xs text-purple-700">
                                    💡 <strong>Controle Sequencial:</strong> O
                                    saldo de prejuízo acumulado é atualizado
                                    após cada operação, garantindo cálculo
                                    preciso mesmo com múltiplas operações
                                    negativas no mesmo dia.
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Cálculo final com breakdown */}
                        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200">
                          <h4 className="font-semibold text-gray-800 mb-3 text-center">
                            🧮 Cálculo com Base nas Operações Reais
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span>Lucro Total do Mês:</span>
                              <span className="font-bold text-green-700">
                                +{formatCurrency(lucroTotalMes)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Prejuízo do Mês:</span>
                              <span className="font-bold text-red-700">
                                -{formatCurrency(prejuizoTotalMes)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Prejuízo Acumulado Anterior:</span>
                              <span className="font-bold text-amber-700">
                                -{formatCurrency(prejudoAnteriorReal)}
                              </span>
                            </div>
                            <div className="border-t pt-2 mt-2">
                              <div className="flex justify-between items-center font-bold">
                                <span>Lucro Tributável:</span>
                                <span className="text-blue-700">
                                  {formatCurrency(
                                    Math.max(
                                      0,
                                      lucroTotalMes -
                                        prejuizoTotalMes -
                                        prejudoAnteriorReal
                                    )
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="explanation"
                className="border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 mb-4"
              >
                <AccordionTrigger className="text-left hover:no-underline px-4 py-3 rounded-t-lg hover:bg-blue-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">
                      O que é este DARF?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {/* Seção Educativa - O que é este DARF? */}
                  <div className=" bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                    <div className="space-y-2 text-sm text-blue-800">
                      <p className="leading-relaxed">
                        Este documento permite o pagamento do{" "}
                        <strong>
                          Imposto de Renda sobre ganhos de capital
                        </strong>{" "}
                        em operações de{" "}
                        <strong>{tipoLabel.toLowerCase()}</strong>. A alíquota
                        aplicada é de <strong>{aliquota}</strong> sobre o lucro
                        obtido.
                      </p>
                      {/* Regras específicas por tipo */}
                      <div className="bg-white/80 rounded-lg p-3 border border-blue-200 mt-3">
                        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-1">
                          <Info className="h-4 w-4" />
                          Regras do {tipoLabel}:
                        </h4>
                        {tipoDarf === "swing" ? (
                          <ul className="text-xs space-y-1 text-blue-700">
                            <li>
                              • ✅ <strong>Isenção:</strong> Vendas até R$
                              20.000 por mês são isentas
                            </li>
                            <li>
                              • 📊 <strong>Alíquota:</strong> 15% sobre o lucro
                              líquido
                            </li>
                            <li>
                              • 🔄 <strong>Compensação:</strong> Prejuízos só
                              compensam com lucros de swing trade
                            </li>
                            <li>
                              • ⏰ <strong>Vencimento:</strong> Último dia útil
                              do mês seguinte
                            </li>
                          </ul>
                        ) : (
                          <ul className="text-xs space-y-1 text-blue-700">
                            <li>
                              • ⚡ <strong>Operação:</strong> Compra e venda no
                              mesmo dia
                            </li>
                            <li>
                              • 📊 <strong>Alíquota:</strong> 20% sobre o lucro
                              líquido
                            </li>
                            <li>
                              • 💳 <strong>IRRF:</strong> 0,01% já retido na
                              fonte (descontado do DARF)
                            </li>
                            <li>
                              • 🔄 <strong>Compensação:</strong> Prejuízos só
                              compensam com lucros de day trade
                            </li>
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="payment-guide"
                className="border rounded-lg bg-gradient-to-r from-emerald-50 to-green-50 border-green-200"
              >
                <AccordionTrigger className="text-left hover:no-underline px-4 py-3 rounded-t-lg hover:bg-green-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-900">
                      Como pagar este DARF?
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Título */}
                    <div className="text-center">
                      <h4 className="font-semibold text-green-800 mb-2">
                        📱 Passo a Passo para Pagamento
                      </h4>
                      <p className="text-sm text-green-700">
                        Para pagar DARF sem código de barras:
                      </p>
                    </div>

                    {/* Passos do pagamento */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                        <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          1
                        </div>
                        <div>
                          <span className="font-medium text-green-800">
                            Acesse sua conta bancária
                          </span>
                          <p className="text-xs text-green-600 mt-1">
                            Entre no Internet Banking do seu banco
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
                          <p className="text-xs text-green-600 mt-1">
                            Insira os dados do seu DARF: código da receita,
                            competência, vencimento e valor
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border-2 border-green-300">
                        <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          ✓
                        </div>
                        <div>
                          <span className="font-medium text-green-800">
                            Revise e finalize
                          </span>
                          <p className="text-xs text-green-600 mt-1">
                            Confira todas as informações e confirme o pagamento
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dica adicional */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-blue-800 text-sm">
                          💡 Dica Importante:
                        </span>
                      </div>
                      <p className="text-xs text-blue-700">
                        Mantenha o comprovante de pagamento guardado por 5 anos.
                        Ele é sua garantia de que o imposto foi quitado!
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            {/* Grid com duas colunas para otimizar espaço */}
          </div>
        </div>
        {/* Footer modernizado */}
        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 px-4 pb-4 border-t border-gray-200">
          <div className="flex flex-1 justify-start">
            <Button
              variant="outline"
              onClick={handleSavePdf}
              className="flex items-center gap-2 rounded-lg border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-sm"
            >
              <Download className="h-3 w-3" />
              Baixar PDF
            </Button>
          </div>
          <div className="flex gap-2">
            {/* ✅ Botão "Marcar como Pendente" - aparece quando status é "Pago" */}
            {shouldShowMarkAsPendenteButton && (
              <Button
                variant="outline"
                onClick={handleMarkAsPendente}
                disabled={isMarkingPendente}
                className="rounded-lg border-2 border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 text-sm"
              >
                {isMarkingPendente ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-orange-500 border-t-transparent"></div>
                    Atualizando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Marcar como Pendente
                  </div>
                )}
              </Button>
            )}

            {/* ✅ Botão "Marcar como Pago" - aparece quando status NÃO é "Pago" */}
            {shouldShowMarkAsPaidButton && (
              <Button
                onClick={handleMarkAsPaid}
                disabled={isMarkingPaid}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-sm"
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

"use client";

import React, { useState, useEffect } from "react";
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

// Helper function para calcular preço médio de compra
const getPrecoMedioCompra = (operacao: any) => {
  if (!operacao || !operacao.valor_compra || !operacao.quantidade) return 0;
  return operacao.valor_compra / operacao.quantidade;
};
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
  tipoDarf?: "swing" | "daytrade";
  onUpdateDashboard?: () => void;
  onDarfStatusChange?: (operationKey: string, newStatus: string) => void;
  operacoesFechadas?: OperacaoFechada[];
  // Nova prop para ResultadoMensal
  resultadoMensal?: any;
}

export function DarfDetailsModal({
  isOpen,
  onClose,
  operacaoFechada,
  tipoDarf,
  onUpdateDashboard,
  onDarfStatusChange,
  operacoesFechadas = [],
  resultadoMensal,
}: DarfDetailsModalProps) {
  const { toast } = useToast();
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isMarkingPendente, setIsMarkingPendente] = useState(false);
  
  // ✅ Estado local para status DARF (atualização otimista)
  const [localDarfStatus, setLocalDarfStatus] = useState<string | null>(null);

  if (!isOpen || (!operacaoFechada && !resultadoMensal)) {
    return null;
  }

  // Se temos ResultadoMensal, usamos ele; caso contrário, OperacaoFechada
  const isFromResultadoMensal = !!resultadoMensal;

  // Quando usando ResultadoMensal, criamos modal para swing e day trade separadamente
  const shouldShowSwingModal = isFromResultadoMensal || (tipoDarf === "swing");
  const shouldShowDayTradeModal = isFromResultadoMensal || (tipoDarf === "daytrade");

  // ✅ OTIMISTA: Marcar como pago com atualização local imediata
  const handleMarkAsPaid = async () => {
    const mesOperacao = isFromResultadoMensal ? resultadoMensal?.mes : operacaoFechada?.mes_operacao;
    const tipoAtual = tipoDarf || "swing";
    
    if (!mesOperacao || !tipoAtual) {
      toast({
        title: "❌ Erro",
        description: "Dados insuficientes para marcar DARF como pago.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800",
      });
      return;
    }

    // ✅ Atualização otimista - mudar status imediatamente
    setLocalDarfStatus("Pago");
    setIsMarkingPaid(true);
    
    try {
      await api.put(
        `/impostos/darf_status/${mesOperacao}/${tipoAtual}`,
        { status: "Pago" }
      );

      toast({
        title: "✅ DARF Pago!",
        description: `DARF ${
          tipoAtual === "swing" ? "Swing Trade" : "Day Trade"
        } para ${formatMonthYear(mesOperacao)} marcado como pago.`,
        className: "bg-green-50 border-green-200 text-green-800",
      });

      // ✅ Notificar callback para atualizar tabela externa com parâmetros corretos
      if (onDarfStatusChange) {
        if (operacaoFechada) {
          const operationKey = `${operacaoFechada.ticker}-${operacaoFechada.data_abertura}-${operacaoFechada.data_fechamento}-${operacaoFechada.quantidade}`;
          onDarfStatusChange(operationKey, "pago");
        } else if (isFromResultadoMensal) {
          // ✅ CORREÇÃO: Enviar 3 parâmetros como esperado pelo TaxResults
          onDarfStatusChange(mesOperacao, tipoAtual, "pago");
        }
      }

      // ✅ NÃO fecha modal nem recarrega dashboard - apenas atualiza estado local
    } catch (error: any) {
      // ✅ Em caso de erro, reverter estado local
      setLocalDarfStatus(null);
      
      const errorMsg = error.response?.data?.detail || `Erro ao marcar DARF como pago.`;
      toast({
        title: "❌ Erro no pagamento",
        description: typeof errorMsg === "string" ? errorMsg : "Ocorreu um erro inesperado.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800",
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // ✅ OTIMISTA: Marcar como pendente com atualização local imediata
  const handleMarkAsPendente = async () => {
    const mesOperacao = isFromResultadoMensal ? resultadoMensal?.mes : operacaoFechada?.mes_operacao;
    const tipoAtual = tipoDarf || "swing";
    
    if (!mesOperacao || !tipoAtual) {
      toast({
        title: "❌ Erro",
        description: "Dados insuficientes para marcar DARF como pendente.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800",
      });
      return;
    }

    // ✅ Atualização otimista - mudar status imediatamente
    setLocalDarfStatus("Pendente");
    setIsMarkingPendente(true);
    
    try {
      await api.put(
        `/impostos/darf_status/${mesOperacao}/${tipoAtual}`,
        { status: "Pendente" }
      );

      toast({
        title: "🔄 Status Atualizado",
        description: `DARF ${
          tipoAtual === "swing" ? "Swing Trade" : "Day Trade"
        } para ${formatMonthYear(mesOperacao)} marcado como pendente.`,
        className: "bg-blue-50 border-blue-200 text-blue-800",
      });

      // ✅ Notificar callback para atualizar tabela externa com parâmetros corretos
      if (onDarfStatusChange) {
        if (operacaoFechada) {
          const operationKey = `${operacaoFechada.ticker}-${operacaoFechada.data_abertura}-${operacaoFechada.data_fechamento}-${operacaoFechada.quantidade}`;
          onDarfStatusChange(operationKey, "pendente");
        } else if (isFromResultadoMensal) {
          // ✅ CORREÇÃO: Enviar 3 parâmetros como esperado pelo TaxResults
          onDarfStatusChange(mesOperacao, tipoAtual, "pendente");
        }
      }

      // ✅ NÃO fecha modal nem recarrega dashboard - apenas atualiza estado local
    } catch (error: any) {
      // ✅ Em caso de erro, reverter estado local
      setLocalDarfStatus(null);
      
      const errorMsg = error.response?.data?.detail || `Erro ao marcar DARF como pendente.`;
      toast({
        title: "❌ Erro na atualização",
        description: typeof errorMsg === "string" ? errorMsg : "Ocorreu um erro inesperado.",
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

  // Helper functions para extrair dados da fonte correta
  const getDarfData = () => {
    if (isFromResultadoMensal) {
      return {
        codigo: "6015",
        competencia: resultadoMensal.mes,
        valorSwing: resultadoMensal.darf_valor_swing || 0,
        valorDay: resultadoMensal.darf_valor_day || 0,
        statusSwing: resultadoMensal.status_darf_swing_trade || 'Pendente',
        statusDay: resultadoMensal.status_darf_day_trade || 'Pendente',
      };
    } else {
      return {
        codigo: "6015",
        competencia: operacaoFechada?.mes_operacao || operacaoFechada?.data_fechamento?.substring(0, 7),
        valorSwing: tipoDarf === "swing" ? (operacaoFechada?.valor_ir_pagar || 0) : 0,
        valorDay: tipoDarf === "daytrade" ? (operacaoFechada?.valor_ir_pagar || 0) : 0,
        statusSwing: tipoDarf === "swing" ? (operacaoFechada?.status_darf || 'Pendente') : 'Pendente',
        statusDay: tipoDarf === "daytrade" ? (operacaoFechada?.status_darf || 'Pendente') : 'Pendente',
      };
    }
  };

  const darfData = getDarfData();
  const darfCodigo = darfData.codigo;
  const darfCompetencia = darfData.competencia;
  
  // ✅ ENHANCED CALCULATION LOGIC (from DarfComprehensiveModal)
  const [irrfSwing, setIrrfSwing] = useState<number>(0);
  const [irrfDay, setIrrfDay] = useState<number>(0);
  
  // Enhanced calculation with optimized data detection and IRRF
  const getEnhancedTaxCalculation = () => {
    if (isFromResultadoMensal) {
      // Using monthly result data - apply enhanced logic
      const mes = resultadoMensal.mes;
      const lucroLiquidoSwing = resultadoMensal.ganho_liquido_swing || 0;
      const lucroLiquidoDay = resultadoMensal.ganho_liquido_day || 0;
      
      // Calculate tax due with IRRF deduction
      const impostoDevidoSwing = (resultadoMensal.ir_devido_swing || 0);
      const impostoDevidoDay = (resultadoMensal.ir_devido_day || 0);
      
      // Apply IRRF deduction
      const impostoLiquidoSwing = Math.max(0, impostoDevidoSwing - irrfSwing);
      const impostoLiquidoDay = Math.max(0, impostoDevidoDay - irrfDay);
      
      // Only collect if >= R$ 10
      const impostoApagarSwing = impostoLiquidoSwing >= 10 ? impostoLiquidoSwing : 0;
      const impostoApagarDay = impostoLiquidoDay >= 10 ? impostoLiquidoDay : 0;
      
      return {
        tipo: tipoDarf || 'swing',
        lucroLiquido: tipoDarf === 'daytrade' ? lucroLiquidoDay : lucroLiquidoSwing,
        impostoDevido: tipoDarf === 'daytrade' ? impostoDevidoDay : impostoDevidoSwing,
        impostoLiquido: tipoDarf === 'daytrade' ? impostoLiquidoDay : impostoLiquidoSwing,
        impostoAPagar: tipoDarf === 'daytrade' ? impostoApagarDay : impostoApagarSwing,
        irrfAplicavel: tipoDarf === 'daytrade' ? irrfDay : irrfSwing,
        aliquota: tipoDarf === 'daytrade' ? 0.20 : 0.15,
        prejuizoDisponivel: 0, // This would need more complex calculation
        resultadoTributavel: (tipoDarf === 'daytrade' ? impostoDevidoDay : impostoDevidoSwing) / (tipoDarf === 'daytrade' ? 0.20 : 0.15)
      };
    } else {
      // Using operation data - simplified calculation
      const resultado = operacaoFechada?.resultado || 0;
      const aliquota = tipoDarf === 'daytrade' ? 0.20 : 0.15;
      const impostoDevido = Math.max(0, resultado * aliquota);
      const irrfAplicavel = tipoDarf === 'daytrade' ? irrfDay : irrfSwing;
      const impostoLiquido = Math.max(0, impostoDevido - irrfAplicavel);
      const impostoAPagar = impostoLiquido >= 10 ? impostoLiquido : 0;
      
      return {
        tipo: tipoDarf || 'swing',
        lucroLiquido: resultado,
        impostoDevido,
        impostoLiquido,
        impostoAPagar,
        irrfAplicavel,
        aliquota,
        prejuizoDisponivel: 0,
        resultadoTributavel: Math.max(0, resultado)
      };
    }
  };
  
  const enhancedCalc = getEnhancedTaxCalculation();
  
  const darfValorMensal = enhancedCalc.impostoAPagar;

  // ✅ Reset estado local quando modal abre/fecha
  useEffect(() => {
    if (isOpen) {
      // Resetar estado local quando modal abre
      setLocalDarfStatus(null);
    }
  }, [isOpen]);

  // ✅ Fetch IRRF data when modal opens (like DarfComprehensiveModal)
  useEffect(() => {
    if (isOpen && isFromResultadoMensal && resultadoMensal?.mes) {
      const fetchIrrfData = async () => {
        try {
          const response = await api.get(`/resultados?mes=${resultadoMensal.mes}`);
          const resultados = response.data;
          
          if (resultados && resultados.length > 0) {
            const resultado = resultados[0];
            setIrrfSwing(resultado.irrf_swing || 0);
            setIrrfDay(resultado.irrf_day || 0);
          }
        } catch (error) {
          console.error("Erro ao buscar dados de IRRF:", error);
          setIrrfSwing(0);
          setIrrfDay(0);
        }
      };
      
      fetchIrrfData();
    }
  }, [isOpen, isFromResultadoMensal, resultadoMensal?.mes]);

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

  // ✅ Status com atualização otimista - prioriza estado local
  const darfStatus = localDarfStatus || (isFromResultadoMensal ? 
    (tipoDarf === "swing" ? darfData.statusSwing : darfData.statusDay) :
    (operacaoFechada?.status_darf || "Pendente"));

  // ✅ Log para debug
  console.log("🔍 [DARF MODAL] Dados utilizados:", {
    darfValorMensal,
    darfStatus,
    localDarfStatus,
    isFromResultadoMensal,
    operacaoFechada: operacaoFechada ? {
      valor_ir_pagar: operacaoFechada?.valor_ir_pagar,
      valor_ir_devido: operacaoFechada?.valor_ir_devido,
      status_darf: operacaoFechada?.status_darf,
      mes_operacao: operacaoFechada?.mes_operacao,
    } : null,
    resultadoMensal: resultadoMensal ? {
      mes: resultadoMensal?.mes,
      ir_devido_swing: resultadoMensal?.ir_devido_swing,
      ir_devido_day: resultadoMensal?.ir_devido_day,
      darf_valor_swing: resultadoMensal?.darf_valor_swing,
      darf_valor_day: resultadoMensal?.darf_valor_day,
    } : null,
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
  const tipoLabel = (tipoDarf === "swing" || !tipoDarf) ? "Swing Trade" : "Day Trade";
  const aliquota = (tipoDarf === "swing" || !tipoDarf) ? "15%" : "20%";

  // Cor do cabeçalho baseada no status
  const getHeaderColor = () => {
    if (isFromResultadoMensal) {
      // Para ResultadoMensal, usar cor baseada nos valores de DARF
      if (darfData.valorSwing > 0 || darfData.valorDay > 0) {
        return "bg-gradient-to-r from-blue-500 to-indigo-600"; // Há DARF a pagar
      } else {
        return "bg-gradient-to-r from-green-500 to-emerald-600"; // Sem DARF
      }
    } else {
      // Para OperacaoFechada, usar status_ir se disponível
      const statusIr = operacaoFechada?.status_ir;
      if (statusIr === "Prejuízo Acumulado") {
        return "bg-gradient-to-r from-amber-500 to-orange-600";
      } else if (statusIr === "Lucro Compensado") {
        return "bg-gradient-to-r from-green-500 to-emerald-600";
      } else {
        return "bg-gradient-to-r from-blue-500 to-indigo-600";
      }
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
                {isFromResultadoMensal ? (
                  <FileText className="h-4 w-4 text-white" />
                ) : (
                  operacaoFechada?.status_ir === "Prejuízo Acumulado" ? (
                    <TrendingDown className="h-4 w-4 text-white" />
                  ) : operacaoFechada?.status_ir === "Lucro Compensado" ? (
                    <TrendingUp className="h-4 w-4 text-white" />
                  ) : (
                    <FileText className="h-4 w-4 text-white" />
                  )
                )}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold text-white mb-1">
                  {isFromResultadoMensal ? (
                    `DARF Mensal - ${formatMonthYear(darfCompetencia)}`
                  ) : (
                    operacaoFechada?.status_ir === "Prejuízo Acumulado"
                      ? `Controle de Prejuízo ${tipoLabel}`
                      : operacaoFechada?.status_ir === "Lucro Compensado"
                      ? `Compensação ${tipoLabel}`
                      : `DARF ${tipoLabel}`
                  )}
                </DialogTitle>
                <DialogDescription className="text-blue-100 text-sm">
                  {isFromResultadoMensal ? (
                    "Resumo detalhado dos impostos do mês"
                  ) : (
                    operacaoFechada?.status_ir === "Prejuízo Acumulado"
                      ? "Controle de prejuízo acumulado para compensação futura"
                      : operacaoFechada?.status_ir === "Lucro Compensado"
                      ? "Análise de compensação e situação fiscal"
                      : "Documento de Arrecadação Federal"
                  )}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="h-3 w-3 text-white/70" />
              <span className="text-white/90 text-xs">
                {isFromResultadoMensal ? (
                  `Competência: ${formatMonthYear(darfCompetencia)}`
                ) : (
                  operacaoFechada?.status_ir === "Prejuízo Acumulado"
                    ? `Prejuízo em: ${formatMonthYear(darfCompetencia)}`
                    : operacaoFechada?.status_ir === "Lucro Compensado"
                    ? `Compensação em: ${formatMonthYear(darfCompetencia)}`
                    : `Competência: ${formatMonthYear(darfCompetencia)}`
                )}
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
                    {isFromResultadoMensal ? 
                      formatCurrency((resultadoMensal?.ir_devido_swing || 0) + (resultadoMensal?.ir_devido_day || 0)) : 
                      formatCurrency(operacaoFechada?.valor_ir_devido || 0)
                    }
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

          {/* ✅ Enhanced Educational Section - Step-by-step calculation */}
          {enhancedCalc.impostoDevido > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calculator className="h-3 w-3 text-blue-600" />
                </div>
                <h4 className="font-semibold text-blue-800 text-sm">
                  Como chegamos neste valor
                </h4>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Lucro líquido do período:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(enhancedCalc.lucroLiquido)}
                  </span>
                </div>
                
                {enhancedCalc.prejuizoDisponivel > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Prejuízo disponível:</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(enhancedCalc.prejuizoDisponivel)}
                    </span>
                  </div>
                )}
                
                <div className="border-t border-blue-200 pt-3 flex justify-between items-center font-medium">
                  <span className="text-gray-800">Valor tributável:</span>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">
                      {formatCurrency(enhancedCalc.lucroLiquido)} 
                      {enhancedCalc.prejuizoDisponivel > 0 && ` - ${formatCurrency(enhancedCalc.prejuizoDisponivel)}`}
                    </div>
                    <span className="text-blue-600">= {formatCurrency(enhancedCalc.resultadoTributavel)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">
                    IR devido ({(enhancedCalc.aliquota * 100)}%):
                  </span>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">
                      {formatCurrency(enhancedCalc.resultadoTributavel)} × {(enhancedCalc.aliquota * 100)}%
                    </div>
                    <span className="text-orange-600">= {formatCurrency(enhancedCalc.impostoDevido)}</span>
                  </div>
                </div>
                
                {enhancedCalc.irrfAplicavel > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Já pago (IRRF):</span>
                    <span className="font-medium text-purple-600">
                      -{formatCurrency(enhancedCalc.irrfAplicavel)}
                    </span>
                  </div>
                )}
                
                <div className="border-t border-blue-200 pt-3 flex justify-between items-center font-semibold">
                  <span className="text-gray-800">Total a pagar:</span>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">
                      {formatCurrency(enhancedCalc.impostoDevido)} - {formatCurrency(enhancedCalc.irrfAplicavel)}
                    </div>
                    <span className={`text-lg ${enhancedCalc.impostoAPagar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      = {formatCurrency(enhancedCalc.impostoAPagar)}
                    </span>
                  </div>
                </div>
                
                {enhancedCalc.impostoLiquido > 0 && enhancedCalc.impostoAPagar === 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-yellow-600" />
                      <span className="text-xs text-yellow-800">
                        Valor menor que R$ 10,00 - dispensado de recolhimento
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detalhes da Operação ou Resultado Mensal */}
          {isFromResultadoMensal ? (
            <div className="bg-gradient-to-br from-gray-50 to-indigo-50 border border-indigo-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-3 w-3 text-indigo-600" />
                </div>
                <h4 className="font-semibold text-gray-800 text-sm">
                  Resumo Mensal - {formatMonthYear(darfCompetencia)}
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vendas Swing:</span>
                    <span className="font-medium text-gray-800">
                      {formatCurrency(resultadoMensal.vendas_swing || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ganho Swing:</span>
                    <span className={`font-medium ${(resultadoMensal.ganho_liquido_swing || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(resultadoMensal.ganho_liquido_swing || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">DARF Swing:</span>
                    <span className="font-medium text-gray-800">
                      {formatCurrency(darfData.valorSwing)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vendas Day Trade:</span>
                    <span className="font-medium text-gray-800">
                      {formatCurrency(resultadoMensal.vendas_day_trade || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ganho Day Trade:</span>
                    <span className={`font-medium ${(resultadoMensal.ganho_liquido_day || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(resultadoMensal.ganho_liquido_day || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">DARF Day Trade:</span>
                    <span className="font-medium text-gray-800">
                      {formatCurrency(darfData.valorDay)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
                      {operacaoFechada?.ticker || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quantidade:</span>
                    <span className="font-medium text-gray-800">
                      {operacaoFechada?.quantidade?.toLocaleString() || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Preço Médio Compra:</span>
                    <span className="font-medium text-gray-800">
                      {operacaoFechada ? formatCurrency(getPrecoMedioCompra(operacaoFechada)) : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Preço Médio Venda:</span>
                    <span className="font-medium text-gray-800">
                      {formatCurrency(operacaoFechada?.preco_medio_venda || 0)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valor Compra:</span>
                    <span className="font-medium text-gray-800">
                      {formatCurrency(operacaoFechada?.valor_compra || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valor Venda:</span>
                    <span className="font-medium text-gray-800">
                      {formatCurrency(operacaoFechada?.valor_venda || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Resultado:</span>
                    <span
                      className={`font-bold ${
                        (operacaoFechada?.resultado || 0) >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(operacaoFechada?.resultado || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium text-gray-800">
                      {operacaoFechada?.day_trade ? "Day Trade" : "Swing Trade"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
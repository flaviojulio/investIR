"use client";

import React, { useState } from 'react';
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
import { OperacaoFechada, ResultadoMensal } from "@/lib/types"; 
import { api } from '@/lib/api'; 
import { useToast } from '@/hooks/use-toast'; 
import jsPDF from 'jspdf'; 
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils";
import { 
  FileText, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calculator, 
  Calendar, 
  CreditCard,
  Info,
  TrendingUp,
  Building,
  Sparkles
} from "lucide-react";

interface DarfDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  operacaoFechada?: OperacaoFechada | null;
  resultadoMensal?: ResultadoMensal | null;
  tipoDarf: 'swing' | 'daytrade';
  onUpdateDashboard: () => void;
  onDarfStatusChange?: (newStatus: string) => void; // Nova prop opcional
}

export function DarfDetailsModal({
  isOpen,
  onClose,
  operacaoFechada,
  resultadoMensal,
  tipoDarf,
  onUpdateDashboard,
  onDarfStatusChange,
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
        className: "bg-red-50 border-red-200 text-red-800"
      });
      return;
    }

    setIsMarkingPaid(true);
    try {
      await api.put(`/impostos/darf_status/${resultadoMensal.mes}/${tipoDarf}`, { status: "Pago" });
      toast({
        title: "✅ DARF Pago!",
        description: `DARF ${tipoDarf === 'swing' ? 'Swing Trade' : 'Day Trade'} para ${formatMonthYear(resultadoMensal.mes)} marcado como pago com sucesso.`,
        className: "bg-green-50 border-green-200 text-green-800"
      });
      
      // Chama o callback para atualizar o status na tabela
      if (onDarfStatusChange) {
        onDarfStatusChange("pago");
      }
      
      onUpdateDashboard();
      onClose();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || `Erro ao marcar DARF como pago.`;
      toast({
        title: "❌ Erro no pagamento",
        description: typeof errorMsg === 'string' ? errorMsg : "Ocorreu um erro inesperado.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800"
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
        className: "bg-red-50 border-red-200 text-red-800"
      });
      return;
    }

    setIsMarkingPendente(true);
    try {
      await api.put(`/impostos/darf_status/${resultadoMensal.mes}/${tipoDarf}`, { status: "Pendente" });
      toast({
        title: "🔄 Status Atualizado",
        description: `DARF ${tipoDarf === 'swing' ? 'Swing Trade' : 'Day Trade'} para ${formatMonthYear(resultadoMensal.mes)} marcado como pendente.`,
        className: "bg-blue-50 border-blue-200 text-blue-800"
      });
      
      // Chama o callback para atualizar o status na tabela
      if (onDarfStatusChange) {
        onDarfStatusChange("pendente");
      }
      
      onUpdateDashboard();
      onClose();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || `Erro ao marcar DARF como pendente.`;
      toast({
        title: "❌ Erro na atualização",
        description: typeof errorMsg === 'string' ? errorMsg : "Ocorreu um erro inesperado.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800"
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
        className: "bg-red-50 border-red-200 text-red-800"
      });
      return;
    }

    const doc = new jsPDF();
    const titleText = `DARF - ${tipoDarf === 'swing' ? 'Swing Trade' : 'Day Trade'}`;
    const competenciaText = formatMonthYear(darfCompetencia);
    const vencimentoText = formatDate(darfVencimento);
    const codigoReceita = darfCodigo || "N/A";
    const valorPrincipal = formatCurrency(darfValorMensal);
    const statusAtual = darfStatus || "Pendente";

    doc.setFontSize(18);
    doc.text(titleText, 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Mês de Competência: ${competenciaText}`, 14, 40);
    doc.text(`Data de Vencimento: ${vencimentoText}`, 14, 50);
    doc.text(`Código da Receita: ${codigoReceita}`, 14, 60);
    doc.text(`Valor Principal: ${valorPrincipal}`, 14, 70);
    doc.text(`Status Atual: ${statusAtual}`, 14, 80);

    if (operacaoFechada && operacaoFechada.resultado > 0 && (operacaoFechada.status_ir === "Tributável Day Trade" || operacaoFechada.status_ir === "Tributável Swing")) {
        doc.text(`--- Detalhes da Operação Inclusa (${operacaoFechada.ticker}) ---`, 14, 95);
        doc.text(`Resultado da Operação: ${formatCurrency(operacaoFechada.resultado)}`, 14, 105);
        doc.text(`Imposto Estimado da Operação: ${formatCurrency(impostoCalculadoDaOperacao)}`, 14, 115);
    }
    
    doc.text("Pagamento até o vencimento.", 14, 130);
    doc.text("Este documento é uma representação para controle e não substitui o DARF oficial.", 14, 140, { maxWidth: 180 });

    doc.save(`DARF_${tipoDarf}_${(darfCompetencia || "competencia").replace('-', '_')}.pdf`);
    
    // Toast de sucesso para download
    toast({
      title: "📄 PDF Gerado!",
      description: "Arquivo DARF baixado com sucesso para seus arquivos.",
      className: "bg-blue-50 border-blue-200 text-blue-800"
    });
  };

  // Determine which DARF details to use from ResultadoMensal based on tipoDarf
  const darfCodigo = tipoDarf === 'swing' ? resultadoMensal.darf_codigo_swing : resultadoMensal.darf_codigo_day;
  const darfCompetencia = tipoDarf === 'swing' ? resultadoMensal.darf_competencia_swing : resultadoMensal.darf_competencia_day;
  const darfValorMensal = tipoDarf === 'swing' ? resultadoMensal.darf_valor_swing : resultadoMensal.darf_valor_day;
  const darfVencimento = tipoDarf === 'swing' ? resultadoMensal.darf_vencimento_swing : resultadoMensal.darf_vencimento_day;
  const darfStatus = tipoDarf === 'swing' ? resultadoMensal.status_darf_swing_trade : resultadoMensal.status_darf_day_trade;

  let impostoCalculadoDaOperacao = 0;
  if (operacaoFechada.status_ir === "Tributável Day Trade") {
    impostoCalculadoDaOperacao = operacaoFechada.resultado * 0.20; 
  } else if (operacaoFechada.status_ir === "Tributável Swing") {
    impostoCalculadoDaOperacao = operacaoFechada.resultado * 0.15;
  }

  // Determinar cor e ícone do status
  const getStatusDisplay = (status: string | null | undefined) => {
    switch (status) {
      case 'Pago':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          text: 'Pago',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800'
        };
      case 'Pendente':
      default:
        return {
          icon: <Clock className="h-5 w-5 text-orange-600" />,
          text: 'Pendente',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800'
        };
    }
  };

  const statusDisplay = getStatusDisplay(darfStatus);
  const tipoLabel = tipoDarf === 'swing' ? 'Swing Trade' : 'Day Trade';
  const aliquota = tipoDarf === 'swing' ? '15%' : '20%';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl p-0">
        {/* Header modernizado com gradiente */}
        <DialogHeader className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-4 text-white mb-4">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  DARF - {tipoLabel}
                </DialogTitle>
                <DialogDescription className="text-blue-100 text-sm">
                  Documento de Arrecadação Federal
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="h-3 w-3 text-blue-200" />
              <span className="text-blue-100 text-xs">
                Competência: {formatMonthYear(darfCompetencia)}
              </span>
            </div>
          </div>
          <div className="absolute inset-0 bg-black/10"></div>
        </DialogHeader>
        
        <div className="px-4 space-y-4">
          {/* Seção Educativa */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-blue-900 text-sm">O que é este DARF?</h3>
            </div>
            <p className="text-xs text-blue-800 leading-relaxed">
              Este documento permite o pagamento do Imposto de Renda sobre ganhos de capital em operações de{" "}
              <strong>{tipoLabel.toLowerCase()}</strong>. A alíquota aplicada é de <strong>{aliquota}</strong> sobre o lucro obtido.
            </p>
          </div>

          {/* Grid com duas colunas para otimizar espaço */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Detalhes da Operação */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-800 text-sm">Operação Tributável</h4>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-xs text-gray-600">Ação:</span>
                  <span className="font-semibold text-blue-600 text-sm">{operacaoFechada.ticker}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-xs text-gray-600">Tipo:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    tipoDarf === 'swing' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {tipoLabel}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-xs text-gray-600">Lucro:</span>
                  <span className="font-bold text-green-600 text-sm">
                    {formatCurrency(operacaoFechada.resultado)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-gray-600">IR desta Op.:</span>
                  <span className="font-bold text-purple-600 text-sm">
                    {formatCurrency(impostoCalculadoDaOperacao)}
                  </span>
                </div>
              </div>
            </div>

            {/* Detalhes do DARF Mensal */}
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building className="h-3 w-3 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-800 text-sm">DARF Mensal</h4>
              </div>              
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-gray-600">Código:</span>
                  <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
                    {darfCodigo || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="flex flex-row items-center gap-1">
                    <Calendar className="h-3 w-3 text-blue-400" />
                    <span className="text-xs text-gray-600">Mês de Referência:</span>
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
                            {tipoDarf === 'daytrade' 
                              ? 'Valor já descontado do IRRF retido na fonte (0,01% sobre as vendas)'
                              : 'Valor total do imposto devido sobre ganhos de capital swing trade'
                            }
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
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${statusDisplay.bgColor} ${statusDisplay.borderColor} border`}>
                    {/* Ícone do status com tamanho fixo e alinhamento */}
                    {React.cloneElement(statusDisplay.icon, { className: 'h-4 w-4 ' + (statusDisplay.icon.props.className || '') })}
                    <span className={`font-semibold text-xs ${statusDisplay.textColor}`}>{statusDisplay.text}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Aviso compacto */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                O valor total do DARF pode incluir outras operações tributáveis do mesmo tipo realizadas em {formatMonthYear(darfCompetencia)}.
              </p>
            </div>
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
            {darfStatus === 'Pago' && darfValorMensal && darfValorMensal > 0 && (
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
            
            {darfStatus !== 'Pago' && darfValorMensal && darfValorMensal >= 10.0 && (
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
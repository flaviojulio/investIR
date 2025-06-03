"use client";

import React, { useState } from 'react'; // Added useState
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
import { OperacaoFechada, ResultadoMensal } from "@/lib/types"; 
import { api } from '@/lib/api'; 
import { useToast } from '@/hooks/use-toast'; 
import jsPDF from 'jspdf'; 
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils"; // Import centralized formatters

// Helper functions are now imported from utils.ts

interface DarfDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  operacaoFechada?: OperacaoFechada | null; // The specific operation that triggered the modal
  resultadoMensal?: ResultadoMensal | null; // The monthly result for the DARF
  tipoDarf: 'swing' | 'daytrade'; // To know which DARF details from ResultadoMensal to show
  onUpdateDashboard: () => void; // To refresh data after marking as paid
}

export function DarfDetailsModal({
  isOpen,
  onClose,
  operacaoFechada,
  resultadoMensal,
  tipoDarf,
  onUpdateDashboard,
}: DarfDetailsModalProps) {
  const { toast } = useToast();
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isMarkingPendente, setIsMarkingPendente] = useState(false);

  if (!isOpen || !operacaoFechada || !resultadoMensal) {
    return null; // Don't render if not open or essential data is missing
  }

  const handleMarkAsPaid = async () => {
    if (!resultadoMensal || !resultadoMensal.mes || !tipoDarf) {
      toast({ title: "Erro", description: "Dados insuficientes para marcar DARF como pago.", variant: "destructive" });
      return;
    }

    setIsMarkingPaid(true);
    try {
      await api.put(`/impostos/darf_status/${resultadoMensal.mes}/${tipoDarf}`, { status: "Pago" });
      toast({
        title: "Sucesso!",
        description: `DARF ${tipoDarf === 'swing' ? 'Swing Trade' : 'Day Trade'} para ${formatMonthYear(resultadoMensal.mes)} marcado como pago.`,
      });
      onUpdateDashboard(); // Refresh dashboard data
      onClose(); // Close the modal
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || `Erro ao marcar DARF como pago.`;
      toast({
        title: "Erro",
        description: typeof errorMsg === 'string' ? errorMsg : "Ocorreu um erro.",
        variant: "destructive",
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleMarkAsPendente = async () => {
    if (!resultadoMensal || !resultadoMensal.mes || !tipoDarf) {
      toast({ title: "Erro", description: "Dados insuficientes para marcar DARF como pendente.", variant: "destructive" });
      return;
    }

    setIsMarkingPendente(true);
    try {
      await api.put(`/impostos/darf_status/${resultadoMensal.mes}/${tipoDarf}`, { status: "Pendente" });
      toast({
        title: "Sucesso!",
        description: `DARF ${tipoDarf === 'swing' ? 'Swing Trade' : 'Day Trade'} para ${formatMonthYear(resultadoMensal.mes)} marcado como pendente.`,
      });
      onUpdateDashboard(); // Refresh dashboard data
      onClose(); // Close the modal
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || `Erro ao marcar DARF como pendente.`;
      toast({
        title: "Erro",
        description: typeof errorMsg === 'string' ? errorMsg : "Ocorreu um erro.",
        variant: "destructive",
      });
    } finally {
      setIsMarkingPendente(false);
    }
  };

  const handleSavePdf = () => {
    if (!resultadoMensal || !darfCompetencia) { // darfCompetencia is derived from resultadoMensal
      toast({ title: "Erro", description: "Dados insuficientes para gerar PDF do DARF.", variant: "destructive" });
      return;
    }

    const doc = new jsPDF();
    const titleText = `DARF - ${tipoDarf === 'swing' ? 'Swing Trade' : 'Day Trade'}`;
    const competenciaText = formatMonthYear(darfCompetencia);
    const vencimentoText = formatDate(darfVencimento);
    const codigoReceita = darfCodigo || "N/A"; // Use N/A if null
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
    
    doc.text("Pagamento até o vencimento.", 14, 130); // Adjusted y-position
    doc.text("Este documento é uma representação para controle e não substitui o DARF oficial.", 14, 140, { maxWidth: 180 });


    doc.save(`DARF_${tipoDarf}_${(darfCompetencia || "competencia").replace('-', '_')}.pdf`);
  };

  // Determine which DARF details to use from ResultadoMensal based on tipoDarf
  const darfCodigo = tipoDarf === 'swing' ? resultadoMensal.darf_codigo_swing : resultadoMensal.darf_codigo_day;
  const darfCompetencia = tipoDarf === 'swing' ? resultadoMensal.darf_competencia_swing : resultadoMensal.darf_competencia_day;
  const darfValorMensal = tipoDarf === 'swing' ? resultadoMensal.darf_valor_swing : resultadoMensal.darf_valor_day;
  const darfVencimento = tipoDarf === 'swing' ? resultadoMensal.darf_vencimento_swing : resultadoMensal.darf_vencimento_day;
  const darfStatus = tipoDarf === 'swing' ? resultadoMensal.status_darf_swing_trade : resultadoMensal.status_darf_day_trade;

  const impostoDaOperacao = operacaoFechada.resultado > 0 ? 
    (operacaoFechada.day_trade ? operacaoFechada.resultado * 0.20 : operacaoFechada.resultado * 0.15) 
    : 0;
    // Note: This is a simplified IR calculation for the operation itself. 
    // For DayTrade, IRRF should be considered if displaying net IR.
    // For SwingTrade, exemption status (already in opFechada.status_ir) is key.
    // The user wants to see "Valor do imposto para ESTA OPERAÇÃO".
    // If opFechada.status_ir is "Tributável...", then this calculation applies. If "Isenta", it's 0.

  let impostoCalculadoDaOperacao = 0;
  if (operacaoFechada.status_ir === "Tributável Day Trade") {
    impostoCalculadoDaOperacao = operacaoFechada.resultado * 0.20; 
    // Consider IRRF if it was part of opFechada.resultado or needs separate handling.
  } else if (operacaoFechada.status_ir === "Tributável Swing") {
    impostoCalculadoDaOperacao = operacaoFechada.resultado * 0.15;
  }


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>DARF {tipoDarf === 'swing' ? '' : ' - Day Trade'}</DialogTitle>
          <DialogDescription>
            Mês de Competência: {formatMonthYear(darfCompetencia)}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <h4 className="font-semibold text-sm mb-1">Referente à Operação:</h4>
            <p className="text-sm">Ação: {operacaoFechada.ticker}</p>
            <p className="text-sm">Resultado da Operação: {formatCurrency(operacaoFechada.resultado)}</p>
            <p className="text-sm">Imposto Estimado da Operação: {formatCurrency(impostoCalculadoDaOperacao)}</p>
          </div>
          <hr/>
          <div>
            <h4 className="font-semibold text-sm mb-1">DARF Mensal Consolidado ({tipoDarf === 'swing' ? 'Swing Trade' : 'Day Trade'}):</h4>
            <p className="text-sm">Código da Receita: {darfCodigo || "N/A"}</p>
            <p className="text-sm">Valor Total do DARF Mensal: <span className="font-bold">{formatCurrency(darfValorMensal)}</span></p>
            <p className="text-xs text-muted-foreground">
              (Nota: O valor total do DARF mensal pode incluir outras operações tributáveis do mesmo tipo no mês de {formatMonthYear(darfCompetencia)}.)
            </p>
            <p className="text-sm">Data de Vencimento: {formatDate(darfVencimento)}</p>
            <p className="text-sm">Status Atual do DARF Mensal: <span className={`font-semibold ${darfStatus === 'Pago' ? 'text-green-600' : 'text-orange-600'}`}>{darfStatus || "Pendente"}</span></p>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2 pt-4">
          <div className="mt-2 sm:mt-0"> 
            <Button variant="outline" size="sm" onClick={handleSavePdf}>
              Salvar PDF
            </Button>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <DialogClose asChild>
            </DialogClose>
            
            {darfStatus !== 'Pago' && darfValorMensal && darfValorMensal >= 10.0 && (
              <Button 
                type="button" 
                size="sm" 
                onClick={handleMarkAsPaid}
                disabled={isMarkingPaid}
                className="mt-2 sm:mt-0"
              >
                {isMarkingPaid ? "Marcando..." : "Marcar Como Pago"}
              </Button>
            )}
            
            {darfStatus === 'Pago' && darfValorMensal && darfValorMensal > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMarkAsPendente}
                disabled={isMarkingPendente}
                className="mt-2 sm:mt-0"
              >
                {isMarkingPendente ? "Marcando..." : "Marcar como Pendente"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

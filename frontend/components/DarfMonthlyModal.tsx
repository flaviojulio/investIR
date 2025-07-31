"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OperacaoFechada } from "@/lib/types";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils";
import {
  CheckCircle,
  Clock,
  Calculator,
  Calendar,
  CreditCard,
  Lightbulb,
  Info,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface DarfDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  operacaoFechada?: OperacaoFechada | null;
  tipoDarf?: "swing" | "daytrade";
  onUpdateDashboard?: () => void;
  onDarfStatusChange?: (yearMonth: string, type: 'swing' | 'daytrade', newStatus: string) => void;
  operacoesFechadas?: OperacaoFechada[];
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
  const [localDarfStatus, setLocalDarfStatus] = useState<string | null>(null);

  // Reset estado local quando modal abre/muda dados
  useEffect(() => {
    if (isOpen) {
      setLocalDarfStatus(null); // Reset para usar dados frescos do prop
    }
  }, [isOpen, resultadoMensal?.mes, tipoDarf]);

  console.log("🔍 [MODAL DEBUG] Props recebidas:", { isOpen, operacaoFechada: !!operacaoFechada, resultadoMensal: !!resultadoMensal });

  if (!isOpen) {
    console.log("🔍 [MODAL DEBUG] Modal fechado - isOpen:", isOpen);
    return null;
  }

  if (!operacaoFechada && !resultadoMensal) {
    console.log("🔍 [MODAL DEBUG] Sem dados - operacaoFechada:", !!operacaoFechada, "resultadoMensal:", !!resultadoMensal);
    return null;
  }

  console.log("🔍 [MODAL DEBUG] Modal vai renderizar");

  const isFromResultadoMensal = !!resultadoMensal;

  // Auto-detectar tipo baseado nos dados disponíveis quando for ResultadoMensal
  const tipoDetectado = isFromResultadoMensal ? (() => {
    const temSwing = (resultadoMensal.ir_pagar_swing || 0) > 0;
    const temDay = (resultadoMensal.ir_pagar_day || 0) > 0;
    
    // Se tem ambos, priorizar o que tem maior valor
    if (temSwing && temDay) {
      return (resultadoMensal.ir_pagar_swing || 0) >= (resultadoMensal.ir_pagar_day || 0) ? 'swing' : 'daytrade';
    }
    
    // Se tem apenas um tipo
    if (temDay) return 'daytrade';
    if (temSwing) return 'swing';
    
    // Default para swing se não tem nenhum
    return tipoDarf || 'swing';
  })() : (tipoDarf || 'swing');

  // Usar dados prontos da API (sem recálculos)
  const dados = isFromResultadoMensal ? {
    ganhoLiquidoMes: tipoDetectado === 'daytrade' ? (resultadoMensal.ganho_liquido_day || 0) : (resultadoMensal.ganho_liquido_swing || 0),
    prejuizoAcumulado: tipoDetectado === 'daytrade' ? (resultadoMensal.prejuizo_acumulado_day || 0) : (resultadoMensal.prejuizo_acumulado_swing || 0),
    irDevido: tipoDetectado === 'daytrade' ? (resultadoMensal.ir_devido_day || 0) : (resultadoMensal.ir_devido_swing || 0),
    irAPagar: tipoDetectado === 'daytrade' ? (resultadoMensal.ir_pagar_day || 0) : (resultadoMensal.ir_pagar_swing || 0),
    irrfDay: resultadoMensal.irrf_day || 0,
    irrfSwing: resultadoMensal.irrf_swing || 0,
    vendasSwing: resultadoMensal.vendas_swing || 0,
    aliquota: tipoDetectado === 'daytrade' ? 0.20 : 0.15,
    tipo: tipoDetectado
  } : {
    ganhoLiquidoMes: operacaoFechada?.resultado || 0,
    prejuizoAcumulado: 0,
    irDevido: Math.max(0, (operacaoFechada?.resultado || 0) * (tipoDarf === 'daytrade' ? 0.20 : 0.15)),
    irAPagar: 0,
    irrfDay: 0,
    irrfSwing: 0,
    vendasSwing: 0,
    aliquota: tipoDarf === 'daytrade' ? 0.20 : 0.15,
    tipo: tipoDarf || 'swing'
  };

  // Para compatibilidade com código existente
  const calculo = {
    impostoAPagar: dados.irAPagar >= 10 ? dados.irAPagar : 0,
    impostoDevido: dados.irDevido,
    lucroLiquido: dados.ganhoLiquidoMes,
    aliquota: dados.aliquota,
    tipo: dados.tipo
  };

  const darfStatus = localDarfStatus || (isFromResultadoMensal ? 
    (tipoDetectado === "swing" ? (resultadoMensal.status_darf_swing_trade || 'pendente') : (resultadoMensal.status_darf_day_trade || 'pendente')) :
    (operacaoFechada?.status_darf || "pendente"));

  // Normalizar para minúsculo para consistência
  const normalizedStatus = darfStatus?.toLowerCase() || 'pendente';

  console.log("🔍 [MODAL STATUS DEBUG]:", {
    rawDarfStatus: darfStatus,
    normalizedStatus,
    localDarfStatus,
    resultadoMensal_swing: resultadoMensal?.status_darf_swing_trade,
    resultadoMensal_day: resultadoMensal?.status_darf_day_trade,
    tipoDarf_original: tipoDarf,
    tipoDetectado,
    irAPagar: dados.irAPagar,
    temSwing: (resultadoMensal?.ir_pagar_swing || 0) > 0,
    temDay: (resultadoMensal?.ir_pagar_day || 0) > 0
  });

  const shouldShowMarkAsPaidButton = dados.irAPagar >= 10.0 && normalizedStatus !== "pago";
  const shouldShowMarkAsPendenteButton = dados.irAPagar >= 10.0 && normalizedStatus === "pago";

  // Calcular vencimento
  const competencia = isFromResultadoMensal ? resultadoMensal.mes : operacaoFechada?.mes_operacao;
  const vencimento = (() => {
    if (!competencia) return new Date().toISOString().split("T")[0];
    const [ano, mes] = competencia.split("-").map(Number);
    let proxMes = mes + 1;
    let proxAno = ano;
    if (proxMes > 12) {
      proxMes = 1;
      proxAno += 1;
    }
    const ultimoDia = new Date(proxAno, proxMes, 0).getDate();
    const vencimento = new Date(proxAno, proxMes - 1, ultimoDia);
    while (vencimento.getDay() === 0 || vencimento.getDay() === 6) {
      vencimento.setDate(vencimento.getDate() - 1);
    }
    return vencimento.toISOString().split("T")[0];
  })();

  console.log("🔍 [MODAL DEBUG] IRRF corrigido:", {
    tipoDarf,
    irDevido: dados.irDevido,
    irAPagar: dados.irAPagar,
    irrfSwing: dados.irrfSwing,
    irrfDay: dados.irrfDay,
    diferenca: dados.irDevido - dados.irAPagar,
    matemáticaCorreta: Math.abs((dados.irDevido - dados.irAPagar) - (tipoDarf === 'daytrade' ? dados.irrfDay : dados.irrfSwing)) < 0.01
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6 -m-6 mb-6">
          <DialogTitle className="text-xl font-semibold">
            Detalhes do DARF - {formatMonthYear(competencia)}
          </DialogTitle>
          <p className="text-orange-100 text-sm">
            {calculo.impostoAPagar > 0 ? "Impostos calculados para pagamento" : "Sem impostos devidos neste período"}
          </p>
        </DialogHeader>
        
        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {/* 💰 Situação Principal */}
          <div className="text-center py-6 px-6 bg-gray-50 rounded-xl shadow-sm space-y-3">
            {dados.irAPagar > 0 ? (
              <>
                <div className="text-4xl font-bold text-red-600">
                  {formatCurrency(dados.irAPagar)}
                </div>
                <p className="text-sm text-gray-600">
                  Vencimento: {formatDate(vencimento)}
                </p>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                  normalizedStatus === "pago" ? "bg-green-50 border-green-200 text-green-800" : "bg-orange-50 border-orange-200 text-orange-800"
                } border`}>
                  {normalizedStatus === "pago" ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  {normalizedStatus === "pago" ? "Pago" : "Pendente"}
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <div className="text-2xl font-semibold text-green-600 mb-2">
                  Nada a pagar este mês
                </div>
                <p className="text-sm text-gray-600 max-w-sm mx-auto">
                  Seus resultados não geraram impostos devidos.
                </p>
              </>
            )}
          </div>

          {/* 📊 Como Pagar - Dados DARF */}
          {dados.irAPagar > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                </div>
                <h4 className="font-semibold text-blue-800 text-base">
                  Como Pagar o DARF
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Site:</span>
                    <span className="font-medium text-blue-600">gov.br/receitafederal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Código:</span>
                    <span className="font-medium text-gray-800">6015</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Competência:</span>
                    <span className="font-medium text-gray-800">{competencia}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vencimento:</span>
                    <span className="font-medium text-gray-800">{formatDate(vencimento)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🧮 Cálculo Didático */}
          {dados.irDevido > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Calculator className="h-4 w-4 text-amber-600" />
                </div>
                <h4 className="font-semibold text-amber-800 text-base">
                  Como chegamos neste valor
                </h4>
              </div>
              
              <div className="bg-white rounded-lg p-4 space-y-3 text-sm">
                {/* Passo 1: Ganhos do mês */}
                <div className="calculation-step">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">1. Ganhos do mês:</span>
                    <span className="font-medium text-green-600">
                      + {formatCurrency(dados.ganhoLiquidoMes)}
                    </span>
                  </div>
                </div>

                {/* Passo 2: Prejuízos compensados este mês (calculado pela diferença) */}
                {(() => {
                  // Se houve ganho mas o IR devido é menor que o esperado, houve compensação
                  const irEsperadoSemCompensacao = dados.ganhoLiquidoMes * dados.aliquota;
                  const compensacaoUsada = Math.max(0, irEsperadoSemCompensacao - dados.irDevido);
                  
                  if (compensacaoUsada > 0.01) { // Compensação significativa
                    return (
                      <div className="calculation-step">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">2. Prejuízos anteriores compensados:</span>
                          <span className="font-medium text-red-600">
                            - {formatCurrency(compensacaoUsada / dados.aliquota)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Passo 3: IR devido */}
                <div className="calculation-step">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">
                      {(() => {
                        const irEsperadoSemCompensacao = dados.ganhoLiquidoMes * dados.aliquota;
                        const compensacaoUsada = Math.max(0, irEsperadoSemCompensacao - dados.irDevido);
                        return compensacaoUsada > 0.01 ? '3' : '2';
                      })()} IR devido ({(dados.aliquota * 100)}%):
                    </span>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">
                        {(() => {
                          const irEsperadoSemCompensacao = dados.ganhoLiquidoMes * dados.aliquota;
                          const compensacaoUsada = Math.max(0, irEsperadoSemCompensacao - dados.irDevido);
                          const baseTributavel = dados.irDevido / dados.aliquota;
                          
                          if (compensacaoUsada > 0.01) {
                            return `${formatCurrency(baseTributavel)} × ${(dados.aliquota * 100)}%`;
                          } else {
                            return `${formatCurrency(dados.ganhoLiquidoMes)} × ${(dados.aliquota * 100)}%`;
                          }
                        })()}
                      </div>
                      <span className="text-orange-600 font-semibold">= {formatCurrency(dados.irDevido)}</span>
                    </div>
                  </div>
                </div>

                {/* IRRF informativo (apenas para transparência) */}
                {((tipoDarf === 'daytrade' && dados.irrfDay > 0) || (tipoDarf === 'swing' && dados.irrfSwing > 0)) && (
                  <div className="calculation-step">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative group cursor-help">
                          <Info className="h-4 w-4 text-gray-500" />
                          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 hidden group-hover:block z-20">
                            <div className="bg-gray-800 text-white text-sm rounded-lg p-4 shadow-lg w-80 max-w-md">
                              <div className="font-medium mb-2">
                                Imposto de Renda Retido na Fonte - IRRF
                              </div>
                              <div className="text-gray-300 mb-2">
                                {tipoDarf === 'daytrade' 
                                  ? '1% sobre os ganhos de day trade'
                                  : '0,005% sobre o valor total das vendas'
                                }
                              </div>
                              <div className="text-gray-300">
                                Valor já descontado pela sua Corretora
                              </div>
                              <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-800"></div>
                            </div>
                          </div>
                        </div>
                        <span className="text-gray-700">Imposto já descontado (IRRF):</span>
                      </div>
                      <span className="text-gray-600">
                        {formatCurrency(tipoDarf === 'daytrade' ? dados.irrfDay : dados.irrfSwing)}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Resultado Final */}
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center font-semibold bg-gray-50 -mx-4 px-4 py-3 rounded-b-lg">
                  <span className="text-gray-800">💰 Total a pagar no DARF:</span>
                  <span className={`text-xl font-bold ${dados.irAPagar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    = {formatCurrency(dados.irAPagar)}
                  </span>
                </div>
                
                {dados.irDevido > 0 && dados.irAPagar === 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-800 font-medium">
                        Valor menor que R$ 10,00 - dispensado de recolhimento
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 📚 Seção Educativa Avançada */}
          {dados.irAPagar > 0 && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Info className="h-4 w-4 text-indigo-600" />
                </div>
                <h4 className="font-semibold text-indigo-800 text-base">
                  Como funciona o IR sobre Investimentos
                </h4>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="font-medium text-indigo-700 mb-2">Day Trade vs Swing Trade</div>
                    <div className="space-y-1 text-gray-600">
                      <div>• Day Trade: {calculo.tipo === 'daytrade' ? '20%' : '20%'} sobre ganhos</div>
                      <div>• Swing Trade: {calculo.tipo === 'swing' ? '15%' : '15%'} sobre ganhos</div>
                      <div>• Vendas ≤ R$ 20k/mês: isentas (swing)</div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="font-medium text-indigo-700 mb-2">Compensação de Prejuízos</div>
                    <div className="space-y-1 text-gray-600">
                      <div>• Prejuízos anteriores reduzem IR</div>
                      <div>• Separados por tipo (DT/ST)</div>
                      <div>• Sem prazo de validade</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="font-medium text-indigo-700 mb-2">Quando Pagar</div>
                    <div className="space-y-1 text-gray-600">
                      <div>• Competência: {competencia}</div>
                      <div>• Vencimento: {formatDate(vencimento)}</div>
                      <div>• Mínimo: R$ 10,00</div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="font-medium text-indigo-700 mb-2">IRRF Deduzido</div>
                    <div className="space-y-1 text-gray-600">
                      <div>• Day Trade: 1% sobre ganhos</div>
                      <div>• Swing: 0,005% sobre vendas</div>
                      <div>• Reduz IR devido automaticamente</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 💡 Dicas Rápidas */}
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-amber-800">Dicas Importantes</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm text-amber-700">
              <div className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span><strong>Site oficial:</strong> gov.br/receitafederal</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                <span><strong>Código DARF:</strong> sempre 6015</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong>Vencimento:</strong> último dia útil do mês seguinte</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-500">•</span>
                <span><strong>Mínimo:</strong> só pagar se ≥ R$ 10,00</span>
              </div>
            </div>
          </div>

          {/* ⚠️ Avisos Legais */}
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <div className="h-6 w-6 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-sm text-red-700">
                <div className="font-semibold mb-2">Importante</div>
                <div className="space-y-1">
                  <div>• Este sistema é apenas informativo e educativo</div>
                  <div>• Consulte sempre um contador para orientações fiscais</div>
                  <div>• Mantenha comprovantes de todas as operações</div>
                  <div>• Atrasos no pagamento geram multa e juros</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center gap-3 p-4 border-t">
          {shouldShowMarkAsPendenteButton && (
            <Button
              onClick={async () => {
                console.log('Botão Marcar Pendente clicado!');
                setIsMarkingPendente(true);
                
                try {
                  // Atualizar estado local imediatamente
                  setLocalDarfStatus("pendente");
                  
                  // Persistir no backend
                  if (isFromResultadoMensal && competencia) {
                    const darfType = dados.tipo === 'daytrade' ? 'daytrade' : 'swing';
                    await api.put(`/impostos/darf_status/${competencia}/${darfType}`, { 
                      status: 'Pendente' 
                    });
                    
                    // Notificar componente pai
                    if (onDarfStatusChange) {
                      console.log('🔄 [MODAL] Notificando TaxResults:', { competencia, darfType, newStatus: 'pendente' });
                      onDarfStatusChange(competencia, darfType, 'pendente');
                    }
                  }
                  
                  toast({ title: "🔄 DARF marcado como pendente!" });
                } catch (error) {
                  console.error('Erro ao atualizar DARF:', error);
                  setLocalDarfStatus(null); // Reverter estado local
                  toast({ 
                    title: "❌ Erro ao atualizar DARF",
                    description: "Tente novamente",
                    variant: "destructive" 
                  });
                } finally {
                  setIsMarkingPendente(false);
                }
              }}
              disabled={isMarkingPendente}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isMarkingPendente ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent"></div>
                  <span>Atualizando...</span>
                </div>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Marcar como Pendente
                </>
              )}
            </Button>
          )}

          {shouldShowMarkAsPaidButton && (
            <Button
              onClick={async () => {
                console.log('Botão Pagar DARF clicado!');
                setIsMarkingPaid(true);
                
                try {
                  // Atualizar estado local imediatamente
                  setLocalDarfStatus("pago");
                  
                  // Persistir no backend
                  if (isFromResultadoMensal && competencia) {
                    const darfType = dados.tipo === 'daytrade' ? 'daytrade' : 'swing';
                    await api.put(`/impostos/darf_status/${competencia}/${darfType}`, { 
                      status: 'Pago' 
                    });
                    
                    // Notificar componente pai
                    if (onDarfStatusChange) {
                      console.log('🔄 [MODAL] Notificando TaxResults:', { competencia, darfType, newStatus: 'pago' });
                      onDarfStatusChange(competencia, darfType, 'pago');
                    }
                  }
                  
                  toast({ title: "✅ DARF marcado como pago!" });
                } catch (error) {
                  console.error('Erro ao atualizar DARF:', error);
                  setLocalDarfStatus(null); // Reverter estado local
                  toast({ 
                    title: "❌ Erro ao atualizar DARF",
                    description: "Tente novamente",
                    variant: "destructive" 
                  });
                } finally {
                  setIsMarkingPaid(false);
                }
              }}
              disabled={isMarkingPaid}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isMarkingPaid ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent"></div>
                  <span>Atualizando...</span>
                </div>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Pagar DARF
                </>
              )}
            </Button>
          )}

          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
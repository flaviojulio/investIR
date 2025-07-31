"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { HelpCircle, CheckCircle, Clock, CreditCard } from "lucide-react";

interface OperacaoFechada {
  id?: number;
  ticker: string;
  quantidade: number;
  resultado: number;
  data_fechamento: string;
  day_trade?: boolean;
  mes_operacao?: string;
  status_ir?: string;
  // Dados otimizados (se disponíveis)
  estatisticas_mes?: {
    prejuizo_acumulado_swing: number;
    prejuizo_acumulado_day: number;
    ir_devido_swing: number;
    ir_devido_day: number;
  };
  detalhes_compensacao?: {
    valor_compensado: number;
    lucro_tributavel: number;
    tem_compensacao: boolean;
    eh_compensacao_parcial: boolean;
  };
  prejuizo_acumulado_ate?: number;
}

interface DarfComprehensiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  operacoesFechadas: OperacaoFechada[];
  mes: string;
  tipo: "swing" | "daytrade";
  onStatusUpdate?: (mes: string, tipo: "swing" | "daytrade", novoStatus: string) => void;
}

export function DarfComprehensiveModal({
  isOpen,
  onClose,
  operacoesFechadas,
  mes,
  tipo,
  onStatusUpdate
}: DarfComprehensiveModalProps) {
  if (!isOpen) return null;

  // Estado local para status do DARF e dados de IRRF
  const [darfStatus, setDarfStatus] = useState<string>("Pendente");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [irrfSwing, setIrrfSwing] = useState<number>(0);
  const [irrfDay, setIrrfDay] = useState<number>(0);

  // Função para alterar status do DARF
  const alterarStatusDarf = async (novoStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const tipoEndpoint = tipo === "swing" ? "swing" : "daytrade";
      await api.put(`/impostos/darf_status/${mes}/${tipoEndpoint}`, {
        status: novoStatus
      });
      
      setDarfStatus(novoStatus);
      
      // Notificar a tabela de operações encerradas sobre a mudança
      if (onStatusUpdate) {
        onStatusUpdate(mes, tipo, novoStatus);
      }
    } catch (error) {
      console.error("Erro ao alterar status do DARF:", error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Filtrar operações do mês e tipo específicos
  const operacoesMes = operacoesFechadas.filter(op => {
    const opMes = op.mes_operacao || op.data_fechamento.substring(0, 7);
    const isDayTrade = op.day_trade || false;
    const tipoOperacao = isDayTrade ? "daytrade" : "swing";
    
    return opMes === mes && tipoOperacao === tipo;
  });

  // Verificar se temos dados otimizados disponíveis
  const temDadosOtimizados = operacoesMes.length > 0 && operacoesMes[0].estatisticas_mes !== undefined;
  
  console.log(`🔍 [DARF Modal] ${mes}-${tipo}:`, { 
    temDadosOtimizados, 
    operacoesMes: operacoesMes.length,
    primeiraOp: operacoesMes[0]?.estatisticas_mes,
    dadosCompletos: operacoesMes[0]
  });

  // Calcular prejuízo disponível (considerando compensações já utilizadas)
  const calcularPrejuizoDisponivel = (): number => {
    // Calcular total de prejuízos acumulados até o mês
    const operacoesAteOMes = operacoesFechadas.filter(op => {
      const opMes = op.mes_operacao || op.data_fechamento.substring(0, 7);
      const isDayTrade = op.day_trade || false;
      const tipoOperacao = isDayTrade ? "daytrade" : "swing";
      
      return tipoOperacao === tipo && opMes <= mes;
    });

    const prejuizosTotal = operacoesAteOMes
      .filter(op => op.resultado < 0)
      .reduce((acc, op) => acc + Math.abs(op.resultado), 0);
    
    // Calcular compensações já utilizadas por operações anteriores ao mês atual
    const operacoesLucroAnteriores = operacoesAteOMes
      .filter(op => {
        const opMes = op.mes_operacao || op.data_fechamento.substring(0, 7);
        return op.resultado > 0 && opMes < mes;
      })
      .sort((a, b) => a.data_fechamento.localeCompare(b.data_fechamento));

    let compensacoesUsadas = 0;
    let prejuizoRestante = prejuizosTotal;
    
    for (const opLucro of operacoesLucroAnteriores) {
      if (prejuizoRestante <= 0) break;
      
      const valorCompensado = Math.min(opLucro.resultado, prejuizoRestante);
      compensacoesUsadas += valorCompensado;
      prejuizoRestante -= valorCompensado;
    }
    
    return Math.max(0, prejuizosTotal - compensacoesUsadas);
  };

  // Calcular detalhes da compensação para o mês atual
  const calcularDetalhesCompensacao = () => {
    const operacoesAteOMes = operacoesFechadas.filter(op => {
      const opMes = op.mes_operacao || op.data_fechamento.substring(0, 7);
      const isDayTrade = op.day_trade || false;
      const tipoOperacao = isDayTrade ? "daytrade" : "swing";
      return tipoOperacao === tipo && opMes <= mes;
    });

    // Prejuízos acumulados até este mês
    const prejuizosAcumulados = operacoesAteOMes
      .filter(op => op.resultado < 0)
      .map(op => ({
        ...op,
        prejuizo: Math.abs(op.resultado),
        mes: op.mes_operacao || op.data_fechamento.substring(0, 7)
      }))
      .sort((a, b) => a.data_fechamento.localeCompare(b.data_fechamento));

    // Operações de lucro anteriores ao mês atual
    const operacoesLucroAnteriores = operacoesAteOMes
      .filter(op => {
        const opMes = op.mes_operacao || op.data_fechamento.substring(0, 7);
        return op.resultado > 0 && opMes < mes;
      })
      .sort((a, b) => a.data_fechamento.localeCompare(b.data_fechamento));

    // Simular compensações já utilizadas
    let prejuizoRestante = prejuizosAcumulados.reduce((acc, op) => acc + op.prejuizo, 0);
    let compensacoesJaUsadas = 0;
    
    for (const opLucro of operacoesLucroAnteriores) {
      if (prejuizoRestante <= 0) break;
      const valorCompensado = Math.min(opLucro.resultado, prejuizoRestante);
      compensacoesJaUsadas += valorCompensado;
      prejuizoRestante -= valorCompensado;
    }

    // Compensação no mês atual
    const prejuizoDisponivelParaEsteMs = Math.max(0, prejuizoRestante);
    const compensacaoNesteMs = Math.min(lucroLiquidoDoMes, prejuizoDisponivelParaEsteMs);

    return {
      prejuizosAcumulados,
      compensacoesJaUsadas,
      prejuizoDisponivelParaEsteMs,
      compensacaoNesteMs,
      prejuizoRestanteAposEsteMs: Math.max(0, prejuizoDisponivelParaEsteMs - compensacaoNesteMs)
    };
  };

  // Cálculos corrigidos - usar dados otimizados quando disponíveis
  const operacoesLucro = operacoesMes.filter(op => op.resultado > 0);
  const operacoesPrejuizo = operacoesMes.filter(op => op.resultado < 0);
  
  const lucrosBrutos = operacoesLucro.reduce((acc, op) => acc + op.resultado, 0);
  const prejuizosDoMes = Math.abs(operacoesPrejuizo.reduce((acc, op) => acc + op.resultado, 0));
  const lucroLiquidoDoMes = lucrosBrutos - prejuizosDoMes; // Lucro líquido real do mês
  
  // USAR DADOS OTIMIZADOS quando disponíveis
  let impostoDevido: number;
  let resultadoTributavel: number;
  let prejuizoDisponivel: number;
  let detalhesCompensacao: any;
  
  // Definir aliquota para ambos os cenários
  const aliquota = tipo === "daytrade" ? 0.20 : 0.15;
  
  if (temDadosOtimizados && operacoesMes[0]?.estatisticas_mes) {
    // 🎯 Usar valores pré-calculados corretos da API otimizada (backend corrigido)
    const stats = operacoesMes[0].estatisticas_mes;
    impostoDevido = tipo === "swing" ? stats.ir_devido_swing : stats.ir_devido_day;
    
    // 🔧 CORREÇÃO: Calcular prejuízo disponível ANTES da compensação
    // O prejuizo_acumulado da API é APÓS compensação, precisamos do valor ANTES
    resultadoTributavel = impostoDevido / aliquota;  // Valor que foi efetivamente tributado
    prejuizoDisponivel = Math.max(0, lucroLiquidoDoMes - resultadoTributavel);  // Prejuízo que foi compensado
    
    // Usar detalhes de compensação corretos da API
    const compensacaoOp = operacoesMes[0]?.detalhes_compensacao;
    if (compensacaoOp) {
      detalhesCompensacao = {
        prejuizosAcumulados: [],
        compensacoesJaUsadas: 0,
        prejuizoDisponivelParaEsteMs: prejuizoDisponivel,
        compensacaoNesteMs: compensacaoOp.valor_compensado || Math.min(lucroLiquidoDoMes, prejuizoDisponivel),
        prejuizoRestanteAposEsteMs: Math.max(0, prejuizoDisponivel - (compensacaoOp.valor_compensado || Math.min(lucroLiquidoDoMes, prejuizoDisponivel)))
      };
    } else {
      detalhesCompensacao = calcularDetalhesCompensacao();
    }
    
    console.log(`🎯 [DARF Modal] Cálculo corrigido - ${tipo}:`, { 
      lucroLiquidoDoMes,
      resultadoTributavel,
      prejuizoDisponivel: `${lucroLiquidoDoMes.toFixed(2)} - ${resultadoTributavel.toFixed(2)} = ${prejuizoDisponivel.toFixed(2)}`,
      impostoDevido,
      aliquota: `${(aliquota * 100)}%`,
      prejuizoBackendAposCompensacao: tipo === "swing" ? stats.prejuizo_acumulado_swing : stats.prejuizo_acumulado_day
    });
  } else {
    // Fallback para cálculos locais
    prejuizoDisponivel = calcularPrejuizoDisponivel();
    detalhesCompensacao = calcularDetalhesCompensacao();
    resultadoTributavel = Math.max(0, lucroLiquidoDoMes - prejuizoDisponivel);
    impostoDevido = resultadoTributavel * aliquota;
    
    console.log(`⚠️ [DARF Modal] Usando cálculos locais - ${tipo}:`, { 
      impostoDevido, 
      prejuizoDisponivel, 
      resultadoTributavel 
    });
  }
  
  // IRRF aplicável (será deduzido do imposto devido)
  const irrfAplicavel = tipo === "swing" ? irrfSwing : irrfDay;
  const impostoLiquido = Math.max(0, impostoDevido - irrfAplicavel);
  const impostoAPagar = impostoLiquido >= 10 ? impostoLiquido : 0;

  // Buscar status inicial do DARF quando o modal abre
  useEffect(() => {
    if (isOpen && impostoLiquido > 0) {
      const buscarStatusInicial = async () => {
        try {
          console.log(`[DARF Modal] Buscando status para mês ${mes}, tipo ${tipo}`);
          const response = await api.get(`/resultados?mes=${mes}`);
          const resultados = response.data;
          
          console.log(`[DARF Modal] Resposta da API:`, resultados);
          
          if (resultados && resultados.length > 0) {
            const resultado = resultados[0]; // Primeiro resultado do mês
            
            const statusCampo = tipo === "swing" 
              ? resultado.status_darf_swing_trade 
              : resultado.status_darf_day_trade;
            
            console.log(`[DARF Modal] Status encontrado para ${tipo}:`, statusCampo);
            setDarfStatus(statusCampo || "Pendente");
            
            // Buscar dados de IRRF
            const irrfSwingValue = resultado.irrf_swing || 0;
            const irrfDayValue = resultado.irrf_day || 0;
            
            console.log(`[DARF Modal] IRRF encontrados - Swing: ${irrfSwingValue}, Day: ${irrfDayValue}`);
            setIrrfSwing(irrfSwingValue);
            setIrrfDay(irrfDayValue);
          } else {
            console.log(`[DARF Modal] Nenhum resultado encontrado, usando Pendente`);
            setDarfStatus("Pendente");
          }
        } catch (error) {
          console.error("Erro ao buscar status inicial do DARF:", error);
          setDarfStatus("Pendente");
        }
      };
      
      buscarStatusInicial();
    }
  }, [isOpen, mes, tipo, impostoLiquido]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatMonthYear = (monthString: string): string => {
    const [year, month] = monthString.split('-');
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Calcular vencimento DARF (último dia útil do mês seguinte)
  const calcularVencimentoDarf = (): string => {
    const [ano, mesNum] = mes.split('-').map(Number);
    
    // Próximo mês
    let proxMes = mesNum + 1;
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
    
    return vencimento.toISOString().split('T')[0];
  };

  const tipoLabel = tipo === "daytrade" ? "Day Trade" : "Swing Trade";
  const darfCodigo = "6015"; // Código fixo para IR sobre ganho de capital
  const darfCompetencia = mes.split('-').reverse().join('/'); // Converter AAAA-MM para MM/AAAA
  const darfVencimento = calcularVencimentoDarf();

  // Função para obter estilo do badge do status
  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "Pago":
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          border: "border-green-300",
          icon: "✓"
        };
      case "Pendente":
      default:
        return {
          bg: "bg-yellow-100", 
          text: "text-yellow-800",
          border: "border-yellow-300",
          icon: "⏳"
        };
    }
  };

  const statusStyle = getStatusBadgeStyle(darfStatus);

  // Componente de tooltip explicativo
  const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    
    return (
      <div className="relative inline-flex items-center">
        {children}
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <HelpCircle size={16} />
        </button>
        {showTooltip && (
          <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg whitespace-nowrap">
            {text}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header Minimalista */}
        <div className="p-6 border-b border-gray-100 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-800 mb-1">
              Impostos de {formatMonthYear(mes)}
            </h1>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                tipo === "daytrade" 
                  ? "border-orange-300 bg-orange-50 text-orange-700" 
                  : "border-blue-300 bg-blue-50 text-blue-700"
              }`}>
                {tipo === "daytrade" ? "Day Trade" : "Swing Trade"}
              </span>
              <span>{operacoesMes.length} operações</span>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-6 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 12rem)' }}>
          
          {/* Valor Principal */}
          <div className="text-center py-2 px-4 bg-gray-50 rounded-xl shadow-sm space-y-2">
            {impostoAPagar > 0 ? (
              <>
                <div className="text-3xl font-bold text-blue-600">
                  {formatCurrency(impostoAPagar)}
                </div>
                <p className="text-sm text-gray-500">
                  Vencimento: {formatDate(darfVencimento)}
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-2">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="text-xl font-semibold text-green-600 mb-1">
                  Nada a pagar este mês
                </div>
                <p className="text-sm text-gray-600 max-w-xs mx-auto">
                  {impostoLiquido > 0 && impostoLiquido < 10 
                    ? "O valor é menor que R$10, então não precisa pagar."
                    : "Seus resultados não geraram imposto devido."}
                </p>
              </>
            )}
          </div>

          {/* Cálculo Didático - Visível apenas se houver imposto */}
          {impostoDevido > 0 && (
            <div className="space-y-4">
              <div className="text-center text-sm font-medium text-gray-700">
                Como chegamos neste valor
              </div>
              <div className="bg-gray-50 rounded-xl shadow-sm space-y-2 p-4">
                <div className="flex justify-between items-center">
                  <Tooltip text="Seu lucro líquido após descontar prejuízos do mês">
                    <span className="text-gray-600">Ganhos do mês:</span>
                  </Tooltip>
                  <span className="font-medium text-green-600">{formatCurrency(lucroLiquidoDoMes)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <Tooltip text="Prejuízos de meses anteriores disponíveis para abater">
                    <span className="text-gray-600">Prejuízo disponível:</span>
                  </Tooltip>
                  <span className="font-medium text-red-600">-{formatCurrency(prejuizoDisponivel)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between items-center font-medium">
                  <span className="text-gray-700">Valor tributável:</span>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {formatCurrency(lucroLiquidoDoMes)} - {formatCurrency(prejuizoDisponivel)}
                    </div>
                    <span className="text-blue-600">= {formatCurrency(resultadoTributavel)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <Tooltip text={`Alíquota de ${(aliquota * 100)}% sobre o valor tributável`}>
                    <span className="text-gray-600">IR devido ({(aliquota * 100)}%):</span>
                  </Tooltip>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {formatCurrency(resultadoTributavel)} × {(aliquota * 100)}%
                    </div>
                    <span className="text-orange-600">= {formatCurrency(impostoDevido)}</span>
                  </div>
                </div>
                {irrfAplicavel > 0 && (
                  <div className="flex justify-between items-center">
                    <Tooltip text="Valor já retido pela corretora">
                      <span className="text-gray-600">Já pago (IRRF):</span>
                    </Tooltip>
                    <span className="font-medium text-purple-600">-{formatCurrency(irrfAplicavel)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between items-center font-semibold">
                  <span className="text-gray-800">Total a pagar:</span>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {formatCurrency(impostoDevido)} - {formatCurrency(irrfAplicavel)}
                    </div>
                    <span className="text-green-600">= {formatCurrency(impostoLiquido)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Como Pagar - Simplificado */}
          {impostoAPagar > 0 && (
            <div className="space-y-4">
              <div className="text-center text-sm font-medium text-gray-700 flex items-center justify-center gap-2">
                
                <div className={`px-2 py-1 rounded-full text-xl font-medium flex items-center gap-1 ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                  {darfStatus === "Pago" ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {darfStatus}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 block">Site:</span>
                  <span className="font-medium">receita.fazenda.gov.br</span>
                </div>
                <div>
                  <span className="text-gray-600 block">Código:</span>
                  <span className="font-medium">{darfCodigo}</span>
                </div>
                <div>
                  <span className="text-gray-600 block">Competência:</span>
                  <span className="font-medium">{darfCompetencia}</span>
                </div>
                <div>
                  <span className="text-gray-600 block">Vencimento:</span>
                  <span className="font-medium">{formatDate(darfVencimento)}</span>
                </div>
              </div>
              <div className="flex justify-center gap-3">
                {darfStatus !== "Pago" && (
                  <button
                    onClick={() => alterarStatusDarf("Pago")}
                    disabled={isUpdatingStatus}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {isUpdatingStatus ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Marcar como Pago
                      </>
                    )}
                  </button>
                )}
                {darfStatus !== "Pendente" && (
                  <button
                    onClick={() => alterarStatusDarf("Pendente")}
                    disabled={isUpdatingStatus}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {isUpdatingStatus ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4" />
                        Marcar como Pendente
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

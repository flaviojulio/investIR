"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { HelpCircle, CheckCircle, Clock, CreditCard, TrendingUp, AlertCircle } from "lucide-react";

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

  const formatIRRF = (value: number, decimals: number = 3): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header Minimalista */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 text-center relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <CreditCard className="w-8 h-8 text-blue-600" />
          </div>
          
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">
            Seus Impostos de {formatMonthYear(mes)}
          </h1>
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              tipo === "daytrade" 
                ? "border-orange-300 bg-orange-100 text-orange-700" 
                : "border-blue-300 bg-blue-100 text-blue-700"
            }`}>
              {tipo === "daytrade" ? "DT" : "ST"}
            </span>
            <span>{operacoesMes.length} operações realizadas</span>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-8 space-y-8 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 12rem)' }}>
          
          {/* Card Principal: Valor a Pagar */}
          <div className="text-center">
            {impostoAPagar > 0 ? (
              <>
                <div className="inline-flex items-center gap-2 text-lg text-gray-600 mb-2">
                  <CreditCard className="w-5 h-5" />
                  <span>Valor a pagar este mês</span>
                </div>
                <div className="text-4xl font-bold text-blue-600 mb-4">
                  {formatCurrency(impostoAPagar)}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>Vencimento: {formatDate(darfVencimento)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-600 mb-2">
                  Nada a pagar!
                </div>
                <p className="text-gray-600 max-w-md mx-auto">
                  {impostoLiquido > 0 && impostoLiquido < 10 
                    ? "O valor calculado é inferior a R$ 10,00, por isso não há obrigatoriedade de pagamento."
                    : "Seus prejuízos anteriores cobriram os impostos deste mês ou você não teve lucros tributáveis."
                  }
                </p>
              </>
            )}
          </div>

          {/* Como Chegamos Neste Valor - Seção Opcional */}
          {impostoAPagar > 0 && (
            <details className="group">
              <summary className="flex items-center gap-2 text-gray-600 hover:text-gray-800 cursor-pointer transition-colors">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Como calculamos este valor?</span>
                <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              
              <div className="mt-4 space-y-4 pl-6 border-l-2 border-gray-100">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Seus ganhos do mês:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(lucroLiquidoDoMes)}</span>
                  </div>
                  
                  {prejuizoDisponivel > 0 && (
                    <div className="flex justify-between items-center mb-2">
                      <Tooltip text="Prejuízos de meses anteriores que podem ser descontados">
                        <span className="text-gray-600">Prejuízos descontados:</span>
                      </Tooltip>
                      <span className="font-semibold text-red-600">-{formatCurrency(detalhesCompensacao.compensacaoNesteMs)}</span>
                    </div>
                  )}
                  
                  {/* Detalhes da Compensação */}
                  {prejuizoDisponivel > 0 && (
                    <details className="group mt-3">
                      <summary className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer transition-colors">
                        <span>Ver cálculo detalhado da compensação</span>
                        <svg className="w-3 h-3 transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs space-y-2">
                        <div className="font-semibold text-gray-700 mb-2">Como calculamos seus prejuízos:</div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total de prejuízos acumulados:</span>
                            <span className="font-medium text-red-600">
                              {formatCurrency(detalhesCompensacao.prejuizosAcumulados.reduce((acc, op) => acc + op.prejuizo, 0))}
                            </span>
                          </div>
                          
                          {detalhesCompensacao.compensacoesJaUsadas > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">(-) Já utilizados em meses anteriores:</span>
                              <span className="font-medium text-purple-600">
                                -{formatCurrency(detalhesCompensacao.compensacoesJaUsadas)}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex justify-between border-t border-gray-200 pt-1">
                            <span className="font-medium text-gray-700">Disponível para este mês:</span>
                            <span className="font-semibold text-blue-600">
                              {formatCurrency(detalhesCompensacao.prejuizoDisponivelParaEsteMs)}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-gray-600">Utilizado neste mês:</span>
                            <span className="font-medium text-green-600">
                              -{formatCurrency(detalhesCompensacao.compensacaoNesteMs)}
                            </span>
                          </div>
                          
                          {detalhesCompensacao.prejuizoRestanteAposEsteMs > 0 && (
                            <div className="flex justify-between border-t border-gray-200 pt-1">
                              <span className="font-medium text-gray-700">Sobra para próximos meses:</span>
                              <span className="font-semibold text-blue-600">
                                {formatCurrency(detalhesCompensacao.prejuizoRestanteAposEsteMs)}
                              </span>
                            </div>
                          )}
                          
                          {/* Indicador de compensação parcial */}
                          {detalhesCompensacao.compensacaoNesteMs > 0 && resultadoTributavel > 0 && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                              <div className="flex items-start gap-1">
                                <AlertCircle className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                                <div className="text-yellow-800">
                                  <strong>Compensação Parcial:</strong> Seus prejuízos disponíveis ({formatCurrency(detalhesCompensacao.prejuizoDisponivelParaEsteMs)}) 
                                  foram suficientes para compensar apenas parte dos seus ganhos. 
                                  O restante ({formatCurrency(resultadoTributavel)}) será tributado.
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Indicador de compensação total */}
                          {detalhesCompensacao.compensacaoNesteMs > 0 && resultadoTributavel === 0 && (
                            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                              <div className="flex items-start gap-1">
                                <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                                <div className="text-green-800">
                                  <strong>Compensação Total:</strong> Seus prejuízos disponíveis foram suficientes 
                                  para compensar todos os ganhos deste mês. Não há imposto a pagar.
                                </div>
                              </div>
                            </div>
                          )}
                          
                        </div>
                      </div>
                    </details>
                  )}
                  
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-800">Valor tributável:</span>
                      <span className="font-bold text-blue-600">{formatCurrency(resultadoTributavel)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Como chegamos ao valor do imposto
                  </h4>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-700">Ganhos brutos do mês:</span>
                      <span className="font-medium text-green-600">+ {formatCurrency(lucroLiquidoDoMes)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2">
                      <Tooltip text="Prejuízos de meses anteriores que podem ser descontados dos ganhos">
                        <span className="text-gray-700">Prejuízos anteriores disponíveis:</span>
                      </Tooltip>
                      <span className="font-medium text-red-600">- {formatCurrency(prejuizoDisponivel)}</span>
                    </div>
                    
                    <div className="border-t border-blue-200 pt-2">
                      <div className="flex justify-between items-center py-2 bg-white rounded-lg px-3">
                        <span className="font-semibold text-gray-800">Valor tributável:</span>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">
                            {formatCurrency(lucroLiquidoDoMes)} - {formatCurrency(prejuizoDisponivel)}
                          </div>
                          <div className="font-bold text-blue-600">= {formatCurrency(resultadoTributavel)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center py-2">
                      <Tooltip text={`Alíquota de ${(aliquota * 100)}% aplicada sobre ${tipoLabel.toLowerCase()}`}>
                        <span className="text-gray-700">Imposto devido ({(aliquota * 100)}%):</span>
                      </Tooltip>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {formatCurrency(resultadoTributavel)} × {(aliquota * 100)}%
                        </div>
                        <div className="font-semibold text-orange-600">= {formatCurrency(impostoDevido)}</div>
                      </div>
                    </div>
                    
                    {irrfAplicavel > 0 && (
                      <div className="flex justify-between items-center py-2">
                        <Tooltip text="Valor já retido pela sua corretora que será descontado">
                          <span className="text-gray-700">Já pago pela corretora (IRRF):</span>
                        </Tooltip>
                        <span className="font-medium text-purple-600">- {formatCurrency(irrfAplicavel)}</span>
                      </div>
                    )}
                    
                    <div className="border-t border-blue-200 pt-2">
                      <div className="flex justify-between items-center py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg px-3 border border-green-200">
                        <span className="font-bold text-gray-800">Valor final a pagar:</span>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">
                            {formatCurrency(impostoDevido)} - {formatCurrency(irrfAplicavel)}
                          </div>
                          <div className="font-bold text-green-600 text-lg">= {formatCurrency(impostoLiquido)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          )}

          {/* Instruções de Pagamento */}
          {impostoAPagar > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                    <CreditCard className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800">Como pagar</h3>
                    <p className="text-sm text-green-600">Guia rápido para não errar</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} text-sm font-medium flex items-center gap-1`}>
                  {statusStyle.icon === "✓" ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {darfStatus}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white bg-opacity-70 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Onde pagar</div>
                  <div className="font-medium text-gray-800">Site da Receita Federal</div>
                  <div className="text-xs text-gray-500">receita.fazenda.gov.br</div>
                </div>
                <div className="bg-white bg-opacity-70 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Código para usar</div>
                  <div className="font-bold text-gray-800 text-lg">{darfCodigo}</div>
                  <div className="text-xs text-gray-500">Ganho de capital</div>
                </div>
                <div className="bg-white bg-opacity-70 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Mês/Ano (Competência)</div>
                  <div className="font-medium text-gray-800">{darfCompetencia}</div>
                </div>
                <div className="bg-white bg-opacity-70 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Prazo final</div>
                  <div className="font-medium text-gray-800">{formatDate(darfVencimento)}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(darfVencimento) < new Date() ? "⚠️ Vencido" : "✅ Em dia"}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <strong>Dica importante:</strong> O DARF pode ser pago em qualquer banco ou via PIX. 
                    Se pagar após o vencimento, será calculada multa e juros automaticamente.
                  </div>
                </div>
              </div>

              {/* Botões de Alteração de Status */}
              <div className="flex justify-center gap-3 mt-4">
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

          {/* Detalhes das Operações - Seção Opcional */}
          <details className="group">
            <summary className="flex items-center gap-2 text-gray-600 hover:text-gray-800 cursor-pointer transition-colors">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Ver suas {operacoesMes.length} operações deste mês</span>
              </div>
              <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pl-6 border-l-2 border-gray-100">
              {operacoesMes.map((operacao, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${operacao.resultado >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                      <span className="font-medium text-gray-800">{operacao.ticker}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {operacao.quantidade.toLocaleString()} ações
                      </span>
                    </div>
                  </div>
                  <span
                    className={`font-semibold ${
                      operacao.resultado >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {operacao.resultado >= 0 ? '+' : ''}{formatCurrency(operacao.resultado)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* Footer Simplificado */}
        <div className="bg-white px-8 py-6 border-t border-gray-100">
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-8 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-all hover:scale-105"
            >
              {impostoAPagar === 0 ? "Entendi" : "Fechar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

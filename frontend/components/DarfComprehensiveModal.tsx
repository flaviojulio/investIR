"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface OperacaoFechada {
  id?: number;
  ticker: string;
  quantidade: number;
  resultado: number;
  data_fechamento: string;
  day_trade?: boolean;
  mes_operacao?: string;
  status_ir?: string;
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

  // Cálculos corrigidos
  const operacoesLucro = operacoesMes.filter(op => op.resultado > 0);
  const operacoesPrejuizo = operacoesMes.filter(op => op.resultado < 0);
  
  const lucrosBrutos = operacoesLucro.reduce((acc, op) => acc + op.resultado, 0);
  const prejuizosDoMes = Math.abs(operacoesPrejuizo.reduce((acc, op) => acc + op.resultado, 0));
  const lucroLiquidoDoMes = lucrosBrutos - prejuizosDoMes; // Lucro líquido real do mês
  const prejuizoDisponivel = calcularPrejuizoDisponivel();
  
  // Base de cálculo: Lucro líquido do mês - Prejuízo disponível (de meses anteriores)
  const resultadoTributavel = Math.max(0, lucroLiquidoDoMes - prejuizoDisponivel);
  const aliquota = tipo === "daytrade" ? 0.20 : 0.15;
  const impostoDevido = resultadoTributavel * aliquota;
  
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
  const darfCompetencia = mes.replace('-', ''); // Formato MMAAAA
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">DARF Detalhado - {tipoLabel}</h2>
              <p className="text-blue-100">
                Competência: {formatMonthYear(mes)} | {operacoesMes.length} operações
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-300 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 12rem)' }}>
          {/* Resumo dos Cálculos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600">📈</span>
                <span className="font-medium text-green-800">Lucro Líquido</span>
              </div>
              <div className="text-xl font-bold text-green-600">
                {formatCurrency(lucroLiquidoDoMes)}
              </div>
              <div className="text-sm text-green-600">
                {operacoesLucro.length} lucros - {operacoesPrejuizo.length} prejuízos
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-600">📉</span>
                <span className="font-medium text-red-800">Prejuízo Disponível</span>
              </div>
              <div className="text-xl font-bold text-red-600">
                {formatCurrency(prejuizoDisponivel)}
              </div>
              <div className="text-sm text-red-600">
                Até {formatMonthYear(mes)} ({tipoLabel})
              </div>
            </div>
          </div>

          {/* Cálculo do IR */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-600">📄</span>
              <span className="font-semibold text-blue-800">Cálculo do Imposto de Renda</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Lucro Líquido do Mês:</span>
                <span className="font-medium">{formatCurrency(lucroLiquidoDoMes)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">(-) Prejuízo Total Disponível:</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(prejuizoDisponivel)}
                </span>
              </div>
              
              <hr className="border-gray-300" />
              
              <div className="flex justify-between">
                <span className="font-semibold text-gray-800">Resultado Tributável:</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(resultadoTributavel)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Alíquota {tipoLabel}:</span>
                <span className="font-medium">{(aliquota * 100)}%</span>
              </div>
              
              <div className="flex justify-between">
                <span className="font-semibold text-gray-800">Imposto Bruto Devido:</span>
                <span className="font-medium text-orange-600">
                  {formatCurrency(impostoDevido)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">(-) IRRF Retido pela Corretora:</span>
                <span className="font-medium text-purple-600">
                  -{tipo === "swing" 
                    ? formatIRRF(irrfSwing, 3)
                    : formatIRRF(irrfDay, 2)
                  }
                </span>
              </div>
              
              <div className="text-xs text-gray-500 ml-4 -mt-2 mb-2">
                {tipo === "swing" 
                  ? "0,005% sobre o valor bruto de vendas (antecipação)"
                  : "1% sobre o resultado positivo (lucro líquido) apurado no dia"
                }
              </div>
              
              <hr className="border-gray-300" />
              
              <div className="flex justify-between text-lg">
                <span className="font-bold text-gray-800">Imposto Líquido:</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(impostoLiquido)}
                </span>
              </div>
              
              <div className="flex justify-between text-lg border-t border-gray-300 pt-2">
                <span className="font-bold text-gray-800">Valor Final a Pagar:</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(impostoAPagar)}
                </span>
              </div>
              
              {impostoLiquido > 0 && impostoLiquido < 10 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm">
                  <div className="text-yellow-800">
                    ⚠️ Imposto líquido inferior a R$ 10,00 - Não há obrigatoriedade de recolhimento
                  </div>
                </div>
              )}

              {prejuizoDisponivel > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm">
                  <div className="text-blue-800">
                    💡 <strong>Compensação de Prejuízos:</strong> Os prejuízos disponíveis de operações {tipoLabel.toLowerCase()} 
                    anteriores foram utilizados para reduzir a base de cálculo do IR deste mês.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informações do DARF */}
          {impostoAPagar > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">📋</span>
                  <span className="font-semibold text-green-800">Informações para DARF</span>
                </div>
                <div className={`px-3 py-1 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} text-sm font-medium`}>
                  {statusStyle.icon} {darfStatus}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Código DARF:</span>
                    <span className="font-medium text-gray-800">{darfCodigo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Competência:</span>
                    <span className="font-medium text-gray-800">{darfCompetencia}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vencimento:</span>
                    <span className="font-medium text-gray-800">{formatDate(darfVencimento)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-semibold">Valor a Pagar:</span>
                    <span className="font-bold text-green-600">{formatCurrency(impostoAPagar)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 bg-white border border-green-200 rounded p-3 text-sm">
                <div className="text-green-800">
                  <strong>💡 Como usar:</strong> Utilize o código <strong>{darfCodigo}</strong> no site da Receita Federal 
                  ou no aplicativo para gerar o DARF. A competência deve ser preenchida como <strong>{darfCompetencia}</strong> 
                  e o vencimento é <strong>{formatDate(darfVencimento)}</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Lista de Operações */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-3">
              Detalhes das {operacoesMes.length} Operações
            </h3>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {operacoesMes.map((operacao, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border text-sm ${
                    operacao.resultado >= 0
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{operacao.ticker}</span>
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                        {operacao.quantidade.toLocaleString()}
                      </span>
                    </div>
                    <span
                      className={`font-bold ${
                        operacao.resultado >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(operacao.resultado)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex gap-2 justify-between items-center">
            {/* Botões de alteração de status do DARF (se há imposto a pagar) */}
            {impostoAPagar > 0 && (
              <div className="flex gap-2">
                {darfStatus !== "Pago" && (
                  <button
                    onClick={() => alterarStatusDarf("Pago")}
                    disabled={isUpdatingStatus}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {isUpdatingStatus ? "Atualizando..." : "✓ Marcar como Pago"}
                  </button>
                )}
                {darfStatus !== "Pendente" && (
                  <button
                    onClick={() => alterarStatusDarf("Pendente")}
                    disabled={isUpdatingStatus}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {isUpdatingStatus ? "Atualizando..." : "⏳ Marcar como Pendente"}
                  </button>
                )}
              </div>
            )}
            
            {/* Botão Fechar */}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

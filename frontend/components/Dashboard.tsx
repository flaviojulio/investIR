"use client"

import React, { useState, useEffect, useMemo } from "react" // Added useMemo, React
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { api, getResumoProventosAnuaisUsuario, getResumoProventosMensaisUsuario, getProventosUsuarioDetalhado } from "@/lib/api" // Added specific api functions
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogOut, TrendingUp, PlusCircle, UploadCloud, DollarSign, Briefcase, Landmark, Trophy, History, FileText, ExternalLink, Eye, EyeOff } from "lucide-react" // Added Trophy, Eye, EyeOff
import { PortfolioOverview } from "@/components/PortfolioOverview"
import { StockTable } from "@/components/StockTable"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input"; // Added Input import
import { InfoCard } from "@/components/InfoCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TabelaProventos } from "@/components/TabelaProventos";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { TaxMeter } from "@/components/TaxMeter"
import { PortfolioEquityChart } from "@/components/PortfolioEquityChart"
import Last12MonthsEarningsChart from "@/components/Last12MonthsEarningsChart"; // Changed to default import
import { UploadOperations } from "@/components/UploadOperations"
import { AddOperation } from "@/components/AddOperation"
import { OperationsHistory } from "@/components/OperationsHistory"
import { TaxResults } from "@/components/TaxResults"
import OperacoesEncerradasTable from '@/components/OperacoesEncerradasTable';
import ExtratoTabContent from '@/components/ExtratoTabContent';
import { useToast } from "@/hooks/use-toast"
import { Tooltip as TooltipUI, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
// Removed DividendTimeline import
// import { DividendTimeline } from "@/components/DividendTimeline"
import Link from "next/link";
// Added ResumoProventoAnualAPI, ResumoProventoMensalAPI, AcaoDetalhadaResumoProventoAPI, ProventoRecebidoUsuario
import type { Operacao, CarteiraItem, ResultadoMensal, OperacaoFechada, ResumoProventoAnualAPI, ResumoProventoMensalAPI, AcaoDetalhadaResumoProventoAPI, ProventoRecebidoUsuario } from "@/lib/types"

interface DashboardData {
  carteira: CarteiraItem[]
  resultados: ResultadoMensal[]
  operacoes: Operacao[]
  operacoes_fechadas: OperacaoFechada[];
}

// Helper functions from ProventosPage
const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return "R$ 0,00";
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Function to format currency with visibility toggle
const formatCurrencyWithVisibility = (value: number | undefined | null, showValues: boolean): string => {
  if (!showValues) {
    return "R$ •••,••";
  }
  if (value === undefined || value === null) return "R$ 0,00";
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatYAxisTick = (tick: number): string => {
  if (tick >= 1000000) return `R$${(tick / 1000000).toFixed(0)}M`;
  if (tick >= 1000) return `R$${(tick / 1000).toFixed(0)}k`;
  return `R$${tick.toFixed(0)}`;
};

const formatMonthName = (monthStr: string): string => {
  const [_, monthNum] = monthStr.split('-');
  const date = new Date();
  date.setMonth(parseInt(monthNum) - 1);
  return date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
};

const BAR_COLORS = {
  Dividendos: "#2563eb", // azul
  JCP: "#22c55e",       // verde
  Outros: "#fbbf24",    // amarelo
};

const PIE_CHART_COLORS = [
  BAR_COLORS.Dividendos, // azul
  BAR_COLORS.JCP,        // verde
  BAR_COLORS.Outros,     // amarelo
  "#a21caf",            // extra: roxo
  "#0ea5e9",            // extra: ciano
  "#eab308",            // extra: dourado
  "#14b8a6",            // extra: teal
  "#f472b6",            // extra: rosa
  "#6366f1",            // extra: indigo
];

function ProventosTabContent({ showValues }: { showValues: boolean }) {
  const [anoSelecionado, setAnoSelecionado] = useState<number | undefined>();
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [resumoAnualData, setResumoAnualData] = useState<ResumoProventoAnualAPI[]>([]);
  const [loadingData, setLoadingData] = useState(true); // Cobre carregamento inicial de resumos e detalhados

  const [resumoMensal, setResumoMensal] = useState<ResumoProventoMensalAPI[]>([]);
  const [loadingGraficoMensal, setLoadingGraficoMensal] = useState(false);

  const [proventosDetalhados, setProventosDetalhados] = useState<ProventoRecebidoUsuario[]>([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingData(true);
      try {
        // Buscar todos os dados em paralelo
        const [anuaisData, detalhadosData] = await Promise.all([
          getResumoProventosAnuaisUsuario(),
          getProventosUsuarioDetalhado()
        ]);

        setResumoAnualData(anuaisData);
        setProventosDetalhados(detalhadosData.map(mapProventoRecebidoBackendToFrontend));

        if (anuaisData.length > 0) {
          const anos = anuaisData.map(item => item.ano).sort((a, b) => b - a);
          setAnosDisponiveis(anos);
          setAnoSelecionado(anos[0] || new Date().getFullYear());
        } else {
          const anoAtual = new Date().getFullYear();
          setAnosDisponiveis([anoAtual, anoAtual -1, anoAtual -2, anoAtual -3, anoAtual -4]);
          setAnoSelecionado(anoAtual);
        }
      } catch (error) {
        console.error("Erro ao buscar dados iniciais de proventos:", error);
        const anoAtual = new Date().getFullYear();
        setAnosDisponiveis([anoAtual, anoAtual -1, anoAtual -2, anoAtual -3, anoAtual -4]);
        setAnoSelecionado(anoAtual);
      } finally {
        setLoadingData(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (anoSelecionado === undefined) {
      setResumoMensal([]);
      return;
    }
    const fetchResumoMensal = async () => {
      setLoadingGraficoMensal(true);
      try {
        const data = await getResumoProventosMensaisUsuario(anoSelecionado);
        const dataOrdenada = data.sort((a,b) => a.mes.localeCompare(b.mes));
        setResumoMensal(dataOrdenada);
      } catch (error) {
        console.error(`Erro ao buscar resumo mensal para o ano ${anoSelecionado}:`, error);
        setResumoMensal([]);
      } finally {
        setLoadingGraficoMensal(false);
      }
    };
    fetchResumoMensal();
  }, [anoSelecionado]);

  const resumoDoAnoSelecionado = resumoAnualData.find(r => r.ano === anoSelecionado);
  const totalAnoSelecionado = resumoDoAnoSelecionado?.total_geral ?? 0;
  const dividendosAnoSelecionado = resumoDoAnoSelecionado?.total_dividendos ?? 0;
  const jcpAnoSelecionado = resumoDoAnoSelecionado?.total_jcp ?? 0;

  let acaoMaiorPagamentoAno: AcaoDetalhadaResumoProventoAPI | null = null;
  if (resumoDoAnoSelecionado && resumoDoAnoSelecionado.acoes_detalhadas.length > 0) {
    acaoMaiorPagamentoAno = resumoDoAnoSelecionado.acoes_detalhadas.reduce((max, acao) =>
      acao.total_recebido_na_acao > max.total_recebido_na_acao ? acao : max
    );
  }

  const dadosGraficoAnual = resumoAnualData
    .map(item => ({
      name: String(item.ano),
      Dividendos: item.total_dividendos,
      JCP: item.total_jcp,
      Outros: item.total_outros,
    }))
    .sort((a, b) => parseInt(a.name) - parseInt(b.name));

  const dadosGraficoMensal = resumoMensal.map(item => ({
    name: formatMonthName(item.mes),
    Dividendos: item.total_dividendos,
    JCP: item.total_jcp,
    Outros: item.total_outros,
  }));

  const dadosGraficoPizzaAcao = resumoDoAnoSelecionado?.acoes_detalhadas
    .filter(acao => acao.total_recebido_na_acao > 0)
    .map(acao => ({
      name: `${acao.ticker} (${acao.nome_acao || 'N/A'})`,
      value: acao.total_recebido_na_acao,
    }))
    .sort((a,b) => b.value - a.value) ?? [];

  const proventosFiltradosParaTabela = useMemo(() => {
    // If no year is selected, the original logic was to return proventosDetalhados.
    // This might mean anoSelecionado is always expected to be set.
    const filteredResult = (() => { // IIFE to contain existing logic
        if (!proventosDetalhados) return []; // Handle case where proventosDetalhados might not be loaded yet

        if (anoSelecionado === undefined) {
            return proventosDetalhados.filter(p => {
                let dateToConsider = null;
                if (p.dt_pagamento) {
                    dateToConsider = new Date(p.dt_pagamento + 'T00:00:00Z');
                    if (!isNaN(dateToConsider.getTime())) {
                        return true; // Valid payment date exists
                    }
                }
                // If no valid payment date, try data_ex
                if (p.data_ex) {
                    dateToConsider = new Date(p.data_ex + 'T00:00:00Z');
                    if (!isNaN(dateToConsider.getTime())) {
                        return true; // Valid ex-dividend date exists
                    }
                }
                return false; // Neither date is valid
            });
        }

        return proventosDetalhados.filter(p => {
            let dateToParse = p.dt_pagamento;
            let isPaymentDate = true;
            let dateFieldNameForLog = "dt_pagamento";

            if (!dateToParse) { // If dt_pagamento is null, undefined, or empty
                dateToParse = p.data_ex; // Fallback to data_ex
                isPaymentDate = false;
                dateFieldNameForLog = "data_ex";
            }

            if (!dateToParse) { // If both are null/undefined/empty
                return false;
            }

            const dateObj = new Date(dateToParse + 'T00:00:00Z');

            if (isNaN(dateObj.getTime())) {
                if (isPaymentDate) { // Original attempt was for dt_pagamento
                     console.warn(`Invalid date encountered for dt_pagamento: ${p.dt_pagamento} for provento ID: ${p.id}, attempting fallback to data_ex or excluding.`);
                     // Try data_ex if dt_pagamento was invalid
                     if (p.data_ex) {
                         const dataExObj = new Date(p.data_ex + 'T00:00:00Z');
                         if (!isNaN(dataExObj.getTime())) {
                             const anoDataEx = dataExObj.getFullYear();
                             return anoDataEx === anoSelecionado;
                         } else {
                             console.warn(`Invalid date also for data_ex: ${p.data_ex} for provento ID: ${p.id}. Excluding.`);
                             return false;
                         }
                     } else {
                         return false; // dt_pagamento invalid and no data_ex to fallback
                     }
                } else { // Original attempt was already for data_ex (because dt_pagamento was initially null/empty)
                     console.warn(`Invalid date encountered for data_ex: ${p.data_ex} for provento ID: ${p.id} (dt_pagamento was also missing/invalid). Excluding.`);
                     return false;
                }
            }

            const anoEvento = dateObj.getFullYear();
            return anoEvento === anoSelecionado;
        });
    })(); // End of IIFE

    if (!searchTerm) {
      return filteredResult;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const searchedResult = filteredResult.filter(p => {
      // Determina status
      let status = 'Recebido';
      const now = new Date();
      if (!p.dt_pagamento || new Date(p.dt_pagamento) > now) {
        status = 'A Receber';
      }
      const fieldsToSearch = [
        p.ticker_acao,
        p.tipo, // Corrigido para o campo correto
        p.dt_pagamento,
        p.data_ex,
        String(p.valor_unitario_provento),
        String(p.quantidade_na_data_ex),
        String(p.valor_total_recebido),
        p.nome_acao,
        status
      ];
      return fieldsToSearch.some(field =>
        field && field.toString().toLowerCase().includes(lowerSearchTerm)
      );
    });
    return searchedResult;

  }, [proventosDetalhados, anoSelecionado, searchTerm]);

  // Cálculo do total de proventos a receber no ano selecionado
  const totalAReceberAnoSelecionado = useMemo(() => {
    if (!proventosDetalhados || !anoSelecionado) return 0;
    const now = new Date();
    return proventosDetalhados.filter(p => {
      let dataPagamento = p.dt_pagamento ? new Date(p.dt_pagamento) : null;
      let anoEvento = dataPagamento && !isNaN(dataPagamento.getTime()) ? dataPagamento.getFullYear() : null;
      if (!dataPagamento || isNaN(dataPagamento.getTime())) {
        if (p.data_ex) {
          const dataEx = new Date(p.data_ex);
          if (!isNaN(dataEx.getTime())) {
            anoEvento = dataEx.getFullYear();
            dataPagamento = dataEx;
          }
        }
      }
      return anoEvento === anoSelecionado && dataPagamento && dataPagamento > now;
    }).reduce((sum, p) => sum + (p.valor_total_recebido || 0), 0);
  }, [proventosDetalhados, anoSelecionado]);

  return (
    <div>
      {/* Filtro de Ano Melhorado */}
      <div className="mb-8 p-6 bg-white rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300">
        <div className="flex items-center justify-center">
          <div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 flex-nowrap">
                <Label htmlFor="select-ano" className="text-sm font-medium text-gray-700 flex items-center gap-2 whitespace-nowrap">                    
                  <span>Ano:</span>
                </Label>
                <Select
                  value={anoSelecionado ? String(anoSelecionado) : ""}
                  onValueChange={(value) => setAnoSelecionado(value ? Number(value) : undefined)}
                  disabled={loadingData || anosDisponiveis.length === 0}
                >
                  <SelectTrigger id="select-ano" className="px-4 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all w-full min-w-[120px]">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map((ano) => (
                      <SelectItem key={ano} value={String(ano)}>
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Insights Rápidos */}
      <div className="mb-10 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-1 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
          <h2 className="text-xl font-bold text-purple-800 flex items-center gap-2">
            <span>💡</span>
            <span>Insights Rápidos</span>
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-lg border border-purple-200 shadow-sm">
            <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
              <span>📊</span>
              <span>Estatísticas do Período</span>
            </h4>
            <p className="text-sm text-gray-600">
              Você tem <strong className="text-purple-600">{proventosFiltradosParaTabela.length}</strong> proventos 
              registrados em <strong className="text-purple-600">{anoSelecionado || "N/A"}</strong>.
              {acaoMaiorPagamentoAno && (
                <> Sua maior fonte é <strong className="text-purple-600">{acaoMaiorPagamentoAno.ticker}</strong>.</>
              )}
            </p>
          </div>
          
          <div className="bg-white p-5 rounded-lg border border-purple-200 shadow-sm">
            <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
              <span>🎯</span>
              <span>Próximos Passos</span>
            </h4>
            <p className="text-sm text-gray-600">
              {totalAReceberAnoSelecionado > 0 ? (
                <>Você tem <strong className="text-green-600">{formatCurrencyWithVisibility(totalAReceberAnoSelecionado, showValues)}</strong> para receber ainda este ano! 🚀</>
              ) : (
                "Continue acompanhando seus investimentos para maximizar os proventos. 📈"
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-1 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
          <h2 className="text-2xl font-bold text-gray-800">
            Resumo de {anoSelecionado || "N/A"}
          </h2>
        </div>
        {loadingData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse bg-white rounded-xl shadow-lg border p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                  </div>
                  <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : resumoDoAnoSelecionado ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card Total Melhorado */}
            <TooltipProvider>
              <TooltipUI>
                <TooltipTrigger asChild>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-600 mb-1">Total Recebido ({anoSelecionado})</p>
                          <p className="text-3xl font-bold text-blue-900">{formatCurrencyWithVisibility(totalAnoSelecionado, showValues)}</p>
                          <p className="text-xs text-blue-700 mt-2 flex items-center gap-1">
                            <span>💰</span>
                            <span>Proventos do ano</span>
                          </p>
                        </div>
                        <div className="h-14 w-14 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white text-2xl">💸</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-sm">
                  <div className="mb-1 font-semibold">Detalhamento:</div>
                  <div>Dividendos: <span className="font-bold text-blue-700">{formatCurrencyWithVisibility(dividendosAnoSelecionado, showValues)}</span></div>
                  <div>JCP: <span className="font-bold text-green-700">{formatCurrencyWithVisibility(jcpAnoSelecionado, showValues)}</span></div>
                </TooltipContent>
              </TooltipUI>
            </TooltipProvider>

            {/* Card A Receber Melhorado */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 mb-1">A Receber ({anoSelecionado})</p>
                    <p className="text-3xl font-bold text-green-900">{formatCurrencyWithVisibility(totalAReceberAnoSelecionado, showValues)}</p>
                    <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                      <span>📅</span>
                      <span>Próximos pagamentos</span>
                    </p>
                  </div>
                  <div className="h-14 w-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white text-2xl">🏦</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Top Ação Melhorado */}
            {acaoMaiorPagamentoAno ? (
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-600 mb-1">Top Ação ({anoSelecionado})</p>
                      <p className="text-2xl font-bold text-yellow-900">{acaoMaiorPagamentoAno.ticker}</p>
                      <p className="text-xs text-yellow-700 mt-1">{formatCurrencyWithVisibility(acaoMaiorPagamentoAno.total_recebido_na_acao, showValues)}</p>
                    </div>
                    <div className="h-14 w-14 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                      <span className="text-white text-2xl">🏆</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl shadow-lg">
                <div className="p-6">
                  <div className="text-center text-gray-500">
                    <div className="h-14 w-14 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-gray-500 text-2xl">📊</span>
                    </div>
                    <p className="text-sm">Sem dados para {anoSelecionado}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Card Distribuição Melhorado */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600 mb-1">Distribuição</p>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-purple-900">
                        {formatCurrencyWithVisibility(dividendosAnoSelecionado, showValues)}
                      </p>
                      <p className="text-xs text-purple-700">Dividendos</p>
                      <p className="text-sm font-semibold text-purple-800">
                        {formatCurrencyWithVisibility(jcpAnoSelecionado, showValues)} JCP
                      </p>
                    </div>
                  </div>
                  <div className="h-14 w-14 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white text-2xl">📈</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">Não há dados de proventos para o ano selecionado ({anoSelecionado || "N/A"}).</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Recebimento Anual (Todos os Anos)</h2>
          {loadingData ? (
            <Card className="h-[400px] flex items-center justify-center"><CardContent><p>Carregando gráfico anual...</p></CardContent></Card>
          ) : dadosGraficoAnual.length > 0 ? (
            <ChartContainer config={{}} className="min-h-[300px] w-full">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dadosGraficoAnual} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                  <YAxis stroke="hsl(var(--foreground))" tickFormatter={formatYAxisTick} />
                  <Tooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: ${formatCurrencyWithVisibility(Number(value), showValues)}`} labelClassName="font-bold" className="bg-background text-foreground border-border shadow-lg" />} />
                  <Legend content={<ChartLegendContent />} />
                  <Bar dataKey="Dividendos" stackId="a" radius={[4, 4, 0, 0]}>
                    {dadosGraficoAnual.map((_, index) => (
                      <Cell key={`dividendo-bar-${index}`} fill={BAR_COLORS.Dividendos} />
                    ))}
                  </Bar>
                  <Bar dataKey="JCP" stackId="a" radius={[4, 4, 0, 0]}>
                    {dadosGraficoAnual.map((_, index) => (
                      <Cell key={`jcp-bar-${index}`} fill={BAR_COLORS.JCP} />
                    ))}
                  </Bar>
                  <Bar dataKey="Outros" stackId="a" radius={[4, 4, 0, 0]}>
                    {dadosGraficoAnual.map((_, index) => (
                      <Cell key={`outros-bar-${index}`} fill={BAR_COLORS.Outros} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">Nenhum dado para exibir no gráfico anual.</p>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Recebimento Mensal ({anoSelecionado || "N/A"})</h2>
          {loadingGraficoMensal ? (
            <Card className="h-[400px] flex items-center justify-center"><CardContent><p>Carregando gráfico mensal...</p></CardContent></Card>
          ) : !anoSelecionado ? (
            <p className="text-gray-600 dark:text-gray-400">Selecione um ano para ver o detalhamento mensal.</p>
          ) : dadosGraficoMensal.length > 0 ? (
            <ChartContainer config={{}} className="min-h-[300px] w-full">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dadosGraficoMensal} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                  <YAxis stroke="hsl(var(--foreground))" tickFormatter={formatYAxisTick} />
                  <Tooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: ${formatCurrencyWithVisibility(Number(value), showValues)}`} labelClassName="font-bold" className="bg-background text-foreground border-border shadow-lg" />} />
                  <Legend content={<ChartLegendContent />} />
                  <Bar dataKey="Dividendos" stackId="a" radius={[4, 4, 0, 0]}>
                    {dadosGraficoMensal.map((_, index) => (
                      <Cell key={`dividendo-mes-bar-${index}`} fill={BAR_COLORS.Dividendos} />
                    ))}
                  </Bar>
                  <Bar dataKey="JCP" stackId="a" radius={[4, 4, 0, 0]}>
                    {dadosGraficoMensal.map((_, index) => (
                      <Cell key={`jcp-mes-bar-${index}`} fill={BAR_COLORS.JCP} />
                    ))}
                  </Bar>
                  <Bar dataKey="Outros" stackId="a" radius={[4, 4, 0, 0]}>
                    {dadosGraficoMensal.map((_, index) => (
                      <Cell key={`outros-mes-bar-${index}`} fill={BAR_COLORS.Outros} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">Nenhum provento recebido em {anoSelecionado}.</p>
          )}
        </div>
      </div>

      <div className="mb-8"> {/* Pie chart section */}
        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Distribuição por Ação ({anoSelecionado || "N/A"})</h2>
        {loadingData ? (
            <Card className="h-[400px] flex items-center justify-center"><CardContent><p>Carregando gráfico de distribuição...</p></CardContent></Card>
        ) : !anoSelecionado ? (
            <p className="text-gray-600 dark:text-gray-400">Selecione um ano para ver a distribuição por ação.</p>
        ) : dadosGraficoPizzaAcao.length > 0 ? (
          <ChartContainer config={{}} className="min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie data={dadosGraficoPizzaAcao} cx="50%" cy="50%" labelLine={false} outerRadius={120} fill={BAR_COLORS.Dividendos} dataKey="value" nameKey="name">
                  {dadosGraficoPizzaAcao.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent formatter={(value, name) => [formatCurrencyWithVisibility(Number(value), showValues), ' '+ name]} labelClassName="font-bold" className="bg-background text-foreground border-border shadow-lg" />} />
                <Legend content={({ payload }) => (
                  <ul className="flex flex-wrap gap-4 mt-2">
                    {payload && payload.map((entry, idx) => (
                      <li key={`legend-pie-${entry.value}`} className="flex items-center gap-2">
                        <span style={{ background: entry.color, width: 16, height: 16, display: 'inline-block', borderRadius: 4 }}></span>
                        <span className="text-sm">{entry.value}</span>
                      </li>
                    ))}
                  </ul>
                )} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">Nenhuma distribuição por ação para exibir em {anoSelecionado}.</p>
        )}
      </div>

      {/* Seção da Tabela Detalhada */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1 bg-indigo-500 rounded-full"></div>
              <h2 className="text-xl font-bold text-gray-800">
                Detalhes dos Proventos Recebidos {anoSelecionado ? `em ${anoSelecionado}` : '(Todos os Anos)'}
              </h2>
            </div>
            <div className="text-sm text-gray-500">
              {proventosFiltradosParaTabela.length} registros
            </div>
          </div>
        </div>
        
        {loadingData ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p>Carregando tabela de proventos...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <Label htmlFor="proventosSearch-table" className="text-gray-700 flex items-center gap-2">
                  <span>🔍</span>
                  <span>Pesquisar Proventos:</span>
                </Label>
                <Input
                  id="proventosSearch-table"
                  type="text"
                  placeholder="Digite para pesquisar em todos os campos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>
            </div>
            <TabelaProventos data={proventosFiltradosParaTabela} showValues={showValues} />
            
          </>
        )}
      </div>

      {/* Footer da Página */}
      <div className="mt-12 text-center text-gray-500 text-sm">
        <p className="flex items-center justify-center gap-2">
          <span>💡</span>
          <span>Dica: Use os filtros para encontrar proventos específicos rapidamente</span>
        </p>
      </div>

      {/* Removed DividendTimeline section
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-200">Linha do Tempo dos Dividendos</h2>
        <DividendTimeline
          eventos={proventosDetalhados
            .filter(p =>
              // Mostra últimos recebidos (pagos até hoje) e futuros garantidos (data_ex futura)
              (p.dt_pagamento && new Date(p.dt_pagamento) <= new Date()) ||
              (p.data_ex && new Date(p.data_ex) > new Date())
            )
            .map(p => ({
              id: p.id,
              ticker: p.ticker_acao,
              nome_acao: p.nome_acao,
              tipo: p.tipo_provento || p.tipo, // cobre ambos os casos
              valor: p.valor_total_recebido, // CORRETO!
              dt_pagamento: p.dt_pagamento,
              data_ex: p.data_ex,
            }))
          }
        />
      </div>
      */}

      {/* Seção de Resumo Geral por Ação (Todos os Anos) - Pode ser opcional ou movida */}
      {/* <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Resumo Geral por Ação (Todos os Períodos)</h2>
        <p className="text-gray-600 dark:text-gray-400">Resumo de proventos por ação (todos os períodos) será exibido aqui.</p>
      </div> */}
    </div>
  );
}

// Função utilitária para mapear campos do backend para o padrão do frontend
function mapProventoRecebidoBackendToFrontend(p: any): ProventoRecebidoUsuario {
  return {
    id: p.id,
    id_acao: p.id_acao,
    tipo: p.tipo_provento, // backend: tipo_provento, frontend: tipo
    valor_unitario_provento: p.valor_unitario_provento,
    data_registro: p.data_registro || '',
    data_ex: p.data_ex || '',
    dt_pagamento: p.dt_pagamento || null,
    ticker_acao: p.ticker_acao,
    nome_acao: p.nome_acao,
    quantidade_na_data_ex: p.quantidade_possuida_na_data_ex, // backend: quantidade_possuida_na_data_ex
    valor_total_recebido: p.valor_total_recebido,
  };
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData>({
    carteira: [],
    resultados: [],
    operacoes: [],
    operacoes_fechadas: [], // Initialize new data field
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [totalDividendosRecebidos, setTotalDividendosRecebidos] = useState<number>(0);
  const [showValues, setShowValues] = useState(true); // New state for hiding/showing values

  const router = useRouter() // Initialize useRouter
  const pathname = usePathname() // Initialize usePathname

  useEffect(() => {
    fetchDashboardData();
    fetchTotalDividendosRecebidos();
  }, [])

  // Sync activeTab with pathname
  useEffect(() => {
    if (pathname === "/") {
      setActiveTab("overview");
    } else if (pathname === "/proventos") {
      setActiveTab("proventos");
    }
    // "taxes", "history" are local tabs
  }, [pathname]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [carteiraRes, resultadosRes, operacoesRes, operacoesFechadasRes] = await Promise.all([
        api.get("/carteira"),
        api.get("/resultados"),
        api.get("/operacoes"),
        api.get("/operacoes/fechadas"), // Fetch closed operations
      ])

      setData({
        carteira: carteiraRes.data,
        resultados: resultadosRes.data,
        operacoes: operacoesRes.data,
        operacoes_fechadas: operacoesFechadasRes.data, // Set closed operations data
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do dashboard",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchTotalDividendosRecebidos = async () => {
    try {
      const resumoAnual = await getResumoProventosAnuaisUsuario();
      // Soma todos os proventos (dividendos + JCP + outros) de todos os anos
      const total = resumoAnual.reduce((acc, ano) => acc + (ano.total_geral || 0), 0);
      setTotalDividendosRecebidos(total);
    } catch (error) {
      setTotalDividendosRecebidos(0);
    }
  };

  const handleDataUpdate = () => {
    fetchDashboardData()
  }

  // Function to mask currency values
  const formatCurrencyWithVisibility = (value: number) => {
    if (!showValues) {
      return "R$ •••,••"
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  // Function to mask numeric values (like quantities)
  const formatNumberWithVisibility = (value: number) => {
    if (!showValues) {
      return "•••"
    }
    return value.toString()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Carteira de Ações</h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Olá, {user?.nome_completo || user?.username}</span>
              
              {/* Toggle para mostrar/esconder valores */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowValues(!showValues)}
                className="flex items-center gap-2"
              >
                {showValues ? (
                  <>
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Esconder Valores</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    <span className="hidden sm:inline">Mostrar Valores</span>
                  </>
                )}
              </Button>
              
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex space-x-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline">
                <PlusCircle className="h-5 w-5 mr-2" />
                Cadastrar Nova Operação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Nova Operação</DialogTitle>
              </DialogHeader>
              <AddOperation onSuccess={handleDataUpdate} />
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline">
                <UploadCloud className="h-5 w-5 mr-2" />
                Importar Operações B3
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Importar Operações da B3</DialogTitle>
              </DialogHeader>
              <UploadOperations onSuccess={handleDataUpdate} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Modern Tabs Layout */}
        <div className="space-y-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
            <div className="flex flex-wrap gap-1">
              {/* Grupo Principal */}
              <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                <TabButton 
                  value="overview" 
                  color="blue" 
                  isActive={activeTab === "overview"} 
                  onClick={(v: string) => {
                    setActiveTab(v);
                    router.push("/");
                  }}
                >
                  <TrendingUp className={`h-5 w-5 mr-2 ${activeTab === "overview" ? "text-white" : "text-blue-600"}`} />
                  Dashboard
                </TabButton>
                <TabButton 
                  value="proventos" 
                  color="green" 
                  isActive={activeTab === "proventos"} 
                  onClick={(v: string) => setActiveTab(v)}
                >
                  <DollarSign className={`h-5 w-5 mr-2 ${activeTab === "proventos" ? "text-white" : "text-green-600"}`} />
                  Proventos
                </TabButton>
                <TabButton 
                  value="extrato" 
                  color="purple" 
                  isActive={activeTab === "extrato"} 
                  onClick={(v: string) => setActiveTab(v)}
                >
                  <Briefcase className={`h-5 w-5 mr-2 ${activeTab === "extrato" ? "text-white" : "text-purple-600"}`} />
                  Extrato
                </TabButton>
                <TabButton 
                  value="taxes" 
                  color="orange" 
                  isActive={activeTab === "taxes"} 
                  onClick={(v: string) => setActiveTab(v)}
                >
                  <Landmark className={`h-5 w-5 mr-2 ${activeTab === "taxes" ? "text-white" : "text-orange-600"}`} />
                  Impostos
                </TabButton>
                <TabButton 
                  value="history" 
                  color="indigo" 
                  isActive={activeTab === "history"} 
                  onClick={(v: string) => setActiveTab(v)}
                >
                  <History className={`h-5 w-5 mr-2 ${activeTab === "history" ? "text-white" : "text-indigo-600"}`} />
                  <span className="hidden sm:inline">Histórico de Importações</span>
                  <span className="sm:hidden">Histórico</span>
                </TabButton>
              </div>
              {/* Separador Visual */}
              <div className="hidden lg:flex items-center px-2">
                <div className="w-px h-6 bg-gray-300"></div>
              </div>
              {/* Grupo Secundário */}
              <div className="flex flex-wrap gap-1">
                {/* Link Externo com estilo diferenciado */}
                <Link href="/imposto-renda" className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 rounded-lg whitespace-nowrap border border-gray-300 hover:border-gray-400 cursor-pointer">
                  <FileText className="h-5 w-5 mr-2 text-gray-500" />
                  <span className="hidden sm:inline">Declaração Anual</span>
                  <span className="sm:hidden">Declaração</span>
                  <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                </Link>
              </div>
            </div>
            {/* Indicador Mobile */}
            <div className="md:hidden mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 flex items-center">
                <div className="w-2 h-2 rounded-full bg-current mr-2"></div>
                Aba ativa: 
                <span className="ml-1 font-medium text-gray-700">
                  {activeTab === "overview" && "Dashboard"}
                  {activeTab === "proventos" && "Proventos"}
                  {activeTab === "extrato" && "Extrato"}
                  {activeTab === "taxes" && "Impostos"}
                  {activeTab === "history" && "Histórico"}
                </span>
              </div>
            </div>
          </div>
          {/* Conteúdo da Tab Ativa */}
          <div className="min-h-[400px]">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Breadcrumb Melhorado */}
                <div className="mb-2">       
                  <div className="flex items-center gap-4 mb-2">
                    <div className="h-10 w-2 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Dashboard
                    </h1>
                  </div>
                  <p className="text-gray-600 ml-6">
                    Visão geral da sua carteira, resultados e operações
                  </p>
                </div>
                
                <PortfolioOverview 
                  carteira={data.carteira} 
                  resultados={data.resultados} 
                  operacoes={data.operacoes} 
                  totalDividendosRecebidos={totalDividendosRecebidos} 
                  showValues={showValues}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PortfolioEquityChart />
                  <Last12MonthsEarningsChart />
                </div>
                <StockTable carteira={data.carteira} onUpdate={handleDataUpdate} showValues={showValues} />
                <OperacoesEncerradasTable 
                  operacoesFechadas={data.operacoes_fechadas} 
                  resultadosMensais={data.resultados}
                  onUpdateDashboard={handleDataUpdate} 
                />
                <TaxMeter resultados={data.resultados} />
              </div>
            )}
            {activeTab === "proventos" && (
              <div className="space-y-6">
                {/* Breadcrumb Melhorado */}
                <div className="mb-2">       
                  <div className="flex items-center gap-4 mb-2">
                    <div className="h-10 w-2 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Meus Proventos
                    </h1>
                  </div>
                  <p className="text-gray-600 ml-6">
                    Acompanhe seus dividendos, JCPs e outros proventos de forma inteligente
                  </p>
                </div>
                
                <ProventosTabContent showValues={showValues} />
              </div>
            )}
            {activeTab === "extrato" && (
              <div className="space-y-6">
                {/* Breadcrumb Melhorado */}
                <div className="mb-2">       
                  <div className="flex items-center gap-4 mb-2">
                    <div className="h-10 w-2 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full"></div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                      Extrato de Operações
                    </h1>
                  </div>
                  <p className="text-gray-600 ml-6">
                    Histórico completo de suas operações abertas e fechadas
                  </p>
                </div>
                
                {/* DEBUG: Log dos dados enviados ao ExtratoTabContent */}
                {console.log("🔍 [Dashboard] Dados enviados ao ExtratoTabContent:", {
                  operacoesAbertas: data.operacoes,
                  operacoesFechadas: data.operacoes_fechadas
                })}
                
                <ExtratoTabContent
                  operacoesAbertas={data.operacoes}
                  operacoesFechadas={data.operacoes_fechadas}
                />
              </div>
            )}
            {activeTab === "taxes" && (
              <div className="space-y-6">
                {/* Breadcrumb Melhorado */}
                <div className="mb-2">       
                  <div className="flex items-center gap-4 mb-2">
                    <div className="h-10 w-2 bg-gradient-to-b from-orange-500 to-red-600 rounded-full"></div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                      Impostos e Tributação
                    </h1>
                  </div>
                  <p className="text-gray-600 ml-6">
                    Controle seus impostos, DARF e declarações fiscais
                  </p>
                </div>
                
                <TaxResults resultados={data.resultados} onUpdate={handleDataUpdate} />
              </div>
            )}
            {activeTab === "history" && (
              <div className="space-y-6">
                {/* Breadcrumb Melhorado */}
                <div className="mb-2">       
                  <div className="flex items-center gap-4 mb-2">
                    <div className="h-10 w-2 bg-gradient-to-b from-indigo-500 to-blue-600 rounded-full"></div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                      Histórico de Importações
                    </h1>
                  </div>
                  <p className="text-gray-600 ml-6">
                    Acompanhe suas importações e sincronizações de dados
                  </p>
                </div>
                
                <OperationsHistory operacoes={data.operacoes} onUpdate={handleDataUpdate} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// Modern TabButton component
interface TabButtonProps {
  value: string;
  children: React.ReactNode;
  color: string;
  isActive: boolean;
  onClick: (value: string) => void;
}

function TabButton({ value, children, color, isActive, onClick }: TabButtonProps) {
  const baseClasses = "inline-flex items-center px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg whitespace-nowrap cursor-pointer";
  let backgroundColor = undefined;
  if (isActive) {
    if (color === 'blue') backgroundColor = '#2563eb';
    else if (color === 'green') backgroundColor = '#16a34a';
    else if (color === 'purple') backgroundColor = '#9333ea';
    else if (color === 'orange') backgroundColor = '#ea580c';
    else if (color === 'red') backgroundColor = '#dc2626';
    else if (color === 'indigo') backgroundColor = '#4f46e5';
    else backgroundColor = '#2563eb';
  }
  return (
    <button
      className={
        baseClasses +
        (isActive
          ? ' shadow-md text-white'
          : ' text-gray-700 hover:bg-gray-50')
      }
      onClick={() => onClick(value)}
      style={isActive ? { backgroundColor, color: 'white' } : {}}
    >
      {children}
    </button>
  );
}

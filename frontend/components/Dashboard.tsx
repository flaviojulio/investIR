"use client"

import React, { useState, useEffect, useMemo } from "react" // Added useMemo, React
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { api, getResumoProventosAnuaisUsuario, getResumoProventosMensaisUsuario, getProventosUsuarioDetalhado } from "@/lib/api" // Added specific api functions
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogOut, TrendingUp, PlusCircle, UploadCloud, DollarSign, Briefcase, Landmark } from "lucide-react" // Added new icons
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
import { UploadOperations } from "@/components/UploadOperations"
import { AddOperation } from "@/components/AddOperation"
import { OperationsHistory } from "@/components/OperationsHistory"
import { TaxResults } from "@/components/TaxResults"
import OperacoesEncerradasTable from '@/components/OperacoesEncerradasTable';
import { useToast } from "@/hooks/use-toast"
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

function ProventosTabContent() {
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

        console.log("API Response (proventosDetalhados raw):", JSON.stringify(detalhadosData, null, 2));
        setResumoAnualData(anuaisData);
        setProventosDetalhados(detalhadosData);

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
    console.log("Filtering proventos. anoSelecionado:", anoSelecionado);
    console.log("proventosDetalhados before filter:", JSON.stringify(proventosDetalhados, null, 2));

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

    console.log("proventosFiltradosParaTabela after year filter:", JSON.stringify(filteredResult, null, 2));

    if (!searchTerm) {
      return filteredResult;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const searchedResult = filteredResult.filter(p => {
      const fieldsToSearch = [
        p.ticker,
        p.tipo_provento,
        p.dt_pagamento,
        p.data_ex,
        String(p.valor_bruto_por_acao),
        String(p.qtd_acoes),
        String(p.valor_total_bruto_recebido),
        String(p.valor_ir_retido),
        String(p.valor_total_liquido_recebido),
        p.nome_acao // Assuming nome_acao might be part of ProventoRecebidoUsuario, add if available
      ];

      return fieldsToSearch.some(field =>
        field && field.toString().toLowerCase().includes(lowerSearchTerm)
      );
    });
    console.log("proventosFiltradosParaTabela after search filter:", JSON.stringify(searchedResult, null, 2));
    return searchedResult;

  }, [proventosDetalhados, anoSelecionado, searchTerm]);

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">Meus Proventos</h1>

      <div className="mb-8 max-w-xs">
        <Label htmlFor="select-ano" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
          Filtrar por Ano:
        </Label>
        <Select
          value={anoSelecionado ? String(anoSelecionado) : ""}
          onValueChange={(value) => setAnoSelecionado(value ? Number(value) : undefined)}
          disabled={loadingData || anosDisponiveis.length === 0}
        >
          <SelectTrigger id="select-ano" className="w-full">
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

      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
          Resumo de {anoSelecionado || "N/A"}
        </h2>
        {loadingData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium bg-gray-200 dark:bg-gray-700 h-4 w-3/4 rounded"></CardTitle>
                  <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold bg-gray-200 dark:bg-gray-700 h-8 w-1/2 mb-2 rounded"></div>
                  <p className="text-xs text-muted-foreground bg-gray-200 dark:bg-gray-700 h-3 w-full rounded"></p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : resumoDoAnoSelecionado ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <InfoCard title={`Total Recebido (${anoSelecionado})`} value={formatCurrency(totalAnoSelecionado)} icon={DollarSign} description="Soma de todos os proventos no ano."/>
            <InfoCard title={`Dividendos (${anoSelecionado})`} value={formatCurrency(dividendosAnoSelecionado)} icon={Landmark} description="Total de dividendos recebidos."/>
            <InfoCard title={`JCP (${anoSelecionado})`} value={formatCurrency(jcpAnoSelecionado)} icon={Briefcase} description="Total de JCP (bruto) recebido."/>
            {acaoMaiorPagamentoAno ? (
              <InfoCard title={`Top Ação (${anoSelecionado})`} value={acaoMaiorPagamentoAno.ticker} description={`Recebido: ${formatCurrency(acaoMaiorPagamentoAno.total_recebido_na_acao)}`} icon={TrendingUp}/>
            ) : (
              <InfoCard title={`Top Ação (${anoSelecionado})`} value="N/A" description="Sem dados de ações para este ano." icon={TrendingUp}/>
            )}
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
                  <Tooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: ${formatCurrency(Number(value))}`} labelClassName="font-bold" className="bg-background text-foreground border-border shadow-lg" />} />
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
                  <Tooltip content={<ChartTooltipContent formatter={(value, name) => `${name}: ${formatCurrency(Number(value))}`} labelClassName="font-bold" className="bg-background text-foreground border-border shadow-lg" />} />
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
                <Tooltip content={<ChartTooltipContent formatter={(value, name) => [formatCurrency(Number(value)), ' '+ name]} labelClassName="font-bold" className="bg-background text-foreground border-border shadow-lg" />} />
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
      <div className="mt-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
          Detalhes dos Proventos Recebidos {anoSelecionado ? `em ${anoSelecionado}` : '(Todos os Anos)'}
        </h2>
        {loadingData ? (
          <Card className="h-[200px] flex items-center justify-center"><CardContent><p>Carregando tabela de proventos...</p></CardContent></Card>
        ) : (
          <>
            <div className="mb-4">
              <Label htmlFor="proventosSearch" className="text-gray-700 dark:text-gray-300">Pesquisar Proventos:</Label>
              <Input
                id="proventosSearch"
                type="text"
                placeholder="Digite para pesquisar em todos os campos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm mt-1 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
              />
            </div>
            <TabelaProventos data={proventosFiltradosParaTabela} />
          </>
        )}
      </div>

      {/* Seção de Resumo Geral por Ação (Todos os Anos) - Pode ser opcional ou movida */}
      {/* <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Resumo Geral por Ação (Todos os Períodos)</h2>
        <p className="text-gray-600 dark:text-gray-400">Resumo de proventos por ação (todos os períodos) será exibido aqui.</p>
      </div> */}
    </div>
  );
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

  const router = useRouter() // Initialize useRouter
  const pathname = usePathname() // Initialize usePathname

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Sync activeTab with pathname
  useEffect(() => {
    if (pathname === "/") {
      setActiveTab("overview");
    } else if (pathname === "/proventos") {
      setActiveTab("proventos");
    }
    // "taxes", "history", "prejuizo_acumulado" are local tabs
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

  const handleDataUpdate = () => {
    fetchDashboardData()
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Operações da B3</DialogTitle>
              </DialogHeader>
              <UploadOperations onSuccess={handleDataUpdate} />
            </DialogContent>
          </Dialog>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (value === "overview") { router.push("/"); }
            else if (value === "proventos") { setActiveTab("proventos"); }
            else if (value === "taxes") { setActiveTab("taxes"); }
            else if (value === "prejuizo_acumulado") { setActiveTab("prejuizo_acumulado"); }
            else { setActiveTab(value); } // For "history" and any other local tabs
          }}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-5 md:grid-cols-8 lg:grid-cols-11 xl:grid-cols-11">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="proventos">Proventos</TabsTrigger>
            <TabsTrigger value="taxes">Impostos</TabsTrigger>
            <TabsTrigger value="prejuizo_acumulado">Prejuízo Acum.</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <PortfolioOverview carteira={data.carteira} resultados={data.resultados} operacoes={data.operacoes} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PortfolioEquityChart />
              <TaxMeter resultados={data.resultados} />
            </div>
            <StockTable carteira={data.carteira} onUpdate={handleDataUpdate} />
            <OperacoesEncerradasTable 
              operacoesFechadas={data.operacoes_fechadas} 
              resultadosMensais={data.resultados}
              onUpdateDashboard={handleDataUpdate} 
            />
          </TabsContent>

          <TabsContent value="proventos" className="space-y-6">
            <ProventosTabContent />
          </TabsContent>

          <TabsContent value="taxes">
            <TaxResults resultados={data.resultados} onUpdate={handleDataUpdate} />
          </TabsContent>

          <TabsContent value="history">
            <OperationsHistory operacoes={data.operacoes} onUpdate={handleDataUpdate} />
          </TabsContent>

          <TabsContent value="prejuizo_acumulado" className="space-y-6">
            <div className="container mx-auto py-8">
              <h2 className="text-2xl font-bold mb-4">Prejuízo Acumulado</h2>
              <p>Conteúdo da seção de Prejuízo Acumulado será implementado aqui.</p>
              {/* TODO: Implementar visualização de prejuízos acumulados (swing e daytrade) */}
              {/* Exemplo: um card ou uma pequena tabela com os valores de prejuízo acumulado swing e daytrade */}
              {/* Pode-se buscar de data.resultados, o último mês com dados, e exibir os campos: */}
              {/* data.resultados[data.resultados.length - 1]?.prejuizo_acumulado_swing */}
              {/* data.resultados[data.resultados.length - 1]?.prejuizo_acumulado_day */}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

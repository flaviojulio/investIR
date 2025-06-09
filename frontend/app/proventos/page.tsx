"use client"

import React, { useState, useEffect, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { InfoCard } from "@/components/InfoCard";
import { getResumoProventosAnuaisUsuario, getResumoProventosMensaisUsuario, getProventosUsuarioDetalhado } from "@/lib/api";
import type { ResumoProventoAnualAPI, ResumoProventoMensalAPI, AcaoDetalhadaResumoProventoAPI, ProventoRecebidoUsuario } from "@/lib/types";
import { DollarSign, TrendingUp, Briefcase, Landmark } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TabelaProventos } from "@/components/TabelaProventos"; // Import da tabela

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

// Função para formatar valores monetários
const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return "R$ 0,00";
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Função para formatar tick do YAxis como moeda de forma concisa
const formatYAxisTick = (tick: number): string => {
  if (tick >= 1000000) return `R$${(tick / 1000000).toFixed(0)}M`;
  if (tick >= 1000) return `R$${(tick / 1000).toFixed(0)}k`;
  return `R$${tick.toFixed(0)}`;
};

// Função para converter "YYYY-MM" para nome do mês abreviado
const formatMonthName = (monthStr: string): string => {
  const [_, monthNum] = monthStr.split('-');
  const date = new Date();
  date.setMonth(parseInt(monthNum) - 1);
  return date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
};

const PIE_CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
];


export default function ProventosPage() {
  const [anoSelecionado, setAnoSelecionado] = useState<number | undefined>();
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);

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
    // If no year is selected, the original logic was to return proventosDetalhados.
    // This might mean anoSelecionado is always expected to be set.
    // If anoSelecionado can truly be undefined and means "show all",
    // then the original `if (!anoSelecionado) return proventosDetalhados;` is fine.
    // The main fix is for when anoSelecionado *is* defined.

    if (!proventosDetalhados) return []; // Handle case where proventosDetalhados might not be loaded yet

    if (anoSelecionado === undefined) { // Explicitly handle if no year is selected (e.g. show all with valid dates, or none)
      // Option 1: Show all proventos regardless of payment date if no year filter
      // return proventosDetalhados;
      // Option 2: Show only proventos that have a valid payment date if no year filter (more consistent with year filtering)
      return proventosDetalhados.filter(p => {
        if (!p.dt_pagamento) return false;
        const dateObj = new Date(p.dt_pagamento + 'T00:00:00Z'); // Use 'Z' for UTC consistency
        return !isNaN(dateObj.getTime()); // Check if date is valid by checking getTime()
      });
    }

    return proventosDetalhados.filter(p => {
      if (!p.dt_pagamento) { // If payment date is null, undefined, or empty string
        return false; // Do not include if a specific year is selected
      }
      // Adding 'Z' assumes dt_pagamento from backend is a date without timezone, treated as UTC.
      // If it has timezone info or should be local, adjust accordingly.
      const dateObj = new Date(p.dt_pagamento + 'T00:00:00Z');

      // Check if dateObj is a valid date
      if (isNaN(dateObj.getTime())) {
        console.warn(`Invalid date encountered for dt_pagamento: ${p.dt_pagamento} for provento ID: ${p.id}`);
        return false; // Do not include if date is invalid
      }

      const anoPagamento = dateObj.getFullYear();
      return anoPagamento === anoSelecionado;
    });
  }, [proventosDetalhados, anoSelecionado]);


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
                  <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} labelClassName="font-bold" className="bg-background text-foreground border-border shadow-lg" />} />
                  <Legend content={<ChartLegendContent />} />
                  <Bar dataKey="Dividendos" stackId="a" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="JCP" stackId="a" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Outros" stackId="a" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
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
                  <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} labelClassName="font-bold" className="bg-background text-foreground border-border shadow-lg" />} />
                  <Legend content={<ChartLegendContent />} />
                  <Bar dataKey="Dividendos" stackId="a" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="JCP" stackId="a" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Outros" stackId="a" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
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
                <Pie data={dadosGraficoPizzaAcao} cx="50%" cy="50%" labelLine={false} outerRadius={120} fill="#8884d8" dataKey="value" nameKey="name">
                  {dadosGraficoPizzaAcao.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent formatter={(value, name) => [formatCurrency(Number(value)), name]} labelClassName="font-bold" className="bg-background text-foreground border-border shadow-lg" />} />
                <Legend content={<ChartLegendContent />} />
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
          <TabelaProventos data={proventosFiltradosParaTabela} />
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

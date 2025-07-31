"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart" // Using the wrapper from ui/chart
import { BarChart, Bar, LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from "recharts" // Direct import for basic components
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"
import { subMonths, subYears, startOfYear, endOfDay, format, parseISO } from 'date-fns'
import {
  EquityDataPoint,
  ProfitabilityDetails,
  PortfolioHistoryResponse,
} from "@/lib/types" // Import actual types
import { getPortfolioEquityHistory } from "@/lib/api" // Import actual API function
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { ptBR } from 'date-fns/locale';

const chartConfig = {
  portfolioValue: {
    label: " Valor da Carteira",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig // Using the ChartConfig type from ui/chart

type PeriodOption = "6m" | "12m" | "ytd" | "2023" | "2022" | "all"

interface PeriodButton {
  label: string
  value: PeriodOption
}

// Definir anos dinâmicos
const currentYear = new Date().getFullYear();
const lastYear = currentYear - 1;

const periodOptions: { label: string; value: PeriodOption }[] = [
  { label: "6 meses", value: "6m" },
  { label: "12 meses", value: "12m" },
  { label: "Este Ano", value: "ytd" },
  { label: String(lastYear), value: String(lastYear) as PeriodOption },
  { label: "Total", value: "all" },
]

export function PortfolioEquityChart({ shouldLoad = true }: { shouldLoad?: boolean }) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("12m")
  const [chartData, setChartData] = useState<EquityDataPoint[]>([])
  const [profitability, setProfitability] = useState<ProfitabilityDetails | null>(null) // Use ProfitabilityDetails type
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const calculateDates = (period: PeriodOption): { startDate: string, endDate: string, frequency: "daily" | "monthly" } => {
    const today = endOfDay(new Date());
    let startDate: Date;
    let endDate: Date = today;
    let frequency: "daily" | "monthly" = "monthly";

    switch (period) {
      case "6m":
        startDate = subMonths(today, 6);
        frequency = "daily";
        break;
      case "12m":
        startDate = subMonths(today, 12);
        break;
      case "ytd":
        startDate = startOfYear(today);
        frequency = "daily";
        break;
      case String(lastYear):
        startDate = startOfYear(new Date(lastYear, 0, 1));
        endDate = new Date(lastYear, 11, 31, 23, 59, 59, 999);
        break;
      case "all":
        startDate = new Date(2000, 0, 1);
        break;
      default:
        startDate = subMonths(today, 12);
    }
    return {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
      frequency
    }
  }

  useEffect(() => {
    if (!shouldLoad) return;

    let didCancel = false;
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      const { startDate, endDate, frequency } = calculateDates(selectedPeriod)

      // Lógica especial para o período 'all':
      if (selectedPeriod === 'all') {
        try {
          // 1. Busca ampla (como antes)
          const response = await getPortfolioEquityHistory(startDate, endDate, frequency)
          if (didCancel) return;
          // 2. Se houver dados, pega a data do primeiro ponto real
          if (response.equity_curve && response.equity_curve.length > 0) {
            const firstDate = response.equity_curve[0].date;
            // Se o primeiro dado não for igual ao startDate original, refaz a busca
            if (firstDate !== startDate) {
              const refined = await getPortfolioEquityHistory(firstDate, endDate, frequency)
              if (didCancel) return;
              setChartData(refined.equity_curve)
              setProfitability(refined.profitability)
              setIsLoading(false)
              setHasLoaded(true)
              return;
            }
          }
          setChartData(response.equity_curve)
          setProfitability(response.profitability)
        } catch (err) {
          if (err instanceof Error) {
            setError(err.message)
          } else {
            setError("Ocorreu um erro desconhecido.")
          }
          setChartData([])
          setProfitability(null)
        } finally {
          setIsLoading(false)
          setHasLoaded(true)
        }
        return;
      }

      // Demais períodos (lógica padrão)
      try {
        const response = await getPortfolioEquityHistory(startDate, endDate, frequency)
        setChartData(response.equity_curve)
        setProfitability(response.profitability)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("Ocorreu um erro desconhecido.")
        }
        setChartData([])
        setProfitability(null)
      } finally {
        setIsLoading(false)
        setHasLoaded(true)
      }
    }
    fetchData()
    return () => { didCancel = true }
  }, [selectedPeriod, shouldLoad])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Determinar se a tendência geral é positiva ou negativa
  const isPositiveTrend = profitability ? profitability.percentage >= 0 : true;
  const lineColor = isPositiveTrend ? "#22c55e" : "#ef4444"; // Verde para positivo, vermelho para negativo
  const gradientId = `gradient-${isPositiveTrend ? 'positive' : 'negative'}`;

  const filteredChartData = React.useMemo(() => {
    if (selectedPeriod === "all" && chartData.length > 0) {
      // Agrupar por mês: pegar o último valor de cada mês
      const monthlyMap = new Map();
      chartData.forEach((d) => {
        const dateObj = parseISO(d.date);
        const key = format(dateObj, 'yyyy-MM');
        monthlyMap.set(key, d); // sobrescreve, fica o último do mês
      });
      // Converter para array e ordenar
      let monthlyData = Array.from(monthlyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      // Remover meses "vazios": só manter se for o primeiro ou se o valor mudou
      monthlyData = monthlyData.filter((d, i, arr) => {
        if (i === 0) return true;
        return d.value !== arr[i - 1].value;
      });
      // Remover datas inválidas (ex: Jan-00 ou datas antes do primeiro dado real)
      monthlyData = monthlyData.filter((d) => {
        const dateObj = parseISO(d.date);
        return dateObj.getFullYear() > 2000 || (dateObj.getFullYear() === 2000 && dateObj.getMonth() > 0);
      });
      // Formatar o campo date para 'MMM-yy' em português
      return monthlyData.map((d) => ({ ...d, date: format(parseISO(d.date), 'MMM-yy', { locale: ptBR }).replace('.', '') }));
    }
    return chartData;
  }, [selectedPeriod, chartData]);

  const formatDateTick = (tickItem: string) => {
    // Se já estiver no formato 'jan-24', retorna direto
    if (/^[a-zA-Záéíóúãõâêôç]{3}-\d{2}$/i.test(tickItem)) return tickItem;
    if (tickItem.length === 7) return format(parseISO(tickItem + '-01'), 'MMM/yy', { locale: ptBR }).replace('.', '');
    return format(parseISO(tickItem), 'dd/MM/yy');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Evolução da Carteira</CardTitle>
          <div className="w-44">
            <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as PeriodOption)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-center text-muted-foreground">Carregando dados...</p>}
        {error && <p className="text-center text-destructive">Erro: {error}</p>}
        {!isLoading && !error && chartData.length === 0 && (
          <p className="text-center text-muted-foreground">Nenhum dado disponível para o período selecionado.</p>
        )}
        {!isLoading && !error && chartData.length > 0 && (
          <>
            <div className="h-[350px] w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart data={filteredChartData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lineColor} stopOpacity={0.4} />
                      <stop offset="25%" stopColor={lineColor} stopOpacity={0.25} />
                      <stop offset="75%" stopColor={lineColor} stopOpacity={0.1} />
                      <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateTick}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCurrency(value)}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    content={<ChartTooltipContent
                      formatter={(value, name, props) => {
                        if (typeof value === 'number') {
                          return [formatCurrency(value), "💰 Valor da Carteira"];
                        }
                        return [String(value), name];
                      }}
                      labelFormatter={(label) => {
                        try {
                          if (!label) return '';
                          // Se já está no formato MMM-yy, retorna direto
                          if (/^[a-zA-Záéíóúãõâêôç]{3}-\d{2}$/i.test(label)) return label;
                          // Formatação para MM/AAAA
                          if (label.length === 7) return format(parseISO(label + '-01'), 'MM/yyyy');
                          if (label.length === 10) return format(parseISO(label), 'MM/yyyy');
                          return format(parseISO(label), 'MM/yyyy');
                        } catch (e) {
                          return String(label);
                        }
                      }}
                    />}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={lineColor}
                    strokeWidth={3}
                    fill={`url(#${gradientId})`}
                    name="Valor da Carteira"
                    dot={{ fill: lineColor, strokeWidth: 2, r: 2 }}
                    activeDot={{ r: 4, fill: lineColor, strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
            
            {/* Cards de Estatísticas Aprimorados */}
            {profitability && (
              <div className="mt-6 space-y-4">
                {/* Card Principal - Rentabilidade */}
                <div className={`
                  p-4 rounded-lg border-2 transition-all duration-200
                  ${profitability.percentage >= 0 
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                    : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
                  }
                `}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`
                        p-2 rounded-full 
                        ${profitability.percentage >= 0 ? 'bg-green-100' : 'bg-red-100'}
                      `}>
                        {profitability.percentage >= 0 ? (
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Rentabilidade do Período</p>
                        <p className={`text-2xl font-bold ${profitability.percentage >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {profitability.percentage >= 0 ? '+' : ''}{profitability.percentage.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Ganho/Perda</p>
                      <p className={`text-xl font-semibold ${profitability.percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profitability.percentage >= 0 ? '+' : ''}{formatCurrency(profitability.absolute)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cards de Métricas em Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Valor Inicial */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="p-1.5 bg-blue-100 rounded-full">
                        <ArrowDownRight className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-700">Valor Inicial</span>
                    </div>
                    <p className="text-lg font-bold text-blue-800">
                      {formatCurrency(profitability.initial_portfolio_value)}
                    </p>
                  </div>

                  {/* Valor Final */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="p-1.5 bg-purple-100 rounded-full">
                        <ArrowUpRight className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="text-sm font-medium text-purple-700">Valor Atual</span>
                    </div>
                    <p className="text-lg font-bold text-purple-800">
                      {formatCurrency(profitability.final_portfolio_value)}
                    </p>
                  </div>

                  {/* Aporte Líquido */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="p-1.5 bg-amber-100 rounded-full">
                        <Wallet className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="text-sm font-medium text-amber-700">Aporte Líquido</span>
                    </div>
                    <p className="text-lg font-bold text-amber-800">
                      {formatCurrency(profitability.net_investment_change)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default PortfolioEquityChart;

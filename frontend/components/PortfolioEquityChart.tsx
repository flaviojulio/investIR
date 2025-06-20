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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from "recharts" // Direct import for basic components
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

const chartConfig = {
  portfolioValue: {
    label: "Valor da Carteira",
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

export function PortfolioEquityChart() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("12m")
  const [chartData, setChartData] = useState<EquityDataPoint[]>([])
  const [profitability, setProfitability] = useState<ProfitabilityDetails | null>(null) // Use ProfitabilityDetails type
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      const { startDate, endDate, frequency } = calculateDates(selectedPeriod)

      try {
        // Use the actual API function
        const response = await getPortfolioEquityHistory(startDate, endDate, frequency)

        // The API returns dates as "YYYY-MM-DD" or "YYYY-MM".
        // XAxis tickFormatter will handle display formatting.
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
      }
    }

    fetchData()
  }, [selectedPeriod])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDateTick = (tickItem: string) => {
    // Se já estiver no formato 'jan-24', retorna direto
    if (/^[a-zA-Z]{3}-\d{2}$/.test(tickItem)) return tickItem;
    if (tickItem.length === 7) return format(parseISO(tickItem + '-01'), 'MMM/yy').replace('.', '');
    return format(parseISO(tickItem), 'dd/MM/yy');
  };

  // Após obter chartData e antes de renderizar o BarChart:
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
      const monthlyData = Array.from(monthlyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      // Formatar o campo date para 'MMM-yy' (jan-24)
      return monthlyData.map((d) => ({ ...d, date: format(parseISO(d.date), 'MMM-yy', { locale: undefined }).replace('.', '') }));
    }
    return chartData;
  }, [selectedPeriod, chartData]);

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
                <BarChart data={filteredChartData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateTick}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCurrency(value)}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    content={<ChartTooltipContent
                      formatter={(value, name, props) => {
                        if (typeof value === 'number') {
                          return [formatCurrency(value), chartConfig.portfolioValue.label];
                        }
                        return [String(value), name];
                      }}
                      labelFormatter={(label) => {
                        try {
                          if (!label) return '';
                          if (/^[a-zA-Z]{3}-\d{2}$/.test(label)) return label;
                          if (label.length === 7) return format(parseISO(label + '-01'), 'MMM/yy').replace('.', '');
                          if (label.length === 10) return format(parseISO(label), 'dd/MM/yyyy');
                          return format(parseISO(label), 'dd/MM/yyyy HH:mm');
                        } catch (e) {
                          return String(label);
                        }
                      }}
                    />}
                  />
                  <Bar dataKey="value" fill="var(--color-portfolioValue)" radius={4} name="Valor da Carteira" />
                </BarChart>
              </ChartContainer>
            </div>
            {profitability && (
              <div className="mt-4 text-center">
                <p className="text-lg font-semibold">
                  Rentabilidade no Período:
                  <span className={profitability.absolute >= 0 ? "text-green-600" : "text-red-600"}>
                    {` ${formatCurrency(profitability.absolute)} (${profitability.percentage.toFixed(2)}%)`}
                  </span>
                </p>
                <div className="text-sm text-muted-foreground mt-1">
                  <span>Valor Inicial: {formatCurrency(profitability.initial_portfolio_value)}</span> |
                  <span> Valor Final: {formatCurrency(profitability.final_portfolio_value)}</span>
                </div>
                 <div className="text-sm text-muted-foreground">
                  <span>Investido: {formatCurrency(profitability.cash_invested_in_period)}</span> |
                  <span> Retornado (Vendas): {formatCurrency(profitability.cash_returned_in_period)}</span> |
                  <span> Aporte Líquido: {formatCurrency(profitability.net_investment_change)}</span>
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

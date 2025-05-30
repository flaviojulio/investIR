"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react"
import type { Operacao, CarteiraItem, ResultadoMensal } from "@/lib/types"

interface PortfolioOverviewProps {
  carteira: CarteiraItem[]
  resultados: ResultadoMensal[]
  operacoes: Operacao[]
}

export function PortfolioOverview({ carteira, resultados, operacoes }: PortfolioOverviewProps) {
  const metrics = useMemo(() => {
    // Valor total da carteira
    const valorTotal = carteira.reduce((total, item) => {
      return total + item.quantidade * item.preco_medio
    }, 0)

    // Resultado total do último mês
    const ultimoResultado = resultados[resultados.length - 1]
    const ganhoMensal = ultimoResultado ? ultimoResultado.ganho_liquido_swing + ultimoResultado.ganho_liquido_day : 0

    // Total de operações
    const totalOperacoes = operacoes.length

    // Vendas do mês atual para o impostômetro
    const mesAtual = new Date().toISOString().slice(0, 7) // YYYY-MM
    const resultadoMesAtual = resultados.find((r) => r.mes === mesAtual)
    const vendasMesAtual = resultadoMesAtual ? resultadoMesAtual.vendas_swing : 0

    return {
      valorTotal,
      ganhoMensal,
      totalOperacoes,
      vendasMesAtual,
    }
  }, [carteira, resultados, operacoes])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Valor Total da Carteira</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.valorTotal)}</div>
          <p className="text-xs text-muted-foreground">Baseado no preço médio de compra</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Resultado Mensal</CardTitle>
          {metrics.ganhoMensal >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${metrics.ganhoMensal >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(metrics.ganhoMensal)}
          </div>
          <p className="text-xs text-muted-foreground">Último mês calculado</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Operações</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalOperacoes}</div>
          <p className="text-xs text-muted-foreground">Compras e vendas registradas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.vendasMesAtual)}</div>
          <p className="text-xs text-muted-foreground">Para cálculo de isenção</p>
        </CardContent>
      </Card>
    </div>
  )
}

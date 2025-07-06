"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Landmark } from "lucide-react"
import type { Operacao, CarteiraItem, ResultadoMensal } from "@/lib/types"

interface PortfolioOverviewProps {
  carteira: CarteiraItem[]
  resultados: ResultadoMensal[]
  operacoes: Operacao[]
  totalDividendosRecebidos: number // NOVA PROP
}

export function PortfolioOverview({ carteira, resultados, operacoes, totalDividendosRecebidos }: PortfolioOverviewProps) {
  const metrics = useMemo(() => {
    // Valor total da carteira
    const valorTotal = carteira.reduce((total, item) => {
      return total + item.quantidade * item.preco_medio
    }, 0)

    // Vendas do mês atual para o impostômetro
    const mesAtual = new Date().toISOString().slice(0, 7) // YYYY-MM
    const resultadoMesAtual = resultados.find((r) => r.mes === mesAtual)
    const vendasMesAtual = resultadoMesAtual ? resultadoMesAtual.vendas_swing : 0

    return {
      valorTotal,
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <CardTitle className="text-sm font-medium">Dividendos Recebidos</CardTitle>
          <Landmark className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalDividendosRecebidos)}</div>
          <p className="text-xs text-muted-foreground">Total de dividendos recebidos até hoje</p>
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

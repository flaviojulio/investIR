"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Landmark } from "lucide-react"
import type { Operacao, CarteiraItem, ResultadoMensal } from "@/lib/types"

interface PortfolioOverviewProps {
  carteira: CarteiraItem[]
  resultados: ResultadoMensal[]
  operacoes: Operacao[]
  totalDividendosRecebidos: number // NOVA PROP
  showValues: boolean // New prop for hiding/showing values
}

export function PortfolioOverview({ carteira, resultados, operacoes, totalDividendosRecebidos, showValues }: PortfolioOverviewProps) {
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
    if (!showValues) {
      return "R$ •••,••"
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Card Valor Total da Carteira */}
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">
              Valor Total da Carteira
            </h3>
            <div className="bg-emerald-200 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-emerald-700" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-900 mb-2">
            {formatCurrency(metrics.valorTotal)}
          </div>
          <p className="text-sm text-emerald-600">
            Baseado no preço médio de compra
          </p>
        </div>
      </div>

      {/* Card Dividendos Recebidos */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">
              Dividendos Recebidos
            </h3>
            <div className="bg-blue-200 p-3 rounded-full">
              <Landmark className="h-6 w-6 text-blue-700" />
            </div>
          </div>
          <div className="text-3xl font-bold text-blue-900 mb-2">
            {formatCurrency(totalDividendosRecebidos)}
          </div>
          <p className="text-sm text-blue-600">
            Total de dividendos recebidos até hoje
          </p>
        </div>
      </div>

      {/* Card Vendas do Mês */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-orange-800 uppercase tracking-wide">
              Vendas do Mês
            </h3>
            <div className="bg-orange-200 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-orange-700" />
            </div>
          </div>
          <div className="text-3xl font-bold text-orange-900 mb-2">
            {formatCurrency(metrics.vendasMesAtual)}
          </div>
          <p className="text-sm text-orange-600">
            Para cálculo de isenção
          </p>
        </div>
      </div>
    </div>
  )
}

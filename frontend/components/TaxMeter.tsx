"use client"

import type React from "react"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import type { ResultadoMensal } from "@/lib/types"

interface TaxMeterProps {
  resultados: ResultadoMensal[]
}

export function TaxMeter({ resultados }: TaxMeterProps) {
  const taxData = useMemo(() => {
    const mesAtual = new Date().toISOString().slice(0, 7) // YYYY-MM
    const resultadoMesAtual = resultados.find((r) => r.mes === mesAtual)

    const vendasMesAtual = resultadoMesAtual ? resultadoMesAtual.vendas_swing : 0
    const limiteIsencao = 20000
    const percentualUtilizado = (vendasMesAtual / limiteIsencao) * 100
    const valorRestante = Math.max(0, limiteIsencao - vendasMesAtual)
    const isento = vendasMesAtual <= limiteIsencao

    return {
      vendasMesAtual,
      limiteIsencao,
      percentualUtilizado: Math.min(100, percentualUtilizado),
      valorRestante,
      isento,
      ultrapassou: vendasMesAtual > limiteIsencao,
    }
  }, [resultados])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const getStatusColor = () => {
    if (taxData.ultrapassou) return "text-red-600"
    if (taxData.percentualUtilizado > 80) return "text-yellow-600"
    return "text-green-600"
  }

  const getStatusIcon = () => {
    if (taxData.ultrapassou) return <XCircle className="h-5 w-5 text-red-600" />
    if (taxData.percentualUtilizado > 80) return <AlertTriangle className="h-5 w-5 text-yellow-600" />
    return <CheckCircle className="h-5 w-5 text-green-600" />
  }

  const getProgressColor = () => {
    if (taxData.ultrapassou) return "bg-red-500"
    if (taxData.percentualUtilizado > 80) return "bg-yellow-500"
    return "bg-green-500"
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              Impostômetro - Swing Trade
            </CardTitle>
            <CardDescription>Acompanhe seu limite de isenção de R$ 20.000 mensais</CardDescription>
          </div>
          <div className={`text-right ${getStatusColor()}`}>
            <div className="text-2xl font-bold">{taxData.percentualUtilizado.toFixed(1)}%</div>
            <div className="text-sm">{taxData.ultrapassou ? "Limite ultrapassado" : "do limite utilizado"}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Vendas do mês atual</span>
            <span className="font-medium">{formatCurrency(taxData.vendasMesAtual)}</span>
          </div>
          <Progress
            value={taxData.percentualUtilizado}
            className="h-3"
            style={
              {
                "--progress-background": taxData.ultrapassou
                  ? "#ef4444"
                  : taxData.percentualUtilizado > 80
                    ? "#eab308"
                    : "#22c55e",
              } as React.CSSProperties
            }
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>R$ 0</span>
            <span>R$ 20.000</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-lg font-semibold text-muted-foreground">{formatCurrency(taxData.limiteIsencao)}</div>
            <div className="text-sm text-muted-foreground">Limite de isenção</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-semibold ${taxData.ultrapassou ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(taxData.valorRestante)}
            </div>
            <div className="text-sm text-muted-foreground">
              {taxData.ultrapassou ? "Valor excedente" : "Valor restante"}
            </div>
          </div>
        </div>

        {taxData.ultrapassou && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Atenção!</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              Você ultrapassou o limite de isenção. Será necessário pagar 15% de IR sobre os ganhos de swing trade.
            </p>
          </div>
        )}

        {!taxData.ultrapassou && taxData.percentualUtilizado > 80 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Cuidado!</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Você está próximo do limite de isenção. Monitore suas próximas vendas.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

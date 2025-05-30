"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { CarteiraItem } from "@/lib/types"

interface StockTableProps {
  carteira: CarteiraItem[]
  onUpdate: () => void
}

export function StockTable({ carteira, onUpdate }: StockTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value)
  }

  // Simular preço atual (em uma aplicação real, viria de uma API de cotações)
  const getSimulatedCurrentPrice = (avgPrice: number) => {
    const variation = (Math.random() - 0.5) * 0.2 // Variação de -10% a +10%
    return avgPrice * (1 + variation)
  }

  const calculateUnrealizedGain = (quantity: number, avgPrice: number, currentPrice: number) => {
    const totalCost = quantity * avgPrice
    const currentValue = quantity * currentPrice
    return currentValue - totalCost
  }

  if (carteira.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carteira Atual</CardTitle>
          <CardDescription>Suas posições em ações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma posição encontrada na carteira.</p>
            <p className="text-sm mt-2">Adicione operações para ver suas posições aqui.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carteira Atual</CardTitle>
        <CardDescription>Suas posições em ações com ganhos/perdas não realizados</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Preço Médio</TableHead>
                <TableHead className="text-right">Preço Atual*</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Ganho/Perda</TableHead>
                <TableHead className="text-right">%</TableHead>
                {/* <TableHead className="text-center">Ações</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {carteira.map((item) => {
                const currentPrice = getSimulatedCurrentPrice(item.preco_medio)
                const unrealizedGain = calculateUnrealizedGain(item.quantidade, item.preco_medio, currentPrice)
                const unrealizedGainPercent = (unrealizedGain / item.custo_total) * 100
                const currentValue = item.quantidade * currentPrice

                return (
                  <TableRow key={item.ticker}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{item.ticker}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(item.quantidade)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.preco_medio)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(currentPrice)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(currentValue)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${unrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {unrealizedGain >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {formatCurrency(Math.abs(unrealizedGain))}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        unrealizedGainPercent >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {unrealizedGainPercent >= 0 ? "+" : ""}
                      {unrealizedGainPercent.toFixed(2)}%
                    </TableCell>
                    {/* 
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell> 
                    */}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          * Preços atuais são simulados para demonstração. Em produção, seriam obtidos de uma API de cotações.
        </div>
      </CardContent>
    </Card>
  )
}

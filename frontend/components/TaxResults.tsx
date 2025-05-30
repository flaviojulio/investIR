"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, DollarSign, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"
import type { ResultadoMensal } from "@/lib/types"

interface TaxResultsProps {
  resultados: ResultadoMensal[]
}

export function TaxResults({ resultados }: TaxResultsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR")
  }

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split("-")
    const monthNames = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ]
    return `${monthNames[Number.parseInt(month) - 1]} ${year}`
  }

  const totalIRDevido = resultados.reduce((sum, r) => sum + r.ir_pagar_day, 0)
  const totalVendasSwing = resultados.reduce((sum, r) => sum + r.vendas_swing, 0)
  const mesesIsentos = resultados.filter((r) => r.isento_swing).length

  if (resultados.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resultados de Impostos</CardTitle>
          <CardDescription>Cálculos mensais de imposto de renda sobre operações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum resultado de imposto calculado ainda.</p>
            <p className="text-sm mt-2">Adicione operações para ver os cálculos aqui.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total IR a Pagar</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalIRDevido)}</div>
            <p className="text-xs text-muted-foreground">Day trade acumulado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Swing Trade</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalVendasSwing)}</div>
            <p className="text-xs text-muted-foreground">Volume total vendido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meses Isentos</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mesesIsentos}</div>
            <p className="text-xs text-muted-foreground">De {resultados.length} meses</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Resultados Mensais */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados Mensais Detalhados</CardTitle>
          <CardDescription>Breakdown mensal dos cálculos de imposto de renda</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Vendas Swing</TableHead>
                  <TableHead className="text-right">Ganho Swing</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ganho Day Trade</TableHead>
                  <TableHead className="text-right">IR Day Trade</TableHead>
                  <TableHead className="text-right">DARF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((resultado) => (
                  <TableRow key={resultado.mes}>
                    <TableCell className="font-medium">{formatMonth(resultado.mes)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(resultado.vendas_swing)}</TableCell>
                    <TableCell
                      className={`text-right ${resultado.ganho_liquido_swing >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {formatCurrency(resultado.ganho_liquido_swing)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={resultado.isento_swing ? "default" : "destructive"}>
                        {resultado.isento_swing ? "Isento" : "Tributável"}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right ${resultado.ganho_liquido_day >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {formatCurrency(resultado.ganho_liquido_day)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(resultado.ir_devido_day)}</TableCell>
                    <TableCell className="text-right">
                      {resultado.ir_pagar_day > 0 ? (
                        <Badge variant="destructive">{formatCurrency(resultado.ir_pagar_day)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* DARFs a Pagar */}
      {resultados.some((r) => r.ir_pagar_day > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              DARFs a Pagar
            </CardTitle>
            <CardDescription>Guias de recolhimento que precisam ser pagas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resultados
                .filter((r) => r.ir_pagar_day > 0)
                .map((resultado) => (
                  <Alert key={resultado.mes}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex justify-between items-center">
                        <div>
                          <strong>Competência:</strong> {formatMonth(resultado.mes)} |<strong> Código:</strong>{" "}
                          {resultado.darf_codigo || "6015"}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-600">{formatCurrency(resultado.ir_pagar_day)}</div>
                          {resultado.darf_vencimento && (
                            <div className="text-sm text-muted-foreground">
                              Venc: {formatDate(resultado.darf_vencimento)}
                            </div>
                          )}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações Importantes */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">Swing Trade</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Isenção até R$ 20.000 em vendas mensais</li>
                <li>• Alíquota de 15% sobre ganhos acima da isenção</li>
                <li>• Prejuízos podem ser compensados</li>
                <li>• Declaração anual obrigatória</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Day Trade</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Alíquota de 20% sobre todos os ganhos</li>
                <li>• IRRF de 1% retido na fonte</li>
                <li>• DARF mensal obrigatório se houver IR a pagar</li>
                <li>• Vencimento até último dia útil do mês seguinte</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

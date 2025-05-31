"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useState } from "react" // Added for darfUpdating state
import { Button } from "@/components/ui/button" // Added Button import
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Edit3 } from "lucide-react" // Edit3 for actions
import type { ResultadoMensal } from "@/lib/types"
import { api } from "@/lib/api" // Added api import
import { useToast } from "@/hooks/use-toast" // Added useToast import

interface TaxResultsProps {
  resultados: ResultadoMensal[]
  onUpdate: () => void; // Added onUpdate prop
}

export function TaxResults({ resultados, onUpdate }: TaxResultsProps) { // Destructure onUpdate
  const { toast } = useToast() // Initialize toast
  const [darfUpdating, setDarfUpdating] = useState<string | null>(null);

  const handleMarkAsPaid = async (yearMonth: string, type: 'swing' | 'daytrade') => {
    const darfId = `${yearMonth}-${type}`;
    setDarfUpdating(darfId);
    try {
      await api.put(`/impostos/darf_status/${yearMonth}/${type}`, { status: "Pago" });
      toast({
        title: "Sucesso!",
        description: `DARF ${type === 'swing' ? 'Swing Trade' : 'Day Trade'} de ${formatMonth(yearMonth)} marcado como Pago.`,
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.detail || `Erro ao marcar DARF como pago.`,
        variant: "destructive",
      });
    } finally {
      setDarfUpdating(null);
    }
  };

  const formatCurrency = (value: number | undefined | null) => { // Allow undefined/null
    if (value === undefined || value === null) return "-";
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
      {/* Controle de DARFs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Controle de Pagamento de DARFs</CardTitle>
          <CardDescription>Gerencie o status de pagamento dos seus DARFs mensais.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Vendas Swing</TableHead>
                  <TableHead className="text-right">Resultado ST</TableHead>
                  <TableHead className="text-right">DARF ST (R$)</TableHead>
                  <TableHead className="text-center">Status ST</TableHead>
                  <TableHead className="text-right">Vendas Day Trade</TableHead>
                  <TableHead className="text-right">Resultado DT</TableHead>
                  <TableHead className="text-right">DARF DT (R$)</TableHead>
                  <TableHead className="text-center">Status DT</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhum resultado mensal encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  resultados.map((resultado) => (
                    <TableRow key={`controle-${resultado.mes}`}>
                      <TableCell className="font-medium">{formatMonth(resultado.mes)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(resultado.vendas_swing)}</TableCell>
                      <TableCell className={`text-right ${resultado.ganho_liquido_swing >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(resultado.ganho_liquido_swing)}
                      </TableCell>
                      <TableCell className="text-right">
                        { (resultado.darf_swing_trade_valor && resultado.darf_swing_trade_valor > 0)
                          ? <Badge variant="outline">{formatCurrency(resultado.darf_swing_trade_valor)}</Badge>
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {resultado.status_darf_swing_trade ? (
                          <Badge variant={resultado.status_darf_swing_trade === 'Pago' ? 'success' : 'warning'}>
                            {resultado.status_darf_swing_trade}
                          </Badge>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(resultado.vendas_day_trade)}</TableCell>
                      <TableCell className={`text-right ${resultado.ganho_liquido_day >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(resultado.ganho_liquido_day)}
                      </TableCell>
                       <TableCell className="text-right">
                        { (resultado.darf_day_trade_valor && resultado.darf_day_trade_valor > 0)
                          ? <Badge variant="destructive">{formatCurrency(resultado.darf_day_trade_valor)}</Badge>
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {resultado.status_darf_day_trade ? (
                          <Badge variant={resultado.status_darf_day_trade === 'Pago' ? 'success' : 'warning'}>
                            {resultado.status_darf_day_trade}
                          </Badge>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center space-x-1">
                        {resultado.status_darf_swing_trade === 'Pendente' && resultado.darf_swing_trade_valor && resultado.darf_swing_trade_valor > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsPaid(resultado.mes, 'swing')}
                            disabled={darfUpdating === `${resultado.mes}-swing`}
                            className="text-xs h-7 px-2"
                          >
                            {darfUpdating === `${resultado.mes}-swing` ? "..." : "Pagar ST"}
                          </Button>
                        )}
                        {resultado.status_darf_day_trade === 'Pendente' && resultado.darf_day_trade_valor && resultado.darf_day_trade_valor > 0 && (
                           <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsPaid(resultado.mes, 'daytrade')}
                            disabled={darfUpdating === `${resultado.mes}-daytrade`}
                            className="text-xs h-7 px-2"
                          >
                            {darfUpdating === `${resultado.mes}-daytrade` ? "..." : "Pagar DT"}
                          </Button>
                        )}
                         {!(resultado.status_darf_swing_trade === 'Pendente' && resultado.darf_swing_trade_valor && resultado.darf_swing_trade_valor > 0) &&
                          !(resultado.status_darf_day_trade === 'Pendente' && resultado.darf_day_trade_valor && resultado.darf_day_trade_valor > 0) &&
                           <span className="text-muted-foreground text-xs">-</span>
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

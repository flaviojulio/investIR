"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Calendar, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Edit3, Search, ArrowUpDown, FileText, Clock, PiggyBank, Receipt } from "lucide-react"
import type { ResultadoMensal } from "@/lib/types"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface TaxResultsProps {
  resultados: ResultadoMensal[]
  onUpdate: () => void; // Added onUpdate prop
}

export function TaxResults({ resultados, onUpdate }: TaxResultsProps) {
  const { toast } = useToast()
  const [darfUpdating, setDarfUpdating] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pago" | "pendente" | "isento">("all")
  const [sortConfig, setSortConfig] = useState<{ key: keyof ResultadoMensal; direction: 'ascending' | 'descending' } | null>({ key: 'mes', direction: 'descending' })

  // Funções utilitárias movidas para antes do useMemo
  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return "R$ 0,00";
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
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ]
    return `${monthNames[Number.parseInt(month) - 1]} ${year}`
  }

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

  const requestSort = (key: keyof ResultadoMensal) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    const filtered = resultados.filter(resultado => {
      const matchesSearch = formatMonth(resultado.mes).toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      
      if (statusFilter === "all") return true;
      if (statusFilter === "isento") return resultado.isento_swing;
      if (statusFilter === "pago") return resultado.status_darf_swing_trade === "Pago" || resultado.status_darf_day_trade === "Pago";
      if (statusFilter === "pendente") return resultado.status_darf_swing_trade === "Pendente" || resultado.status_darf_day_trade === "Pendente";
      
      return true;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue === null || aValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        
        const comparison = String(aValue).localeCompare(String(bValue));
        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [resultados, searchTerm, statusFilter, sortConfig, formatMonth])

  // Cálculos de resumo
  const totalIRDevido = resultados.reduce((sum, r) => sum + (r.ir_pagar_day || 0), 0)
  const totalVendasSwing = resultados.reduce((sum, r) => sum + (r.vendas_swing || 0), 0)
  const totalVendasDayTrade = resultados.reduce((sum, r) => sum + (r.vendas_day_trade || 0), 0)
  const mesesIsentos = resultados.filter((r) => r.isento_swing).length
  const totalGanhoSwing = resultados.reduce((sum, r) => sum + (r.ganho_liquido_swing || 0), 0)
  const totalGanhoDayTrade = resultados.reduce((sum, r) => sum + (r.ganho_liquido_day || 0), 0)
  const darfsPendentes = resultados.filter(r => 
    (r.status_darf_swing_trade === "Pendente" && r.darf_valor_swing && r.darf_valor_swing > 0) ||
    (r.status_darf_day_trade === "Pendente" && r.darf_valor_day && r.darf_valor_day > 0)
  ).length

  if (resultados.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <Receipt className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Resultados de Impostos</CardTitle>
          <CardDescription>Acompanhe seus cálculos de imposto de renda sobre operações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-base mb-2">Nenhum resultado de imposto calculado ainda.</p>
            <p className="text-sm">Adicione operações para ver os cálculos automaticamente aqui.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {/* Cards de Resumo Modernos */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200">Total IR a Pagar</CardTitle>
            <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(totalIRDevido)}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Day trade acumulado</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-green-800 dark:text-green-200">Vendas Swing Trade</CardTitle>
            <div className="p-2 bg-green-200 dark:bg-green-800 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-700 dark:text-green-300" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">{formatCurrency(totalVendasSwing)}</div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Volume total vendido</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-purple-800 dark:text-purple-200">Meses Isentos</CardTitle>
            <div className="p-2 bg-purple-200 dark:bg-purple-800 rounded-lg">
              <CheckCircle className="h-5 w-5 text-purple-700 dark:text-purple-300" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{mesesIsentos}</div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">De {resultados.length} meses</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-orange-800 dark:text-orange-200">DARFs Pendentes</CardTitle>
            <div className="p-2 bg-orange-200 dark:bg-orange-800 rounded-lg">
              <Clock className="h-5 w-5 text-orange-700 dark:text-orange-300" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">{darfsPendentes}</div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Aguardando pagamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Resultados Mensais Modernizada */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📊</span>
              <div>
                <h2 className="text-xl font-bold">
                  Histórico Detalhado de Impostos
                </h2>
                <p className="text-orange-100 text-sm">
                  Breakdown completo dos cálculos mensais de imposto de renda
                </p>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <span className="text-white font-semibold">{filteredAndSortedData.length} registros</span>
            </div>
          </div>
        </div>
        
        {/* Barra de Pesquisa */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-orange-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100">
                <Search className="text-orange-600 h-5 w-5" />
              </div>
              <div className="flex-1">
                <label className="text-gray-700 font-medium mb-1 block">
                  Pesquisar por mês
                </label>
                <input
                  type="text"
                  placeholder="Digite o mês (ex: Janeiro 2024)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border-2 border-orange-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-200 transition-all rounded-xl px-4 py-3 outline-none"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <label className="text-gray-700 font-medium mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="border-2 border-orange-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-200 transition-all rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="isento">Isentos</SelectItem>
                  <SelectItem value="pago">Pagos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="px-4 py-2 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
          
          {searchTerm && (
            <div className="mt-3 p-3 bg-orange-100 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <span className="font-semibold">{filteredAndSortedData.length}</span> resultados encontrados para "{searchTerm}"
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">
                  <Button variant="ghost" onClick={() => requestSort('mes')} className="px-1 text-xs sm:text-sm font-semibold">
                    Mês
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <Button variant="ghost" onClick={() => requestSort('vendas_swing')} className="px-1 text-xs sm:text-sm font-semibold">
                    Vendas Swing
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <Button variant="ghost" onClick={() => requestSort('ganho_liquido_swing')} className="px-1 text-xs sm:text-sm font-semibold">
                    Ganho Swing
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-center font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">
                  <Button variant="ghost" onClick={() => requestSort('ganho_liquido_day')} className="px-1 text-xs sm:text-sm font-semibold">
                    Ganho Day Trade
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <Button variant="ghost" onClick={() => requestSort('ir_devido_day')} className="px-1 text-xs sm:text-sm font-semibold">
                    IR Day Trade
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right font-semibold">DARF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                      <p>Nenhum resultado encontrado com os filtros aplicados.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((resultado, index) => (
                  <TableRow key={resultado.mes} className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                    <TableCell className="font-medium text-sm">{formatMonth(resultado.mes)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(resultado.vendas_swing)}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${resultado.ganho_liquido_swing >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(resultado.ganho_liquido_swing)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={resultado.isento_swing ? "default" : "destructive"} className="text-xs">
                        {resultado.isento_swing ? "Isento" : "Tributável"}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${resultado.ganho_liquido_day >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(resultado.ganho_liquido_day)}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(resultado.ir_devido_day)}</TableCell>
                    <TableCell className="text-right">
                      {resultado.ir_pagar_day > 0 ? (
                        <Badge variant="destructive" className="text-xs">{formatCurrency(resultado.ir_pagar_day)}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Resumo da Tabela */}
        <div className="p-6 bg-muted/30 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Vendas Swing:</span>
              <div className="font-semibold">{formatCurrency(totalVendasSwing)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Ganho Swing:</span>
              <div className={`font-semibold ${totalGanhoSwing >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(totalGanhoSwing)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Ganho Day Trade:</span>
              <div className={`font-semibold ${totalGanhoDayTrade >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(totalGanhoDayTrade)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Total IR a Pagar:</span>
              <div className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(totalIRDevido)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* DARFs a Pagar - Modernizado */}
      {resultados.some((r) => r.ir_pagar_day > 0) && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertTriangle className="h-5 w-5" />
              DARFs Pendentes - Ação Necessária
            </CardTitle>
            <CardDescription className="text-red-600 dark:text-red-400">
              Guias de recolhimento que precisam ser pagas até o último dia útil do mês seguinte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resultados
                .filter((r) => r.ir_pagar_day > 0)
                .map((resultado) => (
                  <Alert key={resultado.mes} className="border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertDescription>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="text-sm">
                          <div className="font-semibold text-red-800 dark:text-red-200">
                            {formatMonth(resultado.mes)}
                          </div>
                          <div className="text-red-600 dark:text-red-400">
                            Código: {resultado.darf_codigo_day || "6015"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-700 dark:text-red-300 text-lg">
                            {formatCurrency(resultado.ir_pagar_day)}
                          </div>
                          {resultado.darf_vencimento_day && (
                            <div className="text-sm text-red-600 dark:text-red-400">
                              Vencimento: {formatDate(resultado.darf_vencimento_day)}
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

      {/* Controle de DARFs - Modernizado */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💳</span>
              <div>
                <h2 className="text-xl font-bold">
                  Controle de Pagamento de DARFs
                </h2>
                <p className="text-green-100 text-sm">
                  Gerencie o status de pagamento dos seus DARFs mensais de Swing Trade e Day Trade
                </p>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <span className="text-white font-semibold">{filteredAndSortedData.length} meses</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Mês</TableHead>
                <TableHead className="text-right font-semibold">Vendas Swing</TableHead>
                <TableHead className="text-right font-semibold">Resultado ST</TableHead>
                <TableHead className="text-right font-semibold">DARF ST</TableHead>
                <TableHead className="text-center font-semibold">Status ST</TableHead>
                <TableHead className="text-right font-semibold">Vendas Day Trade</TableHead>
                <TableHead className="text-right font-semibold">Resultado DT</TableHead>
                <TableHead className="text-right font-semibold">DARF DT</TableHead>
                <TableHead className="text-center font-semibold">Status DT</TableHead>
                <TableHead className="text-center font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                      <p>Nenhum resultado encontrado com os filtros aplicados.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((resultado, index) => (
                  <TableRow key={`controle-${resultado.mes}`} className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                    <TableCell className="font-medium text-sm">{formatMonth(resultado.mes)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(resultado.vendas_swing)}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${resultado.ganho_liquido_swing >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(resultado.ganho_liquido_swing)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(resultado.darf_valor_swing && resultado.darf_valor_swing > 0) ? (
                        <Badge variant="outline" className="text-xs">{formatCurrency(resultado.darf_valor_swing)}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {resultado.status_darf_swing_trade ? (
                        <Badge variant={resultado.status_darf_swing_trade === 'Pago' ? 'default' : 'secondary'} className="text-xs">
                          {resultado.status_darf_swing_trade}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(resultado.vendas_day_trade)}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${resultado.ganho_liquido_day >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(resultado.ganho_liquido_day)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(resultado.darf_valor_day && resultado.darf_valor_day > 0) ? (
                        <Badge variant="destructive" className="text-xs">{formatCurrency(resultado.darf_valor_day)}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {resultado.status_darf_day_trade ? (
                        <Badge variant={resultado.status_darf_day_trade === 'Pago' ? 'default' : 'secondary'} className="text-xs">
                          {resultado.status_darf_day_trade}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col sm:flex-row gap-1 justify-center">
                        {resultado.status_darf_swing_trade === 'Pendente' && resultado.darf_valor_swing && resultado.darf_valor_swing > 0 && (
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
                        {resultado.status_darf_day_trade === 'Pendente' && resultado.darf_valor_day && resultado.darf_valor_day > 0 && (
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
                        {!(resultado.status_darf_swing_trade === 'Pendente' && resultado.darf_valor_swing && resultado.darf_valor_swing > 0) &&
                         !(resultado.status_darf_day_trade === 'Pendente' && resultado.darf_valor_day && resultado.darf_valor_day > 0) && (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Informações Importantes - Modernizado */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <FileText className="h-5 w-5" />
            Guia Completo de Impostos
          </CardTitle>
          <CardDescription className="text-blue-600 dark:text-blue-400">
            Entenda as regras e obrigações fiscais para suas operações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-200 dark:bg-green-800 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-700 dark:text-green-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Swing Trade</h4>
                  <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>• <strong>Isenção:</strong> Até R$ 20.000 em vendas mensais</li>
                    <li>• <strong>Alíquota:</strong> 15% sobre ganhos acima da isenção</li>
                    <li>• <strong>Compensação:</strong> Prejuízos podem ser compensados</li>
                    <li>• <strong>Declaração:</strong> Anual obrigatória no IR</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-200 dark:bg-orange-800 rounded-lg">
                  <Clock className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Day Trade</h4>
                  <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                    <li>• <strong>Alíquota:</strong> 20% sobre todos os ganhos</li>
                    <li>• <strong>IRRF:</strong> 1% retido na fonte automaticamente</li>
                    <li>• <strong>DARF:</strong> Mensal obrigatório se houver IR a pagar</li>
                    <li>• <strong>Vencimento:</strong> Último dia útil do mês seguinte</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Lembretes Importantes
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Mantenha sempre seus registros organizados e atualizados</li>
              <li>• Considere procurar um contador especializado em operações na bolsa</li>
              <li>• Use o sistema InvestIR para automação completa dos cálculos</li>
              <li>• Fique atento aos prazos de vencimento dos DARFs</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

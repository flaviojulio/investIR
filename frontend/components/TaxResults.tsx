"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  FileText, 
  Clock, 
  Receipt,
  Calculator,
  BookOpen,
  Info,
  Target,
  Zap,
  MoreVertical,
  RotateCcw,
  CheckCheck,
  Eye,
  ExternalLink,
  CreditCard,
  BarChart3,
  Shield,
  Timer,
  Lightbulb,
  PieChart
} from "lucide-react"
import type { ResultadoMensal, OperacaoFechada } from "@/lib/types"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { DarfDetailsModal } from "@/components/DarfMonthlyModal"

interface TaxResultsProps {
  resultados: ResultadoMensal[]
  operacoesFechadas?: OperacaoFechada[]
  onUpdate: () => void
}

export function TaxResults({ resultados, operacoesFechadas = [], onUpdate }: TaxResultsProps) {
  const { toast } = useToast()
  const [darfUpdating, setDarfUpdating] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pago" | "pendente" | "isento">("all")
  
  // Estado para o modal de detalhes
  const [selectedResultado, setSelectedResultado] = useState<ResultadoMensal | null>(null)
  const [isDarfModalOpen, setIsDarfModalOpen] = useState(false)
  
  // Estado local para DARFs com atualização otimista
  const [localDarfUpdates, setLocalDarfUpdates] = useState<Record<string, { swing?: string; day?: string }>>({})

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split("-")
    const monthNames = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ]
    return `${monthNames[Number.parseInt(month) - 1]}/${year}`
  }

  // Função para abrir o modal de detalhes
  const handleOpenDarfModal = (resultado: ResultadoMensal) => {
    setSelectedResultado(resultado)
    setIsDarfModalOpen(true)
  }

  // Função bidirecional: Alternar status DARF (Pago ↔ Pendente)
  const handleToggleDarfStatus = async (yearMonth: string, type: 'swing' | 'daytrade', currentStatus: string) => {
    const darfId = `${yearMonth}-${type}`;
    setDarfUpdating(darfId);
    
    const newStatus = currentStatus?.toLowerCase() === 'pago' ? 'pendente' : 'pago';
    const apiStatus = newStatus === 'pago' ? 'Pago' : 'Pendente';
    
    try {
      setLocalDarfUpdates(prev => ({
        ...prev,
        [yearMonth]: {
          ...prev[yearMonth],
          [type === 'swing' ? 'swing' : 'day']: newStatus
        }
      }));

      await api.put(`/impostos/darf_status/${yearMonth}/${type}`, { 
        status: apiStatus 
      });
      
      toast({
        title: newStatus === 'pago' ? "✅ DARF marcado como pago!" : "⏰ DARF marcado como pendente!",
        description: `${type === 'swing' ? 'Swing Trade' : 'Day Trade'} de ${formatMonth(yearMonth)}`,
      });
      
    } catch (error: any) {
      console.error('Erro ao atualizar DARF:', error);
      
      setLocalDarfUpdates(prev => {
        const updated = { ...prev };
        if (updated[yearMonth]) {
          delete updated[yearMonth][type === 'swing' ? 'swing' : 'day'];
          if (Object.keys(updated[yearMonth]).length === 0) {
            delete updated[yearMonth];
          }
        }
        return updated;
      });
      
      toast({
        title: "❌ Erro ao atualizar DARF",
        description: error.response?.data?.detail || "Erro ao conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setDarfUpdating(null);
    }
  };

  // Função para o modal atualizar o estado local
  const handleDarfStatusChangeFromModal = (yearMonth: string, type: 'swing' | 'daytrade', newStatus: string) => {
    setLocalDarfUpdates(prev => ({
      ...prev,
      [yearMonth]: {
        ...prev[yearMonth],
        [type === 'swing' ? 'swing' : 'day']: newStatus
      }
    }));
  };

  // Função: Aplica atualizações locais aos dados
  const getResultadoWithLocalUpdates = (resultado: ResultadoMensal): ResultadoMensal => {
    const localUpdate = localDarfUpdates[resultado.mes];
    if (!localUpdate) return resultado;

    return {
      ...resultado,
      status_darf_swing_trade: localUpdate.swing || resultado.status_darf_swing_trade,
      status_darf_day_trade: localUpdate.day || resultado.status_darf_day_trade,
    };
  };

  // Aplicar atualizações locais aos cálculos
  const resultadosComAtualizacoes = resultados.map(getResultadoWithLocalUpdates);

  // Cálculos com dados atualizados
  const totalIRDevido = resultadosComAtualizacoes.reduce((sum, r) => sum + (r.ir_pagar_day || 0), 0)
  const totalVendasMesAtual = resultadosComAtualizacoes
    .filter(r => r.mes === new Date().toISOString().slice(0, 7))
    .reduce((sum, r) => sum + (r.vendas_swing || 0), 0)
  const mesesIsentos = resultadosComAtualizacoes.filter((r) => r.isento_swing).length
  const darfsPendentes = resultadosComAtualizacoes.filter(r => 
    (r.status_darf_swing_trade?.toLowerCase() === "pendente" && r.darf_valor_swing && r.darf_valor_swing > 0) ||
    (r.status_darf_day_trade?.toLowerCase() === "pendente" && r.darf_valor_day && r.darf_valor_day > 0)
  ).length

  const filteredData = useMemo(() => {
    return resultadosComAtualizacoes.filter(resultado => {
      // Primeiro, filtrar apenas linhas que têm impostos (DARF > 0 ou day trade com ganho > 0)
      const temImpostos = (resultado.darf_valor_swing && resultado.darf_valor_swing > 0) ||
                          (resultado.darf_valor_day && resultado.darf_valor_day > 0) ||
                          (resultado.ganho_liquido_day && resultado.ganho_liquido_day > 0);
      
      if (!temImpostos) return false;
      
      const matchesSearch = formatMonth(resultado.mes).toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      
      if (statusFilter === "all") return true;
      if (statusFilter === "isento") return resultado.isento_swing;
      if (statusFilter === "pago") return resultado.status_darf_swing_trade?.toLowerCase() === "pago" || resultado.status_darf_day_trade?.toLowerCase() === "pago";
      if (statusFilter === "pendente") return resultado.status_darf_swing_trade?.toLowerCase() === "pendente" || resultado.status_darf_day_trade?.toLowerCase() === "pendente";
      
      return true;
    });
  }, [resultadosComAtualizacoes, searchTerm, statusFilter])

  // Função melhorada: Renderizar badge de DARF com dropdown de ações
  const renderDarfBadge = (valor: number | null | undefined, status: string | null | undefined, tipo: string, yearMonth: string, darfType: 'swing' | 'daytrade') => {
    if (!valor || valor <= 0) {
      return <span className="text-xs text-muted-foreground">-</span>
    }

    const normalizedStatus = status?.toLowerCase() || 'pendente'
    
    const getBadgeConfig = (status: string) => {
      switch (status) {
        case 'pago':
          return {
            className: 'bg-green-100 text-green-800 border-green-300',
            icon: '✅',
            text: 'Pago',
            textColor: 'text-green-700'
          }
        case 'pendente':
          return {
            className: 'bg-orange-100 text-orange-800 border-orange-300',
            icon: '⏰',
            text: 'Pendente',
            textColor: 'text-orange-700'
          }
        case 'isento':
          return {
            className: 'bg-gray-100 text-gray-600 border-gray-300',
            icon: '🛡️',
            text: 'Isento',
            textColor: 'text-gray-600'
          }
        default:
          return {
            className: 'bg-orange-100 text-orange-800 border-orange-300',
            icon: '⏰',
            text: 'Pendente',
            textColor: 'text-orange-700'
          }
      }
    }

    const config = getBadgeConfig(normalizedStatus)
    const isUpdating = darfUpdating === `${yearMonth}-${darfType}`;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1">
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${config.className}`}>
            <span>{config.icon}</span>
            <span>{formatCurrency(valor)}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100"
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <div className="animate-spin text-xs">⏳</div>
                ) : (
                  <MoreVertical className="h-3 w-3" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => handleOpenDarfModal(resultadosComAtualizacoes.find(r => r.mes === yearMonth)!)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <Eye className="h-4 w-4" />
                Ver Detalhes do DARF
              </DropdownMenuItem>
              {normalizedStatus === 'pendente' ? (
                <DropdownMenuItem
                  onClick={() => handleToggleDarfStatus(yearMonth, darfType, normalizedStatus)}
                  className="flex items-center gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <CheckCheck className="h-4 w-4" />
                  Marcar como Pago
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleToggleDarfStatus(yearMonth, darfType, normalizedStatus)}
                  className="flex items-center gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Marcar como Pendente
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Texto removido conforme solicitado */}
      </div>
    )
  }

  if (resultados.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <Receipt className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Impostos sobre suas Operações</CardTitle>
          <CardDescription>Acompanhe o que precisa ser pago de imposto de renda</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-base mb-2">Nenhum resultado de imposto calculado ainda.</p>
            <p className="text-sm">Faça algumas operações para ver os cálculos aqui.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-8">
        {/* Resumo Principal */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-orange-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-red-800">Para Pagar</CardTitle>
              <div className="p-2 bg-red-200 rounded-lg">
                <CreditCard className="h-5 w-5 text-red-700" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900">{formatCurrency(totalIRDevido)}</div>
              <p className="text-xs text-red-600 mt-1">IR sobre day trade</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-blue-800">Vendas Este Mês</CardTitle>
              <div className="p-2 bg-blue-200 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-700" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(totalVendasMesAtual)}</div>
              <p className="text-xs text-blue-600 mt-1">
                {totalVendasMesAtual > 20000 ? "⚠️ Acima da isenção" : "✅ Dentro da isenção"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-green-800">Meses Isentos</CardTitle>
              <div className="p-2 bg-green-200 rounded-lg">
                <Shield className="h-5 w-5 text-green-700" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{mesesIsentos}</div>
              <p className="text-xs text-green-600 mt-1">De {resultados.length} meses</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-yellow-50 to-orange-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-orange-800">DARFs Pendentes</CardTitle>
              <div className="p-2 bg-orange-200 rounded-lg">
                <Timer className="h-5 w-5 text-orange-700" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">{darfsPendentes}</div>
              <p className="text-xs text-orange-600 mt-1">Precisam ser pagos</p>
            </CardContent>
          </Card>
        </div>

        {/* Seção Educativa - Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="como-funciona-imposto" className="border border-blue-200 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-800 text-lg">
                  Como Funciona o Imposto sobre Ações
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <p className="text-blue-600 mb-4">
                Regras simples para entender sua tributação
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-white rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Target className="h-4 w-4 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-blue-800">Swing Trade (Normal)</h4>
                  </div>
                  <div className="space-y-2 text-sm text-blue-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span><strong>Isenção:</strong> Até R$ 20.000 em vendas/mês</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calculator className="h-3 w-3 text-blue-600" />
                      <span><strong>Imposto:</strong> 15% sobre lucros acima da isenção</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-purple-600" />
                      <span><strong>Declaração:</strong> Anual no IR</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-orange-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Zap className="h-4 w-4 text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-orange-800">Day Trade</h4>
                  </div>
                  <div className="space-y-2 text-sm text-orange-700">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-red-600" />
                      <span><strong>Imposto:</strong> 20% sobre TODOS os lucros</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3 text-orange-600" />
                      <span><strong>DARF:</strong> Mensal até último dia útil</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Info className="h-3 w-3 text-blue-600" />
                      <span><strong>IRRF:</strong> 1% retido automaticamente</span>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* DARFs Pendentes */}
        {darfsPendentes > 0 && (
          <Card className="border-0 shadow-sm bg-gradient-to-r from-red-50 to-orange-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5" />
                Ação Necessária: {darfsPendentes} DARF{darfsPendentes > 1 ? 'S' : ''} Pendente{darfsPendentes > 1 ? 's' : ''}
              </CardTitle>
              <CardDescription className="text-red-600">
                Pague até o último dia útil do mês seguinte para evitar multa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {resultadosComAtualizacoes
                  .filter((r) => 
                    (r.status_darf_day_trade?.toLowerCase() === "pendente" && r.darf_valor_day && r.darf_valor_day > 0) ||
                    (r.status_darf_swing_trade?.toLowerCase() === "pendente" && r.darf_valor_swing && r.darf_valor_swing > 0)
                  )
                  .map((resultado) => (
                    <Alert key={resultado.mes} className="border-red-200">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <div className="font-semibold text-red-800">
                              {formatMonth(resultado.mes)}
                            </div>
                            <div className="text-sm text-red-600">
                              {resultado.darf_valor_day > 0 && `Day Trade: ${formatCurrency(resultado.darf_valor_day)}`}
                              {resultado.darf_valor_swing > 0 && ` | Swing: ${formatCurrency(resultado.darf_valor_swing)}`}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenDarfModal(resultado)}
                              className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver Detalhes
                            </Button>
                            {resultado.status_darf_day_trade?.toLowerCase() === 'pendente' && resultado.darf_valor_day > 0 && (
                              <Button
                                size="sm"
                                onClick={() => handleToggleDarfStatus(resultado.mes, 'daytrade', resultado.status_darf_day_trade)}
                                disabled={darfUpdating === `${resultado.mes}-daytrade`}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {darfUpdating === `${resultado.mes}-daytrade` ? "..." : "✓ Pagar DT"}
                              </Button>
                            )}
                            {resultado.status_darf_swing_trade?.toLowerCase() === 'pendente' && resultado.darf_valor_swing > 0 && (
                              <Button
                                size="sm"
                                onClick={() => handleToggleDarfStatus(resultado.mes, 'swing', resultado.status_darf_swing_trade)}
                                disabled={darfUpdating === `${resultado.mes}-swing`}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {darfUpdating === `${resultado.mes}-swing` ? "..." : "✓ Pagar ST"}
                              </Button>
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

        {/* Tabela Principal */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-white" />
                <div>
                  <h2 className="text-xl font-bold">
                    Histórico Mensal de Impostos
                  </h2>
                  <p className="text-orange-100 text-sm">
                    Clique nos badges para alterar status ou ver detalhes completos
                  </p>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                <span className="text-white font-semibold">{filteredData.length} meses</span>
              </div>
            </div>
          </div>
          
          {/* Filtros */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-orange-50">
            <div className="flex flex-col sm:flex-row gap-4">
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
                    placeholder="Digite o mês (ex: Jan/2024)"
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
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="pago">Pagos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {searchTerm && (
              <div className="mt-3 p-3 bg-orange-100 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  <span className="font-semibold">{filteredData.length}</span> resultados encontrados para "{searchTerm}"
                </p>
              </div>
            )}
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto rounded-lg border-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Mês</TableHead>
                  <TableHead className="text-right font-semibold">Vendas Swing</TableHead>
                  <TableHead className="text-center font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Day Trade</TableHead>
                  <TableHead className="text-center font-semibold">DARF Swing</TableHead>
                  <TableHead className="text-center font-semibold">DARF Day Trade</TableHead>
                  <TableHead className="text-center font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum resultado encontrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((resultado) => (
                    <TableRow key={resultado.mes} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{formatMonth(resultado.mes)}</TableCell>
                      <TableCell className="text-right">
                        <div>
                          <div className="font-medium">{formatCurrency(resultado.vendas_swing)}</div>
                          <div className="text-xs text-muted-foreground">
                            {resultado.vendas_swing > 20000 ? "Acima R$ 20k" : "Abaixo R$ 20k"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={resultado.isento_swing ? "default" : "destructive"}>
                          {resultado.isento_swing ? "Isento" : "Tributável"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`font-medium ${resultado.ganho_liquido_day >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(resultado.ganho_liquido_day)}
                        </div>
                      </TableCell>
                      
                      {/* DARF Swing Trade com Dropdown */}
                      <TableCell className="text-center">
                        {renderDarfBadge(
                          resultado.darf_valor_swing || 0,
                          resultado.status_darf_swing_trade || 'isento',
                          'Swing',
                          resultado.mes,
                          'swing'
                        )}
                      </TableCell>
                      
                      {/* DARF Day Trade com Dropdown */}
                      <TableCell className="text-center">
                        {renderDarfBadge(
                          resultado.darf_valor_day || 0,
                          resultado.status_darf_day_trade || 'isento',
                          'Day',
                          resultado.mes,
                          'daytrade'
                        )}
                      </TableCell>

                      {/* Coluna de Ações - Botão para abrir modal */}
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDarfModal(resultado)}
                          className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 hover:text-blue-800"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Detalhar DARF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Dicas Importantes - Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="dicas-importantes" className="border border-amber-200 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-600" />
                <span className="font-semibold text-amber-800 text-lg">
                  Dicas Importantes
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span><strong>Ver Detalhes:</strong> Clique em "Detalhes" ou no menu (⋮) dos badges para análise completa do DARF</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span><strong>Gerenciar Status:</strong> Use os menus dos badges para alterar status entre Pago e Pendente</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span><strong>Prejuízos compensam:</strong> Losses em swing trade ou day trade podem ser usados para reduzir impostos futuros do mesmo tipo</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span><strong>Procure ajuda:</strong> Para carteiras grandes ou situações complexas, considere contratar um contador especializado</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Modal de Detalhes do DARF */}
      {isDarfModalOpen && selectedResultado && (
        (() => {
          // Debug: logar dados enviados ao modal
          // eslint-disable-next-line no-console
          console.log('[DEBUG] Abrindo DarfDetailsModal:', {
            resultadoMensal: selectedResultado,
            operacoesFechadas,
          });
          return (
            <DarfDetailsModal
              isOpen={isDarfModalOpen}
              onClose={() => setIsDarfModalOpen(false)}
              resultadoMensal={selectedResultado}
              operacoesFechadas={operacoesFechadas}
              onDarfStatusChange={handleDarfStatusChangeFromModal}
              onUpdateDashboard={onUpdate}
              tipoDarf="swing" // Default para swing, mas modal mostrará ambos quando usando ResultadoMensal
            />
          );
        })()
      )}
    </>
  )
}
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
    console.log('🔄 [SYNC] Modal atualizou status:', { yearMonth, type, newStatus });
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

  // Calcular próximo vencimento DARF
  const getProximoVencimento = () => {
    const darfsPendentesComVencimento = resultadosComAtualizacoes.filter(r => 
      ((r.status_darf_swing_trade?.toLowerCase() === "pendente" && r.darf_valor_swing && r.darf_valor_swing > 0) ||
       (r.status_darf_day_trade?.toLowerCase() === "pendente" && r.darf_valor_day && r.darf_valor_day > 0))
    ).map(r => {
      // Calcular vencimento (último dia útil do mês seguinte)
      const [ano, mes] = r.mes.split('-').map(Number);
      let proxMes = mes + 1;
      let proxAno = ano;
      if (proxMes > 12) {
        proxMes = 1;
        proxAno += 1;
      }
      const ultimoDia = new Date(proxAno, proxMes, 0).getDate();
      const vencimento = new Date(proxAno, proxMes - 1, ultimoDia);
      while (vencimento.getDay() === 0 || vencimento.getDay() === 6) {
        vencimento.setDate(vencimento.getDate() - 1);
      }
      return { ...r, vencimento };
    });

    return darfsPendentesComVencimento.length > 0 
      ? darfsPendentesComVencimento.sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0]
      : null;
  };

  const proximoVencimento = getProximoVencimento();
  const totalPendente = resultadosComAtualizacoes.reduce((sum, r) => {
    let valor = 0;
    if (r.status_darf_swing_trade?.toLowerCase() === "pendente" && r.darf_valor_swing > 0) valor += r.darf_valor_swing;
    if (r.status_darf_day_trade?.toLowerCase() === "pendente" && r.darf_valor_day > 0) valor += r.darf_valor_day;
    return sum + valor;
  }, 0);

  const totalPagos = resultadosComAtualizacoes.filter(r => 
    (r.status_darf_swing_trade?.toLowerCase() === "pago" && r.darf_valor_swing > 0) ||
    (r.status_darf_day_trade?.toLowerCase() === "pago" && r.darf_valor_day > 0)
  ).length;

  return (
    <>
      <div className="space-y-6">
        {/* 💰 Situação Fiscal - Cards Objetivos */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-red-500 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-800">{darfsPendentes} Pendentes</p>
                  <p className="text-xl font-bold text-red-900">{formatCurrency(totalPendente)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-800">Próximo Vence</p>
                  <p className="text-lg font-bold text-orange-900">
                    {proximoVencimento 
                      ? proximoVencimento.vencimento.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                      : "Nenhum"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">{mesesIsentos} Isentos</p>
                  <p className="text-lg font-bold text-green-900">R$ 0,00</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">{totalPagos} Pagos</p>
                  <p className="text-lg font-bold text-blue-900">Em dia</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 📊 Tabela Objetiva - Histórico Mensal */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6" />
                <div>
                  <CardTitle className="text-lg font-semibold">Histórico Mensal de Impostos</CardTitle>
                  <CardDescription className="text-blue-100 text-sm">
                    Seus DARFs organizados por mês - clique em "Ver DARF" para detalhes completos
                  </CardDescription>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
                <span className="text-white font-semibold text-sm">{filteredData.length} meses</span>
              </div>
            </div>
          </CardHeader>

          {/* Filtros Simplificados */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar mês (ex: Jan/2024)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-40">
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="pago">Pagos</SelectItem>
                    <SelectItem value="isento">Isentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Nova Tabela Objetiva */}
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="font-semibold text-gray-700 px-6 py-4">Mês</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-right px-4 py-4">Valor Total</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-center px-4 py-4">Vencimento</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-center px-4 py-4">Status</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-center px-4 py-4">Tipo</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-center px-6 py-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                      <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
                      <p className="text-lg">Nenhum resultado encontrado</p>
                      {searchTerm && <p className="text-sm mt-1">Tente alterar os filtros ou termo de busca</p>}
                    </TableCell>
                  </TableRow>
                ) : (
                  // Ordenação inteligente: Pendentes primeiro, depois por data (mais recente primeiro)
                  filteredData
                    .sort((a, b) => {
                      // Calcular se tem DARF pendente
                      const aPendente = (a.status_darf_swing_trade?.toLowerCase() === "pendente" && a.darf_valor_swing > 0) ||
                                       (a.status_darf_day_trade?.toLowerCase() === "pendente" && a.darf_valor_day > 0);
                      const bPendente = (b.status_darf_swing_trade?.toLowerCase() === "pendente" && b.darf_valor_swing > 0) ||
                                       (b.status_darf_day_trade?.toLowerCase() === "pendente" && b.darf_valor_day > 0);
                      
                      // Pendentes primeiro
                      if (aPendente && !bPendente) return -1;
                      if (!aPendente && bPendente) return 1;
                      
                      // Dentro do mesmo grupo, mais recente primeiro
                      return b.mes.localeCompare(a.mes);
                    })
                    .map((resultado) => {
                      // Calcular valores para exibição
                      const valorTotal = (resultado.darf_valor_swing || 0) + (resultado.darf_valor_day || 0);
                      const temSwing = resultado.darf_valor_swing > 0;
                      const temDay = resultado.darf_valor_day > 0;
                      const temPendente = (resultado.status_darf_swing_trade?.toLowerCase() === "pendente" && resultado.darf_valor_swing > 0) ||
                                         (resultado.status_darf_day_trade?.toLowerCase() === "pendente" && resultado.darf_valor_day > 0);
                      const temPago = (resultado.status_darf_swing_trade?.toLowerCase() === "pago" && resultado.darf_valor_swing > 0) ||
                                     (resultado.status_darf_day_trade?.toLowerCase() === "pago" && resultado.darf_valor_day > 0);
                      
                      // Calcular vencimento
                      const [ano, mes] = resultado.mes.split('-').map(Number);
                      let proxMes = mes + 1;
                      let proxAno = ano;
                      if (proxMes > 12) { proxMes = 1; proxAno += 1; }
                      const ultimoDia = new Date(proxAno, proxMes, 0).getDate();
                      const vencimento = new Date(proxAno, proxMes - 1, ultimoDia);
                      while (vencimento.getDay() === 0 || vencimento.getDay() === 6) {
                        vencimento.setDate(vencimento.getDate() - 1);
                      }
                      
                      // Determinar status geral
                      let statusGeral = "Isento";
                      let statusColor = "text-gray-600 bg-gray-100";
                      let statusIcon = "🛡️";
                      
                      if (valorTotal > 0) {
                        if (temPendente) {
                          statusGeral = "Pendente";
                          statusColor = "text-red-700 bg-red-100 border-red-200";
                          statusIcon = "⏰";
                          // Verificar urgência
                          const diasParaVencimento = Math.ceil((vencimento.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          if (diasParaVencimento <= 7 && diasParaVencimento > 0) {
                            statusIcon = "⚠️";
                            statusColor = "text-red-800 bg-red-200 border-red-300";
                          } else if (diasParaVencimento <= 0) {
                            statusIcon = "🚨";
                            statusColor = "text-red-900 bg-red-300 border-red-400";
                          }
                        } else if (temPago) {
                          statusGeral = "Pago";
                          statusColor = "text-green-700 bg-green-100 border-green-200";
                          statusIcon = "✅";
                        }
                      }
                      
                      return (
                        <TableRow key={resultado.mes} className="hover:bg-gray-50 transition-colors">
                          {/* Mês */}
                          <TableCell className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {temPendente && <span className="text-red-500">🔴</span>}
                              <span className="font-medium text-gray-900">{formatMonth(resultado.mes)}</span>
                            </div>
                          </TableCell>

                          {/* Valor Total */}
                          <TableCell className="px-4 py-4 text-right">
                            <div className="space-y-1">
                              <div className={`font-semibold ${valorTotal > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                {formatCurrency(valorTotal)}
                              </div>
                              {valorTotal > 0 && (
                                <div className="text-xs text-gray-500">
                                  {temSwing && temDay ? "ST + DT" : temSwing ? "Swing Trade" : "Day Trade"}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Vencimento */}
                          <TableCell className="px-4 py-4 text-center">
                            {valorTotal > 0 && statusGeral === "Pendente" ? (
                              <div className="text-sm">
                                <div className="font-medium text-gray-700">
                                  {vencimento.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {(() => {
                                    const dias = Math.ceil((vencimento.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                    if (dias < 0) return `${Math.abs(dias)} dias atrasado`;
                                    if (dias === 0) return "Vence hoje";
                                    if (dias === 1) return "Vence amanhã";
                                    return `${dias} dias`;
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell className="px-4 py-4 text-center">
                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${statusColor}`}>
                              <span>{statusIcon}</span>
                              <span>{statusGeral}</span>
                            </div>
                          </TableCell>

                          {/* Tipo */}
                          <TableCell className="px-4 py-4 text-center">
                            <div className="flex justify-center gap-1">
                              {temSwing && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                  ST
                                </span>
                              )}
                              {temDay && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                                  DT
                                </span>
                              )}
                              {!temSwing && !temDay && (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Ações */}
                          <TableCell className="px-6 py-4 text-center">
                            {valorTotal > 0 ? (
                              <div className="flex justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDarfModal(resultado)}
                                  className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 text-xs"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Ver DARF
                                </Button>
                                {statusGeral === "Pendente" && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      // Marcar como pago o primeiro tipo encontrado
                                      if (resultado.status_darf_swing_trade?.toLowerCase() === "pendente" && resultado.darf_valor_swing > 0) {
                                        handleToggleDarfStatus(resultado.mes, 'swing', resultado.status_darf_swing_trade);
                                      } else if (resultado.status_darf_day_trade?.toLowerCase() === "pendente" && resultado.darf_valor_day > 0) {
                                        handleToggleDarfStatus(resultado.mes, 'daytrade', resultado.status_darf_day_trade);
                                      }
                                    }}
                                    disabled={darfUpdating?.startsWith(resultado.mes)}
                                    className="bg-green-600 hover:bg-green-700 text-xs"
                                  >
                                    {darfUpdating?.startsWith(resultado.mes) ? (
                                      <div className="flex items-center gap-1">
                                        <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                                        <span>...</span>
                                      </div>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Pagar
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 💡 Dicas Rápidas */}
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-amber-800">Dicas Rápidas</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3 text-sm text-amber-700">
            <div className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span><strong>"Ver DARF"</strong> mostra como calculamos cada centavo</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              <span><strong>Botão "Pagar"</strong> marca como pago (não efetua pagamento)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-500">•</span>
              <span><strong>Prejuízos compensam</strong> automaticamente nos cálculos</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span><strong>Em dúvida?</strong> Consulte um contador especializado</span>
            </div>
          </div>
        </div>
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
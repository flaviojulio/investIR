"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Search, ArrowDown, ArrowUp } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { Operacao, Corretora } from "@/lib/types"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"

interface OperationsHistoryProps {
  operacoes: Operacao[]
  onUpdate: () => void
}

export function OperationsHistory({ operacoes, onUpdate }: OperationsHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterOperation, setFilterOperation] = useState("all")
  const [loading, setLoading] = useState<number | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false); // State for bulk delete
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [corretoras, setCorretoras] = useState<Corretora[]>([])
  const { toast } = useToast()

  useEffect(() => {
    api.get<Corretora[]>("/corretoras")
      .then(res => setCorretoras(res.data))
      .catch(() => setCorretoras([]))
  }, [])

  // Função para mapear campos em português para o padrão esperado
  function mapOperacaoCampos(operacao: any): Operacao {
    return {
      id: operacao.id,
      date: operacao.date || operacao["Data do Negócio"],
      ticker: operacao.ticker || operacao["Código de Negociação"],
      operation: operacao.operation || operacao["Tipo de Movimentação"],
      quantity: operacao.quantity ?? operacao["Quantidade"],
      price: operacao.price ?? operacao["Preço"],
      fees: operacao.fees ?? operacao["Taxas"] ?? 0,
      corretora_id: operacao.corretora_id ?? null,
      corretora_nome: operacao.corretora_nome ?? null,
      usuario_id: operacao.usuario_id ?? null,
    };
  }

  // Mapeia todas as operações recebidas
  const operacoesPadronizadas = operacoes.map(mapOperacaoCampos);
  console.log('Operacoes padronizadas:', operacoesPadronizadas);

  const filteredOperations = operacoesPadronizadas.filter((op) => {
    const lowerSearch = (searchTerm || "").toLowerCase();
    const ticker = typeof op.ticker === "string" ? op.ticker : "";
    const corretoraNome = typeof op.corretora_nome === "string" ? op.corretora_nome : "";
    const operation = typeof op.operation === "string" ? op.operation : "";
    const matchesTicker = ticker.toLowerCase().includes(lowerSearch);
    const matchesCorretora = corretoraNome.toLowerCase().includes(lowerSearch);
    const matchesOperation = operation === "buy"
      ? "compra".includes(lowerSearch)
      : "venda".includes(lowerSearch) || operation.toLowerCase().includes(lowerSearch);
    const matchesQuantity = String(op.quantity).includes(lowerSearch);
    const matchesPrice = String(op.price).includes(lowerSearch);
    const matchesFees = String(op.fees).includes(lowerSearch);
    // Permite busca por data (formato brasileiro)
    const matchesDate = op.date && new Date(op.date).toLocaleDateString("pt-BR").includes(lowerSearch);
    return (
      !searchTerm ||
      matchesTicker ||
      matchesCorretora ||
      matchesOperation ||
      matchesQuantity ||
      matchesPrice ||
      matchesFees ||
      matchesDate
    ) && (filterOperation === "all" || operation === filterOperation);
  })

  console.log('Operacoes recebidas (props):', operacoes);
  console.log('Operacoes filtradas:', filteredOperations);

  const handleDelete = async (operationId: number) => {
    if (!confirm("Tem certeza que deseja excluir esta operação?")) return

    setLoading(operationId)
    try {
      await api.delete(`/operacoes/${operationId}`)
      toast({
        title: "Sucesso!",
        description: "Operação excluída com sucesso",
      })
      onUpdate()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.detail || "Erro ao excluir operação",
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  const handleBulkDelete = async () => {
    setShowBulkDeleteModal(false);
    setBulkDeleting(true);
    try {
      const response = await api.delete("/bulk-ops/operacoes/delete-all");
      toast({
        title: "Sucesso!",
        description: response.data.mensagem || "Todas as operações foram excluídas.",
      });
      onUpdate();
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;
      toast({
        title: "Erro",
        description: errorDetail || "Erro ao excluir operações.",
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Estado para ordenação
  const [sortField, setSortField] = useState<'date' | 'total'>("date");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>("desc");

  // Função para alternar ordenação
  function handleSort(field: 'date' | 'total') {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "date" ? "desc" : "asc"); // Data começa desc, total asc
    }
  }

  // Ordena operações filtradas
  const sortedOperations = [...filteredOperations].sort((a, b) => {
    if (sortField === "date") {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    } else {
      // total = quantity * price (+/- fees)
      const totalA = a.quantity * a.price + (a.operation === "buy" ? a.fees : -a.fees);
      const totalB = b.quantity * b.price + (b.operation === "buy" ? b.fees : -b.fees);
      return sortDirection === "asc" ? totalA - totalB : totalB - totalA;
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Operações</CardTitle>
        <CardDescription>Todas as suas operações registradas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <Select value={filterOperation} onValueChange={setFilterOperation}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="buy">Compras</SelectItem>
                <SelectItem value="sell">Vendas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk Delete Button */}
        <div className="mt-4">
          <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={bulkDeleting || operacoes.length === 0}
                className="w-full sm:w-auto"
              >
                Excluir Todas as Operações
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                  <DialogTitle className="text-red-700">Excluir todas as operações?</DialogTitle>
                </div>
                <DialogDescription>
                  Esta ação <span className="font-bold text-red-600">não pode ser desfeita</span>.<br />
                  Todas as operações, proventos e resultados relacionados serão removidos permanentemente.
                  Tem certeza que deseja continuar?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowBulkDeleteModal(false)} disabled={bulkDeleting}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
                  {bulkDeleting ? "Excluindo..." : "Excluir tudo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto mt-4"> {/* Added mt-4 for spacing */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort('date')} className="cursor-pointer select-none">
                  Data {sortField === 'date' && (sortDirection === 'asc' ? <ArrowUp className="inline w-3 h-3" /> : <ArrowDown className="inline w-3 h-3" />)}
                </TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Taxas</TableHead>
                <TableHead onClick={() => handleSort('total')} className="text-right cursor-pointer select-none">
                  Total {sortField === 'total' && (sortDirection === 'asc' ? <ArrowUp className="inline w-3 h-3" /> : <ArrowDown className="inline w-3 h-3" />)}
                </TableHead>
                <TableHead>Corretora</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOperations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {operacoes.length === 0
                      ? "Nenhuma operação encontrada. Adicione operações para vê-las aqui."
                      : "Nenhuma operação corresponde aos filtros aplicados."}
                  </TableCell>
                </TableRow>
              ) : (
                sortedOperations.map((operacao) => {
                  console.log('Renderizando operacao:', operacao);
                  const total = operacao.quantity * operacao.price
                  const totalWithFees = operacao.operation === "buy" ? total + operacao.fees : total - operacao.fees

                  // Busca nome da corretora (cache local)
                  const corretora = corretoras?.find(c => c.id === operacao.corretora_id)

                  return (
                    <TableRow key={operacao.id}>
                      <TableCell>{formatDate(operacao.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{operacao.ticker}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={operacao.operation === "buy" ? "default" : "secondary"}>
                          {operacao.operation === "buy" ? "Compra" : "Venda"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{typeof operacao.quantity === "number" ? operacao.quantity.toLocaleString("pt-BR") : (operacao.quantity ?? "-")}</TableCell>
                      <TableCell className="text-right">{formatCurrency(operacao.price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(operacao.fees)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(totalWithFees)}</TableCell>
                      <TableCell>{operacao.corretora_nome || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(operacao.id)}
                          disabled={loading === operacao.id}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Resumo */}
        {filteredOperations.length > 0 && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="font-medium text-muted-foreground">Total de Operações</div>
                <div className="text-lg font-bold">{filteredOperations.length}</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-muted-foreground">Compras</div>
                <div className="text-lg font-bold text-green-600">
                  {filteredOperations.filter((op) => op.operation === "buy").length}
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium text-muted-foreground">Vendas</div>
                <div className="text-lg font-bold text-red-600">
                  {filteredOperations.filter((op) => op.operation === "sell").length}
                </div>
              </div>
              <div className="text-center">
                <div className="font-medium text-muted-foreground">Volume Total</div>
                <div className="text-lg font-bold">
                  {formatCurrency(filteredOperations.reduce((sum, op) => sum + op.quantity * op.price, 0))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Search } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { Operacao } from "@/lib/types"

interface OperationsHistoryProps {
  operacoes: Operacao[]
  onUpdate: () => void
}

export function OperationsHistory({ operacoes, onUpdate }: OperationsHistoryProps) {
  const [searchTicker, setSearchTicker] = useState("")
  const [filterOperation, setFilterOperation] = useState("all")
  const [loading, setLoading] = useState<number | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false); // State for bulk delete
  const { toast } = useToast()

  const filteredOperations = operacoes.filter((op) => {
    const matchesTicker = !searchTicker || op.ticker.toLowerCase().includes(searchTicker.toLowerCase())
    const matchesOperation = filterOperation === "all" || op.operation === filterOperation
    return matchesTicker && matchesOperation
  })

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
    if (!confirm("Tem certeza que deseja excluir TODAS as operações? Esta ação não pode ser desfeita.")) {
      return;
    }

    setBulkDeleting(true);
    try {
      const response = await api.delete("/bulk-ops/operacoes/delete-all"); // Changed path to new prefix
      toast({
        title: "Sucesso!",
        description: response.data.mensagem || "Todas as operações foram excluídas.",
      });
      onUpdate(); // Refresh data
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;
      let errorMessage = "Erro ao excluir todas as operações."; // Default message

      if (typeof errorDetail === 'string') {
        errorMessage = errorDetail;
      } else if (Array.isArray(errorDetail) && errorDetail.length > 0) {
        // Handle array of error objects (e.g., FastAPI validation errors)
        const firstError = errorDetail[0];
        if (typeof firstError.msg === 'string') {
          errorMessage = firstError.msg;
        } else if (typeof firstError.message === 'string') {
          errorMessage = firstError.message;
        } else {
          errorMessage = "Não foi possível extrair uma mensagem específica do erro retornado pelo servidor (array).";
          console.error("Unknown error array item structure:", firstError);
        }
      } else if (typeof errorDetail === 'object' && errorDetail !== null) {
        // Handle single error object
        if (typeof errorDetail.msg === 'string') {
          errorMessage = errorDetail.msg;
        } else if (typeof errorDetail.message === 'string') {
          errorMessage = errorDetail.message;
        } else {
          errorMessage = "Não foi possível extrair uma mensagem específica do erro retornado pelo servidor (objeto).";
          console.error("Unknown error object structure:", errorDetail);
        }
      }
      // If errorDetail is none of the above (e.g. undefined), errorMessage remains the default.

      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

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
                placeholder="Buscar por ticker..."
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value)}
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
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={bulkDeleting || operacoes.length === 0}
            className="w-full sm:w-auto" // Full width on small screens, auto on larger
          >
            {bulkDeleting ? "Excluindo..." : "Excluir Todas as Operações"}
          </Button>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto mt-4"> {/* Added mt-4 for spacing */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Taxas</TableHead>
                <TableHead>Corretora</TableHead> {/* Added Corretora Header */}
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOperations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground"> {/* Adjusted colSpan */}
                    {operacoes.length === 0
                      ? "Nenhuma operação encontrada. Adicione operações para vê-las aqui."
                      : "Nenhuma operação corresponde aos filtros aplicados."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOperations.map((operacao) => {
                  const total = operacao.quantity * operacao.price
                  const totalWithFees = operacao.operation === "buy" ? total + operacao.fees : total - operacao.fees

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
                      <TableCell className="text-right">{operacao.quantity.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{formatCurrency(operacao.price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(operacao.fees)}</TableCell>
                      <TableCell>{operacao.nome_corretora || 'N/A'}</TableCell> {/* Added Corretora Cell */}
                      <TableCell className="text-right font-medium">{formatCurrency(totalWithFees)}</TableCell>
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

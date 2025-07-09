"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Search, ArrowUpDown, AlertTriangle, Shield, FileX, Zap, Info } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { Operacao, Corretora } from "@/lib/types"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils"

interface OperationsHistoryProps {
  operacoes: Operacao[]
  onUpdate: () => void
}

type SortableKeys = 'date' | 'ticker' | 'operation' | 'quantity' | 'price' | 'fees' | 'total';

export function OperationsHistory({ operacoes, onUpdate }: OperationsHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterOperation, setFilterOperation] = useState("all")
  const [loading, setLoading] = useState<number | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [showSingleDeleteModal, setShowSingleDeleteModal] = useState(false)
  const [operationToDelete, setOperationToDelete] = useState<Operacao | null>(null)
  const [corretoras, setCorretoras] = useState<Corretora[]>([])
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'descending' })
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

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const filteredOperations = useMemo(() => {
    return operacoesPadronizadas.filter((op) => {
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
    });
  }, [operacoesPadronizadas, searchTerm, filterOperation]);

  const sortedOperations = useMemo(() => {
    if (!sortConfig) return filteredOperations;

    let sortableItems = [...filteredOperations];

    sortableItems.sort((a, b) => {
      let aValue: any, bValue: any;

      if (sortConfig.key === 'total') {
        aValue = a.quantity * a.price + (a.operation === "buy" ? a.fees : -a.fees);
        bValue = b.quantity * b.price + (b.operation === "buy" ? b.fees : -b.fees);
      } else {
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
      }

      // Handle null or undefined values
      if (aValue === null || aValue === undefined) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      if (bValue === null || bValue === undefined) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue);
      }

      // For date strings (YYYY-MM-DD), direct string comparison works for sorting
      return String(aValue).localeCompare(String(bValue));
    });

    // Apply direction after sorting
    if (sortConfig.direction === 'descending') {
      sortableItems.reverse();
    }

    return sortableItems;
  }, [filteredOperations, sortConfig]);

  // Modal de confirmação para operação individual - MODERNIZADO
  const handleSingleDeleteClick = (operacao: Operacao) => {
    setOperationToDelete(operacao);
    setShowSingleDeleteModal(true);
  };

  const handleSingleDelete = async () => {
    if (!operationToDelete) return;

    setShowSingleDeleteModal(false);
    setLoading(operationToDelete.id);
    
    try {
      await api.delete(`/operacoes/${operationToDelete.id}`);
      
      // Toast de sucesso modernizado
      toast({
        title: "✅ Operação removida!",
        description: `${operationToDelete.ticker} (${operationToDelete.operation === "buy" ? "Compra" : "Venda"}) foi excluída com sucesso.`,
        className: "bg-green-50 border-green-200 text-green-800",
      });
      
      onUpdate();
      setOperationToDelete(null);
    } catch (error: any) {
      // Toast de erro modernizado
      toast({
        title: "❌ Erro ao remover",
        description: error.response?.data?.detail || "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleBulkDelete = async () => {
    setShowBulkDeleteModal(false);
    setBulkDeleting(true);
    
    try {
      const response = await api.delete("/bulk-ops/operacoes/delete-all");
      
      // Toast de sucesso para exclusão em massa
      toast({
        title: "🗑️ Limpeza completa!",
        description: response.data.mensagem || "Todas as operações foram removidas com sucesso.",
        className: "bg-blue-50 border-blue-200 text-blue-800",
      });
      
      onUpdate();
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;
      toast({
        title: "❌ Erro na exclusão",
        description: errorDetail || "Erro ao remover operações. Tente novamente.",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-red-800",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Configuration for table headers
  const headerConfig: { key?: SortableKeys; label: string; className?: string; isSortable: boolean }[] = [
    { key: 'date', label: 'Data', isSortable: true },
    { key: 'ticker', label: 'Ticker', isSortable: true },
    { key: 'operation', label: 'Tipo', isSortable: true },
    { key: 'quantity', label: 'Quantidade', className: 'text-right', isSortable: true },
    { key: 'price', label: 'Preço', className: 'text-right', isSortable: true },
    { key: 'fees', label: 'Taxas', className: 'text-right hidden sm:table-cell', isSortable: true },
    { key: 'total', label: 'Total', className: 'text-right', isSortable: true },
    { label: 'Corretora', className: 'hidden lg:table-cell', isSortable: false },
    { label: 'Ações', className: 'text-center', isSortable: false },
  ];

  if (!operacoesPadronizadas || operacoesPadronizadas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Operações</CardTitle>
          <CardDescription>Todas as suas operações registradas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
              <FileX className="h-12 w-12 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-gray-800 mb-2">Nenhuma operação encontrada</p>
            <p className="text-muted-foreground">Adicione operações para vê-las aqui.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header moderno com gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6 text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Search className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Histórico de Operações</h1>
          </div>
          <p className="text-blue-100 text-sm">
            Visualize e gerencie todas as suas operações registradas de forma inteligente
          </p>
        </div>
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
        <CardContent className="p-6 space-y-6">
          {/* Barra de busca e filtros modernizada */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 p-6 rounded-xl border border-blue-200 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-500" />
                  <Input
                    placeholder="Buscar por ticker, corretora, quantidade, preço, taxa ou data..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white dark:bg-gray-800 border-2 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-200 rounded-xl transition-all duration-300"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Select value={filterOperation} onValueChange={setFilterOperation}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-2 border-blue-200 focus:border-blue-500 rounded-xl">
                    <SelectValue placeholder="Filtrar por tipo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="buy">🟢 Compras</SelectItem>
                    <SelectItem value="sell">🔴 Vendas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Botão de exclusão em massa modernizado */}
          <div className="flex justify-end">
            <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={bulkDeleting || operacoes.length === 0}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  {bulkDeleting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Excluindo...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Excluir Todas
                    </div>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-gray-800">
                        Excluir todas as operações?
                      </DialogTitle>
                      <p className="text-sm text-gray-600 mt-1">Esta ação não pode ser desfeita</p>
                    </div>
                  </div>
                  <DialogDescription className="text-gray-700 leading-relaxed">
                    Você está prestes a <strong className="text-red-600">remover permanentemente</strong> todas as suas operações registradas.
                    <br /><br />
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-yellow-800">Isso também removerá:</span>
                      </div>
                      <ul className="text-sm text-yellow-700 space-y-1 ml-6">
                        <li>• Todos os proventos relacionados</li>
                        <li>• Resultados calculados automaticamente</li>
                        <li>• Histórico de performance</li>
                      </ul>
                    </div>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowBulkDeleteModal(false)} 
                    disabled={bulkDeleting}
                    className="flex-1 rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleBulkDelete} 
                    disabled={bulkDeleting}
                    className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl"
                  >
                    {bulkDeleting ? "Excluindo..." : "Confirmar Exclusão"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tabela modernizada */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-lg">
            <Table>
              <TableHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <TableRow className="border-b-2 border-blue-100 dark:border-blue-800">
                  {headerConfig.map((header) => (
                    <TableHead key={header.label} className={`${header.className} font-semibold text-gray-700 dark:text-gray-200`}>
                      {header.isSortable && header.key ? (
                        <Button 
                          variant="ghost" 
                          onClick={() => requestSort(header.key!)} 
                          className="h-auto p-0 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-semibold text-left w-full justify-start group"
                        >
                          <span className="text-xs sm:text-sm">{header.label}</span>
                          <ArrowUpDown className={`ml-2 h-3 w-3 transition-all duration-200 ${
                            sortConfig?.key === header.key 
                              ? 'opacity-100 text-blue-600 dark:text-blue-400' 
                              : 'opacity-0 group-hover:opacity-70'
                          }`} />
                        </Button>
                      ) : (
                        <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200">{header.label}</span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOperations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headerConfig.length} className="text-center py-12">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                          <Search className="h-8 w-8 text-gray-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-800 mb-1">Nenhuma operação encontrada</p>
                          <p className="text-muted-foreground text-sm">Ajuste os filtros ou adicione novas operações</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedOperations.map((operacao, index) => {
                    const total = operacao.quantity * operacao.price
                    const totalWithFees = operacao.operation === "buy" ? total + operacao.fees : total - operacao.fees

                    return (
                      <TableRow 
                        key={operacao.id}
                        className={`
                          transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 hover:shadow-sm
                          ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/30 dark:bg-gray-800/30'}
                        `}
                      >
                        <TableCell className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatDate(operacao.date)}
                        </TableCell>
                        <TableCell className="font-bold text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                          {operacao.ticker}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <span className={
                            operacao.operation === "buy" 
                              ? 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                              : 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }>
                            {operacao.operation === "buy" ? "🟢 Compra" : "🔴 Venda"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatNumber(operacao.quantity)}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(operacao.price)}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {formatCurrency(operacao.fees)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                          {formatCurrency(totalWithFees)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {operacao.corretora_nome || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSingleDeleteClick(operacao)}
                            disabled={loading === operacao.id}
                            className="h-9 w-9 p-0 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 rounded-lg group"
                          >
                            {loading === operacao.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent"></div>
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-500 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
              {/* Rodapé moderno com somatórios */}
              <tfoot className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20">
                <TableRow className="border-t-2 border-blue-100 dark:border-blue-800">
                  <TableCell colSpan={headerConfig.length} className="p-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-800 dark:to-indigo-800">
                      <div className="flex flex-col items-center justify-center py-4 px-3 bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20">
                        <span className="text-xs font-medium text-muted-foreground mb-1">Total de Operações</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{sortedOperations.length}</span>
                      </div>
                      <div className="flex flex-col items-center justify-center py-4 px-3 bg-gradient-to-br from-white to-green-50 dark:from-gray-800 dark:to-green-900/20">
                        <span className="text-xs font-medium text-muted-foreground mb-1">Compras</span>
                        <span className="text-lg font-bold text-green-700 dark:text-green-400">
                          {sortedOperations.filter((op) => op.operation === "buy").length}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center py-4 px-3 bg-gradient-to-br from-white to-red-50 dark:from-gray-800 dark:to-red-900/20">
                        <span className="text-xs font-medium text-muted-foreground mb-1">Vendas</span>
                        <span className="text-lg font-bold text-red-700 dark:text-red-400">
                          {sortedOperations.filter((op) => op.operation === "sell").length}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center py-4 px-3 bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-purple-900/20">
                        <span className="text-xs font-medium text-muted-foreground mb-1">Volume Total</span>
                        <span className="text-lg font-bold text-purple-700 dark:text-purple-400">
                          {formatCurrency(sortedOperations.reduce((sum, op) => sum + op.quantity * op.price, 0))}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              </tfoot>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de confirmação para operação individual - MODERNIZADO */}
      <Dialog open={showSingleDeleteModal} onOpenChange={setShowSingleDeleteModal}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-800">
                  Confirmar Exclusão
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-1">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            
            {operationToDelete && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  Operação a ser removida:
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ticker:</span>
                    <span className="font-semibold text-blue-600">{operationToDelete.ticker}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo:</span>
                    <span className={`font-semibold ${
                      operationToDelete.operation === "buy" ? "text-green-600" : "text-red-600"
                    }`}>
                      {operationToDelete.operation === "buy" ? "Compra" : "Venda"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quantidade:</span>
                    <span className="font-semibold text-gray-800">{formatNumber(operationToDelete.quantity)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Preço:</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(operationToDelete.price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data:</span>
                    <span className="font-semibold text-gray-800">{formatDate(operationToDelete.date)}</span>
                  </div>
                  <div className="border-t border-blue-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Valor Total:</span>
                      <span className="font-bold text-gray-900">
                        {formatCurrency(
                          operationToDelete.quantity * operationToDelete.price + 
                          (operationToDelete.operation === "buy" ? operationToDelete.fees : -operationToDelete.fees)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <DialogDescription className="text-gray-700 leading-relaxed mt-4">
              Tem certeza que deseja remover esta operação do seu histórico?
              <br /><br />
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-amber-800">Impactos da remoção:</span>
                </div>
                <ul className="text-sm text-amber-700 space-y-1 ml-6">
                  <li>• Recálculo automático da carteira</li>
                  <li>• Atualização dos resultados</li>
                  <li>• Ajuste nos impostos calculados</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowSingleDeleteModal(false);
                setOperationToDelete(null);
              }}
              className="flex-1 rounded-xl"
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleSingleDelete}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl"
            >
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
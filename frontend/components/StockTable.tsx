"use client"
import { useState, useEffect } from "react" // For modal and form state, added useEffect
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog" // Dialog components
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog" // AlertDialog components
import { Input } from "@/components/ui/input" // Input for form
import { Label } from "@/components/ui/label" // Label for form
import { TrendingUp, TrendingDown, Edit, Trash2, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react" // Edit, Trash2, and Sort icons
import Link from 'next/link'; // Import Link for navigation
import type { CarteiraItem } from "@/lib/types"
import { api } from "@/lib/api" // For API calls
import { useToast } from "@/hooks/use-toast" // For notifications
import { formatCurrency, formatNumber } from "@/lib/utils"; // Import centralized formatters

interface StockTableProps {
  carteira: CarteiraItem[]
  onUpdate: () => void
}

export function StockTable({ carteira, onUpdate }: StockTableProps) {
  const { toast } = useToast();
  const [editingItem, setEditingItem] = useState<CarteiraItem | null>(null);
  const [editFormData, setEditFormData] = useState({ quantidade: "", preco_medio: "" });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // State for delete confirmation
  const [deletingTicker, setDeletingTicker] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  // New state for sorting
  const [sortConfigST, setSortConfigST] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  
  // New state for search term
  const [searchTermST, setSearchTermST] = useState<string>("");
  
  // New state for data to be displayed in the table
  const [processedCarteira, setProcessedCarteira] = useState<CarteiraItem[]>(carteira); 

  useEffect(() => {
    // Augment items with values needed for sorting/filtering, especially calculated ones
    const augmentedCarteira = carteira.map(item => {
      const currentPrice = getSimulatedCurrentPrice(item.preco_medio); // Assume item.preco_medio é o PM de compra ou de venda
      const valorInicial = item.custo_total; // Para comprados: custo de aquisição. Para vendidos: valor recebido na venda.
      const valorDeMercadoAtualDaPosicao = item.quantidade * currentPrice; // Para comprados: positivo. Para vendidos: negativo.

      let resultadoDaPosicao;
      if (item.quantidade > 0) { // Posição Comprada
        resultadoDaPosicao = valorDeMercadoAtualDaPosicao - valorInicial;
      } else { // Posição Vendida (item.quantidade < 0)
        // Lucro = valor recebido na venda - custo de recompra
        // valorInicial (item.custo_total) é o valor recebido na venda (positivo)
        // valorDeMercadoAtualDaPosicao é o "valor de mercado da dívida" (negativo)
        // Ex: Vendi por 1000 (valorInicial). Devo ações que valem 950 (representado por valorDeMercadoAtualDaPosicao = -950).
        // Lucro = 1000 + (-950) = 50.
        resultadoDaPosicao = valorInicial + valorDeMercadoAtualDaPosicao;
      }

      const resultadoPercentualDaPosicao = valorInicial !== 0 ? (resultadoDaPosicao / Math.abs(valorInicial)) * 100 : 0; // Usar Math.abs(valorInicial) para base percentual

      return {
        ...item,
        _valorAtualCalculated: valorDeMercadoAtualDaPosicao, // Coluna "Valor Atual*"
        _resultadoAtualCalculated: resultadoDaPosicao, // Usado para ordenação da coluna de resultado e exibição
        _resultadoPercentualCalculated: resultadoPercentualDaPosicao, // Usado para ordenação e exibição
      };
    });

    let newProcessedData = [...augmentedCarteira];

    newProcessedData = newProcessedData.filter(item => item.quantidade !== 0);

    // 1. Filtering based on searchTermST
    if (searchTermST) {
      const lowercasedSearchTerm = searchTermST.toLowerCase();
      newProcessedData = newProcessedData.filter(item => {
        return (
          item.ticker.toLowerCase().includes(lowercasedSearchTerm) ||
          item.quantidade.toString().includes(lowercasedSearchTerm) ||
          item.custo_total.toString().includes(lowercasedSearchTerm) || 
          formatCurrency(item._valorAtualCalculated).toLowerCase().includes(lowercasedSearchTerm) || // Search formatted currency
          (item._resultadoPercentualCalculated.toFixed(2) + "%").toLowerCase().includes(lowercasedSearchTerm)
        );
      });
    }

    // 2. Sorting based on sortConfigST
    if (sortConfigST !== null) {
      newProcessedData.sort((a, b) => {
        const getSortValue = (item: any, key: string) => { // item is augmented type
          switch (key) {
            case 'ticker':
              return item.ticker.toLowerCase();
            case 'quantidade':
              return item.quantidade;
            case 'custo_total': // Valor Inicial
              return item.custo_total;
            case 'calculated_valorAtual':
              return item._valorAtualCalculated;
            case 'calculated_resultadoPercentual':
              return item._resultadoPercentualCalculated;
            default:
              // Should not happen if keys are correct, but good to have a fallback
              const val = item[key];
              return typeof val === 'string' ? val.toLowerCase() : val;
          }
        };

        const valA = getSortValue(a, sortConfigST.key);
        const valB = getSortValue(b, sortConfigST.key);

        let comparison = 0;
        if (valA === null || valA === undefined) comparison = -1; // Treat null/undefined as smaller
        else if (valB === null || valB === undefined) comparison = 1;
        else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB);
        }
        
        return sortConfigST.direction === 'descending' ? comparison * -1 : comparison;
      });
    }

    setProcessedCarteira(newProcessedData);
  }, [carteira, searchTermST, sortConfigST, formatCurrency]); // formatCurrency is stable if defined outside or memoized

  const requestSortST = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfigST && sortConfigST.key === key && sortConfigST.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfigST({ key, direction });
  };

  const handleOpenEditModal = (item: CarteiraItem) => {
    setEditingItem(item);
    setEditFormData({ 
      quantidade: String(item.quantidade), 
      preco_medio: String(item.preco_medio) 
    });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingItem(null);
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    const quantidade = parseFloat(editFormData.quantidade);
    const preco_medio = parseFloat(editFormData.preco_medio);

    if (isNaN(quantidade) || quantidade < 0) {
      toast({ title: "Erro de Validação", description: "Quantidade deve ser um número igual ou maior que zero.", variant: "destructive" });
      return;
    }
    if (isNaN(preco_medio) || preco_medio < 0) {
      toast({ title: "Erro de Validação", description: "Preço médio deve ser um número igual ou maior que zero.", variant: "destructive" });
      return;
    }
     if (quantidade === 0 && preco_medio !== 0) {
      toast({ title: "Erro de Validação", description: "Se a quantidade for zero, o preço médio também deve ser zero.", variant: "destructive" });
      return;
    }


    setIsSavingEdit(true);
    try {
      await api.put(`/carteira/${editingItem.ticker}`, {
        ticker: editingItem.ticker,
        quantidade: quantidade,
        preco_medio: preco_medio,
      });
      toast({ title: "Sucesso!", description: `Ação ${editingItem.ticker} atualizada.` });
      onUpdate();
      handleCloseEditModal();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.detail || "Erro ao atualizar item da carteira.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async (ticker: string) => {
    setIsDeleting(true);
    try {
      await api.delete(`/carteira/${ticker}`);
      toast({
        title: "Sucesso!",
        description: `Ação ${ticker} removida da carteira.`,
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.response?.data?.detail || `Erro ao remover ${ticker} da carteira.`,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteAlertOpen(false);
      setDeletingTicker(null);
    }
  };

  // Removed local formatCurrency and formatNumber definitions

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
        <CardDescription>Suas posições em ações com resultados atuais (simulados).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Buscar na carteira..."
            value={searchTermST}
            onChange={(e) => setSearchTermST(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => requestSortST('ticker')} className="cursor-pointer hover:bg-muted/50">
                  <div className="flex items-center">
                    Ação
                    {sortConfigST?.key === 'ticker' ? (
                      sortConfigST.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead onClick={() => requestSortST('quantidade')} className="cursor-pointer hover:bg-muted/50 text-right">
                  <div className="flex items-center justify-end">
                    Quantidade
                    {sortConfigST?.key === 'quantidade' ? (
                      sortConfigST.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-right">Preço Médio</TableHead> {/* Not sortable as per current instructions */}
                <TableHead onClick={() => requestSortST('custo_total')} className="cursor-pointer hover:bg-muted/50 text-right">
                  <div className="flex items-center justify-end">
                    Valor Inicial
                    {sortConfigST?.key === 'custo_total' ? (
                      sortConfigST.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-right">Preço Atual*</TableHead> {/* Not sortable */}
                <TableHead onClick={() => requestSortST('calculated_valorAtual')} className="cursor-pointer hover:bg-muted/50 text-right">
                  <div className="flex items-center justify-end">
                    Valor Atual*
                    {sortConfigST?.key === 'calculated_valorAtual' ? (
                      sortConfigST.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-right">Resultado*</TableHead> {/* Not sortable as per current instructions (absolute value) */}
                <TableHead onClick={() => requestSortST('calculated_resultadoPercentual')} className="cursor-pointer hover:bg-muted/50 text-right">
                  <div className="flex items-center justify-end">
                    Resultado (%)*
                    {sortConfigST?.key === 'calculated_resultadoPercentual' ? (
                      sortConfigST.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedCarteira.map((item) => { // Changed to map over processedCarteira
                // Utilizar os valores pré-calculados e corrigidos do useEffect
                const valorInicial = item.custo_total; // Mantém para clareza, ou pode ser removido se não usado diretamente abaixo
                const currentPrice = getSimulatedCurrentPrice(item.preco_medio); // Necessário para a coluna "Preço Atual*"
                const valorAtualDisplay = item._valorAtualCalculated; // Valor para a coluna "Valor Atual*"
                const resultadoAtualDisplay = item._resultadoAtualCalculated; // Valor para a coluna "Resultado*"
                const resultadoPercentualAtualDisplay = item._resultadoPercentualCalculated; // Valor para a coluna "Resultado (%)*"

                return (
                  <TableRow key={item.ticker}>
                    <TableCell className="font-medium">
                      <Link href={`/acao/${item.ticker}`} passHref>
                        <Badge variant="outline" className="hover:underline cursor-pointer">
                          {item.ticker}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(item.quantidade)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.preco_medio)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(valorInicial)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(currentPrice)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(valorAtualDisplay)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${resultadoAtualDisplay >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {resultadoAtualDisplay >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {formatCurrency(Math.abs(resultadoAtualDisplay))}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        resultadoPercentualAtualDisplay >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {resultadoPercentualAtualDisplay >= 0 ? "+" : ""}
                      {resultadoPercentualAtualDisplay.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(item)} title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog 
                        open={isDeleteAlertOpen && deletingTicker === item.ticker} 
                        onOpenChange={(isOpen) => { 
                          if (!isOpen) setDeletingTicker(null); 
                          setIsDeleteAlertOpen(isOpen); 
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Excluir"
                            onClick={() => { setDeletingTicker(item.ticker); setIsDeleteAlertOpen(true); }} 
                            disabled={isDeleting && deletingTicker === item.ticker}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        {deletingTicker === item.ticker && ( // Ensure content is rendered only for the target item
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover {item.ticker} da sua carteira? Esta ação não pode ser desfeita e removerá o item da sua visualização de carteira atual.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => { setIsDeleteAlertOpen(false); setDeletingTicker(null); }}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteConfirm(item.ticker)} disabled={isDeleting}>
                                {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        )}
                      </AlertDialog>
                    </TableCell>
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

      {/* Edit Modal */}
      {editingItem && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Ação: {editingItem.ticker}</DialogTitle>
              <DialogDescription>
                Ajuste a quantidade e o preço médio da sua posição.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="quantidade" className="text-right">
                  Quantidade
                </Label>
                <Input
                  id="quantidade"
                  name="quantidade"
                  type="number"
                  value={editFormData.quantidade}
                  onChange={handleEditFormChange}
                  className="col-span-3"
                  min="0"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="preco_medio" className="text-right">
                  Preço Médio
                </Label>
                <Input
                  id="preco_medio"
                  name="preco_medio"
                  type="number"
                  value={editFormData.preco_medio}
                  onChange={handleEditFormChange}
                  className="col-span-3"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" onClick={handleCloseEditModal}>Cancelar</Button>
              </DialogClose>
              <Button type="submit" onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

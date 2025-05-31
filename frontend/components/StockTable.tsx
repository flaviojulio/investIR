"use client"
import { useState } from "react" // For modal and form state
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog" // Dialog components
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog" // AlertDialog components
import { Input } from "@/components/ui/input" // Input for form
import { Label } from "@/components/ui/label" // Label for form
import { TrendingUp, TrendingDown, Edit, Trash2 } from "lucide-react" // Edit and Trash2 icons
import type { CarteiraItem } from "@/lib/types"
import { api } from "@/lib/api" // For API calls
import { useToast } from "@/hooks/use-toast" // For notifications

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
                <TableHead className="text-center">Ações</TableHead>
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

"use client";
import { useState, useEffect, useMemo } from "react"; // For modal and form state, added useEffect, useMemo
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"; // Dialog components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // AlertDialog components
import { Input } from "@/components/ui/input"; // Input for form
import { Label } from "@/components/ui/label"; // Label for form
import {
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  PiggyBank,
  Calculator,
  Target,
  Activity,
  Coins,
  Wallet,
  TrendingUpDown,
  DollarSign,
} from "lucide-react"; // Edit, Trash2, and Sort icons
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Tooltip components
import Link from "next/link"; // Import Link for navigation
import type { CarteiraItem } from "@/lib/types";
import { api } from "@/lib/api"; // For API calls
import { useToast } from "@/hooks/use-toast"; // For notifications
import { formatCurrency, formatNumber } from "@/lib/utils"; // Import centralized formatters

// Simular preço atual (em uma aplicação real, viria de uma API de cotações)
const getSimulatedCurrentPrice = (avgPrice: number) => {
  const variation = (Math.random() - 0.5) * 0.2; // Variação de -10% a +10%
  return avgPrice * (1 + variation);
};

// Extensão do tipo CarteiraItem para incluir campos calculados
interface CarteiraItemWithCalc extends CarteiraItem {
  _valorAtualCalculated: number;
  _resultadoAtualCalculated: number;
  _resultadoPercentualCalculated: number;
}

interface StockTableProps {
  carteira: CarteiraItem[];
  onUpdate: () => void;
  showValues?: boolean;
}

export function StockTable({
  carteira,
  onUpdate,
  showValues = true,
}: StockTableProps) {
  const { toast } = useToast();
  const [editingItem, setEditingItem] = useState<CarteiraItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    quantidade: "",
    preco_medio: "",
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // State for delete confirmation
  const [deletingTicker, setDeletingTicker] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  // New state for sorting
  const [sortConfigST, setSortConfigST] = useState<{
    key: string;
    direction: "ascending" | "descending";
  } | null>(null);

  // New state for search term
  const [searchTermST, setSearchTermST] = useState<string>("");

  // New state for data to be displayed in the table - REPLACED with useMemo
  const processedCarteira = useMemo(() => {
    const augmentedCarteira = carteira.map((item) => {
      const currentPrice = getSimulatedCurrentPrice(item.preco_medio);
      const valorInicial = item.custo_total;
      const valorDeMercadoAbsoluto = Math.abs(item.quantidade * currentPrice);

      let resultadoDaPosicao;
      if (item.quantidade > 0) {
        resultadoDaPosicao = valorDeMercadoAbsoluto - valorInicial;
      } else {
        resultadoDaPosicao = valorInicial - valorDeMercadoAbsoluto;
      }

      const resultadoPercentualDaPosicao =
        valorInicial !== 0
          ? (resultadoDaPosicao / Math.abs(valorInicial)) * 100
          : 0;

      return {
        ...item,
        _valorAtualCalculated: valorDeMercadoAbsoluto,
        _resultadoAtualCalculated: resultadoDaPosicao,
        _resultadoPercentualCalculated: resultadoPercentualDaPosicao,
      };
    });

    let newProcessedData = [...augmentedCarteira].filter(
      (item) => item.quantidade !== 0
    );

    if (searchTermST) {
      const lowercasedSearchTerm = searchTermST.toLowerCase();
      newProcessedData = newProcessedData.filter(
        (item) =>
          item.ticker.toLowerCase().includes(lowercasedSearchTerm) ||
          (item.nome || "").toLowerCase().includes(lowercasedSearchTerm)
      );
    }

    if (sortConfigST !== null) {
      newProcessedData.sort((a, b) => {
        const getSortValue = (item: any, key: string) => {
          switch (key) {
            case "ticker":
              return item.ticker.toLowerCase();
            case "nome":
              return (item.nome || "").toLowerCase();
            case "quantidade":
              return item.quantidade;
            case "custo_total":
              return item.custo_total;
            case "calculated_valorAtual":
              return item._valorAtualCalculated;
            case "calculated_resultadoPercentual":
              return item._resultadoPercentualCalculated;
            default:
              return item[key];
          }
        };

        const valA = getSortValue(a, sortConfigST.key);
        const valB = getSortValue(b, sortConfigST.key);

        let comparison = 0;
        if (valA === null || valA === undefined) comparison = -1;
        else if (valB === null || valB === undefined) comparison = 1;
        else if (typeof valA === "number" && typeof valB === "number")
          comparison = valA - valB;
        else if (typeof valA === "string" && typeof valB === "string")
          comparison = valA.localeCompare(valB);

        return sortConfigST.direction === "descending"
          ? comparison * -1
          : comparison;
      });
    }

    return newProcessedData;
  }, [carteira, searchTermST, sortConfigST]);

  const requestSortST = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfigST &&
      sortConfigST.key === key &&
      sortConfigST.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfigST({ key, direction });
  };

  const handleOpenEditModal = (item: CarteiraItem) => {
    setEditingItem(item);
    setEditFormData({
      quantidade: String(item.quantidade),
      preco_medio: String(item.preco_medio),
    });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingItem(null);
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    const quantidade = parseFloat(editFormData.quantidade);
    const preco_medio = parseFloat(editFormData.preco_medio);

    if (isNaN(quantidade) || quantidade < 0) {
      toast({
        title: "Erro de Validação",
        description: "Quantidade deve ser um número igual ou maior que zero.",
        variant: "destructive",
      });
      return;
    }
    if (isNaN(preco_medio) || preco_medio < 0) {
      toast({
        title: "Erro de Validação",
        description: "Preço médio deve ser um número igual ou maior que zero.",
        variant: "destructive",
      });
      return;
    }
    if (quantidade === 0 && preco_medio !== 0) {
      toast({
        title: "Erro de Validação",
        description:
          "Se a quantidade for zero, o preço médio também deve ser zero.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingEdit(true);
    try {
      await api.put(`/carteira/${editingItem.ticker}`, {
        ticker: editingItem.ticker,
        quantidade: quantidade,
        preco_medio: preco_medio,
      });
      toast({
        title: "Sucesso!",
        description: `Ação ${editingItem.ticker} atualizada.`,
      });
      onUpdate();
      handleCloseEditModal();
    } catch (error: any) {
      toast({
        title: "Erro",
        description:
          error.response?.data?.detail || "Erro ao atualizar item da carteira.",
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
        description:
          error.response?.data?.detail ||
          `Erro ao remover ${ticker} da carteira.`,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteAlertOpen(false);
      setDeletingTicker(null);
    }
  };

  // Removed local formatCurrency and formatNumber definitions

  const calculateUnrealizedGain = (
    quantity: number,
    avgPrice: number,
    currentPrice: number
  ) => {
    const totalCost = quantity * avgPrice;
    const currentValue = quantity * currentPrice;
    return currentValue - totalCost;
  };

  if (carteira.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-slate-100 rounded-full flex items-center justify-center text-2xl border-2 border-gray-200">
              <Coins className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-800">
                Carteira de Investimentos
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Suas posições em ações
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-200">
              <Wallet className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-lg font-medium">
              Nenhuma posição encontrada na carteira.
            </p>
            <p className="text-sm mt-2">
              Adicione operações para ver suas posições aqui.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-green-100 rounded-full flex items-center justify-center text-2xl border-2 border-emerald-200">
            <Wallet className="h-10 w-10 text-emerald-600 drop-shadow" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              Carteira de Investimentos
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Suas posições em ações com resultados atuais (simulados)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Buscar em todas as colunas..."
            value={searchTermST}
            onChange={(e) => setSearchTermST(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  onClick={() => requestSortST("ticker")}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-center">
                    Ação
                    {sortConfigST?.key === "ticker" ? (
                      sortConfigST.direction === "ascending" ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowDown className="ml-2 h-4 w-4" />
                      )
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                {/* Nome column removed, now shown as hint on badge */}
                <TableHead
                  onClick={() => requestSortST("quantidade")}
                  className="cursor-pointer hover:bg-muted/50 text-right"
                >
                  <div className="flex items-center justify-end">
                    Quantidade
                    {sortConfigST?.key === "quantidade" ? (
                      sortConfigST.direction === "ascending" ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowDown className="ml-2 h-4 w-4" />
                      )
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-right">Preço Médio</TableHead>{" "}
                {/* Not sortable as per current instructions */}
                <TableHead
                  onClick={() => requestSortST("custo_total")}
                  className="cursor-pointer hover:bg-muted/50 text-right"
                >
                  <div className="flex items-center justify-end">
                    Valor Inicial
                    {sortConfigST?.key === "custo_total" ? (
                      sortConfigST.direction === "ascending" ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowDown className="ml-2 h-4 w-4" />
                      )
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-right">Preço Atual*</TableHead>{" "}
                {/* Not sortable */}
                <TableHead
                  onClick={() => requestSortST("calculated_valorAtual")}
                  className="cursor-pointer hover:bg-muted/50 text-right"
                >
                  <div className="flex items-center justify-end">
                    Valor Atual*
                    {sortConfigST?.key === "calculated_valorAtual" ? (
                      sortConfigST.direction === "ascending" ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowDown className="ml-2 h-4 w-4" />
                      )
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-right">Resultado*</TableHead>{" "}
                {/* Not sortable as per current instructions (absolute value) */}
                <TableHead
                  onClick={() =>
                    requestSortST("calculated_resultadoPercentual")
                  }
                  className="cursor-pointer hover:bg-muted/50 text-right"
                >
                  <div className="flex items-center justify-end">
                    Resultado (%)*
                    {sortConfigST?.key === "calculated_resultadoPercentual" ? (
                      sortConfigST.direction === "ascending" ? (
                        <ArrowUp className="ml-2 h-4 w-4" />
                      ) : (
                        <ArrowDown className="ml-2 h-4 w-4" />
                      )
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedCarteira.map((item) => {
                const typedItem = item as CarteiraItemWithCalc;
                const currentPrice = getSimulatedCurrentPrice(
                  typedItem.preco_medio
                );
                const valorAtualDisplay = typedItem._valorAtualCalculated;
                const resultadoAtualDisplay =
                  typedItem._resultadoAtualCalculated;
                const resultadoPercentualAtualDisplay =
                  typedItem._resultadoPercentualCalculated;
                return (
                  <TableRow key={typedItem.ticker}>
                    <TableCell className="font-medium">
                      <Link href={`/acao/${typedItem.ticker}`} passHref>
                        <Badge
                          variant="outline"
                          className="hover:underline cursor-pointer"
                          title={typedItem.nome || undefined}
                        >
                          {typedItem.ticker}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(typedItem.quantidade)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {showValues
                          ? formatCurrency(typedItem.preco_medio)
                          : "***"}
                        {typedItem.preco_editado_pelo_usuario && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Edit className="h-3 w-3 text-amber-500 opacity-75 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-amber-50 border-amber-200 text-amber-800">
                                <div className="flex items-center gap-1.5">
                                  <Edit className="h-3 w-3" />
                                  <span className="font-medium text-xs">
                                    Preço editado manualmente
                                  </span>
                                </div>
                                <p className="text-xs text-amber-600 mt-1">
                                  Este valor foi alterado pelo usuário
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {showValues
                        ? formatCurrency(Math.abs(typedItem.custo_total))
                        : "***"}
                    </TableCell>
                    <TableCell className="text-right">
                      {showValues ? formatCurrency(currentPrice) : "***"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {showValues ? formatCurrency(valorAtualDisplay) : "***"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        resultadoAtualDisplay >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {resultadoAtualDisplay >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {showValues
                          ? formatCurrency(Math.abs(resultadoAtualDisplay))
                          : "***"}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        typeof resultadoPercentualAtualDisplay === "number" &&
                        resultadoPercentualAtualDisplay >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {showValues ? (
                        <span>
                          {typeof resultadoPercentualAtualDisplay ===
                            "number" && resultadoPercentualAtualDisplay >= 0
                            ? "+"
                            : ""}
                          {typeof resultadoPercentualAtualDisplay === "number"
                            ? resultadoPercentualAtualDisplay.toFixed(2)
                            : "N/A"}
                          %
                        </span>
                      ) : (
                        "***"
                      )}
                    </TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(typedItem)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog
                        open={
                          isDeleteAlertOpen &&
                          deletingTicker === typedItem.ticker
                        }
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
                            onClick={() => {
                              setDeletingTicker(typedItem.ticker);
                              setIsDeleteAlertOpen(true);
                            }}
                            disabled={
                              isDeleting && deletingTicker === typedItem.ticker
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        {deletingTicker === typedItem.ticker && (
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Confirmar Exclusão
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover{" "}
                                {typedItem.ticker} da sua carteira? Esta ação
                                não pode ser desfeita e removerá o item da sua
                                visualização de carteira atual.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel
                                onClick={() => {
                                  setIsDeleteAlertOpen(false);
                                  setDeletingTicker(null);
                                }}
                              >
                                Cancelar
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleDeleteConfirm(typedItem.ticker)
                                }
                                disabled={isDeleting}
                              >
                                {isDeleting
                                  ? "Excluindo..."
                                  : "Confirmar Exclusão"}
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

        {/* Portfolio Summary Cards */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(() => {
            // Calculate portfolio summary
            const totalInvested = processedCarteira.reduce(
              (sum, item) => sum + Math.abs(item.custo_total),
              0
            );
            const totalCurrentValue = processedCarteira.reduce((sum, item) => {
              const currentPrice = getSimulatedCurrentPrice(item.preco_medio);
              return sum + Math.abs(item.quantidade * currentPrice);
            }, 0);
            const totalResult = totalCurrentValue - totalInvested;
            const totalResultPercentage =
              totalInvested > 0 ? (totalResult / totalInvested) * 100 : 0;
            const activePositions = processedCarteira.length;

            return (
              <>
                {/* Valor Total Inicial */}
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">
                          Valor Total Inicial
                        </p>
                        <p className="text-xl font-bold text-blue-700">
                          {showValues ? formatCurrency(totalInvested) : "***"}
                        </p>
                        <p className="text-xs text-blue-500 mt-1">
                          Valor investido total
                        </p>
                      </div>
                      <PiggyBank className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                {/* Valor Total da Carteira */}
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-600">
                          Valor Total da Carteira
                        </p>
                        <p className="text-xl font-bold text-purple-700">
                          {showValues
                            ? formatCurrency(totalCurrentValue)
                            : "***"}
                        </p>
                        <p className="text-xs text-purple-500 mt-1">
                          Valor atual no mercado
                        </p>
                      </div>
                      <Calculator className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                {/* Resultado Total */}
                <Card
                  className={`bg-gradient-to-br ${
                    totalResult >= 0
                      ? "from-green-50 to-green-100 border-green-200"
                      : "from-red-50 to-red-100 border-red-200"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            totalResult >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          Resultado Total
                        </p>
                        <div className="flex items-center gap-1">
                          {totalResult >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <p
                            className={`text-xl font-bold ${
                              totalResult >= 0
                                ? "text-green-700"
                                : "text-red-700"
                            }`}
                          >
                            {showValues ? (
                              <span>
                                {totalResult >= 0 ? "+" : ""}
                                {formatCurrency(totalResult)}
                              </span>
                            ) : (
                              "***"
                            )}
                          </p>
                        </div>
                        <p
                          className={`text-xs mt-1 ${
                            totalResult >= 0 ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {showValues ? (
                            <span>
                              {totalResult >= 0 ? "+" : ""}
                              {totalResultPercentage.toFixed(2)}%
                            </span>
                          ) : (
                            "***"
                          )}
                        </p>
                      </div>
                      <Target
                        className={`h-8 w-8 ${
                          totalResult >= 0 ? "text-green-500" : "text-red-500"
                        }`}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Posições Ativas */}
                <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">
                          Posições Ativas
                        </p>
                        <p className="text-xl font-bold text-slate-700">
                          {activePositions}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {activePositions === 1
                            ? "ação na carteira"
                            : "ações na carteira"}
                        </p>
                      </div>
                      <Activity className="h-8 w-8 text-slate-500" />
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </div>

        <div className="mt-4 text-xs text-muted-foreground space-y-1">
          <p>
            * Preços atuais são simulados para demonstração. Em produção, seriam
            obtidos de uma API de cotações.
          </p>
        </div>
      </CardContent>

      {/* Edit Modal */}
      {editingItem && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center border-2 border-blue-300">
                  <Edit className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    Editar Posição
                    <Badge
                      variant="outline"
                      className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200"
                    >
                      {editingItem.ticker}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-1">
                    Ajuste a quantidade e o preço médio da sua posição.
                  </DialogDescription>
                </div>
              </div>

              {editingItem.preco_editado_pelo_usuario && (
                <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center">
                      <Edit className="h-3 w-3 text-amber-700" />
                    </div>
                    <span className="text-sm font-medium text-amber-800">
                      Preço já foi editado manualmente
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 ml-8">
                    Esta alteração será registrada no histórico de edições.
                  </p>
                </div>
              )}
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label
                  htmlFor="quantidade"
                  className="text-sm font-medium text-gray-700 flex items-center gap-2"
                >
                  <Activity className="h-4 w-4 text-gray-500" />
                  Quantidade
                </Label>
                <Input
                  id="quantidade"
                  name="quantidade"
                  type="number"
                  value={editFormData.quantidade}
                  onChange={handleEditFormChange}
                  className="w-full h-11 text-base"
                  min="0"
                  placeholder="Digite a quantidade"
                />
                <p className="text-xs text-muted-foreground">
                  Número de ações na sua carteira
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="preco_medio"
                  className="text-sm font-medium text-gray-700 flex items-center gap-2"
                >
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  Preço Médio
                </Label>
                <Input
                  id="preco_medio"
                  name="preco_medio"
                  type="number"
                  value={editFormData.preco_medio}
                  onChange={handleEditFormChange}
                  className="w-full h-11 text-base"
                  min="0"
                  step="0.01"
                  placeholder="Digite o preço médio"
                />
                <p className="text-xs text-muted-foreground">
                  Preço médio pago pelas ações (R$)
                </p>
              </div>

              {/* Preview Card */}
              <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">
                        Valor Total da Posição
                      </p>
                      <p className="text-lg font-bold text-slate-800">
                        {!isNaN(parseFloat(editFormData.quantidade)) &&
                        !isNaN(parseFloat(editFormData.preco_medio))
                          ? formatCurrency(
                              parseFloat(editFormData.quantidade) *
                                parseFloat(editFormData.preco_medio)
                            )
                          : "R$ 0,00"}
                      </p>
                    </div>
                    <Calculator className="h-6 w-6 text-slate-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <DialogFooter className="flex gap-3 pt-4">
              <DialogClose asChild>
                <Button
                  variant="outline"
                  onClick={handleCloseEditModal}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="submit"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {isSavingEdit ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Salvar Alterações
                  </div>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

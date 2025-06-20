"use client"

import type React from "react"
import { useState, useEffect } from "react" // Added useEffect
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, AlertCircle, ChevronsUpDown } from "lucide-react"
import { api, fetchCorretoras } from "@/lib/api" // Added fetchCorretoras
import { useToast } from "@/hooks/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { AcaoInfo, Corretora } from "@/lib/types" // Added Corretora type import
import { getCarteira } from "@/lib/getCarteira";

interface AddOperationProps {
  onSuccess: () => void
}

export function AddOperation({ onSuccess }: AddOperationProps) {
  const [formData, setFormData] = useState({
    date: "",
    ticker: "",
    operation: "",
    quantity: "",
    price: "",
    fees: "",
    corretora_id: "", // Added corretora_id
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { toast } = useToast()

  const [acoesList, setAcoesList] = useState<AcaoInfo[]>([])
  const [corretorasList, setCorretorasList] = useState<Corretora[]>([]) // State for corretoras
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [carteira, setCarteira] = useState<string[]>([])

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [acoesResponse, corretorasResponse] = await Promise.all([
          api.get<AcaoInfo[]>("/acoes"),
          fetchCorretoras() // Use the new API function
        ]);
        setAcoesList(acoesResponse.data || []);
        setCorretorasList(corretorasResponse || []);
      } catch (err) {
        console.error("Erro ao buscar dados iniciais (ações/corretoras):", err);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível buscar a lista de tickers ou corretoras.",
          variant: "destructive",
        });
      }
    };

    const fetchCarteiraData = async () => {
      try {
        const carteiraData = await getCarteira();
        setCarteira(carteiraData.map(item => item.ticker));
      } catch (err) {
        // Ignora erro de carteira
      }
    };
    fetchInitialData();
    fetchCarteiraData();
  }, [toast])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    setError("") // Clear general error when any field changes
  }

  // Specific handler for ticker selection from Combobox
  const handleTickerSelect = (tickerValue: string) => {
    setFormData((prev) => ({
      ...prev,
      ticker: tickerValue,
    }));
    setError(""); // Clear general error
    setComboboxOpen(false); // Close combobox
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Validação básica
      if (!formData.date || !formData.ticker || !formData.operation || !formData.quantity || !formData.price) {
        throw new Error("Todos os campos obrigatórios devem ser preenchidos")
      }

      const operationData = {
        date: formData.date,
        ticker: formData.ticker.toUpperCase(),
        operation: formData.operation,
        quantity: Number.parseInt(formData.quantity),
        price: Number.parseFloat(formData.price),
        fees: Number.parseFloat(formData.fees) || 0,
        corretora_id: formData.corretora_id ? Number.parseInt(formData.corretora_id) : null,
      }

      // Ensure corretora_id is not an empty string if it's optional and not selected
      if (operationData.corretora_id === undefined || operationData.corretora_id === null || isNaN(operationData.corretora_id as any) ) {
        delete operationData.corretora_id; // Remove if not a valid number or not provided
      }


      await api.post("/operacoes", operationData)

      toast({
        title: "Sucesso!",
        description: "Operação adicionada com sucesso",
      })

      // Limpar formulário
      setFormData({
        date: "",
        ticker: "",
        operation: "",
        quantity: "",
        price: "",
        fees: "",
        corretora_id: "", // Reset corretora_id
      })

      onSuccess()
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || "Erro ao adicionar operação"
      setError(errorMessage)
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Adicionar Nova Operação
        </CardTitle>
        <CardDescription>Registre manualmente uma operação de compra ou venda</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data da Operação *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker *</Label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between"
                  >
                    {formData.ticker
                      ? acoesList.find((acao) => acao.ticker === formData.ticker)?.nome || formData.ticker
                      : "Selecione o ticker"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar ticker..." />
                    <CommandList>
                      <CommandEmpty>Nenhum ticker encontrado.</CommandEmpty>
                      <CommandGroup>
                        {acoesList
                          .slice()
                          .sort((a, b) => {
                            const aIn = carteira.includes(a.ticker);
                            const bIn = carteira.includes(b.ticker);
                            if (aIn && !bIn) return -1;
                            if (!aIn && bIn) return 1;
                            return a.ticker.localeCompare(b.ticker);
                          })
                          .map((acao) => (
                            <CommandItem
                              key={acao.ticker}
                              value={acao.ticker}
                              onSelect={(currentValue) => {
                                handleTickerSelect(currentValue === formData.ticker ? "" : currentValue)
                              }}
                            >
                              {acao.ticker} - {acao.nome || "Nome não disponível"}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="operation">Tipo de Operação *</Label>
              <Select value={formData.operation} onValueChange={(value) => handleInputChange("operation", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Compra</SelectItem>
                  <SelectItem value="sell">Venda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade *</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="Ex: 100"
                value={formData.quantity}
                onChange={(e) => handleInputChange("quantity", e.target.value)}
                min="1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço por Ação *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="Ex: 25.50"
                value={formData.price}
                onChange={(e) => handleInputChange("price", e.target.value)}
                min="0.01"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fees">Taxas e Corretagem</Label>
              <Input
                id="fees"
                type="number"
                step="0.01"
                placeholder="Ex: 5.00"
                value={formData.fees}
                onChange={(e) => handleInputChange("fees", e.target.value)}
                min="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="corretora">Corretora (Opcional)</Label>
            <Select value={formData.corretora_id} onValueChange={(value) => handleInputChange("corretora_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a corretora" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <em>Nenhuma (ou não aplicável)</em>
                </SelectItem>
                {corretorasList.map((corretora) => (
                  <SelectItem key={corretora.id} value={String(corretora.id)}>
                    {corretora.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Adicionando..." : "Adicionar Operação"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setFormData({
                  date: "",
                  ticker: "",
                  operation: "",
                  quantity: "",
                  price: "",
                  fees: "",
                  corretora_id: "", // Clear corretora_id on reset
                })
              }
            >
              Limpar
            </Button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Dicas importantes:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use sempre o ticker completo (ex: ITUB4, não ITUB)</li>
            <li>• O preço deve ser por ação individual</li>
            <li>• Inclua todas as taxas (corretagem, emolumentos, etc.)</li>
            <li>• A data deve ser a data de liquidação da operação</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

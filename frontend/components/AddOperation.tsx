"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, AlertCircle, ChevronsUpDown } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { AcaoInfo, Corretora } from "@/lib/types"
import { getCarteira } from "@/lib/getCarteira"

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
    corretora_id: "", // Novo campo
    corretoraSearch: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { toast } = useToast()

  const [acoesList, setAcoesList] = useState<AcaoInfo[]>([])
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [carteira, setCarteira] = useState<string[]>([])
  const [corretoras, setCorretoras] = useState<Corretora[]>([])

  useEffect(() => {
    const fetchAcoes = async () => {
      try {
        const response = await api.get<AcaoInfo[]>("/acoes")
        setAcoesList(response.data || [])
      } catch (err) {
        console.error("Erro ao buscar ações:", err)
        toast({
          title: "Erro ao carregar tickers",
          description: "Não foi possível buscar a lista de tickers disponíveis.",
          variant: "destructive",
        })
      }
    }
    const fetchCarteira = async () => {
      try {
        const carteiraData = await getCarteira();
        setCarteira(carteiraData.map(item => item.ticker));
      } catch (err) {
        // Ignora erro de carteira, não bloqueia uso do componente
      }
    }
    const fetchCorretoras = async () => {
      try {
        const response = await api.get<Corretora[]>("/corretoras")
        setCorretoras(response.data || [])
      } catch (err) {
        // Não bloqueia o uso do componente
      }
    }
    fetchAcoes();
    fetchCarteira();
    fetchCorretoras();
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
      if (isNaN(Number(formData.quantity)) || isNaN(Number(formData.price))) {
        throw new Error("Quantidade e preço devem ser números válidos")
      }

      const operationData: any = {
        date: formData.date,
        ticker: formData.ticker.toUpperCase(),
        operation: formData.operation,
        quantity: Number.parseInt(formData.quantity),
        price: Number.parseFloat(formData.price),
        fees: Number.parseFloat(formData.fees) || 0,
      }
      if (formData.corretora_id && formData.corretora_id !== "none") {
        operationData.corretora_id = Number(formData.corretora_id)
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
        corretora_id: "",
        corretoraSearch: "",
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
    <Card className={`max-w-2xl mx-auto transition-colors duration-300 ${
      formData.operation === 'buy' ? 'bg-green-50 border-green-200' :
      formData.operation === 'sell' ? 'bg-red-50 border-red-200' :
      'bg-white'
    }`}>
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
            <Label htmlFor="total-value">Valor Total da Operação</Label>
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg text-center">
              <span className="text-2xl font-bold text-blue-900">
                {formData.quantity && formData.price ? 
                  `R$ ${(Number(formData.quantity) * Number(formData.price)).toLocaleString('pt-BR', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}` : 
                  'R$ 0,00'
                }
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2 col-span-1 md:col-span-2 lg:col-span-4">
              <Label htmlFor="corretora_id">Corretora</Label>
              <Select
                value={formData.corretora_id}
                onValueChange={(value) => handleInputChange("corretora_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a corretora (opcional)" />
                </SelectTrigger>
                <SelectContent className="min-w-[340px] max-w-[480px]">
                  <div className="px-2 py-1">
                    <Input
                      placeholder="Buscar corretora..."
                      value={formData.corretoraSearch || ""}
                      onChange={e => handleInputChange("corretoraSearch", e.target.value)}
                      className="w-full mb-2"
                    />
                  </div>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {corretoras
                    .filter(corretora =>
                      !formData.corretoraSearch ||
                      corretora.nome.toLowerCase().includes(formData.corretoraSearch.toLowerCase()) ||
                      corretora.cnpj.includes(formData.corretoraSearch)
                    )
                    .map((corretora) => (
                      <SelectItem key={corretora.id} value={String(corretora.id)}>
                        {corretora.nome} ({corretora.cnpj})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
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
                  corretora_id: "",
                  corretoraSearch: "",
                })
              }
            >
              Limpar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

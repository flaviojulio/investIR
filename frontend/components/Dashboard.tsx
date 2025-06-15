"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation" // Import useRouter and usePathname
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogOut, TrendingUp, PlusCircle, UploadCloud } from "lucide-react"
import { PortfolioOverview } from "@/components/PortfolioOverview"
import { StockTable } from "@/components/StockTable"
import { TaxMeter } from "@/components/TaxMeter"
import { PortfolioEquityChart } from "@/components/PortfolioEquityChart" // Import the new chart
import { UploadOperations } from "@/components/UploadOperations"
import { AddOperation } from "@/components/AddOperation"
import { OperationsHistory } from "@/components/OperationsHistory"
import { TaxResults } from "@/components/TaxResults"
import { OperacoesEncerradasTable } from "@/components/OperacoesEncerradasTable"; // Import new component
import { useToast } from "@/hooks/use-toast"
import type { Operacao, CarteiraItem, ResultadoMensal, OperacaoFechada } from "@/lib/types" // Add OperacaoFechada

interface DashboardData {
  carteira: CarteiraItem[]
  resultados: ResultadoMensal[]
  operacoes: Operacao[]
  operacoes_fechadas: OperacaoFechada[]; // Add new data field
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData>({
    carteira: [],
    resultados: [],
    operacoes: [],
    operacoes_fechadas: [], // Initialize new data field
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  const router = useRouter() // Initialize useRouter
  const pathname = usePathname() // Initialize usePathname

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Sync activeTab with pathname
  useEffect(() => {
    if (pathname === "/") {
      setActiveTab("overview");
    } else if (pathname === "/proventos") {
      setActiveTab("proventos");
    } else if (pathname === "/carteira") {
      setActiveTab("carteira");
    }
    // "taxes", "history", "prejuizo_acumulado" are local tabs
  }, [pathname]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [carteiraRes, resultadosRes, operacoesRes, operacoesFechadasRes] = await Promise.all([
        api.get("/carteira"),
        api.get("/resultados"),
        api.get("/operacoes"),
        api.get("/operacoes/fechadas"), // Fetch closed operations
      ])

      setData({
        carteira: carteiraRes.data,
        resultados: resultadosRes.data,
        operacoes: operacoesRes.data,
        operacoes_fechadas: operacoesFechadasRes.data, // Set closed operations data
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do dashboard",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDataUpdate = () => {
    fetchDashboardData()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Carteira de Ações</h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Olá, {user?.nome_completo || user?.username}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex space-x-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline">
                <PlusCircle className="h-5 w-5 mr-2" />
                Cadastrar Nova Operação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Nova Operação</DialogTitle>
              </DialogHeader>
              <AddOperation onSuccess={handleDataUpdate} />
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline">
                <UploadCloud className="h-5 w-5 mr-2" />
                Importar Operações B3
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Operações da B3</DialogTitle>
              </DialogHeader>
              <UploadOperations onSuccess={handleDataUpdate} />
            </DialogContent>
          </Dialog>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (value === "overview") { router.push("/"); }
            else if (value === "carteira") { router.push("/carteira"); }
            else if (value === "proventos") { router.push("/proventos"); }
            else if (value === "taxes") { router.push("/impostos"); }
            else if (value === "prejuizo_acumulado") { router.push("/prejuizo-acumulado"); }
            // For local tabs like "history", just setActiveTab is enough.
            setActiveTab(value);
          }}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-5 md:grid-cols-8 lg:grid-cols-11 xl:grid-cols-11">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="carteira">Minha Carteira</TabsTrigger>
            <TabsTrigger value="proventos">Proventos</TabsTrigger>
            <TabsTrigger value="taxes">Impostos</TabsTrigger>
            <TabsTrigger value="prejuizo_acumulado">Prejuízo Acum.</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <PortfolioOverview carteira={data.carteira} resultados={data.resultados} operacoes={data.operacoes} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PortfolioEquityChart />
              <TaxMeter resultados={data.resultados} />
            </div>
            <StockTable carteira={data.carteira} onUpdate={handleDataUpdate} />
            <OperacoesEncerradasTable 
              operacoesFechadas={data.operacoes_fechadas} 
              resultadosMensais={data.resultados}
              onUpdateDashboard={handleDataUpdate} 
            />
          </TabsContent>

          <TabsContent value="taxes">
            <TaxResults resultados={data.resultados} onUpdate={handleDataUpdate} />
          </TabsContent>

          <TabsContent value="history">
            <OperationsHistory operacoes={data.operacoes} onUpdate={handleDataUpdate} />
          </TabsContent>

          <TabsContent value="prejuizo_acumulado" className="space-y-6">
            <div className="container mx-auto py-8">
              <h2 className="text-2xl font-bold mb-4">Prejuízo Acumulado</h2>
              <p>Conteúdo da seção de Prejuízo Acumulado será implementado aqui.</p>
              {/* TODO: Implementar visualização de prejuízos acumulados (swing e daytrade) */}
              {/* Exemplo: um card ou uma pequena tabela com os valores de prejuízo acumulado swing e daytrade */}
              {/* Pode-se buscar de data.resultados, o último mês com dados, e exibir os campos: */}
              {/* data.resultados[data.resultados.length - 1]?.prejuizo_acumulado_swing */}
              {/* data.resultados[data.resultados.length - 1]?.prejuizo_acumulado_day */}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

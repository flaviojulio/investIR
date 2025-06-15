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
  // const { user, logout } = useAuth() // Moved to AppShell
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData>({
    carteira: [],
    resultados: [],
    operacoes: [],
    operacoes_fechadas: [],
  })
  const [loading, setLoading] = useState(true)
  const [activeLocalTab, setActiveLocalTab] = useState("overview_main"); // For local tabs within overview

  // router and pathname are not needed here anymore if navigation is handled by AppShell
  // and this component is only for "/" (overview)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [carteiraRes, resultadosRes, operacoesRes, operacoesFechadasRes] = await Promise.all([
        api.get("/carteira"),
        api.get("/resultados"),
        api.get("/operacoes"),
        api.get("/operacoes/fechadas"),
      ])

      setData({
        carteira: carteiraRes.data,
        resultados: resultadosRes.data,
        operacoes: operacoesRes.data,
        operacoes_fechadas: operacoesFechadasRes.data,
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
      <div className="flex items-center justify-center py-12"> {/* Adjusted padding for when used within AppShell */}
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // This component now renders the content for the "Visão Geral" tab/page.
  // The main page Tabs (Visão Geral, Carteira, etc.) are in AppShell.
  // We can have local tabs here if needed for "Impostos", "Histórico", "Prejuízo Acumulado".
  return (
    <Tabs value={activeLocalTab} onValueChange={setActiveLocalTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
        {/* These are now local sub-tabs for the "Visão Geral" page */}
        <TabsTrigger value="overview_main">Resumo</TabsTrigger>
        <TabsTrigger value="taxes">Impostos</TabsTrigger>
        <TabsTrigger value="prejuizo_acumulado">Prejuízo Acum.</TabsTrigger>
        <TabsTrigger value="history">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="overview_main" className="space-y-6">
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
        </div>
      </TabsContent>
    </Tabs>
  )
}

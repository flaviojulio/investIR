"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { LogOut, TrendingUp } from "lucide-react"
import AppSidebar from "@/components/AppSidebar" // Import AppSidebar
import { PortfolioOverview } from "@/components/PortfolioOverview"
import { StockTable } from "@/components/StockTable"
import { TaxMeter } from "@/components/TaxMeter"
import { UploadOperations } from "@/components/UploadOperations"
import { AddOperation } from "@/components/AddOperation"
import { OperationsHistory } from "@/components/OperationsHistory"
import { TaxResults } from "@/components/TaxResults"
import { useToast } from "@/hooks/use-toast"
import type { Operacao, CarteiraItem, ResultadoMensal } from "@/lib/types"

interface DashboardData {
  carteira: CarteiraItem[]
  resultados: ResultadoMensal[]
  operacoes: Operacao[]
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData>({
    carteira: [],
    resultados: [],
    operacoes: [],
  })
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState("Visão Geral") // New state for active view

  const viewTitles: { [key: string]: string } = {
    "Visão Geral": "Visão Geral da Carteira",
    "Operações": "Adicionar Nova Operação Manualmente",
    "Upload de Nota": "Upload de Notas de Corretagem",
    "Impostos": "Cálculo e Controle de Impostos",
    "Histórico de Operações": "Histórico Completo de Operações",
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [carteiraRes, resultadosRes, operacoesRes] = await Promise.all([
        api.get("/carteira"),
        api.get("/resultados"),
        api.get("/operacoes"),
      ])

      setData({
        carteira: carteiraRes.data,
        resultados: resultadosRes.data,
        operacoes: operacoesRes.data,
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-blue"></div>
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
              <TrendingUp className="h-8 w-8 text-primary-blue" />
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
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex">
          <AppSidebar setActiveView={setActiveView} activeView={activeView} />
          <div className="flex-1 p-4"> {/* p-6 to p-4 */}
            <h2 className="text-2xl font-semibold mb-4">{viewTitles[activeView]}</h2> {/* mb-6 to mb-4 */}
            {activeView === "Visão Geral" && (
              <div className="space-y-4"> {/* space-y-6 to space-y-4 */}
                <PortfolioOverview carteira={data.carteira} resultados={data.resultados} operacoes={data.operacoes} />
                <TaxMeter resultados={data.resultados} />
                <StockTable carteira={data.carteira} onUpdate={handleDataUpdate} />
              </div>
            )}
            {activeView === "Operações" && <AddOperation onSuccess={handleDataUpdate} />}
            {activeView === "Upload de Nota" && <UploadOperations onSuccess={handleDataUpdate} />}
            {activeView === "Impostos" && <TaxResults resultados={data.resultados} onUpdate={handleDataUpdate} />}
            {activeView === "Histórico de Operações" && <OperationsHistory operacoes={data.operacoes} onUpdate={handleDataUpdate} />}
          </div>
        </div>
      </main>
    </div>
  )
}

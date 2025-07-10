"use client"

import React, { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Info } from "lucide-react"
import type { ResultadoMensal } from "@/lib/types"

interface TaxMeterProps {
  resultados: ResultadoMensal[]
}

export function TaxMeter({ resultados }: TaxMeterProps) {
  const taxData = useMemo(() => {
    const mesAtual = new Date().toISOString().slice(0, 7) // YYYY-MM
    const resultadoMesAtual = resultados.find((r) => r.mes === mesAtual)

    const vendasMesAtual = resultadoMesAtual ? resultadoMesAtual.vendas_swing : 0
    const ganhosMesAtual = resultadoMesAtual ? resultadoMesAtual.ganho_liquido_swing : 0
    const limiteIsencao = 20000
    const percentualUtilizado = (vendasMesAtual / limiteIsencao) * 100
    const valorRestante = Math.max(0, limiteIsencao - vendasMesAtual)
    const valorExcedente = Math.max(0, vendasMesAtual - limiteIsencao)
    const isento = vendasMesAtual <= limiteIsencao
    
    // Cálculo do DARF (imposto devido) - 15% sobre os ganhos se ultrapassou o limite
    const impostoDevido = (vendasMesAtual > limiteIsencao && ganhosMesAtual > 0) 
      ? ganhosMesAtual * 0.15 
      : 0

    return {
      vendasMesAtual,
      ganhosMesAtual,
      limiteIsencao,
      percentualUtilizado: Math.min(100, percentualUtilizado),
      valorRestante,
      valorExcedente,
      isento,
      ultrapassou: vendasMesAtual > limiteIsencao,
      impostoDevido,
    }
  }, [resultados])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const getStatusInfo = () => {
    if (taxData.ultrapassou) {
      return {
        status: "TRIBUTÁVEL",
        color: "orange",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
        textColor: "text-orange-700",
        icon: "💰",
        message: `Você ultrapassou o limite de isenção em ${formatCurrency(taxData.valorExcedente)}`,
        detail: null,
        action: "Você deve declarar e pagar imposto sobre os ganhos"
      }
    } else if (taxData.percentualUtilizado > 80) {
      return {
        status: "ATENÇÃO",
        color: "yellow",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        textColor: "text-yellow-700",
        icon: "⚡",
        message: "Você está próximo do limite de isenção",
        detail: `Restam: ${formatCurrency(taxData.valorRestante)}`,
        action: "Suas vendas estão dando lucro neste mês e, se ultrapassarem R$ 20.000, você terá imposto a pagar"
      }
    } else {
      return {
        status: "ISENTO",
        color: "green",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        textColor: "text-green-700",
        icon: "✅",
        message: "Suas vendas estão dentro do limite de isenção",
        detail: `Restam: ${formatCurrency(taxData.valorRestante)}`,
        action: "Continue tranquilo, não há imposto a pagar este mês"
      }
    }
  }

  const statusInfo = getStatusInfo()

  // Componente de Barra de Progresso
  const ProgressBar = () => {
    const percentage = Math.min(taxData.percentualUtilizado, 100)
    const isOverLimit = taxData.ultrapassou
    
    return (
      <div className="w-full mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progresso do Limite</span>
          <span className={`text-sm font-bold ${statusInfo.textColor}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
          {/* Barra de progresso normal */}
          <div 
            className={`h-3 rounded-full transition-all duration-1000 ease-out ${
              isOverLimit ? 'bg-orange-500' : 
              percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
          
          {/* Efeito de "overflow" se ultrapassou */}
          {isOverLimit && (
            <div className="absolute inset-0 bg-orange-500 opacity-75 animate-pulse" />
          )}
          
          {/* Marca do limite */}
          <div className="absolute top-0 right-0 w-0.5 h-3 bg-gray-600"></div>
        </div>
        
        {/* Labels da barra */}
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>R$ 0</span>
          <span>R$ 20.000</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      
      {/* Card Principal */}
      <Card className={`${statusInfo.bgColor} ${statusInfo.borderColor} border-2 shadow-lg`}>
        <CardContent className="p-6">
        
        {/* Header com Status */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${statusInfo.bgColor} rounded-full flex items-center justify-center text-2xl border-2 ${statusInfo.borderColor}`}>
              {statusInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-800">Isentômetro Swing Trade</h2>
                
                {/* Modal de Informações */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 hover:bg-blue-100 rounded-full"
                    >
                      <Info className="h-4 w-4 text-blue-600" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-blue-800">
                        📚 Como Funciona a Isenção
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm text-gray-700">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <p>Vendas até <strong>R$ 20.000/mês</strong> em ações são isentas de imposto</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <p>Acima desse valor, paga-se <strong>15% sobre os ganhos de capital</strong></p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <p>O limite é calculado por <strong>mês civil</strong> (não por período de 30 dias)</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <p>Apenas <strong>operações de swing trade</strong> são consideradas neste cálculo</p>
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-700">
                          <strong>Importante:</strong> Day trade possui regras diferentes e não está incluído neste limite de isenção.
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <p className={`text-sm font-semibold ${statusInfo.textColor}`}>
                Status: {statusInfo.status}
              </p>
            </div>
          </div>
          
          {/* Badge do mês atual */}
          <div className="text-center">
            <div className="bg-white px-3 py-1 rounded-lg border shadow-sm">
              <p className="text-xs text-gray-500">Mês Atual</p>
              <p className="font-bold text-gray-800">
                {new Date().toLocaleDateString('pt-BR', { month: 'long'})}
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Progresso */}
        <ProgressBar />

        {/* Informações Principais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          
          {/* Vendas do Mês */}
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Vendas no Mês</p>
            <p className="text-xl font-bold text-gray-800">
              {formatCurrency(taxData.vendasMesAtual)}
            </p>
          </div>
          
          {/* Limite de Isenção */}
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Limite de Isenção</p>
            <p className="text-xl font-bold text-blue-600">
              {formatCurrency(taxData.limiteIsencao)}
            </p>
          </div>
          
          {/* Valor Restante/Excedente */}
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <p className="text-xs text-gray-500 mb-1">
              {taxData.ultrapassou ? 'Valor Excedente' : 'Valor Restante'}
            </p>
            <p className={`text-xl font-bold ${
              taxData.ultrapassou ? 'text-orange-600' : 'text-green-600'
            }`}>
              {taxData.ultrapassou 
                ? formatCurrency(taxData.valorExcedente)
                : formatCurrency(taxData.valorRestante)
              }
            </p>
          </div>

          {/* DARF Previsto - Só aparece se ultrapassou o limite */}
          {taxData.ultrapassou && (
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border-2 border-orange-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-orange-500 text-lg">📋</span>
                <p className="text-xs text-orange-600 font-semibold">DARF Previsto</p>
              </div>
              <p className="text-xl font-bold text-orange-700">
                {formatCurrency(taxData.impostoDevido)}
              </p>
              <p className="text-xs text-orange-500 mt-1">
                15% sobre ganhos
              </p>
            </div>
          )}
        </div>

        {/* Mensagem Principal e Ação Necessária lado a lado */}
        {taxData.ultrapassou ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Mensagem Principal */}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <h3 className={`font-bold mb-2 ${statusInfo.textColor}`}>
                {statusInfo.message}
              </h3>
              <p className="text-sm text-gray-600">
                {statusInfo.action}
              </p>
            </div>

            {/* Alerta de Ação Necessária */}
            <div className="bg-orange-100 border border-orange-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-orange-500 text-xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-orange-700 mb-1">Ação Necessária</h4>
                  <p className="text-sm text-orange-600">
                    Você deve declarar os ganhos de capital no próximo mês{taxData.ganhosMesAtual > 0 ? ' e pagar 15% de imposto sobre os lucros obtidos' : ' (sem imposto a pagar, pois houve prejuízo)'}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Mensagem Principal para outros status (ISENTO/ATENÇÃO) */
          <div className="bg-white p-4 rounded-lg border shadow-sm mb-6">
            <h3 className={`font-bold mb-2 ${statusInfo.textColor}`}>
              {statusInfo.message}
            </h3>
            <p className="text-sm text-gray-600">
              {statusInfo.action}
            </p>
          </div>
        )}

        {/* Alertas Específicos */}
        {taxData.ultrapassou && (
          <div className="mt-0 space-y-4">{/* Removido mt-4 pois já temos mb-6 acima */}

            {/* Card de Prévia do DARF - só mostra se há ganhos positivos */}
            {taxData.ganhosMesAtual > 0 && taxData.impostoDevido > 0 && (
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Ícone do DARF */}
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center border-2 border-red-300">
                      <span className="text-2xl">📋</span>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-red-700 text-lg mb-1">
                        Prévia do DARF - Imposto a Pagar
                      </h4>
                      <p className="text-sm text-red-600">
                        Estimativa de imposto sobre ganhos de capital
                      </p>
                    </div>
                  </div>

                  {/* Valor do Imposto */}
                  <div className="text-right">
                    <p className="text-xs text-red-500 mb-1">Valor Estimado (15%)</p>
                    <p className="text-2xl font-bold text-red-700">
                      {formatCurrency(taxData.impostoDevido)}
                    </p>
                    <p className="text-xs text-red-500 mt-1">
                      Vencimento: {(() => {
                        const proximoMes = new Date()
                        proximoMes.setMonth(proximoMes.getMonth() + 1)
                        proximoMes.setDate(31) // Último dia do próximo mês
                        return proximoMes.toLocaleDateString('pt-BR')
                      })()}
                    </p>
                  </div>
                </div>

                {/* Informações Adicionais */}
                <div className="mt-4 pt-4 border-t border-red-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-red-600">
                        <strong>Base de Cálculo:</strong> {formatCurrency(taxData.ganhosMesAtual)}
                      </p>
                      <p className="text-red-600">
                        <strong>Alíquota:</strong> 15% sobre ganhos
                      </p>
                    </div>
                    <div>
                      <p className="text-red-600">
                        <strong>Código DARF:</strong> 6015
                      </p>
                      <p className="text-red-600">
                        <strong>Período:</strong> {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 p-3 bg-white rounded border border-red-200">
                    <p className="text-xs text-red-600">
                      <strong>⚠️ Importante:</strong> Esta é uma estimativa baseada nos ganhos líquidos calculados. 
                      Fique tranquilo! Seu DARF estará disponível para pagamento do próximo mês, aqui, na nossa ferramenta.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Aviso especial se ultrapassou mas teve prejuízo */}
            {taxData.ganhosMesAtual <= 0 && (
              <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 text-xl">ℹ️</span>
                  <div>
                    <h4 className="font-bold text-blue-700 mb-1">Sem Imposto a Pagar</h4>
                    <p className="text-sm text-blue-600">
                      Mesmo tendo ultrapassado o limite de vendas, você teve prejuízo no mês ({formatCurrency(taxData.ganhosMesAtual)}), 
                      portanto não há imposto a pagar. Ainda assim, deve declarar as operações.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {taxData.percentualUtilizado > 80 && !taxData.ultrapassou && (
          <div className="mt-4 bg-yellow-100 border border-yellow-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-500 text-xl">💡</span>
              <div>
                <h4 className="font-bold text-yellow-700 mb-1">Dica Importante</h4>
                <p className="text-sm text-yellow-600">
                  Considere reduzir as operações de swing trade neste mês para manter a isenção fiscal.
                </p>
              </div>
            </div>
          </div>
        )}

        </CardContent>
      </Card>
    </div>
  )
}

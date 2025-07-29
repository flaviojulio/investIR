"use client";
import React, { useState, useMemo } from "react";
import OperationTimeline from "./OperationTimeline";
import OperationTable from "./OperationTable";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, BarChart3, AlertCircle, RefreshCw } from "lucide-react";
import { useExtratoOtimizado } from "@/hooks/useExtratoOtimizado";
import { Button } from "@/components/ui/button";

export default function ExtratoTabContentOptimized() {
  // Estado para controle de visualização
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");
  
  // Hook otimizado que busca todos os dados necessários
  const { timelineItems, isLoading, error, refetch } = useExtratoOtimizado();

  // Estado de carregamento
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-full py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
        <div className="text-gray-600 font-medium">Carregando extrato otimizado...</div>
        <div className="text-sm text-gray-500 mt-2">
          🚀 Buscando operações, proventos e eventos corporativos
        </div>
      </div>
    );
  }

  // Estado de erro
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full py-12">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <div className="text-red-800 font-medium mb-2">Erro ao carregar extrato</div>
        <div className="text-sm text-red-600 mb-4 max-w-md text-center">{error}</div>
        <Button 
          onClick={refetch} 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-5xl">
        
        {/* Header com indicador de performance */}
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium">Extrato Otimizado</span>
            <span className="text-green-600">•</span>
            <span>{timelineItems.length} itens carregados</span>
            <span className="text-green-600">•</span>
            <span className="text-xs">⚡ Performance O(n) vs O(n²)</span>
          </div>
        </div>
                
        {/* Controles de visualização */}
        <div className="flex justify-center mb-1">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setViewMode("timeline")}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                ${viewMode === "timeline" 
                  ? "bg-white text-gray-800 shadow-sm" 
                  : "text-gray-600 hover:text-gray-800"
                }
              `}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Timeline</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                ${viewMode === "table" 
                  ? "bg-white text-gray-800 shadow-sm" 
                  : "text-gray-600 hover:text-gray-800"
                }
              `}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
          </div>
        </div>

        {/* Renderização condicional baseada no modo de visualização */}
        {viewMode === "timeline" ? (
          <OperationTimeline items={timelineItems} />
        ) : (
          <OperationTable items={timelineItems} />
        )}

        {/* Footer com informações de performance */}
        <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-xs text-gray-600 text-center space-y-1">
            <div>
              💡 <strong>Otimização:</strong> Dados pré-calculados no backend • 
              APIs em paralelo • Memoização inteligente
            </div>
            <div className="flex items-center justify-center gap-4 text-gray-500">
              <span>🚀 Operações: {timelineItems.filter(item => item.operation === 'fechamento').length}</span>
              <span>💰 Proventos: {timelineItems.filter(item => item.provento).length}</span>
              <span>🏢 Eventos: {timelineItems.filter(item => ['bonificacao', 'desdobramento', 'agrupamento'].includes(item.operation)).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
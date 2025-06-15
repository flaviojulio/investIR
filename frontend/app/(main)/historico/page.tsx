"use client"
import React, { useState, useEffect } from 'react';
import { OperationsHistory } from "@/components/OperationsHistory";
import { api } from "@/lib/api";
import type { Operacao } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function HistoricoPage() {
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOperacoesData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/operacoes");
      setOperacoes(res.data);
    } catch (error) {
      console.error("Erro ao carregar histórico de operações:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico de operações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperacoesData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">Histórico de Operações</h1>
      <OperationsHistory operacoes={operacoes} onUpdate={fetchOperacoesData} />
    </div>
  );
}

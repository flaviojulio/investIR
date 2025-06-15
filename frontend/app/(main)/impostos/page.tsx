"use client"
import React, { useState, useEffect } from 'react';
import { TaxResults } from "@/components/TaxResults";
import { api } from "@/lib/api";
import type { ResultadoMensal } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner"; // Assuming this exists

export default function ImpostosPage() {
  const [resultados, setResultados] = useState<ResultadoMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchResultadosData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/resultados");
      setResultados(res.data);
    } catch (error) {
      console.error("Erro ao carregar dados de resultados:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados de resultados para impostos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResultadosData();
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
      <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">Impostos</h1>
      <TaxResults resultados={resultados} onUpdate={fetchResultadosData} />
    </div>
  );
}

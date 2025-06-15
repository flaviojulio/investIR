"use client"
import React, { useState, useEffect } from 'react';
import { api } from "@/lib/api";
import type { ResultadoMensal } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils"; // Assuming formatCurrency is in utils
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function PrejuizoAcumuladoPage() {
  const [resultados, setResultados] = useState<ResultadoMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchResultadosData = async () => {
      try {
        setLoading(true);
        const res = await api.get("/resultados");
        setResultados(res.data);
      } catch (error) {
        console.error("Erro ao carregar dados de resultados para prejuízo:", error);
        toast({
          title: "Erro",
          description: "Erro ao carregar dados para prejuízo acumulado.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchResultadosData();
  }, []);

  const ultimoResultado = resultados.length > 0 ? resultados[resultados.length - 1] : null;
  const prejuizoSwing = ultimoResultado?.prejuizo_acumulado_swing ?? 0;
  const prejuizoDayTrade = ultimoResultado?.prejuizo_acumulado_day ?? 0;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">Prejuízo Acumulado</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Prejuízo Acumulado em Swing Trade</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(prejuizoSwing)}</p>
            <p className="text-sm text-muted-foreground">
              Valor disponível para compensação em lucros futuros de Swing Trade.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prejuízo Acumulado em Day Trade</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(prejuizoDayTrade)}</p>
            <p className="text-sm text-muted-foreground">
              Valor disponível para compensação em lucros futuros de Day Trade.
            </p>
          </CardContent>
        </Card>
      </div>
      {/* You might want to add a note about rules for loss compensation if applicable */}
    </div>
  );
}

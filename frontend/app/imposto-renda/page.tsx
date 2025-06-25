"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BensDireitosAcoesTable } from "@/components/BensDireitosAcoesTable"; // Import the new component
import { api } from "@/lib/api"; // For API calls
import { useToast } from "@/hooks/use-toast"; // For notifications
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { getUserOperatedYears } from "@/lib/userYears";

// Define the type for BemDireitoAcao based on BemDireitoAcaoSchema
interface BemDireitoAcao {
  ticker: string;
  nome_empresa?: string | null;
  cnpj?: string | null;
  quantidade: number;
  preco_medio: number;
  valor_total_data_base: number;
}

export default function ImpostoRendaPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear - 1);
  const [bensDireitosData, setBensDireitosData] = useState<BemDireitoAcao[]>([]);
  const [dividendos, setDividendos] = useState<{ ticker: string; empresa: string; cnpj: string; valor: number }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userYears, setUserYears] = useState<number[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    getUserOperatedYears()
      .then((years) => {
        const filteredYears = years.filter((year) => year < currentYear); // Exclui o ano atual
        setUserYears(filteredYears);
      })
      .catch(() => setUserYears([]));
  }, []);

  // Generate year options for the select dropdown
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - 1 - i);

  useEffect(() => {
    const fetchBensDireitosData = async () => {
      if (!selectedYear) return;

      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get(`/analysis/bens-e-direitos/acoes`, {
          params: { year: selectedYear },
        });
        setBensDireitosData(response.data);
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || "Erro ao buscar dados de Bens e Direitos.";
        setError(errorMessage);
        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive",
        });
        setBensDireitosData([]); // Clear data on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchBensDireitosData();
  }, [selectedYear, toast]);

  useEffect(() => {
    if (!selectedYear) return;
    api.get('/analysis/dividendos', { params: { year: selectedYear } })
      .then(res => setDividendos(res.data))
      .catch(() => setDividendos([]));
  }, [selectedYear]);

  const handleYearChange = (value: string) => {
    setSelectedYear(Number(value));
  };

  return (
    <div className="container mx-auto p-4 relative">
      <button
        className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow"
        onClick={() => router.push("/")}
        title="Voltar para Dashboard"
      >
        Voltar para Dashboard
      </button>
      <h1 className="text-2xl font-bold mb-4">
        Declaração Anual de Imposto de Renda
      </h1>

      {/* Filtro Ano Base no topo */}
      <div className="mb-6 flex flex-col items-center">
        <label htmlFor="year-select" className="block text-lg font-medium text-gray-700 mb-1">
          Ano Base
        </label>
        <Select value={String(selectedYear)} onValueChange={handleYearChange}>
          <SelectTrigger className="w-[100px] text-lg" id="year-select">
            <SelectValue placeholder="Selecione o ano" />
          </SelectTrigger>
          <SelectContent>
            {userYears.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="bens-e-direitos">
        <TabsList className="mb-4">
          <TabsTrigger value="bens-e-direitos">Bens e Direitos</TabsTrigger>
          <TabsTrigger value="rendimentos-isentos">
            Rendimentos Isentos e Não Tributáveis
          </TabsTrigger>
          <TabsTrigger value="rendimentos-tributacao-exclusiva">
            Rendimentos Sujeitos a Tributação Exclusiva
          </TabsTrigger>
          <TabsTrigger value="renda-variavel">Renda Variável</TabsTrigger>
        </TabsList>

        <TabsContent value="bens-e-direitos">
          {isLoading && (
            <div>
              <Skeleton className="h-8 w-1/2 mb-4" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          {error && !isLoading && (
            <div className="text-red-600 bg-red-100 p-4 rounded-md">
              <p><strong>Erro:</strong> {error}</p>
            </div>
          )}
          {!isLoading && !error && (
            <BensDireitosAcoesTable data={bensDireitosData} year={selectedYear} />
          )}
        </TabsContent>

        <TabsContent value="rendimentos-isentos">
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300 rounded">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border-b text-left">Ticker</th>
                  <th className="px-4 py-2 border-b text-left">Empresa</th>
                  <th className="px-4 py-2 border-b text-left">CNPJ</th>
                  <th className="px-4 py-2 border-b text-left">Total Dividendos (R$)</th>
                </tr>
              </thead>
              <tbody>
                {dividendos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-4 text-muted-foreground">Nenhum dividendo encontrado para o ano selecionado.</td>
                  </tr>
                ) : (
                  dividendos.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 border-b">{item.ticker}</td>
                      <td className="px-4 py-2 border-b">{item.empresa}</td>
                      <td className="px-4 py-2 border-b">{item.cnpj}</td>
                      <td className="px-4 py-2 border-b">{item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="rendimentos-tributacao-exclusiva">
          <p className="text-muted-foreground">
            Conteúdo da aba Rendimentos Sujeitos a Tributação Exclusiva.
          </p>
        </TabsContent>
        <TabsContent value="renda-variavel">
          <p className="text-muted-foreground">Conteúdo da aba Renda Variável.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

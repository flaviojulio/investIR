"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BensDireitosAcoesTable } from "@/components/BensDireitosAcoesTable"; // Import the new component
import { api } from "@/lib/api"; // For API calls
import { useToast } from "@/hooks/use-toast"; // For notifications
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { getUserOperatedYears } from "@/lib/userYears";
import DetalheLucrosIsentosCard from "./DetalheLucrosIsentosCard";
import ModalLucrosIsentosDetalhe from "./ModalLucrosIsentosDetalhe";
import JCPTributadoCard from "./JCPTributadoCard";
import { CopyableField } from "@/components/CopyableField";
import ModalRendimentoIsento from "@/components/ModalRendimentoIsento";
import { RendimentoIsentoCard } from "./RendimentoIsentoCard";

// Define the type for BemDireitoAcao based on BemDireitoAcaoSchema
interface BemDireitoAcao {
  ticker: string;
  nome_empresa?: string | null;
  cnpj?: string | null;
  quantidade: number;
  preco_medio: number;
  valor_total_data_base: number;
}

// Define the type for RendimentoIsento based on the backend response
interface RendimentoIsento {
  ticker: string;
  empresa?: string | null;
  cnpj?: string | null;
  valor_total_recebido_no_ano: number;
}

// Tipo para lucros isentos mensais
interface LucroIsentoMensal {
  mes: string;
  ganho_liquido_swing: number;
  isento_swing: boolean | number;
}

export default function ImpostoRendaPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear - 1);
  const [bensDireitosData, setBensDireitosData] = useState<BemDireitoAcao[]>([]);
  const [rendimentosIsentos, setRendimentosIsentos] = useState<RendimentoIsento[]>([]); // Changed state name and type
  const [isLoadingBensDireitos, setIsLoadingBensDireitos] = useState<boolean>(false); // Specific loading state
  const [isLoadingRendimentos, setIsLoadingRendimentos] = useState<boolean>(false); // Specific loading state
  const [errorBensDireitos, setErrorBensDireitos] = useState<string | null>(null); // Specific error state
  const [errorRendimentos, setErrorRendimentos] = useState<string | null>(null); // Specific error state
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

      setIsLoadingBensDireitos(true);
      setErrorBensDireitos(null);
      try {
        const response = await api.get(`/analysis/bens-e-direitos/acoes`, {
          params: { year: selectedYear },
        });
        setBensDireitosData(response.data);
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || "Erro ao buscar dados de Bens e Direitos.";
        setErrorBensDireitos(errorMessage);
        toast({
          title: "Erro em Bens e Direitos",
          description: errorMessage,
          variant: "destructive",
        });
        setBensDireitosData([]); // Clear data on error
      } finally {
        setIsLoadingBensDireitos(false);
      }
    };

    const fetchRendimentosIsentosData = async () => {
      if (!selectedYear) return;

      setIsLoadingRendimentos(true);
      setErrorRendimentos(null);
      try {
        const response = await api.get('/analysis/rendimentos-isentos', {
          params: { year: selectedYear },
        });
        setRendimentosIsentos(response.data);
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || "Erro ao buscar Rendimentos Isentos.";
        setErrorRendimentos(errorMessage);
        toast({
          title: "Erro em Rendimentos Isentos",
          description: errorMessage,
          variant: "destructive",
        });
        setRendimentosIsentos([]); // Clear data on error
      } finally {
        setIsLoadingRendimentos(false);
      }
    };

    fetchBensDireitosData();
    fetchRendimentosIsentosData();
  }, [selectedYear, toast]);

  const handleYearChange = (value: string) => {
    setSelectedYear(Number(value));
  };

  // --- NOVA LÓGICA: Buscar lucros isentos mensais (vendas até 20 mil) ---
  const [lucrosIsentosMensais, setLucrosIsentosMensais] = useState<LucroIsentoMensal[]>([]);
  const [isLoadingLucrosIsentos, setIsLoadingLucrosIsentos] = useState(false);
  const [errorLucrosIsentos, setErrorLucrosIsentos] = useState<string | null>(null);

  useEffect(() => {
    const fetchLucrosIsentosMensais = async () => {
      setIsLoadingLucrosIsentos(true);
      setErrorLucrosIsentos(null);
      try {
        const response = await api.get('/analysis/lucros-isentos', {
          params: { year: selectedYear },
        });
        setLucrosIsentosMensais(response.data);
      } catch (err: any) {
        setErrorLucrosIsentos('Erro ao buscar lucros isentos mensais.');
        setLucrosIsentosMensais([]);
      } finally {
        setIsLoadingLucrosIsentos(false);
      }
    };
    fetchLucrosIsentosMensais();
  }, [selectedYear]);

  // Agrupa e soma lucros isentos por mês do ano selecionado
  let lucrosIsentosPorMes: { mes: string; valor: number }[] = [];
  let valorTotalLucrosIsentos = 0;
  if (lucrosIsentosMensais.length > 0) {
    const mapaMes: Record<string, number> = {};
    lucrosIsentosMensais.forEach((item) => {
      if ((item.isento_swing === 1 || item.isento_swing === true) && item.mes && item.ganho_liquido_swing) {
        if (item.mes.startsWith(String(selectedYear))) {
          mapaMes[item.mes] = (mapaMes[item.mes] || 0) + item.ganho_liquido_swing;
        }
      }
    });
    lucrosIsentosPorMes = Object.entries(mapaMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valor]) => ({ mes, valor }));
    valorTotalLucrosIsentos = lucrosIsentosPorMes.reduce((acc, cur) => acc + cur.valor, 0);
  }

  // Modal state
  const [modalLucrosIsentosOpen, setModalLucrosIsentosOpen] = useState(false);
  const [modalRendimentoIsentoOpen, setModalRendimentoIsentoOpen] = useState(false);
  const [rendimentoIsentoSelecionado, setRendimentoIsentoSelecionado] = useState<RendimentoIsento | null>(null);

  // Cria dicionário para lookup rápido por CNPJ
  const rendimentosIsentosByCnpj = useMemo(() => {
    const dict: Record<string, RendimentoIsento> = {};
    rendimentosIsentos.forEach((r) => {
      if (r.cnpj) dict[r.cnpj] = r;
    });
    return dict;
  }, [rendimentosIsentos]);

  // Handler para abrir modal
  function handleInformarRendimentoIsento(cnpj: string) {
    const rendimento = rendimentosIsentosByCnpj[cnpj];
    setRendimentoIsentoSelecionado(rendimento || null);
    setModalRendimentoIsentoOpen(!!rendimento);
  }

  // --- NOVA LÓGICA: Buscar JCP tributados por ação ---
  interface JCPTributado {
    ticker: string;
    empresa?: string | null;
    cnpj?: string | null;
    valor_total_jcp_no_ano: number;
  }
  const [jcpTributados, setJcpTributados] = useState<JCPTributado[]>([]);
  const [isLoadingJCP, setIsLoadingJCP] = useState(false);
  const [errorJCP, setErrorJCP] = useState<string | null>(null);

  useEffect(() => {
    const fetchJCPTributados = async () => {
      setIsLoadingJCP(true);
      setErrorJCP(null);
      try {
        const response = await api.get('/analysis/jcp-tributados', {
          params: { year: selectedYear },
        });
        setJcpTributados(response.data);
      } catch (err: any) {
        setErrorJCP('Erro ao buscar JCP tributados.');
        setJcpTributados([]);
      } finally {
        setIsLoadingJCP(false);
      }
    };
    fetchJCPTributados();
  }, [selectedYear]);

  return (
    <div className="container mx-auto p-4 relative">
      {/* Removido botão de debug e tabela do topo */}
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
          {isLoadingBensDireitos && (
            <div>
              <Skeleton className="h-8 w-1/2 mb-4" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          {errorBensDireitos && !isLoadingBensDireitos && (
            <div className="text-red-600 bg-red-100 p-4 rounded-md">
              <p><strong>Erro ao carregar Bens e Direitos:</strong> {errorBensDireitos}</p>
            </div>
          )}
          {!isLoadingBensDireitos && !errorBensDireitos && (
            <BensDireitosAcoesTable
              data={bensDireitosData}
              year={selectedYear}
              onInformarRendimentoIsento={handleInformarRendimentoIsento}
            />
          )}
        </TabsContent>

        <TabsContent value="rendimentos-isentos">
          {isLoadingRendimentos && (
            <div>
              <Skeleton className="h-8 w-1/2 mb-4" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          {errorRendimentos && !isLoadingRendimentos && (
            <div className="text-red-600 bg-red-100 p-4 rounded-md">
              <p><strong>Erro ao carregar Rendimentos Isentos:</strong> {errorRendimentos}</p>
            </div>
          )}
          {!isLoadingRendimentos && !errorRendimentos && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {rendimentosIsentos.length === 0 ? (
                  <div className="col-span-2 text-center py-4 text-muted-foreground">Nenhum rendimento isento encontrado para o ano selecionado.</div>
                ) : (
                  rendimentosIsentos.map((item, idx) => (
                    <RendimentoIsentoCard
                      key={item.cnpj || idx}
                      ticker={item.ticker}
                      nome_empresa={item.empresa}
                      cnpj={item.cnpj}
                      valor_total_recebido_no_ano={item.valor_total_recebido_no_ano}
                    />
                  ))
                )}
              </div>
              {/* Card de Lucros Isentos (vendas até 20 mil) */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Lucros Isentos (Vendas até R$20.000 no mês)</h2>
                <DetalheLucrosIsentosCard
                  valorTotal={valorTotalLucrosIsentos}
                  onOpenModal={() => setModalLucrosIsentosOpen(true)}
                />
                <ModalLucrosIsentosDetalhe
                  open={modalLucrosIsentosOpen}
                  onClose={() => setModalLucrosIsentosOpen(false)}
                  lucrosIsentosPorMes={lucrosIsentosPorMes}
                  ano={selectedYear}
                  valorTotal={valorTotalLucrosIsentos}
                />
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="rendimentos-tributacao-exclusiva">
          {isLoadingJCP ? (
            <Skeleton className="h-8 w-1/2 mb-4" />
          ) : errorJCP ? (
            <div className="text-red-600 bg-red-100 p-4 rounded-md mb-2">{errorJCP}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {jcpTributados.length === 0 ? (
                <div className="col-span-2 text-center py-4 text-muted-foreground">Nenhum JCP tributado encontrado para o ano selecionado.</div>
              ) : (
                jcpTributados.map((item, idx) => (
                  <JCPTributadoCard
                    key={item.ticker + idx}
                    ticker={item.ticker}
                    empresa={item.empresa}
                    cnpj={item.cnpj}
                    valor={item.valor_total_jcp_no_ano}
                  />
                ))
              )}
            </div>
          )}
        </TabsContent>
        <TabsContent value="renda-variavel">
          <p className="text-muted-foreground">Conteúdo da aba Renda Variável.</p>
        </TabsContent>
      </Tabs>
      <ModalRendimentoIsento
        open={modalRendimentoIsentoOpen}
        onClose={() => setModalRendimentoIsentoOpen(false)}
        rendimento={rendimentoIsentoSelecionado}
      />
    </div>
  );
}

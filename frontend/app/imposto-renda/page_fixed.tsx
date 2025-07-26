"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import ModalRendimentoExclusivo from "@/components/ModalRendimentoExclusivo";
import RendaVariavelOperacoes from "./renda-variavel-operacoes";
import { Building2, DollarSign, Receipt, TrendingUp } from "lucide-react"; // Importação dos ícones

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
  nome_empresa?: string;
  empresa?: string;
  cnpj: string;
  valor_total_recebido_no_ano: number;
}

// Tipo para lucros isentos mensais
interface LucroIsentoMensal {
  mes: string;
  ganho_liquido_swing: number;
  isento_swing: boolean | number;
}

// Define type for tab values
type TabValue = "bens-e-direitos" | "rendimentos-isentos" | "rendimentos-tributacao-exclusiva" | "renda-variavel";

// Modern TabButton component
interface TabButtonProps {
  value: TabValue;
  children: React.ReactNode;
  color: string;
  isActive: boolean;
  onClick: (value: TabValue) => void;
}

function TabButton({ value, children, color, isActive, onClick }: TabButtonProps) {
  const baseClasses = "inline-flex items-center px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg whitespace-nowrap cursor-pointer";
  let backgroundColor = undefined;
  if (isActive) {
    if (color === 'blue') backgroundColor = '#2563eb';
    else if (color === 'green') backgroundColor = '#16a34a';
    else if (color === 'purple') backgroundColor = '#9333ea';
    else if (color === 'orange') backgroundColor = '#ea580c';
    else if (color === 'red') backgroundColor = '#dc2626';
    else if (color === 'indigo') backgroundColor = '#4f46e5';
    else backgroundColor = '#2563eb';
  }
  return (
    <button
      className={
        baseClasses +
        (isActive
          ? ' shadow-md text-white'
          : ' text-gray-700 hover:bg-gray-50')
      }
      onClick={() => onClick(value)}
      style={isActive ? { backgroundColor, color: 'white' } : {}}
    >
      {children}
    </button>
  );
}

export default function ImpostoRendaPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear - 1);
  const [activeTab, setActiveTab] = useState<TabValue>("bens-e-direitos");
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
        setRendimentosIsentos(response.data.map((item: any) => ({
          ...item,
          cnpj: item.cnpj || '',
        })));
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

  // Cria dicionário para lookup rápido por CNPJ para JCP tributados
  const jcpTributadosByCnpj = useMemo(() => {
    const dict: Record<string, JCPTributado> = {};
    jcpTributados.forEach((j) => {
      if (j.cnpj) dict[j.cnpj] = j;
    });
    return dict;
  }, [jcpTributados]);

  // Handler para abrir modal de rendimento exclusivo
  const [modalRendimentoExclusivoOpen, setModalRendimentoExclusivoOpen] = useState(false);
  const [rendimentoExclusivoSelecionado, setRendimentoExclusivoSelecionado] = useState<JCPTributado | null>(null);
  function handleInformarRendimentoExclusivo(cnpj: string) {
    const rendimento = jcpTributadosByCnpj[cnpj];
    setRendimentoExclusivoSelecionado(rendimento || null);
    setModalRendimentoExclusivoOpen(!!rendimento);
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 relative">
      {/* Botão de voltar */}
      <button
        className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow"
        onClick={() => router.push("/")}
        title="Voltar para Dashboard"
      >
        Voltar para Dashboard
      </button>
      
      {/* Título seguindo o padrão do Dashboard */}
      <div className="mb-8">       
        <div className="flex items-center gap-4 mb-2">
          <div className="h-10 w-2 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Módulo IR: Declaração Anual
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300 ml-6">
          Declare o imposto de renda anual das suas ações de forma fácil
        </p>
      </div>

      {/* Filtro Ano Base seguindo o padrão de proventos */}
      <div className="mb-8 max-w-xs">
        <label htmlFor="year-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
          Filtrar por Ano:
        </label>
        <Select value={String(selectedYear)} onValueChange={handleYearChange}>
          <SelectTrigger id="year-select" className="w-full">
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

      {/* Modern Tabs Layout seguindo o padrão do Dashboard */}
      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
          <div className="flex flex-wrap gap-1">
            <TabButton 
              value="bens-e-direitos" 
              color="blue" 
              isActive={activeTab === "bens-e-direitos"} 
              onClick={setActiveTab}
            >
              <Building2 className={`h-4 w-4 mr-2 ${activeTab === "bens-e-direitos" ? "text-white" : "text-blue-600"}`} />
              <span className="text-sm">Bens e Direitos</span>
            </TabButton>
            <TabButton 
              value="rendimentos-isentos" 
              color="green" 
              isActive={activeTab === "rendimentos-isentos"} 
              onClick={setActiveTab}
            >
              <DollarSign className={`h-4 w-4 mr-2 ${activeTab === "rendimentos-isentos" ? "text-white" : "text-green-600"}`} />
              <span className="text-sm">Rendimentos Isentos</span>
            </TabButton>
            <TabButton 
              value="rendimentos-tributacao-exclusiva" 
              color="orange" 
              isActive={activeTab === "rendimentos-tributacao-exclusiva"} 
              onClick={setActiveTab}
            >
              <Receipt className={`h-4 w-4 mr-2 ${activeTab === "rendimentos-tributacao-exclusiva" ? "text-white" : "text-orange-600"}`} />
              <span className="text-sm">Tributação Exclusiva</span>
            </TabButton>
            <TabButton 
              value="renda-variavel" 
              color="purple" 
              isActive={activeTab === "renda-variavel"} 
              onClick={setActiveTab}
            >
              <TrendingUp className={`h-4 w-4 mr-2 ${activeTab === "renda-variavel" ? "text-white" : "text-purple-600"}`} />
              <span className="text-sm">Renda Variável</span>
            </TabButton>
          </div>
          {/* Indicador Mobile */}
          <div className="md:hidden mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500 flex items-center">
              <div className="w-2 h-2 rounded-full bg-current mr-2"></div>
              Aba ativa: 
              <span className="ml-1 font-medium text-gray-700">
                {activeTab === "bens-e-direitos" && "Bens e Direitos"}
                {activeTab === "rendimentos-isentos" && "Rendimentos Isentos"}
                {activeTab === "rendimentos-tributacao-exclusiva" && "Tributação Exclusiva"}
                {activeTab === "renda-variavel" && "Renda Variável"}
              </span>
            </div>
          </div>
        </div>
        
        {/* Conteúdo da Tab Ativa */}
        <div className="min-h-[400px]">
          {activeTab === "bens-e-direitos" && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
                Bens e Direitos - Ações e Fundos Imobiliários ({selectedYear})
              </h2>
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
                  onInformarRendimentoExclusivo={handleInformarRendimentoExclusivo}
                />
              )}
            </div>
          )}

          {activeTab === "rendimentos-isentos" && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
                Rendimentos Isentos e Não Tributáveis ({selectedYear})
              </h2>
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
                      <div className="col-span-2 text-center py-8 text-gray-600 dark:text-gray-400">
                        Nenhum rendimento isento encontrado para o ano selecionado.
                      </div>
                    ) : (
                      rendimentosIsentos.map((item, idx) => (
                        <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-400 to-blue-300 p-3 flex items-center">
                            <div className="w-6 h-6 bg-green-600 rounded mr-2 flex items-center justify-center">
                              <span className="text-white font-bold text-xs">✓</span>
                            </div>
                            <h1 className="text-white text-lg font-semibold">Rendimento Isento e Não Tributável</h1>
                          </div>
                          <div className="p-4 space-y-4">
                            <div>
                              <label className="block text-gray-600 dark:text-gray-300 font-medium mb-2">Tipo de Rendimento</label>
                              <div className="bg-gray-500 text-white p-2 rounded text-sm font-medium mb-2">
                                09 - Lucros e dividendos recebidos
                              </div>
                              <div className="border border-gray-300 dark:border-gray-600 rounded p-3 bg-gray-50 dark:bg-gray-700">
                                <div className="text-blue-600 dark:text-blue-400 font-semibold mb-3">09. Lucros e dividendos recebidos</div>
                                <div className="space-y-3">
                                  <CopyableField value="Titular" input>
                                    <div>
                                      <label className="block text-gray-600 dark:text-gray-300 font-medium mb-1 text-sm">Tipo de Beneficiário</label>
                                      <input
                                        type="text"
                                        value="Titular"
                                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 dark:text-white"
                                        readOnly
                                      />
                                    </div>
                                  </CopyableField>
                                  <CopyableField value="CPF do Titular" input>
                                    <div>
                                      <label className="block text-gray-600 dark:text-gray-300 font-medium mb-1 text-sm">Beneficiário</label>
                                      <input
                                        type="text"
                                        value="CPF do Titular"
                                        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
                                        readOnly
                                      />
                                    </div>
                                  </CopyableField>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <CopyableField value={item.cnpj || "N/A"} input>
                                      <div>
                                        <label className="block text-gray-600 dark:text-gray-300 font-medium mb-1 text-sm">CNPJ da Fonte Pagadora</label>
                                        <input
                                          type="text"
                                          value={item.cnpj || "N/A"}
                                          className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white"
                                          readOnly
                                        />
                                      </div>
                                    </CopyableField>
                                    <CopyableField value={item.empresa || "N/A"} input>
                                      <div>
                                        <label className="block text-gray-600 dark:text-gray-300 font-medium mb-1 text-sm">Nome da Fonte Pagadora</label>
                                        <input
                                          type="text"
                                          value={item.empresa || "N/A"}
                                          className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 dark:text-white"
                                          readOnly
                                        />
                                      </div>
                                    </CopyableField>
                                  </div>
                                  <CopyableField value={item.valor_total_recebido_no_ano.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} input>
                                    <div>
                                      <label className="block text-gray-600 dark:text-gray-300 font-medium mb-1 text-sm">Valor</label>
                                      <div className="flex">
                                        <input
                                          type="text"
                                          value={item.valor_total_recebido_no_ano.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          className="w-32 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-white text-right"
                                          readOnly
                                        />
                                      </div>
                                    </div>
                                  </CopyableField>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {/* Card de Lucros Isentos (vendas até 20 mil) */}
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
                      Lucros Isentos (Vendas até R$20.000 no mês)
                    </h3>
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
            </div>
          )}

          {activeTab === "rendimentos-tributacao-exclusiva" && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
                Rendimentos Sujeitos a Tributação Exclusiva ({selectedYear})
              </h2>
              {isLoadingJCP ? (
                <Skeleton className="h-8 w-1/2 mb-4" />
              ) : errorJCP ? (
                <div className="text-red-600 bg-red-100 p-4 rounded-md mb-2">{errorJCP}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {jcpTributados.length === 0 ? (
                    <div className="col-span-2 text-center py-8 text-gray-600 dark:text-gray-400">
                      Nenhum JCP tributado encontrado para o ano selecionado.
                    </div>
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
            </div>
          )}

          {activeTab === "renda-variavel" && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
                Renda Variável - Operações e Ganhos/Perdas ({selectedYear})
              </h2>
              <RendaVariavelOperacoes ano={selectedYear} />
            </div>
          )}
        </div>
      </div>
      
      <ModalRendimentoIsento
        open={modalRendimentoIsentoOpen}
        onClose={() => setModalRendimentoIsentoOpen(false)}
        rendimento={rendimentoIsentoSelecionado}
      />
      <ModalRendimentoExclusivo
        open={modalRendimentoExclusivoOpen}
        onClose={() => setModalRendimentoExclusivoOpen(false)}
        rendimento={rendimentoExclusivoSelecionado}
      />
    </div>
  );
}

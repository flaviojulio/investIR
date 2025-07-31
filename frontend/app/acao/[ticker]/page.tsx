"use client";

import { useParams } from 'next/navigation'; // To get ticker from URL
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
// import removido: Operacao, ResultadoTicker
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Package, Briefcase, ShoppingCart, Landmark, Search, X, Gift, BarChart3, Calendar, Clock, Calculator, Shield, PieChart, BookOpen, Building, Trophy, Wallet, Activity, Receipt } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // For back button
import { Input } from '@/components/ui/input'; // For search input
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Interfaces tipadas para dados da ação
interface DadosAcao {
  quantidade_atual: number;
  preco_medio_atual: number;
  custo_total_atual: number;
  lucro_prejuizo_realizado_total: number;
  total_investido_historico: number;
  total_vendido_historico: number;
  operacoes_compra_total_quantidade: number;
  operacoes_venda_total_quantidade: number;
}

interface InformacaoAcao {
  ticker: string;
  nome: string;
  logo?: string;
}

interface OperacaoAcao {
  id: number;
  date: string;
  ticker: string;
  operation: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees: number;
}

interface ProventosPorAcao {
  ticker: string;
  ticker_acao?: string;
  nome_acao?: string;
  total_proventos: number;
  total_recebido_geral_acao?: number;
  detalhes_por_tipo?: Array<{
    tipo: string;
    valor: number;
    data: string;
  }>;
  quantidade_pagamentos?: number;
}

interface CotacaoAtual {
  data: string;
  fechamento: number;
  abertura?: number;
  maxima?: number;
  minima?: number;
  volume?: number;
}

// 🛠️ Funções utilitárias
const formatDate = (dateString: string | null | undefined, placeholder: string = "N/A") => {
  if (!dateString) return placeholder;
  // Assuming dateString is in "YYYY-MM-DD" or full ISO format
  return new Date(dateString).toLocaleDateString("pt-BR", {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
};

// 📊 Funções para processamento de dados dos gráficos
const processarDadosEvolucaoInvestimento = (operacoes: OperacaoAcao[]): Array<{mes: string, valor: number}> => {
  console.log(`🔍 [DEBUG] processarDadosEvolucaoInvestimento recebeu ${operacoes?.length || 0} operações`);
  
  if (!operacoes || operacoes.length === 0) {
    console.log(`⚠️ [DEBUG] Sem operações para processar`);
    return [];
  }
  
  // Filtrar e ordenar todas as operações por data (compras e vendas)
  const operacoesOrdenadas = operacoes
    .filter(op => op.date && (op.operation === 'buy' || op.operation === 'sell'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  console.log(`🎯 [DEBUG] Processando ${operacoesOrdenadas.length} operações ordenadas por data`);
  
  if (operacoesOrdenadas.length === 0) return [];
  
  // Calcular valor acumulado investido ao longo do tempo
  let valorAcumulado = 0;
  const pontosPorMes = new Map<string, number>();
  
  operacoesOrdenadas.forEach((operacao, index) => {
    console.log(`🔍 [DEBUG] Processando operação ${index + 1}:`, operacao);
    
    const data = new Date(operacao.date);
    const mesAno = `${data.getMonth() + 1}/${data.getFullYear().toString().substr(-2)}`;
    
    if (operacao.operation === 'buy') {
      // Compra: aumenta o valor investido acumulado
      const valorOperacao = (operacao.price * operacao.quantity) + (operacao.fees || 0);
      valorAcumulado += valorOperacao;
      console.log(`💰 [DEBUG] Compra: +R$ ${valorOperacao} | Acumulado: R$ ${valorAcumulado}`);
    } else if (operacao.operation === 'sell') {
      // Venda: reduz o valor investido acumulado (venda de parte da posição)
      const valorOperacao = (operacao.price * operacao.quantity) - (operacao.fees || 0);
      valorAcumulado -= valorOperacao;
      console.log(`📈 [DEBUG] Venda: -R$ ${valorOperacao} | Acumulado: R$ ${valorAcumulado}`);
    }
    
    // Armazenar o último valor acumulado para cada mês (sobrescreve se houver múltiplas operações no mês)
    pontosPorMes.set(mesAno, valorAcumulado);
  });
  
  // Converter para array e ordenar por data
  const dadosGrafico = Array.from(pontosPorMes.entries())
    .map(([mes, valor]) => ({ mes, valor }))
    .sort((a, b) => {
      const [mesA, anoA] = a.mes.split('/');
      const [mesB, anoB] = b.mes.split('/');
      const dataA = new Date(2000 + parseInt(anoA), parseInt(mesA) - 1);
      const dataB = new Date(2000 + parseInt(anoB), parseInt(mesB) - 1);
      return dataA.getTime() - dataB.getTime();
    });
  
  console.log(`📊 [DEBUG] Dados finais do gráfico de evolução do valor investido:`, dadosGrafico);
  return dadosGrafico;
};

const processarDadosProventosMensais = (proventosUsuario: any[] | null, tickerFiltro: string): Array<{mes: string, valor: number}> => {
  console.log(`🔍 [DEBUG] processarDadosProventosMensais recebeu ${proventosUsuario?.length || 0} proventos do usuário para filtrar por ${tickerFiltro}`);
  
  if (!proventosUsuario || proventosUsuario.length === 0) {
    console.log(`⚠️ [DEBUG] Sem dados de proventos do usuário para processar`);
    return [];
  }
  
  // Filtrar apenas proventos do ticker específico
  const proventosDaTicker = proventosUsuario.filter(provento => 
    provento.ticker_acao?.toUpperCase() === tickerFiltro.toUpperCase()
  );
  
  console.log(`🎯 [DEBUG] Filtrados ${proventosDaTicker.length} proventos para ${tickerFiltro}`);
  
  if (proventosDaTicker.length === 0) {
    return [];
  }
  
  // Agrupar proventos por mês usando data_ex
  const proventosPorMes = new Map<string, number>();
  
  proventosDaTicker.forEach((provento, index) => {
    console.log(`🔍 [DEBUG] Processando provento ${index + 1} de ${tickerFiltro}:`, provento);
    const dataProvento = provento.data_ex;
    if (dataProvento) {
      const data = new Date(dataProvento);
      const mesAno = `${data.getMonth() + 1}/${data.getFullYear().toString().substr(-2)}`;
      const valorAtual = proventosPorMes.get(mesAno) || 0;
      
      // ✅ CORREÇÃO: Usar valor_total_recebido que já vem calculado corretamente da API do usuário
      const valorTotalRecebido = provento.valor_total_recebido || 0;
                                
      const novoValor = valorAtual + valorTotalRecebido;
      proventosPorMes.set(mesAno, novoValor);
      console.log(`📊 [DEBUG] Adicionado ao mês ${mesAno}: R$ ${valorTotalRecebido} (Total do mês: R$ ${novoValor})`);
    } else {
      console.log(`⚠️ [DEBUG] Provento sem data_ex válida:`, provento);
    }
  });
  
  // Converter para array e ordenar por data
  const dadosGrafico = Array.from(proventosPorMes.entries())
    .map(([mes, valor]) => ({ mes, valor }))
    .sort((a, b) => {
      const [mesA, anoA] = a.mes.split('/');
      const [mesB, anoB] = b.mes.split('/');
      const dataA = new Date(2000 + parseInt(anoA), parseInt(mesA) - 1);
      const dataB = new Date(2000 + parseInt(anoB), parseInt(mesB) - 1);
      return dataA.getTime() - dataB.getTime();
    });
  
  console.log(`📊 [DEBUG] Dados finais do gráfico de proventos mensais para ${tickerFiltro}:`, dadosGrafico);
  return dadosGrafico;
};

export default function AcaoDetalhePage() {
  const params = useParams();
  const ticker = typeof params.ticker === 'string' ? params.ticker.toUpperCase() : '';

  // Helper functions
  const formatCurrency = (value: number | null | undefined, placeholder: string = "R$ 0,00") => {
    if (value == null || isNaN(value)) return placeholder;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatNumber = (value: number | null | undefined, placeholder: string = "0") => {
    if (value == null || isNaN(value)) return placeholder;
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  // Hook para calcular resultado não realizado
  const useResultadoNaoRealizado = (dados: DadosAcao | null, cotacaoAtual: CotacaoAtual | null) => {
    return React.useMemo(() => {
      if (!dados || !cotacaoAtual) return null;
      
      const possuiAcoes = dados.quantidade_atual > 0;
      const temCotacao = cotacaoAtual.fechamento > 0;
      const temPrecoMedio = dados.preco_medio_atual > 0;
      
      if (!possuiAcoes || !temCotacao || !temPrecoMedio) {
        return { disponivel: false, valor: 0, percentual: 0 };
      }
      
      const valorAtual = dados.quantidade_atual * cotacaoAtual.fechamento;
      const valorInvestido = dados.quantidade_atual * dados.preco_medio_atual;
      const lucroNaoRealizado = valorAtual - valorInvestido;
      const percentual = valorInvestido > 0 ? (lucroNaoRealizado / valorInvestido) * 100 : 0;
      
      return {
        disponivel: true,
        valor: lucroNaoRealizado,
        percentual: percentual
      };
    }, [dados, cotacaoAtual]);
  };

  // Skeleton components
  const CardSkeleton = () => (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );

  // Componente de Loading para a seção de cards
  const SectionLoadingSkeleton = ({ title, cardCount = 4 }: { title: string; cardCount?: number }) => (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-1 bg-gradient-to-b from-gray-400 to-gray-500 rounded-full"></div>
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cardCount }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </section>
  );

  // Componente para Card de Resultado Não Realizado
  const CardResultadoNaoRealizado = ({ resultado }: { resultado: any }) => {
    const corCard = resultado?.disponivel ? (resultado.valor >= 0 ? 'green' : 'red') : 'gray';
    
    return (
      <div className={`${
        corCard === 'green' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200' :
        corCard === 'red' ? 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200' :
        'bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200'
      } rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className={`text-lg font-semibold ${
              corCard === 'green' ? 'text-emerald-700' :
              corCard === 'red' ? 'text-red-700' :
              'text-gray-700'
            } flex items-center gap-2`}>
              {corCard === 'green' ? <TrendingUp className="h-5 w-5" /> :
               corCard === 'red' ? <TrendingDown className="h-5 w-5" /> :
               <BarChart3 className="h-5 w-5" />}
              Resultado Atual
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {resultado?.disponivel ? (
            <>
              <div className={`text-3xl font-bold mb-2 ${
                corCard === 'green' ? 'text-emerald-800' :
                corCard === 'red' ? 'text-red-800' :
                'text-gray-800'
              }`}>
                {formatCurrency(resultado.valor)}
              </div>
              <p className={`text-sm mb-1 ${
                corCard === 'green' ? 'text-emerald-600' :
                corCard === 'red' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {resultado.valor >= 0 ? '📈' : '📉'} {resultado.percentual >= 0 ? '+' : ''}{resultado.percentual.toFixed(2)}% não realizado
              </p>
              <p className={`text-xs ${
                corCard === 'green' ? 'text-emerald-500' :
                corCard === 'red' ? 'text-red-500' :
                'text-gray-500'
              }`}>
                💡 {formatCurrency(cotacaoAtual?.fechamento || 0)} atual vs {formatCurrency(dados?.preco_medio_atual || 0)} médio
              </p>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-gray-800 mb-2">--</div>
              <p className="text-sm text-gray-600">📊 Aguardando dados</p>
              <p className="text-xs text-gray-500 mt-1">💡 Precisa de cotação e posição para calcular</p>
            </>
          )}
        </CardContent>
      </div>
    );
  };

  const [dados, setDados] = useState<DadosAcao | null>(null);
  const [infoAcao, setInfoAcao] = useState<InformacaoAcao | null>(null);
  const [operacoes, setOperacoes] = useState<OperacaoAcao[]>([]);
  const [proventos, setProventos] = useState<ProventosPorAcao | null>(null);
  const [proventosUsuario, setProventosUsuario] = useState<any[] | null>(null); // 📊 Novos dados: proventos específicos do usuário
  const [cotacaoAtual, setCotacaoAtual] = useState<CotacaoAtual | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Estados para dados dos gráficos
  const [dadosEvolucaoInvestimento, setDadosEvolucaoInvestimento] = useState<Array<{mes: string, valor: number}>>([]);
  const [dadosProventosMensais, setDadosProventosMensais] = useState<Array<{mes: string, valor: number}>>([]);
  
  // Estados para Calculadora DCA
  const [valorAporteMensal, setValorAporteMensal] = useState<number>(500);
  const [periodoMeses, setPeriodoMeses] = useState<number>(12);
  const [precoAlvoDCA, setPrecoAlvoDCA] = useState<number | null>(null);
  
  // Estados para filtros e paginação da tabela de proventos
  const [filtroProventos, setFiltroProventos] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const itensPorPagina = 10;

  // Hook para calcular resultado não realizado
  const resultadoNaoRealizado = useResultadoNaoRealizado(dados, cotacaoAtual);

  useEffect(() => {
    if (!ticker) {
      setLoading(false);
      setError("Ticker não fornecido na URL.");
      return;
    }

    async function fetchDetalhesAcao() {
      setLoading(true);
      setError(null);
      try {
        console.log(`🔍 [DEBUG] Buscando informações para ticker: ${ticker}`);
        
        const infoAcaoRes = await api.get(`/acoes/info/${ticker}`).catch((error) => {
          console.error(`🚨 [DEBUG] Erro ao buscar info da ação ${ticker}:`, error);
          return null;
        });
        
        console.log(`🔍 [DEBUG] Resposta completa da API /acoes/info/${ticker}:`, infoAcaoRes);
        
        let idAcao = infoAcaoRes?.data?.id; // Tentar obter ID da API info (corrigida)
        console.log(`🔍 [DEBUG] ID da ação via API info: ${idAcao}`);
        
        // 🔧 FALLBACK: Se API info falhar, usar mapeamento conhecido
        if (!idAcao) {
          console.log(`⚠️ [DEBUG] Usando fallback para obter ID...`);
          const tickerToIdMap: {[key: string]: number} = {
            'BBAS3': 4, 'VALE3': 24, 'PETR4': 10, 'ITUB4': 9, 'MGLU3': 2, 'B3SA3': 2, 
            'CYRE3': 5, 'SAPR11': 6, 'GOAU4': 7, 'AERI3': 8, 'TOTS3': 11, 'CSAN3': 12, 
            'ITSA4': 13, 'RDOR3': 14 // Baseado nos dados conhecidos do sistema
          };
          idAcao = tickerToIdMap[ticker.toUpperCase()];
          console.log(`🔧 [DEBUG] ID obtido via fallback: ${idAcao}`);
        }
        
        console.log(`🎯 [DEBUG] ID final da ação ${ticker}: ${idAcao}`);
        
        const [resResultados, resOperacoes, resProventos, resProventosUsuario, resCotacao] = await Promise.all([
          api.get(`/resultados/ticker/${ticker}`),
          api.get(`/operacoes/ticker/${ticker}`),
          api.get(`/usuario/proventos/resumo_por_acao/`),
          api.get(`/usuario/proventos/`).catch(() => null), // 🎁 Buscar proventos detalhados do usuário com valor_total_recebido
          api.get(`/cotacoes/ticker/${ticker}/mais-recente`).catch(() => null) // 💹 Buscar cotação mais recente (opcional)
        ]);
        
        console.log(`🔍 [DEBUG] Resposta da API de info da ação:`, infoAcaoRes?.data);
        console.log(`🔍 [DEBUG] Resposta da API de proventos resumo:`, resProventos?.data);
        console.log(`🔍 [DEBUG] Resposta da API de proventos do usuário:`, resProventosUsuario?.data);
        setDados(resResultados.data);
        const operacoesMapeadas = Array.isArray(resOperacoes.data)
          ? resOperacoes.data.map((op: any, idx: number) => ({
              id: idx,
              date: op["Data do Negócio"] || op.date || "",
              ticker: op["Código de Negociação"] || op.ticker || "",
              operation: op["Tipo de Movimentação"] || op.operation || "",
              quantity: op["Quantidade"] ?? op.quantity ?? 0,
              price: op["Preço"] ?? op.price ?? 0,
              fees: op["Taxas"] ?? op.fees ?? 0,
            }))
          : [];
        setOperacoes(operacoesMapeadas);
        const proventosData = Array.isArray(resProventos.data)
          ? resProventos.data.find((p: any) => p.ticker_acao?.toUpperCase() === ticker.toUpperCase())
          : null;
        console.log(`🔍 [DEBUG] Proventos data encontrados para ${ticker}:`, proventosData);
        const proventosProcessados = proventosData ? {
          ticker: ticker,
          ticker_acao: proventosData.ticker_acao,
          nome_acao: proventosData.nome_acao,
          total_proventos: proventosData.total_recebido_geral_acao || 0,
          total_recebido_geral_acao: proventosData.total_recebido_geral_acao || 0,
          detalhes_por_tipo: proventosData.detalhes_por_tipo || [],
          quantidade_pagamentos: proventosData.detalhes_por_tipo?.length || 0
        } : { 
          ticker: ticker,
          total_proventos: 0, 
          quantidade_pagamentos: 0,
          detalhes_por_tipo: []
        };
        console.log(`🔍 [DEBUG] Proventos processados para estado:`, proventosProcessados);
        setProventos(proventosProcessados);
        
        // 📊 Definir proventos do usuário (para cálculo do gráfico mensal)
        setProventosUsuario(resProventosUsuario?.data || []);
        console.log(`🔍 [DEBUG] Proventos do usuário salvos:`, resProventosUsuario?.data?.length || 0, 'registros');
        
        // 💹 Definir cotação atual (se disponível)
        setCotacaoAtual(resCotacao?.data || null);
        
        // 🏷️ Definir informações da ação (nome e logo)
        const infoProcessada = infoAcaoRes?.data ? {
          ticker: ticker,
          nome: infoAcaoRes.data.nome || ticker,
          logo: infoAcaoRes.data.logo || null
        } : {
          ticker: ticker,
          nome: ticker,
          logo: null
        };
        
        console.log(`🔍 [DEBUG] Info da ação processada:`, infoProcessada);
        setInfoAcao(infoProcessada);
        
        // 📊 Processar dados para gráficos
        const dadosEvolucao = processarDadosEvolucaoInvestimento(operacoesMapeadas);
        const dadosProventosMes = processarDadosProventosMensais(resProventosUsuario?.data, ticker);
        console.log(`🔍 [DEBUG] Dados proventos mensais processados para ${ticker}:`, dadosProventosMes);
        setDadosEvolucaoInvestimento(dadosEvolucao);
        setDadosProventosMensais(dadosProventosMes);
        
      } catch (err: any) {
        let errorMessage = "Erro ao carregar dados da ação.";
        if (err.response?.data?.detail && typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        }
        setError(errorMessage);
        console.error("Erro ao buscar detalhes da ação:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetalhesAcao();
  }, [ticker]);

  // Filtro das operações baseado no termo de busca
  const operacoesFiltradas = operacoes.filter((op) => {
    if (!searchTerm) return true;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    const searchFields = [
      op.date,
      op.operation === 'buy' ? 'compra' : 'venda',
      op.quantity?.toString(),
      op.price?.toString(),
      op.fees?.toString(),
      formatDate(op.date),
      formatCurrency(op.price),
      formatCurrency(op.fees),
      formatNumber(op.quantity)
    ];
    
    return searchFields.some(field => 
      field && field.toString().toLowerCase().includes(lowerSearchTerm)
    );
  });

  if (!ticker) { // This check might be redundant due to useEffect but kept for safety before effect runs
    return (
      <div className="container mx-auto p-4">
        <p>Ticker não encontrado.</p>
        <Link href="/" passHref>
          <Button variant="link" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="container mx-auto p-4 space-y-8">
          {/* Header skeleton */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div>
                  <Skeleton className="h-10 w-20 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <Skeleton className="h-10 w-40" />
            </div>
          </div>

          {/* Seções de loading */}
          <SectionLoadingSkeleton title="Posição Atual" cardCount={5} />
          <SectionLoadingSkeleton title="Histórico de Operações" cardCount={4} />
          
          {/* Tabela skeleton */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-1 bg-gradient-to-b from-gray-400 to-gray-500 rounded-full"></div>
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-red-600">{error}</p>
        <Link href="/" passHref>
          <Button variant="link" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // Renderiza o conteúdo principal apenas se não estiver carregando e não houver erro
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="container mx-auto p-4 space-y-8">
        {/* Header modernizado inspirado no Dashboard */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white rounded-2xl shadow-lg">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex items-center gap-4">

              <div className="flex items-center gap-3">
                {/* Logo da ação */}
                {infoAcao?.logo ? (
                  <div className="relative">
                    <img 
                      src={infoAcao.logo} 
                      alt={`Logo ${ticker}`}
                      className="h-24 w-24 rounded-lg object-cover shadow-md border-2 border-white"
                      onError={(e) => {
                        console.log(`❌ [DEBUG] Erro ao carregar logo: ${infoAcao.logo}`);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : null}
                <div>
                  <h1 className="text-3xl font-bold text-white">{ticker}</h1>
                  <p className="text-lg text-white/90">{infoAcao?.nome || `Análise detalhada de ${ticker}`}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/" passHref>
                <Button 
                  variant="outline" 
                  className="bg-white/20 hover:bg-white/30 border-2 border-white/50 text-white hover:text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Cards de posição atual modernizados */}
        <section id="current-position">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-800">💼 Posição Atual</h2>
          </div>
          {dados ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-blue-700 flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Quantidade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-800 mb-2">{formatNumber(dados.quantidade_atual)}</div>
                  <p className="text-sm text-blue-600">📦 Ações em carteira</p>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-green-700 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Preço Médio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-800 mb-2">{formatCurrency(dados.preco_medio_atual)}</div>
                  <p className="text-sm text-green-600">💰 Custo médio por ação</p>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-purple-700 flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Valor Investido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-800 mb-2">{formatCurrency(dados.custo_total_atual)}</div>
                  <p className="text-sm text-purple-600">💵 Total aplicado atualmente</p>
                </CardContent>
              </div>

              <div className={`${(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200' : 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200'} rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
                <CardHeader className="pb-3">
                  <CardTitle className={`text-lg font-semibold ${(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'} flex items-center gap-2`}>
                    {(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    L&P Realizado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold mb-2 ${(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                    {formatCurrency(dados.lucro_prejuizo_realizado_total)}
                  </div>
                  <p className={`text-sm ${(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? '📈' : '📉'} Lucros e prejuízos realizados
                  </p>
                </CardContent>
              </div>

              {/* Card de Resultado Não Realizado */}
              <CardResultadoNaoRealizado resultado={resultadoNaoRealizado} />
            </div>
          ) : (
            <SectionLoadingSkeleton title="" cardCount={5} />
          )}
        </section>

        {/* Seção de Proventos modernizada */}
        {proventos && (
          <section id="dividends">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-1 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-800">🎁 Dividendos e Proventos</h2>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-emerald-700 flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Total Recebido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl mb-3">💰</div>
                    <div className="text-2xl font-bold text-emerald-800 mb-2">
                      {formatCurrency(proventos.total_proventos || 0)}
                    </div>
                    <p className="text-sm text-emerald-600">
                      💡 Sua renda passiva total
                    </p>
                  </div>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-blue-700 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Dividend Yield
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl mb-3">📊</div>
                    <div className="text-2xl font-bold text-blue-800 mb-2">
                      {(() => {
                        const totalInvestido = dados.total_investido_historico || 0;
                        const totalProventos = proventos.total_proventos || 0;
                        const yield_ = totalInvestido > 0 ? (totalProventos / totalInvestido) * 100 : 0;
                        return yield_.toFixed(1) + '%';
                      })()}
                    </div>
                    <p className="text-sm text-blue-600">
                      📈 Retorno em dividendos
                    </p>
                  </div>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-purple-700 flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Média Mensal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl mb-3">📅</div>
                    <div className="text-2xl font-bold text-purple-800 mb-2">
                      {(() => {
                        const totalProventos = proventos.total_proventos || 0;
                        const mesesComProventos = 12; // Assumindo período de 12 meses
                        return formatCurrency(totalProventos / mesesComProventos);
                      })()}
                    </div>
                    <p className="text-sm text-purple-600">
                      💰 Renda passiva mensal estimada
                    </p>
                  </div>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibent text-amber-700 flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Próximos Pagamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl mb-3">🎯</div>
                    <div className="text-lg font-bold text-amber-800 mb-2">
                      Em breve
                    </div>
                    <p className="text-sm text-amber-600">
                      📊 Aguarde informações das próximas distribuições
                    </p>
                  </div>
                </CardContent>
              </div>
            </div>

            {/* Lista Detalhada de Dividendos com Dados Reais */}
            <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-zinc-50 rounded-2xl p-6 border-2 border-slate-200 shadow-lg mb-6">
              <div className="flex items-center gap-3 mb-6">
                <Receipt className="h-6 w-6 text-slate-600" />
                <h3 className="text-xl font-bold text-gray-800">📋 Histórico Detalhado de Recebimentos</h3>
                {proventosUsuario && (
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {(() => {
                      const proventosFiltrados = proventosUsuario
                        .filter(p => p.ticker_acao?.toUpperCase() === ticker.toUpperCase())
                        .filter(p => {
                          // Filtro de busca
                          if (filtroProventos && !p.tipo?.toLowerCase().includes(filtroProventos.toLowerCase()) && 
                              !formatDate(p.dt_pagamento).toLowerCase().includes(filtroProventos.toLowerCase())) {
                            return false;
                          }
                          
                          // Filtro de tipo
                          if (filtroTipo !== "todos" && !p.tipo?.toLowerCase().includes(filtroTipo.toLowerCase())) {
                            return false;
                          }
                          
                          // Filtro de status
                          if (filtroStatus !== "todos") {
                            const now = new Date();
                            const pagamentoDate = p.dt_pagamento ? new Date(p.dt_pagamento) : null;
                            const isRecebido = pagamentoDate && pagamentoDate <= now;
                            if (filtroStatus === "recebido" && !isRecebido) return false;
                            if (filtroStatus === "a_receber" && isRecebido) return false;
                          }
                          
                          return true;
                        });
                      return proventosFiltrados.length;
                    })()} registros
                  </div>
                )}
              </div>

              {/* Filtros */}
              <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Campo de busca */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      🔍 Buscar
                    </label>
                    <input
                      type="text"
                      placeholder="Tipo, data..."
                      value={filtroProventos}
                      onChange={(e) => {
                        setFiltroProventos(e.target.value);
                        setPaginaAtual(1); // Reset para primeira página
                      }}
                      className="w-full border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all rounded-lg px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  
                  {/* Filtro de tipo */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      🏷️ Tipo
                    </label>
                    <select
                      value={filtroTipo}
                      onChange={(e) => {
                        setFiltroTipo(e.target.value);
                        setPaginaAtual(1);
                      }}
                      className="w-full border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all rounded-lg px-3 py-2 text-sm outline-none"
                    >
                      <option value="todos">Todos</option>
                      <option value="dividendo">Dividendos</option>
                      <option value="jcp">JCP</option>
                      <option value="bonificacao">Bonificação</option>
                    </select>
                  </div>
                  
                  {/* Filtro de status */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      📊 Status
                    </label>
                    <select
                      value={filtroStatus}
                      onChange={(e) => {
                        setFiltroStatus(e.target.value);
                        setPaginaAtual(1);
                      }}
                      className="w-full border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all rounded-lg px-3 py-2 text-sm outline-none"
                    >
                      <option value="todos">Todos</option>
                      <option value="recebido">✅ Recebidos</option>
                      <option value="a_receber">⏳ A Receber</option>
                    </select>
                  </div>
                  
                  {/* Botão limpar filtros */}
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setFiltroProventos("");
                        setFiltroTipo("todos");
                        setFiltroStatus("todos");
                        setPaginaAtual(1);
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Limpar
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Data Pagamento</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Tipo</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Valor por Ação</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Quantidade</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Total Recebido</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Aplicar filtros
                      const proventosFiltrados = proventosUsuario ? proventosUsuario
                        .filter(provento => provento.ticker_acao?.toUpperCase() === ticker.toUpperCase())
                        .filter(p => {
                          // Filtro de busca
                          if (filtroProventos && !p.tipo?.toLowerCase().includes(filtroProventos.toLowerCase()) && 
                              !formatDate(p.dt_pagamento).toLowerCase().includes(filtroProventos.toLowerCase())) {
                            return false;
                          }
                          
                          // Filtro de tipo
                          if (filtroTipo !== "todos" && !p.tipo?.toLowerCase().includes(filtroTipo.toLowerCase())) {
                            return false;
                          }
                          
                          // Filtro de status
                          if (filtroStatus !== "todos") {
                            const now = new Date();
                            const pagamentoDate = p.dt_pagamento ? new Date(p.dt_pagamento) : null;
                            const isRecebido = pagamentoDate && pagamentoDate <= now;
                            if (filtroStatus === "recebido" && !isRecebido) return false;
                            if (filtroStatus === "a_receber" && isRecebido) return false;
                          }
                          
                          return true;
                        })
                        .sort((a, b) => {
                          // Ordenar por data de pagamento decrescente (mais recente primeiro)
                          const dataA = new Date(a.dt_pagamento || '1900-01-01');
                          const dataB = new Date(b.dt_pagamento || '1900-01-01');
                          return dataB.getTime() - dataA.getTime();
                        }) : [];

                      // Aplicar paginação
                      const totalItens = proventosFiltrados.length;
                      const totalPaginas = Math.ceil(totalItens / itensPorPagina);
                      const indiceInicio = (paginaAtual - 1) * itensPorPagina;
                      const indiceFim = indiceInicio + itensPorPagina;
                      const itensPaginaAtual = proventosFiltrados.slice(indiceInicio, indiceFim);

                      return itensPaginaAtual.map((provento, index) => {
                        const dataPagamento = provento.dt_pagamento ? formatDate(provento.dt_pagamento) : '--/--/----';
                        const valorUnitario = provento.valor_unitario_provento || provento.valor_unitario || provento.valor || 0;
                        const quantidade = provento.quantidade_na_data_ex || provento.quantidade_possuida_na_data_ex || provento.quantidade || 0;
                        const totalRecebido = provento.valor_total_recebido || 0;
                        const tipo = provento.tipo || 'N/A';
                        
                        // Determinar status baseado na data de pagamento
                        const now = new Date();
                        const pagamentoDate = provento.dt_pagamento ? new Date(provento.dt_pagamento) : null;
                        const isRecebido = pagamentoDate && pagamentoDate <= now;
                        const isEven = index % 2 === 0;
                        
                        return (
                          <tr key={provento.id || index} className={`${isEven ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                            <td className="py-3 px-4 border-b border-gray-200 font-medium">{dataPagamento}</td>
                            <td className="py-3 px-4 border-b border-gray-200">
                              <Badge className={`${
                                tipo.toLowerCase().includes('dividendo') ? 'bg-blue-100 text-blue-800' :
                                tipo.toLowerCase().includes('jcp') ? 'bg-green-100 text-green-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {tipo}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 border-b border-gray-200 font-medium">
                              {formatCurrency(valorUnitario)}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-200 text-center">
                              {formatNumber(quantidade)}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-200 font-bold text-lg">
                              {formatCurrency(totalRecebido)}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-200">
                              <Badge className={`${
                                isRecebido ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                              }`}>
                                {isRecebido ? '✅ Recebido' : '⏳ A Receber'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                    
                    {/* Estado vazio quando não há dados filtrados */}
                    {proventosUsuario && (() => {
                      const proventosFiltrados = proventosUsuario
                        .filter(p => p.ticker_acao?.toUpperCase() === ticker.toUpperCase())
                        .filter(p => {
                          // Aplicar os mesmos filtros
                          if (filtroProventos && !p.tipo?.toLowerCase().includes(filtroProventos.toLowerCase()) && 
                              !formatDate(p.dt_pagamento).toLowerCase().includes(filtroProventos.toLowerCase())) {
                            return false;
                          }
                          if (filtroTipo !== "todos" && !p.tipo?.toLowerCase().includes(filtroTipo.toLowerCase())) {
                            return false;
                          }
                          if (filtroStatus !== "todos") {
                            const now = new Date();
                            const pagamentoDate = p.dt_pagamento ? new Date(p.dt_pagamento) : null;
                            const isRecebido = pagamentoDate && pagamentoDate <= now;
                            if (filtroStatus === "recebido" && !isRecebido) return false;
                            if (filtroStatus === "a_receber" && isRecebido) return false;
                          }
                          return true;
                        });
                      return proventosFiltrados.length === 0;
                    })() && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="text-6xl mb-4">🔍</div>
                            <h4 className="text-xl font-semibold text-gray-800 mb-2">Nenhum Resultado Encontrado</h4>
                            <p className="text-gray-600 mb-4">
                              Não há proventos que atendem aos filtros aplicados para <strong>{ticker}</strong>.
                            </p>
                            <button
                              onClick={() => {
                                setFiltroProventos("");
                                setFiltroTipo("todos");
                                setFiltroStatus("todos");
                                setPaginaAtual(1);
                              }}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              Limpar Filtros
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {/* Estado vazio quando não há dados do ticker */}
                    {(!proventosUsuario || proventosUsuario.filter(p => p.ticker_acao?.toUpperCase() === ticker.toUpperCase()).length === 0) && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="text-6xl mb-4">💰</div>
                            <h4 className="text-xl font-semibold text-gray-800 mb-2">Nenhum Provento Registrado</h4>
                            <p className="text-gray-600 mb-4">
                              Ainda não há dividendos ou proventos registrados para <strong>{ticker}</strong>.
                            </p>
                            <p className="text-sm text-gray-500">
                              💡 Os proventos aparecerão aqui automaticamente quando distribuídos pela empresa.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Paginação */}
              {proventosUsuario && (() => {
                const proventosFiltrados = proventosUsuario
                  .filter(p => p.ticker_acao?.toUpperCase() === ticker.toUpperCase())
                  .filter(p => {
                    // Aplicar os mesmos filtros da tabela
                    if (filtroProventos && !p.tipo?.toLowerCase().includes(filtroProventos.toLowerCase()) && 
                        !formatDate(p.dt_pagamento).toLowerCase().includes(filtroProventos.toLowerCase())) {
                      return false;
                    }
                    if (filtroTipo !== "todos" && !p.tipo?.toLowerCase().includes(filtroTipo.toLowerCase())) {
                      return false;
                    }
                    if (filtroStatus !== "todos") {
                      const now = new Date();
                      const pagamentoDate = p.dt_pagamento ? new Date(p.dt_pagamento) : null;
                      const isRecebido = pagamentoDate && pagamentoDate <= now;
                      if (filtroStatus === "recebido" && !isRecebido) return false;
                      if (filtroStatus === "a_receber" && isRecebido) return false;
                    }
                    return true;
                  });
                
                const totalItens = proventosFiltrados.length;
                const totalPaginas = Math.ceil(totalItens / itensPorPagina);
                
                return totalItens > 0 && (
                  <>
                    {/* Informações da paginação */}
                    <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">
                        Mostrando {Math.min((paginaAtual - 1) * itensPorPagina + 1, totalItens)} a {Math.min(paginaAtual * itensPorPagina, totalItens)} de {totalItens} registros
                      </div>
                      
                      {totalPaginas > 1 && (
                        <div className="flex items-center gap-2">
                          {/* Botão Anterior */}
                          <button
                            onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                            disabled={paginaAtual === 1}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                              paginaAtual === 1 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            ← Anterior
                          </button>
                          
                          {/* Números das páginas */}
                          <div className="flex items-center gap-1">
                            {(() => {
                              const paginas = [];
                              const inicio = Math.max(1, paginaAtual - 2);
                              const fim = Math.min(totalPaginas, paginaAtual + 2);
                              
                              // Primeira página se não estiver no início
                              if (inicio > 1) {
                                paginas.push(
                                  <button
                                    key={1}
                                    onClick={() => setPaginaAtual(1)}
                                    className="px-3 py-1 rounded-md text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                                  >
                                    1
                                  </button>
                                );
                                if (inicio > 2) {
                                  paginas.push(<span key="ellipsis1" className="px-2 text-gray-500">...</span>);
                                }
                              }
                              
                              // Páginas do meio
                              for (let i = inicio; i <= fim; i++) {
                                paginas.push(
                                  <button
                                    key={i}
                                    onClick={() => setPaginaAtual(i)}
                                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                      i === paginaAtual
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    {i}
                                  </button>
                                );
                              }
                              
                              // Última página se não estiver no fim
                              if (fim < totalPaginas) {
                                if (fim < totalPaginas - 1) {
                                  paginas.push(<span key="ellipsis2" className="px-2 text-gray-500">...</span>);
                                }
                                paginas.push(
                                  <button
                                    key={totalPaginas}
                                    onClick={() => setPaginaAtual(totalPaginas)}
                                    className="px-3 py-1 rounded-md text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                                  >
                                    {totalPaginas}
                                  </button>
                                );
                              }
                              
                              return paginas;
                            })()}
                          </div>
                          
                          {/* Botão Próximo */}
                          <button
                            onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                            disabled={paginaAtual === totalPaginas}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                              paginaAtual === totalPaginas 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            Próximo →
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Confirmação de dados reais */}
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        <span className="font-semibold">✅ Dados Reais:</span> Histórico completo de todos os dividendos e proventos recebidos desta ação.
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </section>
        )}

        {/* Cards de histórico modernizados */}
        <section id="history-cards">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-800">📋 Histórico de Operações</h2>
          </div>
          {dados ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-yellow-700 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Total Investido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-800 mb-2">{formatCurrency(dados.total_investido_historico || 0)}</div>
                  <p className="text-sm text-yellow-600">💵 Soma de todas as suas compras</p>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-orange-700 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Total Vendido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-800 mb-2">{formatCurrency(dados.total_vendido_historico || 0)}</div>
                  <p className="text-sm text-orange-600">📈 Soma de todas as suas vendas</p>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-2 border-cyan-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-cyan-700 flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Qtd. Comprada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-cyan-800 mb-2">{formatNumber(dados.operacoes_compra_total_quantidade || 0)}</div>
                  <p className="text-sm text-cyan-600">🛒 Total de ações compradas</p>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Qtd. Vendida
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-800 mb-2">{formatNumber(dados.operacoes_venda_total_quantidade || 0)}</div>
                  <p className="text-sm text-indigo-600">💼 Total de ações vendidas</p>
                </CardContent>
              </div>
            </div>
          ) : null}
        </section>

        {/* Tabela de operações modernizada */}
        <section id="operations-table">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-gradient-to-b from-gray-500 to-gray-600 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-800">📊 Detalhes das Operações</h2>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 border-b border-gray-200">
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-4">
                  <span className="font-semibold">💡 Dica:</span> Aqui você vê todas as compras e vendas realizadas para{" "}
                  <span className="font-bold text-blue-600">{ticker}</span>. 
                  Cada linha representa uma operação que você fez na bolsa.
                </p>
                
                {/* Campo de busca */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-gray-700 font-medium mb-1 block">
                      🔍 Pesquisar nas suas operações
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Busque por qualquer campo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 border-2 border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 transition-all rounded-xl px-4 py-3 outline-none"
                      />
                    </div>
                  </div>
                  {searchTerm && (
                    <Button
                      onClick={() => setSearchTerm("")}
                      variant="outline"
                      className="mt-6 px-4 py-2 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Limpar
                    </Button>
                  )}
                </div>
                
                {searchTerm && (
                  <div className="mt-3 p-3 bg-blue-100 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">{operacoesFiltradas.length}</span> resultados encontrados para "{searchTerm}"
                    </p>
                  </div>
                )}
              </div>
            </div>
            {operacoesFiltradas && operacoesFiltradas.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold text-gray-700">📅 Data</TableHead>
                      <TableHead className="font-semibold text-gray-700">🏷️ Tipo</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700">📊 Quantidade</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700">💰 Preço Unit.</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700">💸 Taxas</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700">💵 Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operacoesFiltradas.map((op, index) => {
                      const valorOperacao = op.quantity * op.price;
                      const valorTotalComTaxas = op.operation === 'buy' ? valorOperacao + op.fees : valorOperacao - op.fees;
                      const isEven = index % 2 === 0;
                      return (
                        <TableRow key={op.id} className={`${isEven ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 transition-colors`}>
                          <TableCell className="font-medium">{formatDate(op.date)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={op.operation === 'buy' ? 'default' : 'secondary'} 
                              className={`${op.operation === 'buy' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}
                            >
                              {op.operation === 'buy' ? '🛒 Compra' : '📈 Venda'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(op.quantity)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(op.price)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(op.fees)}</TableCell>
                          <TableCell className="text-right font-bold text-lg">{formatCurrency(valorTotalComTaxas)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : operacoes.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-gray-600 text-lg">Nenhuma operação encontrada para {ticker}</p>
                <p className="text-sm text-gray-500 mt-2">Suas operações aparecerão aqui assim que forem registradas</p>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-600 text-lg">Nenhuma operação encontrada para "{searchTerm}"</p>
                <p className="text-sm text-gray-500 mt-2">Tente pesquisar por data, tipo de operação, quantidade ou preço</p>
                <Button
                  onClick={() => setSearchTerm("")}
                  variant="outline"
                  className="mt-4"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar busca
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* 📊 NOVA SEÇÃO: Gráficos Analíticos */}
        <section id="charts-section">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-indigo-600" />
              📊 Análise Gráfica
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {/* Gráfico de Evolução do Valor Investido - Layout Premium */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📈</span>
                  <div>
                    <h3 className="text-xl font-bold">Evolução do Valor Investido</h3>
                    <p className="text-blue-100 text-sm">Crescimento acumulado dos investimentos em {ticker} ao longo do tempo</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {dadosEvolucaoInvestimento.length > 0 ? (
                  <>
                    {/* Estatísticas resumidas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                        <div className="text-center">
                          <div className="text-2xl mb-2">📊</div>
                          <div className="text-lg font-bold text-blue-800">
                            {dadosEvolucaoInvestimento.length}
                          </div>
                          <p className="text-xs text-blue-600">Pontos no tempo</p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-lg p-4">
                        <div className="text-center">
                          <div className="text-2xl mb-2">🎯</div>
                          <div className="text-lg font-bold text-indigo-800">
                            {formatCurrency(Math.max(...dadosEvolucaoInvestimento.map(d => d.valor)))}
                          </div>
                          <p className="text-xs text-indigo-600">Pico máximo</p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                        <div className="text-center">
                          <div className="text-2xl mb-2">💰</div>
                          <div className="text-lg font-bold text-purple-800">
                            {formatCurrency(dadosEvolucaoInvestimento[dadosEvolucaoInvestimento.length - 1]?.valor || 0)}
                          </div>
                          <p className="text-xs text-purple-600">Valor atual</p>
                        </div>
                      </div>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dadosEvolucaoInvestimento} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <defs>
                            {/* Gradiente para a área sob a linha */}
                            <linearGradient id="investimentoAreaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05}/>
                            </linearGradient>
                            
                            {/* Gradiente moderno para a linha */}
                            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="25%" stopColor="#3b82f6" />
                              <stop offset="50%" stopColor="#2563eb" />
                              <stop offset="75%" stopColor="#1d4ed8" />
                              <stop offset="100%" stopColor="#1e40af" />
                            </linearGradient>
                            
                            {/* Filtros para sombras */}
                            <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
                              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#3b82f6" floodOpacity="0.3"/>
                            </filter>
                            
                            <filter id="glowEffect" x="-50%" y="-50%" width="200%" height="200%">
                              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                              <feMerge> 
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                              </feMerge>
                            </filter>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis 
                            dataKey="mes" 
                            stroke="#6b7280" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <YAxis 
                            stroke="#6b7280" 
                            fontSize={12} 
                            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                            tickLine={false} 
                            axisLine={false}
                          />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const value = payload[0].value as number;
                                const isHighest = value === Math.max(...dadosEvolucaoInvestimento.map(d => d.valor));
                                return (
                                  <div className="bg-white p-4 rounded-xl shadow-2xl border border-gray-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg">{isHighest ? '🏆' : '📈'}</span>
                                      <h4 className="font-bold text-gray-800">{label}</h4>
                                      {isHighest && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Pico máximo!</span>}
                                    </div>
                                    <div className="text-lg font-semibold text-blue-600">
                                      {formatCurrency(value)}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                      Valor acumulado investido em {ticker}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="valor" 
                            stroke="url(#lineGradient)" 
                            strokeWidth={4}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="url(#dropShadow)"
                            dot={{ 
                              fill: '#ffffff', 
                              stroke: '#3b82f6', 
                              strokeWidth: 3, 
                              r: 6,
                              style: {
                                filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4))',
                                transition: 'all 0.3s ease'
                              }
                            }}
                            activeDot={{ 
                              r: 9, 
                              stroke: '#1e40af', 
                              strokeWidth: 4, 
                              fill: '#ffffff',
                              style: {
                                filter: 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.6))',
                                transition: 'all 0.3s ease',
                                animation: 'pulse 2s infinite'
                              }
                            }}
                            fill="url(#investimentoAreaGradient)"
                            fillOpacity={1}
                            animationDuration={1500}
                            animationEasing="ease-in-out"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="h-80 flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-gray-400 text-2xl">📈</span>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        Sem Histórico de Investimento
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Ainda não há operações registradas para <strong>{ticker}</strong>.
                      </p>
                      <p className="text-sm text-gray-500">
                        💡 A evolução do valor investido aparecerá aqui conforme você realizar operações.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Gráfico de Proventos por Mês - Layout Premium Inspirado no Dashboard */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">💰</span>
                  <div>
                    <h3 className="text-xl font-bold">Proventos Mensais de {ticker}</h3>
                    <p className="text-green-100 text-sm">Distribuição dos dividendos e proventos recebidos ao longo do tempo</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {dadosProventosMensais.length > 0 ? (
                  <>
                    {/* Estatísticas resumidas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg p-4">
                        <div className="text-center">
                          <div className="text-2xl mb-2">📊</div>
                          <div className="text-lg font-bold text-emerald-800">
                            {dadosProventosMensais.length}
                          </div>
                          <p className="text-xs text-emerald-600">Meses com proventos</p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                        <div className="text-center">
                          <div className="text-2xl mb-2">💎</div>
                          <div className="text-lg font-bold text-blue-800">
                            {formatCurrency(Math.max(...dadosProventosMensais.map(d => d.valor)))}
                          </div>
                          <p className="text-xs text-blue-600">Melhor mês</p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                        <div className="text-center">
                          <div className="text-2xl mb-2">📈</div>
                          <div className="text-lg font-bold text-purple-800">
                            {formatCurrency(dadosProventosMensais.reduce((acc, d) => acc + d.valor, 0) / dadosProventosMensais.length)}
                          </div>
                          <p className="text-xs text-purple-600">Média mensal</p>
                        </div>
                      </div>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dadosProventosMensais} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <defs>
                            <linearGradient id="proventosGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                              <stop offset="100%" stopColor="#10b981" stopOpacity={0.6}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis 
                            dataKey="mes" 
                            stroke="#6b7280" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <YAxis 
                            stroke="#6b7280" 
                            fontSize={12} 
                            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                            tickLine={false} 
                            axisLine={false}
                          />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const value = payload[0].value as number;
                                const isHighest = value === Math.max(...dadosProventosMensais.map(d => d.valor));
                                return (
                                  <div className="bg-white p-4 rounded-xl shadow-2xl border border-gray-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg">{isHighest ? '🏆' : '💰'}</span>
                                      <h4 className="font-bold text-gray-800">{label}</h4>
                                      {isHighest && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Melhor mês!</span>}
                                    </div>
                                    <div className="text-lg font-semibold text-emerald-600">
                                      {formatCurrency(value)}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                      Proventos recebidos de {ticker}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="valor" 
                            fill="url(#proventosGradient)"
                            radius={[4, 4, 0, 0]}
                            stroke="#10b981"
                            strokeWidth={1}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="h-80 flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-gray-400 text-2xl">💰</span>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        Aguardando Proventos
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Ainda não há dividendos registrados para <strong>{ticker}</strong>.
                      </p>
                      <p className="text-sm text-gray-500">
                        💡 Os proventos aparecerão aqui automaticamente quando forem distribuídos pela empresa e registrados no sistema.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Dica final para iniciantes */}
        <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-6 border border-blue-200 shadow-lg text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Dica para Iniciantes</h3>
          <p className="text-gray-600 mb-4">
            Está começando no mundo dos investimentos? Clique no botão abaixo para ver o resumo de todas as suas ações!
          </p>
          <Link href="/" passHref>
            <Button 
              variant="default" 
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Ver Dashboard Completo
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
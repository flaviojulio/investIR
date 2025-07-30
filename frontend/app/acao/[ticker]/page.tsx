"use client";

import { useParams } from 'next/navigation'; // To get ticker from URL
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
// import removido: Operacao, ResultadoTicker
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Package, Briefcase, ShoppingCart, Landmark, Search, X, Gift, Brain, Target, Award, AlertTriangle, Lightbulb, BarChart3, Calendar, Clock, Calculator, Shield, PieChart, BookOpen } from 'lucide-react'; // Added intelligence icons
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // For back button
import { Input } from '@/components/ui/input'; // For search input

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

interface InsightsInteligentes {
  tempoMedioEntreOperacoes: number | null;
  estrategiaInvestimento: {
    tipo: 'buy-and-hold' | 'trader' | 'acumulador' | 'equilibrado';
    descricao: string;
    emoji: string;
  };
  eficienciaDecisoes: {
    nivel: 'excelente' | 'boa' | 'moderada' | 'atencao' | 'critica';
    cor: 'emerald' | 'green' | 'yellow' | 'orange' | 'red';
    descrição: string;
  } | null;
  perfilRisco: {
    tipo: 'agressivo' | 'moderado' | 'conservador';
    descricao: string;
    emoji: string;
    cor: 'red' | 'blue' | 'green';
  };
  badges: Array<{
    nome: string;
    emoji: string;
    cor: 'blue' | 'purple' | 'green' | 'amber';
    descricao: string;
  }>;
  sugestoes: Array<{
    tipo: 'oportunidade' | 'alerta' | 'fiscal' | 'estrategia';
    titulo: string;
    descricao: string;
    icone: string;
    cor: 'blue' | 'amber' | 'red' | 'purple';
  }>;
}

// 🧠 Centro de Inteligência - Funções de Análise Automatizada
const calcularInsightsInteligentes = (
  dados: DadosAcao, 
  operacoes: OperacaoAcao[], 
  proventos: ProventosPorAcao | null
): InsightsInteligentes | null => {
  if (!dados || !operacoes.length) return null;

  // Análise temporal das operações
  const operacoesComData = operacoes.filter(op => op.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const compras = operacoesComData.filter(op => op.operation === 'buy');
  const vendas = operacoesComData.filter(op => op.operation === 'sell');
  
  // Cálculos de comportamento
  const tempoMedioEntreOperacoes = calcularTempoMedioOperacoes(operacoesComData);
  const estrategiaInvestimento = analisarEstrategiaInvestimento(compras, vendas, dados);
  const eficienciaDecisoes = calcularEficienciaDecisoes(dados);
  const perfilRisco = determinarPerfilRisco(dados, operacoes.length);
  
  return {
    tempoMedioEntreOperacoes,
    estrategiaInvestimento,
    eficienciaDecisoes,
    perfilRisco,
    badges: gerarBadgesComportamento(dados, operacoes, proventos),
    sugestoes: gerarSugestoesPersonalizadas(dados, operacoes, proventos)
  };
};

const calcularTempoMedioOperacoes = (operacoes: OperacaoAcao[]): number | null => {
  if (operacoes.length < 2) return null;
  
  let totalDias = 0;
  for (let i = 1; i < operacoes.length; i++) {
    const dataAnterior = new Date(operacoes[i-1].date);
    const dataAtual = new Date(operacoes[i].date);
    totalDias += Math.abs(dataAtual.getTime() - dataAnterior.getTime()) / (1000 * 60 * 60 * 24);
  }
  
  return Math.round(totalDias / (operacoes.length - 1));
};

const analisarEstrategiaInvestimento = (
  compras: OperacaoAcao[], 
  vendas: OperacaoAcao[], 
  dados: DadosAcao
) => {
  const totalCompras = compras.length;
  const totalVendas = vendas.length;
  const possuiAcoes = dados.quantidade_atual > 0;
  
  if (totalVendas === 0 && possuiAcoes) {
    return { tipo: 'buy-and-hold', descricao: 'Investidor de Longo Prazo', emoji: '💎' };
  } else if (totalVendas > totalCompras) {
    return { tipo: 'trader', descricao: 'Operador Ativo', emoji: '⚡' };
  } else if (totalCompras > totalVendas * 2) {
    return { tipo: 'acumulador', descricao: 'Acumulador Estratégico', emoji: '📈' };
  } else {
    return { tipo: 'equilibrado', descricao: 'Investidor Equilibrado', emoji: '⚖️' };
  }
};

const calcularEficienciaDecisoes = (dados: DadosAcao) => {
  const totalInvestido = dados.total_investido_historico || 0;
  const lucroRealizado = dados.lucro_prejuizo_realizado_total || 0;
  
  if (totalInvestido === 0) return null;
  
  const eficiencia = (lucroRealizado / totalInvestido) * 100;
  
  if (eficiencia > 10) return { nivel: 'excelente', cor: 'emerald', descrição: 'Decisões Muito Eficazes' };
  if (eficiencia > 5) return { nivel: 'boa', cor: 'green', descrição: 'Boas Decisões' };
  if (eficiencia > 0) return { nivel: 'moderada', cor: 'yellow', descrição: 'Decisões Moderadas' };
  if (eficiencia > -5) return { nivel: 'atencao', cor: 'orange', descrição: 'Precisa de Atenção' };
  return { nivel: 'critica', cor: 'red', descrição: 'Revisar Estratégia' };
};

const determinarPerfilRisco = (dados: DadosAcao, totalOperacoes: number) => {
  const posicaoAtual = dados.custo_total_atual || 0;
  const frequenciaOperacao = totalOperacoes;
  
  if (frequenciaOperacao > 20 && posicaoAtual > 10000) {
    return { tipo: 'agressivo', descricao: 'Alto Risco - Alto Retorno', emoji: '🚀', cor: 'red' };
  } else if (frequenciaOperacao > 10 || posicaoAtual > 5000) {
    return { tipo: 'moderado', descricao: 'Risco Moderado', emoji: '📊', cor: 'blue' };
  } else {
    return { tipo: 'conservador', descricao: 'Baixo Risco', emoji: '🛡️', cor: 'green' };
  }
};

const gerarBadgesComportamento = (
  dados: DadosAcao, 
  operacoes: OperacaoAcao[], 
  proventos: ProventosPorAcao | null
) => {
  const badges = [];
  
  // Badge: Investidor Paciente
  if (dados.quantidade_atual > 0 && operacoes.filter(op => op.operation === 'sell').length === 0) {
    badges.push({ nome: 'Investidor Paciente', emoji: '💎', cor: 'blue', descricao: 'Mantém posições de longo prazo' });
  }
  
  // Badge: Coletor de Proventos
  if (proventos?.total_proventos > 0) {
    badges.push({ nome: 'Coletor de Dividendos', emoji: '🎁', cor: 'purple', descricao: 'Recebe proventos regularmente' });
  }
  
  // Badge: Realizador de Lucros
  if ((dados.lucro_prejuizo_realizado_total || 0) > 0) {
    badges.push({ nome: 'Realizador de Lucros', emoji: '💰', cor: 'green', descricao: 'Sabe quando vender com lucro' });
  }
  
  // Badge: Estrategista
  if (operacoes.length >= 10) {
    badges.push({ nome: 'Operador Experiente', emoji: '🎯', cor: 'amber', descricao: 'Muita experiência operando' });
  }
  
  return badges;
};

const gerarSugestoesPersonalizadas = (
  dados: DadosAcao, 
  operacoes: OperacaoAcao[], 
  proventos: ProventosPorAcao | null
) => {
  const sugestoes = [];
  
  // Sugestão baseada na posição atual
  if (dados.quantidade_atual > 0) {
    const lucroNaoRealizado = dados.custo_total_atual * 0.1; // Simula 10% de valorização
    sugestoes.push({
      tipo: 'oportunidade',
      titulo: 'Monitore a Performance',
      descricao: `Com ${dados.quantidade_atual} ações, acompanhe a cotação atual para decidir sobre realizar lucros ou aportar mais.`,
      icone: 'BarChart3',
      cor: 'blue'
    });
  }
  
  // Sugestão sobre diversificação
  if (dados.custo_total_atual > 5000) {
    sugestoes.push({
      tipo: 'alerta',
      titulo: 'Diversificação Importante',
      descricao: 'Posição concentrada detectada. Considere diversificar para reduzir riscos.',
      icone: 'AlertTriangle',
      cor: 'amber'
    });
  }
  
  // Sugestão fiscal
  if ((dados.lucro_prejuizo_realizado_total || 0) > 1000) {
    sugestoes.push({
      tipo: 'fiscal',
      titulo: 'Atenção aos Impostos',
      descricao: 'Lucro realizado alto. Verifique suas obrigações fiscais no painel IR.',
      icone: 'Landmark',
      cor: 'red'
    });
  }
  
  // Sugestão de continuidade
  if (operacoes.length > 0) {
    const ultimaOperacao = operacoes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const diaSemOperacao = Math.floor((Date.now() - new Date(ultimaOperacao.date).getTime()) / (1000 * 60 * 60 * 24));
    
    if (diaSemOperacao > 30) {
      sugestoes.push({
        tipo: 'estrategia',
        titulo: 'Revisite sua Estratégia',
        descricao: `Última operação há ${diaSemOperacao} dias. Hora de revisar e planejar próximos passos?`,
        icone: 'Target',
        cor: 'purple'
      });
    }
  }
  
  return sugestoes;
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

  const formatDate = (dateString: string | null | undefined, placeholder: string = "N/A") => {
    if (!dateString) return placeholder;
    // Assuming dateString is in "YYYY-MM-DD" or full ISO format
    return new Date(dateString).toLocaleDateString("pt-BR", {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
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
      const valor = valorAtual - valorInvestido;
      const percentual = ((cotacaoAtual.fechamento - dados.preco_medio_atual) / dados.preco_medio_atual) * 100;
      
      return {
        disponivel: true,
        valor,
        percentual,
        valorAtual,
        valorInvestido
      };
    }, [dados, cotacaoAtual]);
  };

  // Componente de Loading Skeleton para Cards
  const CardSkeleton = () => (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-10 w-24 mb-2" />
      <Skeleton className="h-4 w-40" />
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
  const [cotacaoAtual, setCotacaoAtual] = useState<CotacaoAtual | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [insights, setInsights] = useState<InsightsInteligentes | null>(null);

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
        
        const [resResultados, resOperacoes, resProventos, resCotacao, resInfoAcao] = await Promise.all([
          api.get(`/resultados/ticker/${ticker}`),
          api.get(`/operacoes/ticker/${ticker}`),
          api.get(`/usuario/proventos/resumo_por_acao/`),
          api.get(`/cotacoes/ticker/${ticker}/mais-recente`).catch(() => null), // 💹 Buscar cotação mais recente (opcional)
          api.get(`/acoes/info/${ticker}`).catch((error) => {
            console.error(`🚨 [DEBUG] Erro ao buscar info da ação ${ticker}:`, error);
            return null;
          }) // 🏷️ Buscar informações da ação (nome e logo)
        ]);
        
        console.log(`🔍 [DEBUG] Resposta da API de info da ação:`, resInfoAcao?.data);
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
        setProventos(proventosData ? {
          total_proventos: proventosData.total_recebido_geral_acao || 0,
          quantidade_pagamentos: proventosData.detalhes_por_tipo?.length || 0
        } : { total_proventos: 0, quantidade_pagamentos: 0 });
        
        // 💹 Definir cotação atual (se disponível)
        setCotacaoAtual(resCotacao?.data || null);
        
        // 🏷️ Definir informações da ação (nome e logo)
        const infoProcessada = resInfoAcao?.data ? {
          ticker: ticker,
          nome: resInfoAcao.data.nome || ticker,
          logo: resInfoAcao.data.logo || null
        } : {
          ticker: ticker,
          nome: ticker,
          logo: null
        };
        
        console.log(`🔍 [DEBUG] Info da ação processada:`, infoProcessada);
        setInfoAcao(infoProcessada);
        
        // 🧠 Calcular insights inteligentes após carregar os dados
        if (resResultados.data && operacoesMapeadas.length > 0) {
          const insightsCalculados = calcularInsightsInteligentes(
            resResultados.data, 
            operacoesMapeadas, 
            proventosData ? {
              total_proventos: proventosData.total_recebido_geral_acao || 0,
              quantidade_pagamentos: proventosData.detalhes_por_tipo?.length || 0
            } : null
          );
          setInsights(insightsCalculados);
        }
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
          <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-6 border border-blue-200 shadow-lg">
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
        <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-6 border border-blue-200 shadow-lg">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Package className="h-5 w-5 text-white" />
              </div>
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
                        // Mostrar fallback
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                      onLoad={() => {
                        console.log(`✅ [DEBUG] Logo carregado com sucesso: ${infoAcao.logo}`);
                      }}
                    />
                    <div 
                      className="h-24 w-24 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-md border-2 border-white"
                      style={{ display: 'none' }}
                    >
                      <Package className="h-12 w-12 text-gray-500" />
                    </div>
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-md border-2 border-white">
                    <Package className="h-12 w-12 text-gray-500" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {ticker}
                    </h1>
                  </div>
                  {infoAcao?.nome && infoAcao.nome !== ticker && (
                    <p className="text-lg font-medium text-gray-700 mt-1">
                      {infoAcao.nome}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    📊 Veja tudo sobre esta ação de forma simples e didática
                  </p>
                </div>
              </div>
            </div>
            <Link href="/" passHref>
              <Button 
                variant="default" 
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Cards agrupados e didáticos - Seção Posição Atual */}
        <section id="summary-cards">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-800">📈 Sua Posição Atual</h2>
          </div>
          {dados ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-blue-700 flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Quantidade em Carteira
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-800 mb-2">{formatNumber(dados.quantidade_atual || 0)}</div>
                  <p className="text-sm text-blue-600">💡 Ações que você possui atualmente</p>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-green-700 flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Preço Médio
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-800 mb-2">{formatCurrency(dados.preco_medio_atual || 0)}</div>
                  <p className="text-sm text-green-600">💰 Preço médio pago por ação</p>
                </CardContent>
              </div>

              {/* Card: Cotação Atual */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Cotação Atual
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {cotacaoAtual ? (
                    <>
                      <div className="text-3xl font-bold text-indigo-800 mb-2">
                        {formatCurrency(cotacaoAtual.fechamento || 0)}
                      </div>
                      <p className="text-sm text-indigo-600">💹 Último fechamento registrado</p>
                      <p className="text-xs text-indigo-500 mt-1">
                        📅 {formatDate(cotacaoAtual.data)}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-indigo-800 mb-2">--</div>
                      <p className="text-sm text-indigo-600">💹 Cotação não disponível</p>
                      <p className="text-xs text-indigo-500 mt-1">⚠️ Sem dados históricos no sistema</p>
                    </>
                  )}
                </CardContent>
              </div>

              {/* Card: Resultado Atual (Não Realizado) */}
              <CardResultadoNaoRealizado resultado={resultadoNaoRealizado} />

              {/* Novo Card de Proventos */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-amber-700 flex items-center gap-2">
                      <Gift className="h-5 w-5" />
                      Proventos Recebidos
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-800 mb-2">
                    {proventos ? formatCurrency(proventos.total_proventos) : formatCurrency(0)}
                  </div>
                  <p className="text-sm text-amber-600">
                    {proventos?.total_proventos > 0 
                      ? (proventos?.quantidade_pagamentos > 0 
                          ? `🎁 ${proventos?.quantidade_pagamentos} pagamentos recebidos`
                          : "🎁 Proventos recebidos")
                      : "📊 Nenhum provento registrado ainda"
                    }
                  </p>
                </CardContent>
              </div>

              {/* Card de Lucro/Prejuízo com destaque especial */}
              <div className={`${(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200' : 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200'} rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 col-span-full md:col-span-2`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-xl font-semibold ${(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'} flex items-center gap-2`}>
                      {(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                      Resultado das Negociações
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-4xl font-bold ${(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? 'text-emerald-800' : 'text-red-800'} mb-2`}>
                    {formatCurrency(dados.lucro_prejuizo_realizado_total || 0)}
                  </div>
                  <p className={`text-base ${(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(dados.lucro_prejuizo_realizado_total || 0) >= 0 ? '🎉 Parabéns! Você já realizou lucro com vendas' : '📉 Prejuízo realizado com vendas (faz parte do aprendizado!)'}
                  </p>
                </CardContent>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl shadow-lg p-6">
              <p className="text-gray-600 text-center">📊 Nenhum dado de posição disponível para {ticker}</p>
            </div>
          )}
        </section>

        {/* 🧠 CENTRO DE INTELIGÊNCIA DA AÇÃO - NOVIDADE REVOLUCIONÁRIA */}
        {insights && (
          <section id="intelligence-center" className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-1 bg-gradient-to-b from-purple-500 to-pink-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Brain className="h-6 w-6 text-purple-600" />
                🧠 Centro de Inteligência da Ação
              </h2>
              <div className="ml-auto">
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-3 py-1">
                  ✨ NOVIDADE
                </Badge>
              </div>
            </div>

            {/* Introdução Educativa */}
            <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 rounded-2xl p-6 border-2 border-purple-200 shadow-lg mb-6">
              <div className="text-center">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Análise Automatizada do Seu Comportamento</h3>
                <p className="text-gray-600 max-w-3xl mx-auto">
                  Nossa IA analisou suas operações em <span className="font-bold text-purple-600">{ticker}</span> e gerou insights personalizados 
                  sobre seu perfil de investidor. Descubra padrões que você nem sabia que existiam!
                </p>
              </div>
            </div>

            {/* Grid de Análises Inteligentes */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {/* Card: Perfil de Investidor */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-indigo-700 flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Seu Perfil de Investidor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl mb-3">{insights.estrategiaInvestimento.emoji}</div>
                    <div className="text-2xl font-bold text-indigo-800 mb-2">
                      {insights.estrategiaInvestimento.descricao}
                    </div>
                    <p className="text-sm text-indigo-600">
                      💡 Baseado no seu padrão de {operacoes.filter(op => op.operation === 'buy').length} compras e {operacoes.filter(op => op.operation === 'sell').length} vendas
                    </p>
                  </div>
                </CardContent>
              </div>

              {/* Card: Eficiência das Decisões */}
              {insights.eficienciaDecisoes && (
                <div className={`${
                  insights.eficienciaDecisoes.cor === 'emerald' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200' :
                  insights.eficienciaDecisoes.cor === 'green' ? 'bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200' :
                  insights.eficienciaDecisoes.cor === 'yellow' ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200' :
                  insights.eficienciaDecisoes.cor === 'orange' ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200' :
                  'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200'
                } rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
                  <CardHeader className="pb-3">
                    <CardTitle className={
                      insights.eficienciaDecisoes.cor === 'emerald' ? 'text-lg font-semibold text-emerald-700 flex items-center gap-2' :
                      insights.eficienciaDecisoes.cor === 'green' ? 'text-lg font-semibold text-green-700 flex items-center gap-2' :
                      insights.eficienciaDecisoes.cor === 'yellow' ? 'text-lg font-semibold text-yellow-700 flex items-center gap-2' :
                      insights.eficienciaDecisoes.cor === 'orange' ? 'text-lg font-semibold text-orange-700 flex items-center gap-2' :
                      'text-lg font-semibold text-red-700 flex items-center gap-2'
                    }>
                      <BarChart3 className="h-5 w-5" />
                      Eficiência das Decisões
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-3xl mb-3">
                        {insights.eficienciaDecisoes.nivel === 'excelente' ? '🏆' : 
                         insights.eficienciaDecisoes.nivel === 'boa' ? '✅' :
                         insights.eficienciaDecisoes.nivel === 'moderada' ? '📊' :
                         insights.eficienciaDecisoes.nivel === 'atencao' ? '⚠️' : '🔄'}
                      </div>
                      <div className={
                        insights.eficienciaDecisoes.cor === 'emerald' ? 'text-xl font-bold text-emerald-800 mb-2' :
                        insights.eficienciaDecisoes.cor === 'green' ? 'text-xl font-bold text-green-800 mb-2' :
                        insights.eficienciaDecisoes.cor === 'yellow' ? 'text-xl font-bold text-yellow-800 mb-2' :
                        insights.eficienciaDecisoes.cor === 'orange' ? 'text-xl font-bold text-orange-800 mb-2' :
                        'text-xl font-bold text-red-800 mb-2'
                      }>
                        {insights.eficienciaDecisoes.descrição}
                      </div>
                      <p className={
                        insights.eficienciaDecisoes.cor === 'emerald' ? 'text-sm text-emerald-600' :
                        insights.eficienciaDecisoes.cor === 'green' ? 'text-sm text-green-600' :
                        insights.eficienciaDecisoes.cor === 'yellow' ? 'text-sm text-yellow-600' :
                        insights.eficienciaDecisoes.cor === 'orange' ? 'text-sm text-orange-600' :
                        'text-sm text-red-600'
                      }>
                        📈 Baseado no retorno vs investimento total
                      </p>
                    </div>
                  </CardContent>
                </div>
              )}

              {/* Card: Perfil de Risco */}
              <div className={`${
                insights.perfilRisco.cor === 'red' ? 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200' :
                insights.perfilRisco.cor === 'blue' ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200' :
                'bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200'
              } rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
                <CardHeader className="pb-3">
                  <CardTitle className={
                    insights.perfilRisco.cor === 'red' ? 'text-lg font-semibold text-red-700 flex items-center gap-2' :
                    insights.perfilRisco.cor === 'blue' ? 'text-lg font-semibold text-blue-700 flex items-center gap-2' :
                    'text-lg font-semibold text-green-700 flex items-center gap-2'
                  }>
                    <AlertTriangle className="h-5 w-5" />
                    Perfil de Risco
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl mb-3">{insights.perfilRisco.emoji}</div>
                    <div className={
                      insights.perfilRisco.cor === 'red' ? 'text-2xl font-bold text-red-800 mb-2' :
                      insights.perfilRisco.cor === 'blue' ? 'text-2xl font-bold text-blue-800 mb-2' :
                      'text-2xl font-bold text-green-800 mb-2'
                    }>
                      {insights.perfilRisco.descricao}
                    </div>
                    <p className={
                      insights.perfilRisco.cor === 'red' ? 'text-sm text-red-600' :
                      insights.perfilRisco.cor === 'blue' ? 'text-sm text-blue-600' :
                      'text-sm text-green-600'
                    }>
                      🎯 {operacoes.length} operações analisadas
                    </p>
                  </div>
                </CardContent>
              </div>

              {/* Card: Tempo Médio entre Operações */}
              {insights.tempoMedioEntreOperacoes && (
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-2 border-cyan-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-cyan-700 flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Padrão Temporal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-4xl mb-3">⏱️</div>
                      <div className="text-2xl font-bold text-cyan-800 mb-2">
                        {insights.tempoMedioEntreOperacoes} dias
                      </div>
                      <p className="text-sm text-cyan-600">
                        📅 Tempo médio entre suas operações
                      </p>
                    </div>
                  </CardContent>
                </div>
              )}
            </div>

            {/* Seção de Badges de Conquistas */}
            {insights.badges && insights.badges.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-amber-200 shadow-lg mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <Award className="h-6 w-6 text-amber-600" />
                  <h3 className="text-xl font-bold text-gray-800">🏆 Suas Conquistas de Investidor</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {insights.badges.map((badge: any, index: number) => (
                    <div key={index} className="bg-white rounded-lg p-4 shadow-md border border-amber-200 text-center hover:shadow-lg transition-shadow">
                      <div className="text-3xl mb-2">{badge.emoji}</div>
                      <div className={
                        badge.cor === 'blue' ? 'font-bold text-blue-700 mb-1' :
                        badge.cor === 'purple' ? 'font-bold text-purple-700 mb-1' :
                        badge.cor === 'green' ? 'font-bold text-green-700 mb-1' :
                        badge.cor === 'amber' ? 'font-bold text-amber-700 mb-1' :
                        'font-bold text-gray-700 mb-1'
                      }>{badge.nome}</div>
                      <p className="text-xs text-gray-600">{badge.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seção de Sugestões Personalizadas */}
            {insights.sugestoes && insights.sugestoes.length > 0 && (
              <div className="bg-gradient-to-r from-rose-50 via-pink-50 to-purple-50 rounded-2xl p-6 border-2 border-rose-200 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Lightbulb className="h-6 w-6 text-rose-600" />
                  <h3 className="text-xl font-bold text-gray-800">💡 Sugestões Personalizadas para Você</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {insights.sugestoes.map((sugestao: any, index: number) => {
                    const IconComponent = sugestao.icone === 'BarChart3' ? BarChart3 :
                                        sugestao.icone === 'AlertTriangle' ? AlertTriangle :
                                        sugestao.icone === 'Landmark' ? Landmark :
                                        sugestao.icone === 'Target' ? Target : Lightbulb;
                    
                    return (
                      <div key={index} className={
                        sugestao.cor === 'blue' ? 'bg-white rounded-lg p-4 shadow-md border-l-4 border-blue-400 hover:shadow-lg transition-shadow' :
                        sugestao.cor === 'amber' ? 'bg-white rounded-lg p-4 shadow-md border-l-4 border-amber-400 hover:shadow-lg transition-shadow' :
                        sugestao.cor === 'red' ? 'bg-white rounded-lg p-4 shadow-md border-l-4 border-red-400 hover:shadow-lg transition-shadow' :
                        sugestao.cor === 'purple' ? 'bg-white rounded-lg p-4 shadow-md border-l-4 border-purple-400 hover:shadow-lg transition-shadow' :
                        'bg-white rounded-lg p-4 shadow-md border-l-4 border-gray-400 hover:shadow-lg transition-shadow'
                      }>
                        <div className="flex items-start gap-3">
                          <div className={
                            sugestao.cor === 'blue' ? 'p-2 rounded-lg bg-blue-100' :
                            sugestao.cor === 'amber' ? 'p-2 rounded-lg bg-amber-100' :
                            sugestao.cor === 'red' ? 'p-2 rounded-lg bg-red-100' :
                            sugestao.cor === 'purple' ? 'p-2 rounded-lg bg-purple-100' :
                            'p-2 rounded-lg bg-gray-100'
                          }>
                            <IconComponent className={
                              sugestao.cor === 'blue' ? 'h-5 w-5 text-blue-600' :
                              sugestao.cor === 'amber' ? 'h-5 w-5 text-amber-600' :
                              sugestao.cor === 'red' ? 'h-5 w-5 text-red-600' :
                              sugestao.cor === 'purple' ? 'h-5 w-5 text-purple-600' :
                              'h-5 w-5 text-gray-600'
                            } />
                          </div>
                          <div className="flex-1">
                            <h4 className={
                              sugestao.cor === 'blue' ? 'font-bold text-blue-700 mb-1' :
                              sugestao.cor === 'amber' ? 'font-bold text-amber-700 mb-1' :
                              sugestao.cor === 'red' ? 'font-bold text-red-700 mb-1' :
                              sugestao.cor === 'purple' ? 'font-bold text-purple-700 mb-1' :
                              'font-bold text-gray-700 mb-1'
                            }>{sugestao.titulo}</h4>
                            <p className="text-sm text-gray-600">{sugestao.descricao}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 📊 NOVA SEÇÃO: Análise Técnica Educativa */}
        {cotacaoAtual && dados && (
          <section id="technical-analysis" className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-1 bg-gradient-to-b from-violet-500 to-fuchsia-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-violet-600" />
                📊 Análise Técnica Simplificada
              </h2>
              <div className="ml-auto">
                <Badge className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-3 py-1">
                  ✨ EDUCATIVO
                </Badge>
              </div>
            </div>

            {/* Introdução Educativa */}
            <div className="bg-gradient-to-r from-violet-50 via-fuchsia-50 to-pink-50 rounded-2xl p-6 border-2 border-violet-200 shadow-lg mb-6">
              <div className="text-center">
                <div className="text-4xl mb-4">📈</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">O que é Análise Técnica?</h3>
                <p className="text-gray-600 max-w-3xl mx-auto">
                  A análise técnica estuda o movimento dos preços para identificar tendências. 
                  Aqui simplificamos os conceitos mais importantes para ajudar você a entender melhor sua ação!
                </p>
              </div>
            </div>

            {/* Grid de Indicadores Técnicos Educativos */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {/* Indicador: Posição vs Mercado */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-blue-700 flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Sua Estratégia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl mb-3">
                      {dados.preco_medio_atual > cotacaoAtual.fechamento ? '🎯' : 
                       dados.preco_medio_atual < cotacaoAtual.fechamento ? '🚀' : '⚖️'}
                    </div>
                    <div className="text-xl font-bold text-blue-800 mb-2">
                      {dados.preco_medio_atual > cotacaoAtual.fechamento ? 'Comprou Caro' : 
                       dados.preco_medio_atual < cotacaoAtual.fechamento ? 'Comprou Barato' : 'No Preço Justo'}
                    </div>
                    <p className="text-sm text-blue-600">
                      💡 {dados.preco_medio_atual > cotacaoAtual.fechamento ? 
                           'Aguarde valorização ou considere aportar mais' : 
                           'Boa estratégia! Posição favorável no momento'}
                    </p>
                  </div>
                </CardContent>
              </div>

              {/* Indicador: Volatilidade Simplificada */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-emerald-700 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Nível de Risco
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl mb-3">
                      {operacoes.length > 20 ? '🌊' : operacoes.length > 10 ? '📊' : '🛡️'}
                    </div>
                    <div className="text-xl font-bold text-emerald-800 mb-2">
                      {operacoes.length > 20 ? 'Alto Movimento' : 
                       operacoes.length > 10 ? 'Movimento Moderado' : 'Baixo Movimento'}
                    </div>
                    <p className="text-sm text-emerald-600">
                      📈 Baseado em {operacoes.length} operações realizadas
                    </p>
                  </div>
                </CardContent>
              </div>

              {/* Indicador: Momento de Entrada */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-amber-700 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Timing de Operações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl mb-3">
                      {(() => {
                        const ultimaOperacao = operacoes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                        if (!ultimaOperacao) return '📅';
                        const diasUltimaOperacao = Math.floor((Date.now() - new Date(ultimaOperacao.date).getTime()) / (1000 * 60 * 60 * 24));
                        return diasUltimaOperacao < 30 ? '⚡' : diasUltimaOperacao < 90 ? '📅' : '😴';
                      })()}
                    </div>
                    <div className="text-xl font-bold text-amber-800 mb-2">
                      {(() => {
                        const ultimaOperacao = operacoes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                        if (!ultimaOperacao) return 'Sem Operações';
                        const diasUltimaOperacao = Math.floor((Date.now() - new Date(ultimaOperacao.date).getTime()) / (1000 * 60 * 60 * 24));
                        return diasUltimaOperacao < 30 ? 'Operador Ativo' : diasUltimaOperacao < 90 ? 'Operador Moderado' : 'Investidor Passivo';
                      })()}
                    </div>
                    <p className="text-sm text-amber-600">
                      ⏰ Baseado na frequência das suas operações
                    </p>
                  </div>
                </CardContent>
              </div>
            </div>

            {/* Seção de Educação Técnica */}
            <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-zinc-50 rounded-2xl p-6 border-2 border-slate-200 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Lightbulb className="h-6 w-6 text-slate-600" />
                <h3 className="text-xl font-bold text-gray-800">💡 Dicas de Análise Técnica para Iniciantes</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-white rounded-lg p-4 shadow-md border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-blue-700 mb-1">Tendência</h4>
                      <p className="text-sm text-gray-600">
                        Se o preço atual está acima do seu preço médio, a tendência está favorável para você.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-md border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-100">
                      <Target className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-green-700 mb-1">Suporte e Resistência</h4>
                      <p className="text-sm text-gray-600">
                        Seu preço médio pode servir como um nível de "suporte" psicológico para suas decisões.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-md border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <Clock className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-purple-700 mb-1">Timing</h4>
                      <p className="text-sm text-gray-600">
                        Não existe timing perfeito. O importante é ter uma estratégia consistente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 🚨 NOVA SEÇÃO: Smart Alerts e Recomendações */}
        {dados && cotacaoAtual && (
          <section id="smart-alerts" className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-1 bg-gradient-to-b from-red-500 to-orange-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                🚨 Alertas e Recomendações Inteligentes
              </h2>
              <div className="ml-auto">
                <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold px-3 py-1">
                  ⚡ AUTOMÁTICO
                </Badge>
              </div>
            </div>

            {(() => {
              const alerts = [];
              const valorAtual = dados.quantidade_atual * cotacaoAtual.fechamento;
              const valorInvestido = dados.quantidade_atual * dados.preco_medio_atual;
              const percentualResultado = valorInvestido > 0 ? ((valorAtual - valorInvestido) / valorInvestido) * 100 : 0;
              
              // Alerta de Concentração de Risco
              if (valorAtual > 10000) {
                alerts.push({
                  tipo: 'concentracao',
                  titulo: '⚠️ Concentração de Risco Detectada',
                  descricao: `Você tem ${formatCurrency(valorAtual)} investidos em ${ticker}. Considere diversificar sua carteira para reduzir riscos.`,
                  cor: 'amber',
                  icone: Shield,
                  prioridade: 'alta'
                });
              }

              // Alerta de Performance
              if (percentualResultado > 15) {
                alerts.push({
                  tipo: 'performance_positiva',
                  titulo: '🎉 Excelente Performance!',
                  descricao: `${ticker} está ${percentualResultado.toFixed(1)}% acima do seu preço médio. Considere realizar lucros parciais ou definir um stop loss.`,
                  cor: 'green',
                  icone: TrendingUp,
                  prioridade: 'media'
                });
              } else if (percentualResultado < -15) {
                alerts.push({
                  tipo: 'performance_negativa',
                  titulo: '📉 Atenção: Performance Negativa',
                  descricao: `${ticker} está ${Math.abs(percentualResultado).toFixed(1)}% abaixo do seu preço médio. Revise sua tese de investimento.`,
                  cor: 'red',
                  icone: TrendingDown,
                  prioridade: 'alta'
                });
              }

              // Alerta de Inatividade
              const ultimaOperacao = operacoes[0]?.date;
              if (ultimaOperacao) {
                const diasSemOperacao = Math.floor((new Date().getTime() - new Date(ultimaOperacao).getTime()) / (1000 * 60 * 60 * 24));
                if (diasSemOperacao > 180) {
                  alerts.push({
                    tipo: 'inatividade',
                    titulo: '⏰ Longa Inatividade Detectada',
                    descricao: `Última operação em ${ticker} foi há ${diasSemOperacao} dias. Considere reavaliar sua posição.`,
                    cor: 'blue',
                    icone: Clock,
                    prioridade: 'baixa'
                  });
                }
              }

              // Recomendações Educativas para Iniciantes
              if (operacoes.length < 5) {
                alerts.push({
                  tipo: 'educativo',
                  titulo: '📚 Dica para Investidor Iniciante',
                  descricao: 'Como você ainda tem poucas operações, considere estudar mais sobre análise fundamentalista e diversificação de carteira.',
                  cor: 'purple',
                  icone: BookOpen,
                  prioridade: 'media'
                });
              }

              // Ordenar por prioridade
              const prioridadeOrdem = { 'alta': 3, 'media': 2, 'baixa': 1 };
              alerts.sort((a, b) => prioridadeOrdem[b.prioridade] - prioridadeOrdem[a.prioridade]);

              return alerts.length > 0 ? (
                <div className="grid gap-4">
                  {alerts.map((alert, index) => {
                    const IconComponent = alert.icone;
                    const corClasses = {
                      amber: {
                        bg: 'bg-amber-50 border-amber-200',
                        icon: 'bg-amber-100 text-amber-600',
                        title: 'text-amber-700',
                        text: 'text-amber-600'
                      },
                      green: {
                        bg: 'bg-green-50 border-green-200', 
                        icon: 'bg-green-100 text-green-600',
                        title: 'text-green-700',
                        text: 'text-green-600'
                      },
                      red: {
                        bg: 'bg-red-50 border-red-200',
                        icon: 'bg-red-100 text-red-600', 
                        title: 'text-red-700',
                        text: 'text-red-600'
                      },
                      blue: {
                        bg: 'bg-blue-50 border-blue-200',
                        icon: 'bg-blue-100 text-blue-600',
                        title: 'text-blue-700', 
                        text: 'text-blue-600'
                      },
                      purple: {
                        bg: 'bg-purple-50 border-purple-200',
                        icon: 'bg-purple-100 text-purple-600',
                        title: 'text-purple-700',
                        text: 'text-purple-600'
                      }
                    };

                    const classes = corClasses[alert.cor];

                    return (
                      <div key={index} className={`${classes.bg} rounded-2xl p-6 border-2 shadow-lg hover:shadow-xl transition-all duration-300`}>
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl ${classes.icon}`}>
                            <IconComponent className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <h3 className={`text-lg font-bold ${classes.title} mb-2`}>
                              {alert.titulo}
                            </h3>
                            <p className={`text-sm ${classes.text} leading-relaxed`}>
                              {alert.descricao}
                            </p>
                            <div className="mt-3 flex items-center gap-2">
                              <Badge variant="outline" className={`text-xs ${classes.title} border-current`}>
                                Prioridade: {alert.prioridade.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className={`text-xs ${classes.title} border-current`}>
                                {alert.tipo.replace(/_/g, ' ').toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-8 border-2 border-green-200 text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-bold text-green-700 mb-2">Tudo Bem por Aqui!</h3>
                  <p className="text-green-600">
                    Não identificamos nenhum alerta importante para sua posição em {ticker}. Continue acompanhando regularmente!
                  </p>
                </div>
              );
            })()}
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

        {/* 📈 NOVA SEÇÃO: Calculadora de Cenários */}
        {dados && cotacaoAtual && (
          <section id="scenario-calculator" className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-1 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Calculator className="h-6 w-6 text-emerald-600" />
                📈 Simulador de Cenários
              </h2>
              <div className="ml-auto">
                <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-3 py-1">
                  🧮 INTERATIVO
                </Badge>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Cenário de Alta */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-green-100">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-green-700">🚀 Cenário Otimista</h3>
                    <p className="text-sm text-green-600">Se o preço subir 20% do seu preço médio</p>
                  </div>
                </div>
                
                {(() => {
                  // 🎯 CORREÇÃO: Cenário deve ser baseado no preço médio do investidor, não na cotação atual
                  const precoAlvo = dados.preco_medio_atual * 1.20;
                  const valorFuturo = dados.quantidade_atual * precoAlvo;
                  const valorInvestido = dados.quantidade_atual * dados.preco_medio_atual;
                  const lucroProjetado = valorFuturo - valorInvestido;
                  const percentualGanho = valorInvestido > 0 ? ((lucroProjetado / valorInvestido) * 100) : 0;

                  // Simulação Fiscal - Swing Trade Brasileiro
                  const isIsentoSwing = valorFuturo <= 20000; // Isenção para vendas ≤ R$ 20.000/mês
                  const aliquotaIR = 0.15; // 15% para swing trade
                  const impostoIR = isIsentoSwing ? 0 : (lucroProjetado * aliquotaIR);
                  const lucroLiquido = lucroProjetado - impostoIR;

                  return (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-green-200">
                        <span className="text-green-700 font-medium">Preço Alvo:</span>
                        <span className="text-green-800 font-bold">{formatCurrency(precoAlvo)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-green-200">
                        <span className="text-green-700 font-medium">Valor da Posição:</span>
                        <span className="text-green-800 font-bold">{formatCurrency(valorFuturo)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-green-200">
                        <span className="text-green-700 font-medium">Lucro Bruto:</span>
                        <span className="text-green-800 font-bold">
                          {formatCurrency(lucroProjetado)} ({percentualGanho.toFixed(1)}%)
                        </span>
                      </div>

                      {/* Simulação Fiscal */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-1">
                          🏛️ Simulação Fiscal (Swing Trade)
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-blue-700">Valor da venda:</span>
                            <span className="text-blue-800 font-medium">{formatCurrency(valorFuturo)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-blue-700">Status fiscal:</span>
                            <span className={`font-medium ${isIsentoSwing ? 'text-green-600' : 'text-orange-600'}`}>
                              {isIsentoSwing ? '✅ Isento' : '⚠️ Tributável'}
                            </span>
                          </div>
                          {!isIsentoSwing && (
                            <div className="flex justify-between items-center">
                              <span className="text-blue-700">IR (15%):</span>
                              <span className="text-red-600 font-medium">- {formatCurrency(impostoIR)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                            <span className="text-blue-800 font-bold">Lucro Líquido:</span>
                            <span className="text-green-800 font-bold text-lg">
                              {formatCurrency(lucroLiquido)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Educacional sobre Impostos */}
                      <div className="mt-4 p-3 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg border border-green-200">
                        <p className="text-xs text-green-700 mb-2">
                          💡 <strong>Educação Fiscal:</strong>
                        </p>
                        {isIsentoSwing ? (
                          <p className="text-xs text-green-700">
                            🎉 <strong>Operação isenta!</strong> Vendas de ações até R$ 20.000/mês não pagam IR.
                            Continue investindo com tranquilidade fiscal.
                          </p>
                        ) : (
                          <div className="text-xs text-green-700 space-y-1">
                            <p>
                              📊 <strong>Swing Trade (≥30 dias):</strong> IR de 15% sobre o lucro
                            </p>
                            <p>
                              📅 <strong>DARF:</strong> Recolher até o último dia útil do mês seguinte
                            </p>
                            <p>
                              🔄 <strong>Compensação:</strong> Prejuízos anteriores podem reduzir o imposto
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 p-3 bg-green-100 rounded-lg">
                        <p className="text-xs text-green-700">
                          🎯 <strong>Estratégia:</strong> Considere definir uma meta de lucro para realizar ganhos parciais e otimizar a tributação.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Cenário de Baixa */}
              <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-6 border-2 border-red-200 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-red-100">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-700">📉 Cenário Pessimista</h3>
                    <p className="text-sm text-red-600">Se o preço cair 20% do seu preço médio</p>
                  </div>
                </div>
                
                {(() => {
                  // 🎯 CORREÇÃO: Cenário deve ser baseado no preço médio do investidor, não na cotação atual
                  const precoAlvo = dados.preco_medio_atual * 0.80;
                  const valorFuturo = dados.quantidade_atual * precoAlvo;
                  const valorInvestido = dados.quantidade_atual * dados.preco_medio_atual;
                  const prejuizoProjetado = valorFuturo - valorInvestido;
                  const percentualPerda = valorInvestido > 0 ? ((prejuizoProjetado / valorInvestido) * 100) : 0;

                  return (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-red-200">
                        <span className="text-red-700 font-medium">Preço Alvo:</span>
                        <span className="text-red-800 font-bold">{formatCurrency(precoAlvo)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-red-200">
                        <span className="text-red-700 font-medium">Valor da Posição:</span>
                        <span className="text-red-800 font-bold">{formatCurrency(valorFuturo)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-red-700 font-medium">Prejuízo Projetado:</span>
                        <span className="text-red-800 font-bold text-lg">
                          {formatCurrency(prejuizoProjetado)} ({percentualPerda.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="mt-4 p-3 bg-red-100 rounded-lg">
                        <p className="text-xs text-red-700">
                          ⚠️ <strong>Atenção:</strong> Defina um limite de perda (stop loss) para proteger seu capital.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Seção Educativa sobre Gerenciamento de Risco */}
            <div className="mt-6 bg-gradient-to-r from-slate-50 via-gray-50 to-zinc-50 rounded-2xl p-6 border-2 border-slate-200 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-slate-600" />
                <h3 className="text-xl font-bold text-gray-800">🛡️ Gestão de Risco para Iniciantes</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-white rounded-lg p-4 shadow-md border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Target className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-blue-700 mb-1">Meta de Ganho</h4>
                      <p className="text-sm text-gray-600">
                        Defina uma meta de lucro (ex: 15-20%) para realizar ganhos parciais.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-md border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-red-100">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-red-700 mb-1">Stop Loss</h4>
                      <p className="text-sm text-gray-600">
                        Limite de perda máxima aceitável (ex: -10 a -15%) para proteger o capital.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-md border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <PieChart className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-purple-700 mb-1">Diversificação</h4>
                      <p className="text-sm text-gray-600">
                        Não concentre mais de 5-10% do patrimônio em uma única ação.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

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

"use client";

import { useParams } from 'next/navigation'; // To get ticker from URL
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Operacao, ResultadoTicker } from '@/lib/types'; // Assuming ResultadoTicker will be added to types.ts
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Package, Briefcase, ShoppingCart, Landmark, Search, X } from 'lucide-react'; // Added Search, X icons
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // For back button
import { Input } from '@/components/ui/input'; // For search input

// Placeholder for ResultadoTicker if not already in types.ts
// You might need to create/update this in a separate step if it's complex
// For now, this subtask can assume a basic structure or use 'any' temporarily.
// Already done: The ResultadoTicker model was defined in backend/models.py and should have a counterpart in frontend/lib/types.ts

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

  const [resultadoDoTicker, setResultadoDoTicker] = useState<ResultadoTicker | null>(null);
  const [operacoesDoTicker, setOperacoesDoTicker] = useState<Operacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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
        const [resResultados, resOperacoes] = await Promise.all([
          api.get(`/resultados/ticker/${ticker}`),
          api.get(`/operacoes/ticker/${ticker}`)
        ]);
        setResultadoDoTicker(resResultados.data);
        // Mapeia os campos da API para o formato esperado pelo frontend
        const operacoesMapeadas = Array.isArray(resOperacoes.data)
          ? resOperacoes.data.map((op: any, idx: number) => ({
              id: idx, // ou op.id se existir
              date: op["Data do Negócio"] || op.date || "",
              ticker: op["Código de Negociação"] || op.ticker || "",
              operation: op["Tipo de Movimentação"] || op.operation || "",
              quantity: op["Quantidade"] ?? op.quantity ?? 0,
              price: op["Preço"] ?? op.price ?? 0,
              fees: op["Taxas"] ?? op.fees ?? 0,
            }))
          : [];
        setOperacoesDoTicker(operacoesMapeadas);
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
  const operacoesFiltradas = operacoesDoTicker.filter((op) => {
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
      <div className="container mx-auto p-4 text-center">
        <p>Carregando dados da ação...</p> {/* TODO: Replace with a spinner component */}
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
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {ticker}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  📊 Veja tudo sobre esta ação de forma simples e didática
                </p>
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
          {resultadoDoTicker ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                  <div className="text-3xl font-bold text-blue-800 mb-2">{formatNumber(resultadoDoTicker.quantidade_atual)}</div>
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
                  <div className="text-3xl font-bold text-green-800 mb-2">{formatCurrency(resultadoDoTicker.preco_medio_atual)}</div>
                  <p className="text-sm text-green-600">💰 Preço médio pago por ação</p>
                </CardContent>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-purple-700 flex items-center gap-2">
                      <Landmark className="h-5 w-5" />
                      Valor Total Investido
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-800 mb-2">{formatCurrency(resultadoDoTicker.custo_total_atual)}</div>
                  <p className="text-sm text-purple-600">🏦 Total investido na posição</p>
                </CardContent>
              </div>

              {/* Card de Lucro/Prejuízo com destaque especial */}
              <div className={`${resultadoDoTicker.lucro_prejuizo_realizado_total >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200' : 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200'} rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 col-span-full md:col-span-2 lg:col-span-3`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-xl font-semibold ${resultadoDoTicker.lucro_prejuizo_realizado_total >= 0 ? 'text-emerald-700' : 'text-red-700'} flex items-center gap-2`}>
                      {resultadoDoTicker.lucro_prejuizo_realizado_total >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                      Lucro/Prejuízo Realizado
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-4xl font-bold ${resultadoDoTicker.lucro_prejuizo_realizado_total >= 0 ? 'text-emerald-800' : 'text-red-800'} mb-2`}>
                    {formatCurrency(resultadoDoTicker.lucro_prejuizo_realizado_total)}
                  </div>
                  <p className={`text-base ${resultadoDoTicker.lucro_prejuizo_realizado_total >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {resultadoDoTicker.lucro_prejuizo_realizado_total >= 0 ? '🎉 Parabéns! Você já realizou lucro com vendas' : '📉 Prejuízo realizado com vendas (faz parte do aprendizado!)'}
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

        {/* Cards de histórico modernizados */}
        <section id="history-cards">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-800">📋 Histórico de Operações</h2>
          </div>
          {resultadoDoTicker ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-yellow-700 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Total Investido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-800 mb-2">{formatCurrency(resultadoDoTicker.total_investido_historico)}</div>
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
                  <div className="text-2xl font-bold text-orange-800 mb-2">{formatCurrency(resultadoDoTicker.total_vendido_historico)}</div>
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
                  <div className="text-2xl font-bold text-cyan-800 mb-2">{formatNumber(resultadoDoTicker.operacoes_compra_total_quantidade)}</div>
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
                  <div className="text-2xl font-bold text-indigo-800 mb-2">{formatNumber(resultadoDoTicker.operacoes_venda_total_quantidade)}</div>
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
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Digite a data, tipo (compra/venda), quantidade, preço..."
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
            ) : operacoesDoTicker.length === 0 ? (
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

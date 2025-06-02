"use client";

import { useParams } from 'next/navigation'; // To get ticker from URL
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Operacao, ResultadoTicker } from '@/lib/types'; // Assuming ResultadoTicker will be added to types.ts
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Package, Briefcase, ShoppingCart, Landmark } from 'lucide-react'; // Added icons
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // For back button

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
        setOperacoesDoTicker(resOperacoes.data);
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
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Detalhes da Ação: {ticker}</h1>
        <Link href="/" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Dashboard
          </Button>
        </Link>
      </div>

      {/* Placeholder for Summary Cards - Step 7 */}
      <section id="summary-cards">
        <h2 className="text-2xl font-semibold mb-4">Resumo da Ação</h2>
        {resultadoDoTicker ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quantidade Atual</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(resultadoDoTicker.quantidade_atual)}</div>
                <p className="text-xs text-muted-foreground">Ações em carteira</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Preço Médio Atual</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(resultadoDoTicker.preco_medio_atual)}</div>
                <p className="text-xs text-muted-foreground">Custo médio por ação</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custo Total Atual</CardTitle>
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(resultadoDoTicker.custo_total_atual)}</div>
                <p className="text-xs text-muted-foreground">Valor total investido na posição atual</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro/Prejuízo Realizado</CardTitle>
                {resultadoDoTicker.lucro_prejuizo_realizado_total >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${resultadoDoTicker.lucro_prejuizo_realizado_total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(resultadoDoTicker.lucro_prejuizo_realizado_total)}
                </div>
                <p className="text-xs text-muted-foreground">Total de ganhos/perdas com vendas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Investido (Histórico)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(resultadoDoTicker.total_investido_historico)}</div>
                <p className="text-xs text-muted-foreground">Soma de todas as compras</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Vendido (Histórico)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(resultadoDoTicker.total_vendido_historico)}</div>
                <p className="text-xs text-muted-foreground">Soma de todas as vendas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Qtd. Comprada</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(resultadoDoTicker.operacoes_compra_total_quantidade)}</div>
                <p className="text-xs text-muted-foreground">Soma de todas as quantidades compradas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Qtd. Vendida</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(resultadoDoTicker.operacoes_venda_total_quantidade)}</div>
                <p className="text-xs text-muted-foreground">Soma de todas as quantidades vendidas</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="text-muted-foreground">Nenhum dado de resumo disponível para este ticker.</p>
        )}
      </section>

      {/* Placeholder for Operations Table - Step 8 */}
      <section id="operations-table">
        <h2 className="text-2xl font-semibold mb-4">Histórico de Operações para {ticker}</h2>
        {operacoesDoTicker && operacoesDoTicker.length > 0 ? (
          <Card>
            <CardContent className="pt-4"> {/* Added pt-4 for padding, CardHeader could also be used */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Preço Unitário</TableHead>
                    <TableHead className="text-right">Taxas</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operacoesDoTicker.map((op) => {
                    const valorOperacao = op.quantity * op.price;
                    const valorTotalComTaxas = op.operation === 'buy' ? valorOperacao + op.fees : valorOperacao - op.fees;
                    return (
                      <TableRow key={op.id}>
                        <TableCell>{formatDate(op.date)}</TableCell>
                        <TableCell>
                          <Badge variant={op.operation === 'buy' ? 'default' : 'secondary'}>
                            {op.operation === 'buy' ? 'Compra' : 'Venda'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(op.quantity)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(op.price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(op.fees)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(valorTotalComTaxas)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Nenhuma operação encontrada para este ticker.</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

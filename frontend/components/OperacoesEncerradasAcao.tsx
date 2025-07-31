"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useOperacoesOtimizadas } from "@/hooks/useOperacoesOtimizadas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Calendar, DollarSign, Hash, BarChart3, Building2 } from 'lucide-react';

interface OperacoesEncerradasAcaoProps {
  ticker: string;
  nomeAcao?: string;
}

// Formatting helpers
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

const formatDate = (dateString: string) => {
  const dateOnly = dateString.split("T")[0];
  const [year, month, day] = dateOnly.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit", 
    year: "numeric",
  });
};

// Helper functions to calculate average prices with fallback
const getPrecoMedioCompra = (op: any): number => {
  // Try to use the field directly from backend
  if (op.preco_medio_compra && op.preco_medio_compra > 0) {
    return op.preco_medio_compra;
  }

  // Fallback: calculate manually from total value
  if (op.valor_compra && op.quantidade && op.quantidade > 0) {
    return op.valor_compra / op.quantidade;
  }

  return 0;
};

const getPrecoMedioVenda = (op: any): number => {
  // Try to use the field directly from backend
  if (op.preco_medio_venda && op.preco_medio_venda > 0) {
    return op.preco_medio_venda;
  }

  // Fallback: calculate manually from total value
  if (op.valor_venda && op.quantidade && op.quantidade > 0) {
    return op.valor_venda / op.quantidade;
  }

  return 0;
};

// Pagination Controls Component
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

const PaginationControls = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationControlsProps) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-gradient-to-r from-gray-50 to-indigo-50 border-t border-indigo-200 rounded-b-xl">
      <div className="text-sm text-gray-600">
        Mostrando <span className="font-medium">{startItem}</span> a <span className="font-medium">{endItem}</span> de <span className="font-medium">{totalItems}</span> operações
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-1">
          {getVisiblePages().map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="px-2 py-1 text-sm text-gray-400">...</span>
              ) : (
                <Button
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page as number)}
                  className={`h-8 w-8 p-0 ${
                    currentPage === page
                      ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                      : "border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {page}
                </Button>
              )}
            </div>
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default function OperacoesEncerradasAcao({ ticker, nomeAcao }: OperacoesEncerradasAcaoProps) {
  // Get optimized operations data
  const { operacoes: todasOperacoes, isLoading, error } = useOperacoesOtimizadas();
  
  // Filter operations for this specific ticker
  const operacoesAcao = useMemo(() => {
    return todasOperacoes.filter(op => 
      op.ticker.toUpperCase() === ticker.toUpperCase()
    );
  }, [todasOperacoes, ticker]);

  // State for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterResult, setFilterResult] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterResult]);

  // Process and filter operations
  const filteredOperacoes = useMemo(() => {
    let ops = [...operacoesAcao];

    // Filter by type
    if (filterType !== "all") {
      ops = ops.filter(op => 
        filterType === "day_trade" ? op.day_trade : !op.day_trade
      );
    }

    // Filter by result type
    if (filterResult !== "all") {
      ops = ops.filter(op => 
        filterResult === "lucro" ? op.resultado > 0 : op.resultado <= 0
      );
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      ops = ops.filter(op =>
        formatDate(op.data_fechamento).toLowerCase().includes(term) ||
        (op.day_trade ? "day trade" : "swing trade").includes(term) ||
        op.resultado.toString().toLowerCase().includes(term) ||
        formatCurrency(getPrecoMedioCompra(op)).toLowerCase().includes(term) ||
        formatCurrency(getPrecoMedioVenda(op)).toLowerCase().includes(term)
      );
    }

    return ops;
  }, [operacoesAcao, searchTerm, filterType, filterResult]);

  // Sort operations by closing date (most recent first)
  const sortedOperacoes = useMemo(() => {
    return [...filteredOperacoes].sort((a, b) => 
      new Date(b.data_fechamento).getTime() - new Date(a.data_fechamento).getTime()
    );
  }, [filteredOperacoes]);

  // Pagination
  const totalPages = Math.ceil(sortedOperacoes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOperacoes = sortedOperacoes.slice(startIndex, endIndex);

  // Summary statistics
  const totalResult = operacoesAcao.reduce((acc, op) => acc + op.resultado, 0);
  const totalProfit = operacoesAcao.filter(op => op.resultado > 0).reduce((acc, op) => acc + op.resultado, 0);
  const totalLoss = Math.abs(operacoesAcao.filter(op => op.resultado < 0).reduce((acc, op) => acc + op.resultado, 0));
  const totalOperations = operacoesAcao.length;

  if (isLoading) {
    return (
      <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
          <CardTitle className="text-2xl font-bold">🔄 Carregando Operações Encerradas...</CardTitle>
        </CardHeader>
        <CardContent className="p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Buscando suas operações encerradas de {ticker}...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6">
          <CardTitle className="text-2xl font-bold">❌ Erro ao Carregar Operações</CardTitle>
        </CardHeader>
        <CardContent className="p-12">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (operacoesAcao.length === 0) {
    return (
      <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
          <CardTitle className="text-2xl font-bold flex items-center gap-3">
            <BarChart3 className="h-6 w-6" />
            Operações Encerradas - {ticker}
          </CardTitle>
          <CardDescription className="text-indigo-100">
            Histórico de operações finalizadas para {nomeAcao || ticker}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-12">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-6">
              <Building2 className="h-12 w-12 text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Nenhuma Operação Encerrada
            </h3>
            <p className="text-gray-600 text-lg mb-4">
              Ainda não há operações finalizadas para {ticker}
            </p>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Suas operações de compra e venda finalizadas aparecerão aqui automaticamente
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
      {/* Header with summary stats */}
      <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                Operações Encerradas - {ticker}
              </CardTitle>
              <CardDescription className="text-indigo-100">
                {totalOperations} operação(ões) finalizada(s) para {nomeAcao || ticker}
              </CardDescription>
            </div>
          </div>
          
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  totalResult >= 0 ? 'bg-green-100/20' : 'bg-red-100/20'
                }`}>
                  {totalResult >= 0 ? 
                    <TrendingUp className="h-4 w-4 text-green-200" /> : 
                    <TrendingDown className="h-4 w-4 text-red-200" />
                  }
                </div>
                <div>
                  <p className="text-xs font-medium text-white/80">Resultado Total</p>
                  <p className={`text-sm font-bold ${
                    totalResult >= 0 ? 'text-green-200' : 'text-red-200'
                  }`}>
                    {formatCurrency(totalResult)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-green-100/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-200" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white/80">Total Lucros</p>
                  <p className="text-sm font-bold text-green-200">
                    {formatCurrency(totalProfit)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-red-100/20 rounded-lg flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-red-200" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white/80">Total Prejuízos</p>
                  <p className="text-sm font-bold text-red-200">
                    {formatCurrency(totalLoss)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 pb-0">
        {/* Filters */}
        <div className="mb-6 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl p-4 border border-indigo-200">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-indigo-500" />
              <Input
                placeholder="Pesquisar por data, tipo, resultado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-2 border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200 rounded-xl transition-all duration-300 bg-white"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px] h-12 border-2 border-indigo-200 focus:border-indigo-500 rounded-xl bg-white">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="day_trade">Day Trade</SelectItem>
                <SelectItem value="swing_trade">Swing Trade</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterResult} onValueChange={setFilterResult}>
              <SelectTrigger className="w-[160px] h-12 border-2 border-indigo-200 focus:border-indigo-500 rounded-xl bg-white">
                <SelectValue placeholder="Resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os resultados</SelectItem>
                <SelectItem value="lucro">Lucros</SelectItem>
                <SelectItem value="prejuizo">Prejuízos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredOperacoes.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Nenhuma operação encontrada
            </h3>
            <p className="text-gray-600 mb-4">
              Ajuste os filtros ou tente outros termos de pesquisa
            </p>
            <Button
              onClick={() => {
                setSearchTerm("");
                setFilterType("all");
                setFilterResult("all");
              }}
              variant="outline"
              className="rounded-xl border-2 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50"
            >
              Limpar Filtros
            </Button>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="border border-indigo-200 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-gray-50 to-indigo-50 border-b border-indigo-200">
                    <TableHead className="font-semibold text-gray-700 p-4">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-indigo-500" />
                        ID
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 p-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-indigo-500" />
                        Ação
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 p-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-500" />
                        Data Encerr.
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700 p-4">Tipo</TableHead>
                    <TableHead className="font-semibold text-gray-700 p-4 text-right">Preço Médio</TableHead>
                    <TableHead className="font-semibold text-gray-700 p-4 text-right">Preço Venda</TableHead>
                    <TableHead className="font-semibold text-gray-700 p-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <DollarSign className="h-4 w-4 text-indigo-500" />
                        Resultado
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOperacoes.map((operacao, index) => {
                    const isProfit = operacao.resultado > 0;
                    const globalIndex = startIndex + index + 1;
                    
                    return (
                      <TableRow 
                        key={operacao.id} 
                        className={`${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                        } hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-all duration-200`}
                      >
                        <TableCell className="p-4">
                          <span className="text-sm text-gray-600 font-medium">
                            #{globalIndex}
                          </span>
                        </TableCell>
                        <TableCell className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {ticker}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {nomeAcao || ticker}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatNumber(operacao.quantidade)} ações
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-4">
                          <span className="text-sm text-gray-700">
                            {formatDate(operacao.data_fechamento)}
                          </span>
                        </TableCell>
                        <TableCell className="p-4">
                          <Badge
                            variant="outline"
                            className={`${
                              operacao.day_trade
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {operacao.day_trade ? "Day Trade" : "Swing Trade"}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-4 text-right">
                          <span className="text-sm font-medium text-gray-700">
                            {formatCurrency(getPrecoMedioCompra(operacao))}
                          </span>
                        </TableCell>
                        <TableCell className="p-4 text-right">
                          <span className="text-sm font-medium text-gray-700">
                            {formatCurrency(getPrecoMedioVenda(operacao))}
                          </span>
                        </TableCell>
                        <TableCell className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isProfit ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                            <span className={`text-sm font-bold ${
                              isProfit ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {isProfit ? '+' : ''}
                              {formatCurrency(operacao.resultado)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      {/* Pagination */}
      {filteredOperacoes.length > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedOperacoes.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}
    </Card>
  );
}
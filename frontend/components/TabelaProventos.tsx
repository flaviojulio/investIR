"use client"
import React, { useState, useMemo, useEffect } from 'react';
import { ProventoRecebidoUsuario } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, TrendingUp, TrendingDown, Calendar, DollarSign, Hash, Gift, Building2 } from 'lucide-react';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

interface TabelaProventosProps {
  data: ProventoRecebidoUsuario[];
  showValues?: boolean;
  title?: string;
  ticker?: string;
}

type SortableKeys = 'data_ex' | 'dt_pagamento' | 'ticker_acao' | 'tipo' | 'valor_total_recebido';

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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-gradient-to-r from-gray-50 to-green-50 border-t border-green-200 rounded-b-xl">
      <div className="text-sm text-gray-600">
        Mostrando <span className="font-medium">{startItem}</span> a <span className="font-medium">{endItem}</span> de <span className="font-medium">{totalItems}</span> proventos
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 border-green-200 hover:border-green-300 hover:bg-green-50"
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
                      ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                      : "border-green-200 hover:border-green-300 hover:bg-green-50"
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
          className="h-8 w-8 p-0 border-green-200 hover:border-green-300 hover:bg-green-50"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export function TabelaProventos({ data, showValues = true, title = "Proventos", ticker }: TabelaProventosProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'dt_pagamento', direction: 'descending' });
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStatus]);

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Process and filter data
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter(provento => 
        provento.tipo?.toLowerCase().includes(filterType.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== "all") {
      const now = new Date();
      filtered = filtered.filter(provento => {
        const pagamentoDate = provento.dt_pagamento ? new Date(provento.dt_pagamento) : null;
        const isRecebido = pagamentoDate && pagamentoDate <= now;
        if (filterStatus === "recebido") return isRecebido;
        if (filterStatus === "a_receber") return !isRecebido;
        return true;
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(provento =>
        provento.ticker_acao?.toLowerCase().includes(term) ||
        provento.nome_acao?.toLowerCase().includes(term) ||
        provento.tipo?.toLowerCase().includes(term) ||
        formatDate(provento.dt_pagamento)?.toLowerCase().includes(term) ||
        formatCurrency(provento.valor_total_recebido || 0).toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [data, searchTerm, filterType, filterStatus]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    // Create a new array to avoid mutating the original data prop
    const sortableItems = [...filteredData];

    sortableItems.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle null or undefined values by pushing them to the end when ascending, beginning when descending
      if (aValue === null || aValue === undefined) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      if (bValue === null || bValue === undefined) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue); // Natural order for numbers
      }

      // For date strings (YYYY-MM-DD), direct string comparison works for sorting.
      // For other strings, localeCompare is appropriate.
      return String(aValue).localeCompare(String(bValue));
    });

    // Apply direction after sorting
    if (sortConfig.direction === 'descending') {
      sortableItems.reverse();
    }

    return sortableItems;
  }, [filteredData, sortConfig]);

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  // Summary statistics
  const totalReceived = data.filter(p => {
    const now = new Date();
    return p.dt_pagamento && new Date(p.dt_pagamento) <= now;
  }).reduce((sum, p) => sum + (p.valor_total_recebido || 0), 0);
  
  const totalToReceive = data.filter(p => {
    const now = new Date();
    return !p.dt_pagamento || new Date(p.dt_pagamento) > now;
  }).reduce((sum, p) => sum + (p.valor_total_recebido || 0), 0);
  
  const totalGeneral = data.reduce((sum, p) => sum + (p.valor_total_recebido || 0), 0);
  const totalProventos = data.length;

  // Reset to first page when data changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
          <CardTitle className="text-2xl font-bold flex items-center gap-3">
            <Gift className="h-6 w-6" />
            {title}
          </CardTitle>
          <CardDescription className="text-green-100">
            Histórico de dividendos e proventos {ticker ? `para ${ticker}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-12">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mb-6">
              <Gift className="h-12 w-12 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Nenhum Provento Registrado
            </h3>
            <p className="text-gray-600 text-lg mb-4">
              Ainda não há proventos registrados {ticker ? `para ${ticker}` : ''}
            </p>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Os dividendos e proventos aparecerão aqui automaticamente quando distribuídos
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Configuration for table headers
  // Adiciona coluna de status (Recebido/A Receber)
  const headerConfig: { key?: SortableKeys; label: string; className?: string; isSortable: boolean }[] = [
    { key: 'data_ex', label: 'Data Ex', className: 'hidden md:table-cell', isSortable: true },
    { key: 'dt_pagamento', label: 'Data Pag.', isSortable: true },
    { key: 'ticker_acao', label: 'Ticker', isSortable: true },
    { label: 'Nome Ação', className: 'hidden lg:table-cell', isSortable: false },
    { key: 'tipo', label: 'Tipo', isSortable: true },
    { label: 'Qtd. na Data Ex', className: 'text-right hidden sm:table-cell', isSortable: false },
    { label: 'Valor Unit.', className: 'text-right', isSortable: false },
    { key: 'valor_total_recebido', label: 'Total Recebido', className: 'text-right', isSortable: true },
    { label: 'Status', className: 'text-center', isSortable: false },
  ];

  const now = new Date();
  const uniqueData = Array.from(new Map(sortedData.map(item => [item.id, item])).values());
  const paginatedUniqueData = Array.from(new Map(paginatedData.map(item => [item.id, item])).values());

  return (
    <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
      {/* Header with summary stats */}
      <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Gift className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                {title} {ticker ? `- ${ticker}` : ''}
              </CardTitle>
              <CardDescription className="text-green-100">
                {totalProventos} provento(s) registrado(s)
              </CardDescription>
            </div>
          </div>
          
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-green-100/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-200" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white/80">Recebidos</p>
                  <p className="text-sm font-bold text-green-200">
                    {showValues ? formatCurrency(totalReceived) : '***'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-blue-100/20 rounded-lg flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-blue-200" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white/80">A Receber</p>
                  <p className="text-sm font-bold text-blue-200">
                    {showValues ? formatCurrency(totalToReceive) : '***'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-yellow-100/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-yellow-200" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white/80">Total Geral</p>
                  <p className="text-sm font-bold text-yellow-200">
                    {showValues ? formatCurrency(totalGeneral) : '***'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 pb-0">
        {/* Filters */}
        <div className="mb-6 bg-gradient-to-r from-gray-50 to-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
              <Input
                placeholder="Pesquisar por ticker, tipo, data..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-2 border-green-200 focus:border-green-500 focus:ring-4 focus:ring-green-200 rounded-xl transition-all duration-300 bg-white"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px] h-12 border-2 border-green-200 focus:border-green-500 rounded-xl bg-white">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="dividendo">Dividendo</SelectItem>
                <SelectItem value="jcp">JCP</SelectItem>
                <SelectItem value="rendimento">Rendimento</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] h-12 border-2 border-green-200 focus:border-green-500 rounded-xl bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="recebido">Recebidos</SelectItem>
                <SelectItem value="a_receber">A Receber</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {sortedData.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Nenhum provento encontrado
            </h3>
            <p className="text-gray-600 mb-4">
              Ajuste os filtros ou tente outros termos de pesquisa
            </p>
            <Button
              onClick={() => {
                setSearchTerm("");
                setFilterType("all");
                setFilterStatus("all");
              }}
              variant="outline"
              className="rounded-xl border-2 border-green-200 hover:border-green-300 hover:bg-green-50"
            >
              Limpar Filtros
            </Button>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="border border-green-200 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-gray-50 to-green-50 border-b border-green-200">
                    {headerConfig.map((header) => (
                      <TableHead key={header.label} className={`font-semibold text-gray-700 p-4 ${header.className || ''}`}>
                        {header.isSortable && header.key ? (
                          <Button variant="ghost" onClick={() => requestSort(header.key!)} className="px-1 text-xs sm:text-sm text-left w-full justify-start group hover:bg-green-50">
                            {header.label}
                            <ArrowUpDown className={`ml-1 h-3 w-3 inline-block transition-opacity ${sortConfig?.key === header.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
                            {sortConfig?.key === header.key && (
                              <span className="sr-only">
                                {sortConfig.direction === 'ascending' ? ' (ascendente)' : ' (descendente)'}
                              </span>
                            )}
                          </Button>
                        ) : (
                          <span className="px-1 text-xs sm:text-sm font-medium">{header.label}</span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUniqueData.map((provento, index) => {
                    // Badge: Recebido se dt_pagamento <= hoje, A Receber se dt_pagamento > hoje ou ausente e data_ex futura
                    let status = 'Recebido';
                    if (!provento.dt_pagamento || new Date(provento.dt_pagamento) > now) {
                      status = 'A Receber';
                    }
                    return (
                      <TableRow 
                        key={provento.id}
                        className={`${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                        } hover:bg-gradient-to-r hover:from-green-50/50 hover:to-emerald-50/50 transition-all duration-200`}
                      >
                        <TableCell className="hidden md:table-cell text-xs sm:text-sm p-4">{formatDate(provento.data_ex)}</TableCell>
                        <TableCell className="text-xs sm:text-sm p-4">{formatDate(provento.dt_pagamento)}</TableCell>
                        <TableCell className="font-medium text-xs sm:text-sm p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                              <span className="text-white font-semibold text-xs">
                                {provento.ticker_acao?.substring(0, 2) || '??'}
                              </span>
                            </div>
                            <span>{provento.ticker_acao}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs sm:text-sm p-4">{provento.nome_acao || '-'}</TableCell>
                        <TableCell className="text-xs sm:text-sm p-4">
                          <Badge
                            variant="outline"
                            className={
                              provento.tipo === 'Dividendo' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              provento.tipo === 'JCP' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }
                          >
                            {provento.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell text-xs sm:text-sm p-4">{formatNumber(provento.quantidade_na_data_ex)}</TableCell>
                        <TableCell className="text-right text-xs sm:text-sm p-4">{formatCurrency(provento.valor_unitario_provento)}</TableCell>
                        <TableCell className="text-right font-semibold text-xs sm:text-sm p-4">
                          <div className="flex items-center justify-end gap-1">
                            <DollarSign className="h-3 w-3 text-green-600" />
                            <span className="text-green-600 font-bold">
                              {showValues ? formatCurrency(provento.valor_total_recebido) : '***'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs sm:text-sm p-4">
                          <Badge
                            variant="outline"
                            className={status === 'Recebido' ? 
                              'bg-green-50 text-green-700 border-green-200' : 
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }
                          >
                            {status}
                          </Badge>
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
      {sortedData.length > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={uniqueData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}
    </Card>
  );
}

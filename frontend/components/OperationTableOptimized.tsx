"use client";
import React, { useState, useMemo, memo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OperationTableProps {
  items: any[];
}

// Funções utilitárias memoizadas
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};

const getOperationTypeLabel = (operation: string) => {
  const types: { [key: string]: string } = {
    'buy': 'Compra',
    'sell': 'Venda',
    'dividend': 'Dividendo',
    'jcp': 'JCP',
    'rendimento': 'Rendimento',
    'bonificacao': 'Bonificação',
    'desdobramento': 'Desdobramento',
    'agrupamento': 'Agrupamento',
    'fechamento': 'Posição Encerrada'
  };
  return types[operation] || operation;
};

// Componente Badge otimizado com classes fixas
const OperationBadge = memo<{ operation: string }>(({ operation }) => {
  const getBadgeClass = (op: string) => {
    switch (op) {
      case 'buy':
        return 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300';
      case 'sell':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-300';
      case 'dividend':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300';
      case 'jcp':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300';
      case 'rendimento':
        return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200 border-cyan-300';
      case 'bonificacao':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300';
      case 'desdobramento':
        return 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-300';
      case 'agrupamento':
        return 'bg-pink-100 text-pink-800 hover:bg-pink-200 border-pink-300';
      case 'fechamento':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <Badge variant="outline" className={getBadgeClass(operation)}>
      {getOperationTypeLabel(operation)}
    </Badge>
  );
});

OperationBadge.displayName = 'OperationBadge';

// Componente de linha da tabela otimizado
const TableRowOptimized = memo<{ 
  item: any; 
  index: number;
}>(({ item, index }) => {
  const valorTotal = useMemo(() => (item.quantity || 0) * (item.price || 0), [item.quantity, item.price]);
  const isProvento = useMemo(() => 
    item.provento || ['dividend', 'jcp', 'rendimento'].includes(item.operation), 
    [item.provento, item.operation]
  );
  const isPosicaoFechada = useMemo(() => item.operation === 'fechamento', [item.operation]);
  const isEventoCorporativo = useMemo(() => 
    ['bonificacao', 'desdobramento', 'agrupamento'].includes(item.operation), 
    [item.operation]
  );

  return (
    <TableRow key={item.id || index} className="hover:bg-gray-50">
      <TableCell className="font-medium">
        {formatDate(item.date)}
      </TableCell>
      
      <TableCell className="font-semibold text-blue-600">
        {item.ticker_acao || item.ticker}
      </TableCell>
      
      <TableCell>
        <OperationBadge operation={item.operation} />
      </TableCell>
      
      <TableCell className="text-right">
        {isEventoCorporativo && item.razao ? (
          <div className="text-center">
            <span className="font-mono text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded border">
              {item.razao}
            </span>
          </div>
        ) : item.quantity > 0 ? (
          (item.quantidade_na_data_ex || item.quantity).toLocaleString('pt-BR')
        ) : '-'}
      </TableCell>
      
      <TableCell className="text-right">
        {item.price > 0 ? (
          formatCurrency(item.valor_unitario_provento || item.price)
        ) : '-'}
      </TableCell>
      
      <TableCell className="text-right font-medium">
        {isProvento && item.valor_total_recebido ? (
          formatCurrency(item.valor_total_recebido)
        ) : valorTotal > 0 ? (
          formatCurrency(valorTotal)
        ) : '-'}
      </TableCell>
      
      <TableCell className="text-right">
        {(isPosicaoFechada || item.operation === 'sell') && item.resultado !== undefined ? (
          <div className="flex items-center justify-end">
            {item.resultado >= 0 ? (
              <span className="h-4 w-4 text-green-600 mr-1">📈</span>
            ) : (
              <span className="h-4 w-4 text-red-600 mr-1">📉</span>
            )}
            <span className={item.resultado >= 0 ? "text-green-600" : "text-red-600"}>
              {formatCurrency(item.resultado)}
            </span>
          </div>
        ) : '-'}
      </TableCell>
    </TableRow>
  );
});

TableRowOptimized.displayName = 'TableRowOptimized';

// Componente principal otimizado
const OperationTableOptimized = memo<OperationTableProps>(({ items }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Obter tipos únicos para o filtro - memoizado
  const uniqueOperationTypes = useMemo(() => {
    const types = [...new Set(items.map(item => item.operation))];
    return types.filter(type => type); // Remove valores vazios
  }, [items]);

  // Filtrar e ordenar os dados - otimizado
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items;

    // Aplicar filtros
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const ticker = item.ticker_acao || item.ticker || '';
        return ticker.toLowerCase().includes(searchLower) ||
               getOperationTypeLabel(item.operation).toLowerCase().includes(searchLower);
      });
    }

    if (filterType !== "all") {
      filtered = filtered.filter(item => item.operation === filterType);
    }

    // Aplicar ordenação
    filtered.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'date':
          valueA = new Date(a.date).getTime();
          valueB = new Date(b.date).getTime();
          break;
        case 'ticker':
          valueA = (a.ticker_acao || a.ticker || '').toLowerCase();
          valueB = (b.ticker_acao || b.ticker || '').toLowerCase();
          break;
        case 'operation':
          valueA = getOperationTypeLabel(a.operation).toLowerCase();
          valueB = getOperationTypeLabel(b.operation).toLowerCase();
          break;
        case 'quantity':
          valueA = a.quantidade_na_data_ex || a.quantity || 0;
          valueB = b.quantidade_na_data_ex || b.quantity || 0;
          break;
        case 'price':
          valueA = a.valor_unitario_provento || a.price || 0;
          valueB = b.valor_unitario_provento || b.price || 0;
          break;
        default:
          valueA = new Date(a.date).getTime();
          valueB = new Date(b.date).getTime();
      }

      if (sortOrder === "asc") {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });

    return filtered;
  }, [items, searchTerm, filterType, sortBy, sortOrder]);

  // Callbacks otimizados
  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortOrder(current => current === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  }, [sortBy]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setFilterType(value);
  }, []);

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {/* Controles de filtro e busca */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
            <Input
              placeholder="Buscar por ticker ou tipo de operação..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
          
          <Select value={filterType} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <span className="h-4 w-4 mr-2">🔽</span>
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {uniqueOperationTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {getOperationTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('date')}>
                  <div className="flex items-center">
                    Data
                    <span className="ml-2 h-4 w-4">
                      {sortBy === 'date' && sortOrder === 'asc' ? '⬆️' : 
                       sortBy === 'date' && sortOrder === 'desc' ? '⬇️' : '↕️'}
                    </span>
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('ticker')}>
                  <div className="flex items-center">
                    Ticker
                    <span className="ml-2 h-4 w-4">
                      {sortBy === 'ticker' && sortOrder === 'asc' ? '⬆️' : 
                       sortBy === 'ticker' && sortOrder === 'desc' ? '⬇️' : '↕️'}
                    </span>
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('operation')}>
                  <div className="flex items-center">
                    Tipo
                    <span className="ml-2 h-4 w-4">
                      {sortBy === 'operation' && sortOrder === 'asc' ? '⬆️' : 
                       sortBy === 'operation' && sortOrder === 'desc' ? '⬇️' : '↕️'}
                    </span>
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('quantity')}>
                  <div className="flex items-center justify-end">
                    Quantidade
                    <span className="ml-2 h-4 w-4">
                      {sortBy === 'quantity' && sortOrder === 'asc' ? '⬆️' : 
                       sortBy === 'quantity' && sortOrder === 'desc' ? '⬇️' : '↕️'}
                    </span>
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('price')}>
                  <div className="flex items-center justify-end">
                    Preço Unitário
                    <span className="ml-2 h-4 w-4">
                      {sortBy === 'price' && sortOrder === 'asc' ? '⬆️' : 
                       sortBy === 'price' && sortOrder === 'desc' ? '⬇️' : '↕️'}
                    </span>
                  </div>
                </TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Nenhuma operação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedItems.map((item, index) => (
                  <TableRowOptimized 
                    key={`${item.id}-${index}`} 
                    item={item} 
                    index={index} 
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Resumo */}
        {filteredAndSortedItems.length > 0 && (
          <div className="mt-4 text-sm text-gray-600 text-center">
            Mostrando {filteredAndSortedItems.length} de {items.length} operações
          </div>
        )}
      </CardContent>
    </Card>
  );
});

OperationTableOptimized.displayName = 'OperationTableOptimized';

export default OperationTableOptimized;
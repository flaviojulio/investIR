"use client";
import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const OperationTable: React.FC<OperationTableProps> = ({ items }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Função para formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para formatar datas
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Função para obter o tipo de operação em português
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

  // Função para obter a variante do badge baseado no tipo de operação
  const getOperationBadgeVariant = (operation: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      'buy': 'default',
      'sell': 'destructive', 
      'dividend': 'secondary',
      'jcp': 'secondary',
      'rendimento': 'secondary',
      'bonificacao': 'outline',
      'desdobramento': 'outline',
      'agrupamento': 'outline',
      'fechamento': 'outline'
    };
    return variants[operation] || 'outline';
  };

  // Função para obter classes CSS customizadas para as cores dos badges
  const getOperationBadgeCustomClass = (operation: string) => {
    const customClasses: { [key: string]: string } = {
      'buy': 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300',
      'sell': 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-300',
      'dividend': 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300',
      'jcp': 'bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300',
      'rendimento': 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200 border-cyan-300',
      'bonificacao': 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-300',
      'desdobramento': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300',
      'agrupamento': 'bg-pink-100 text-pink-800 hover:bg-pink-200 border-pink-300',
      'fechamento': 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300'
    };
    return customClasses[operation] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Filtrar e ordenar os dados
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(item => {
      const matchesSearch = item.ticker?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           getOperationTypeLabel(item.operation).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterType === "all" || item.operation === filterType;
      
      return matchesSearch && matchesFilter;
    });

    // Ordenar
    filtered.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'date':
          valueA = new Date(a.date).getTime();
          valueB = new Date(b.date).getTime();
          break;
        case 'ticker':
          valueA = a.ticker || '';
          valueB = b.ticker || '';
          break;
        case 'operation':
          valueA = getOperationTypeLabel(a.operation);
          valueB = getOperationTypeLabel(b.operation);
          break;
        case 'quantity':
          valueA = a.quantity || 0;
          valueB = b.quantity || 0;
          break;
        case 'price':
          valueA = a.price || 0;
          valueB = b.price || 0;
          break;
        default:
          valueA = a.date;
          valueB = b.date;
      }

      // Ordenar pelo critério escolhido
      let result;
      if (sortOrder === "asc") {
        result = valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        result = valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }

      return result;
    });

    return filtered;
  }, [items, searchTerm, filterType, sortBy, sortOrder]);

  // Obter tipos únicos para o filtro
  const uniqueOperationTypes = useMemo(() => {
    const types = [...new Set(items.map(item => item.operation))];
    return types.filter(type => type); // Remove valores vazios
  }, [items]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterType} onValueChange={setFilterType}>
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
                    <span className="ml-2 h-4 w-4">↕️</span>
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('ticker')}>
                  <div className="flex items-center">
                    Ticker
                    <span className="ml-2 h-4 w-4">↕️</span>
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('operation')}>
                  <div className="flex items-center">
                    Tipo
                    <span className="ml-2 h-4 w-4">↕️</span>
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('quantity')}>
                  <div className="flex items-center justify-end">
                    Quantidade
                    <span className="ml-2 h-4 w-4">↕️</span>
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('price')}>
                  <div className="flex items-center justify-end">
                    Preço Unitário
                    <span className="ml-2 h-4 w-4">↕️</span>
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
                filteredAndSortedItems.map((item, index) => {
                  const valorTotal = (item.quantity || 0) * (item.price || 0);
                  const isProvento = item.provento || ['dividend', 'jcp', 'rendimento'].includes(item.operation);
                  const isPosicaoFechada = item.operation === 'fechamento';
                  
                  return (
                    <TableRow key={item.id || index} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        {formatDate(item.date)}
                      </TableCell>
                      
                      <TableCell className="font-semibold text-blue-600">
                        {item.ticker}
                      </TableCell>
                      
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={getOperationBadgeCustomClass(item.operation)}
                        >
                          {getOperationTypeLabel(item.operation)}
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        {/* Para eventos corporativos, mostrar a proporção */}
                        {['bonificacao', 'desdobramento', 'agrupamento'].includes(item.operation) && item.razao ? (
                          <div className="text-center">
                            <span className="font-mono text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded border">
                              {item.razao}
                            </span>
                          </div>
                        ) : item.quantity > 0 ? (
                          item.quantity.toLocaleString('pt-BR')
                        ) : '-'}
                      </TableCell>
                      
                      <TableCell className="text-right">
                        {item.price > 0 ? (
                          isProvento ? formatCurrency(item.price) : formatCurrency(item.price)
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
                        {isPosicaoFechada && item.resultado !== undefined ? (
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
                        ) : item.operation === 'sell' && item.resultado !== undefined ? (
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
                })
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
};

export default OperationTable;

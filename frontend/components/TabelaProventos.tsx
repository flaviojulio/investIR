"use client"
import React, { useState, useMemo } from 'react';
import { ProventoRecebidoUsuario } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from 'lucide-react';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

interface TabelaProventosProps {
  data: ProventoRecebidoUsuario[];
}

type SortableKeys = 'data_ex' | 'dt_pagamento' | 'ticker_acao' | 'tipo_provento' | 'valor_total_recebido';

export function TabelaProventos({ data }: TabelaProventosProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'dt_pagamento', direction: 'descending' });

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig) return data; // Should not happen with default sortConfig

    // Create a new array to avoid mutating the original data prop
    let sortableItems = [...data];

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
  }, [data, sortConfig]);

  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Nenhum provento para exibir com os filtros atuais.</p>;
  }

  // Configuration for table headers
  // Adiciona coluna de status (Recebido/A Receber)
  const headerConfig: { key?: SortableKeys; label: string; className?: string; isSortable: boolean }[] = [
    { key: 'data_ex', label: 'Data Ex', className: 'hidden md:table-cell', isSortable: true },
    { key: 'dt_pagamento', label: 'Data Pag.', isSortable: true },
    { key: 'ticker_acao', label: 'Ticker', isSortable: true },
    { label: 'Nome Ação', className: 'hidden lg:table-cell', isSortable: false },
    { key: 'tipo_provento', label: 'Tipo', isSortable: true },
    { label: 'Qtd. na Data Ex', className: 'text-right hidden sm:table-cell', isSortable: false },
    { label: 'Valor Unit.', className: 'text-right', isSortable: false },
    { key: 'valor_total_recebido', label: 'Total Recebido', className: 'text-right', isSortable: true },
    { label: 'Status', className: 'text-center', isSortable: false },
  ];

  const now = new Date();
  const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {headerConfig.map((header) => (
              <TableHead key={header.label} className={header.className}>
                {header.isSortable && header.key ? (
                  <Button variant="ghost" onClick={() => requestSort(header.key!)} className="px-1 text-xs sm:text-sm text-left w-full justify-start group">
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
          {uniqueData.map((provento) => {
            // Badge: Recebido se dt_pagamento <= hoje, A Receber se dt_pagamento > hoje ou ausente e data_ex futura
            let status = 'Recebido';
            if (!provento.dt_pagamento || new Date(provento.dt_pagamento) > now) {
              status = 'A Receber';
            }
            return (
              <TableRow key={provento.id}>
                <TableCell className="hidden md:table-cell text-xs sm:text-sm">{formatDate(provento.data_ex)}</TableCell>
                <TableCell className="text-xs sm:text-sm">{formatDate(provento.dt_pagamento)}</TableCell>
                <TableCell className="font-medium text-xs sm:text-sm">{provento.ticker_acao}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs sm:text-sm">{provento.nome_acao || '-'}</TableCell>
                <TableCell className="text-xs sm:text-sm">{provento.tipo_provento}</TableCell>
                <TableCell className="text-right hidden sm:table-cell text-xs sm:text-sm">{formatNumber(provento.quantidade_possuida_na_data_ex)}</TableCell>
                <TableCell className="text-right text-xs sm:text-sm">{formatCurrency(provento.valor_unitario_provento)}</TableCell>
                <TableCell className="text-right font-semibold text-xs sm:text-sm">{formatCurrency(provento.valor_total_recebido)}</TableCell>
                <TableCell className="text-center text-xs sm:text-sm">
                  {status === 'Recebido' ? (
                    <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-700 text-xs">Recebido</span>
                  ) : (
                    <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">A Receber</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        {/* Rodapé com somatórios */}
        <tfoot>
          <TableRow>
            <TableCell colSpan={headerConfig.length} className="p-0" style={{ background: '#f9fafb' }}>
              <div className="flex flex-col md:flex-row w-full text-base md:text-lg font-bold divide-y md:divide-y-0 md:divide-x divide-gray-200">
                <div className="flex-1 flex flex-col items-center py-3 px-2">
                  <span className="text-muted-foreground text-xs md:text-sm mb-1">Recebidos</span>
                  <span className="text-green-700">{formatCurrency(uniqueData.filter(p => {
                    const now = new Date();
                    return p.dt_pagamento && new Date(p.dt_pagamento) <= now;
                  }).reduce((sum, p) => sum + (p.valor_total_recebido || 0), 0))}</span>
                </div>
                <div className="flex-1 flex flex-col items-center py-3 px-2">
                  <span className="text-muted-foreground text-xs md:text-sm mb-1">A Receber</span>
                  <span className="text-blue-700">{formatCurrency(uniqueData.filter(p => {
                    const now = new Date();
                    return !p.dt_pagamento || new Date(p.dt_pagamento) > now;
                  }).reduce((sum, p) => sum + (p.valor_total_recebido || 0), 0))}</span>
                </div>
                <div className="flex-1 flex flex-col items-center py-3 px-2">
                  <span className="text-muted-foreground text-xs md:text-sm mb-1">Total</span>
                  <span>{formatCurrency(uniqueData.reduce((sum, p) => sum + (p.valor_total_recebido || 0), 0))}</span>
                </div>
              </div>
            </TableCell>
          </TableRow>
        </tfoot>
      </Table>
    </div>
  );
}

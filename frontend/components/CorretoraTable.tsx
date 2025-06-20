"use client";

import React from 'react';
import { Corretora } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react"; // Icon for actions

interface CorretoraTableProps {
  corretoras: Corretora[];
  onEdit: (corretora: Corretora) => void;
  onDelete: (id: number) => Promise<void>; // Make async to handle API calls directly if needed
  isLoading?: boolean; // Optional: to show a loading state on the table
  error?: string | null; // Optional: to display an error message
}

const CorretoraTable: React.FC<CorretoraTableProps> = ({ corretoras, onEdit, onDelete, isLoading, error }) => {

  const formatCnpj = (cnpj: string | null | undefined): string => {
    if (!cnpj) return 'N/A';
    // Ensure CNPJ has 14 digits for formatting
    const cleaned = cnpj.replace(/[^\d]/g, '');
    if (cleaned.length === 14) {
      return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return cnpj; // Return original if not a standard 14-digit CNPJ
  };

  if (isLoading) {
    return <p>Carregando corretoras...</p>;
  }

  if (error) {
    return <p className="text-red-500">Erro ao carregar corretoras: {error}</p>;
  }

  if (corretoras.length === 0) {
    return <p>Nenhuma corretora cadastrada.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>CNPJ</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {corretoras.map((corretora) => (
          <TableRow key={corretora.id}>
            <TableCell>{corretora.nome}</TableCell>
            <TableCell>{formatCnpj(corretora.cnpj)}</TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Abrir menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(corretora)}>
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (window.confirm(`Tem certeza que deseja excluir a corretora "${corretora.nome}"?`)) {
                        try {
                          await onDelete(corretora.id);
                        } catch (err: any) {
                          // Parent component should handle and display this error
                          // For now, log to console or make parent handle it via props
                          console.error("Falha ao excluir corretora da tabela:", err.message);
                          alert(`Erro ao excluir: ${err.message}`); // Simple alert, improve in ManageCorretoras
                        }
                      }
                    }}
                    className="text-red-600 hover:text-red-700 focus:text-red-700"
                  >
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default CorretoraTable;

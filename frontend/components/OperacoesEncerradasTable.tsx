"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OperacaoFechada, ResultadoMensal } from "@/lib/types";
import { Button } from '@/components/ui/button';
import { DarfDetailsModal } from './DarfDetailsModal'; // Import the modal

// Helper functions
const formatCurrency = (value: number | null | undefined, placeholder: string = "R$ 0,00") => {
  if (value == null || isNaN(value)) return placeholder;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const formatNumber = (value: number | null | undefined, placeholder: string = "0") => {
  if (value == null || isNaN(value)) return placeholder;
  return new Intl.NumberFormat("pt-BR").format(value);
};

const formatDate = (dateString: string | null | undefined, placeholder: string = "N/A") => {
  if (!dateString) return placeholder;
  try {
    // Attempt to create a valid date object, handling potential ISO string with time
    const date = new Date(dateString.split('T')[0]); // Use only date part if timestamp
    if (isNaN(date.getTime())) return placeholder; // Invalid date
    return date.toLocaleDateString("pt-BR", { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch (e) {
    return placeholder; // Error parsing date
  }
};

interface OperacoesEncerradasTableProps {
  operacoesFechadas: OperacaoFechada[];
  resultadosMensais: ResultadoMensal[]; 
  onUpdateDashboard: () => void; 
}

export function OperacoesEncerradasTable({ operacoesFechadas, resultadosMensais, onUpdateDashboard }: OperacoesEncerradasTableProps) {
  const [isDarfModalOpen, setIsDarfModalOpen] = useState(false);
  const [selectedOpForDarf, setSelectedOpForDarf] = useState<OperacaoFechada | null>(null);
  const [selectedResultadoMensalForDarf, setSelectedResultadoMensalForDarf] = useState<ResultadoMensal | null>(null);
  const [selectedDarfType, setSelectedDarfType] = useState<'swing' | 'daytrade'>('daytrade'); // Default, will be set

  const isPreviousMonthOrEarlier = (dateString: string): boolean => {
    try {
        const operationDate = new Date(dateString.split('T')[0]);
        if (isNaN(operationDate.getTime())) return false;

        const currentDate = new Date();
        
        const opYear = operationDate.getFullYear();
        const opMonth = operationDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        if (opYear < currentYear) return true;
        if (opYear === currentYear && opMonth < currentMonth) return true;
        return false;
    } catch (e) {
        return false; // Error parsing date
    }
  };

  const handleDarfClick = (op: OperacaoFechada) => {
    const mesFechamento = op.data_fechamento.substring(0, 7); // YYYY-MM
    const tipoDarfAtual: 'swing' | 'daytrade' = op.day_trade ? 'daytrade' : 'swing';
    
    const resultadoMensalCorrespondente = resultadosMensais.find(
      rm => rm.mes === mesFechamento
    );

    if (resultadoMensalCorrespondente) {
      setSelectedOpForDarf(op);
      setSelectedResultadoMensalForDarf(resultadoMensalCorrespondente);
      setSelectedDarfType(tipoDarfAtual);
      setIsDarfModalOpen(true);
    } else {
      console.error(`ResultadoMensal não encontrado para o mês ${mesFechamento} da operação.`, op);
      // Consider adding a toast notification here for the user
      // toast({ title: "Erro", description: "Dados mensais de imposto não encontrados para esta operação.", variant: "destructive" });
    }
  };

  if (!operacoesFechadas || operacoesFechadas.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Operações Encerradas</CardTitle>
          <CardDescription>Histórico de suas operações de compra e venda finalizadas.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Nenhuma operação encerrada encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Operações Encerradas</CardTitle>
        <CardDescription>Histórico de suas operações de compra e venda finalizadas.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4"> {/* Added pt-4 for consistency if needed */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ação</TableHead>
              <TableHead>Data Fech.</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Preço Abert.</TableHead>
              <TableHead className="text-right">Preço Fech.</TableHead>
              <TableHead className="text-right">Resultado</TableHead>
              <TableHead>Tipo Trade</TableHead>
              <TableHead>Status IR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operacoesFechadas.map((op, index) => { // Added index for a more robust key if needed
              const isDarfLinkActive = 
                (op.status_ir === "Tributável Swing" || op.status_ir === "Tributável Day Trade") &&
                isPreviousMonthOrEarlier(op.data_fechamento);
              
              // Construct a more unique key
              const rowKey = `${op.ticker}-${op.data_abertura}-${op.data_fechamento}-${op.quantidade}-${index}`;

              return (
                <TableRow key={rowKey}>
                  <TableCell><Badge variant="outline">{op.ticker}</Badge></TableCell>
                  <TableCell>{formatDate(op.data_fechamento)}</TableCell>
                  <TableCell className="text-right">{formatNumber(op.quantidade)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(op.valor_compra)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(op.valor_venda)}</TableCell>
                  <TableCell className={`text-right font-medium ${op.resultado >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(op.resultado)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={op.day_trade ? "destructive" : "secondary"}>
                      {op.day_trade ? "Day Trade" : "Swing Trade"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {op.status_ir?.startsWith("Tributável") ? (
                      isDarfLinkActive ? (
                        <Button variant="link" className="p-0 h-auto text-xs" onClick={() => handleDarfClick(op)}>
                          DARF ({op.status_ir.replace("Tributável ", "")})
                        </Button>
                      ) : (
                        <span className="text-xs">{op.status_ir} (DARF mês corrente/futuro)</span>
                      )
                    ) : (
                      <span className="text-xs">{op.status_ir || "-"}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      
      {selectedOpForDarf && selectedResultadoMensalForDarf && (
        <DarfDetailsModal
          isOpen={isDarfModalOpen}
          onClose={() => {
            setIsDarfModalOpen(false);
            setSelectedOpForDarf(null);
            setSelectedResultadoMensalForDarf(null);
          }}
          operacaoFechada={selectedOpForDarf}
          resultadoMensal={selectedResultadoMensalForDarf}
          tipoDarf={selectedDarfType}
          onUpdateDashboard={onUpdateDashboard}
        />
      )}
    </Card>
  );
}

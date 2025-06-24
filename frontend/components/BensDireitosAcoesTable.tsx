"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatInteger } from "@/lib/utils"; // Assuming formatInteger exists or can be created

// Define the type for the props based on BemDireitoAcaoSchema
interface BemDireitoAcao {
  ticker: string;
  nome_empresa?: string | null;
  cnpj?: string | null;
  quantidade: number;
  preco_medio: number;
  valor_total_data_base: number;
  valor_total_ano_anterior?: number; // Novo campo: valor total em 31/12 do ano anterior
}

interface BensDireitosAcoesTableProps {
  data: BemDireitoAcao[];
  year: number;
}

export function BensDireitosAcoesTable({ data, year }: BensDireitosAcoesTableProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bens e Direitos - Ações em {year}</CardTitle>
          <CardDescription>
            Nenhuma ação encontrada em carteira em 31/12/{year}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Não havia posições em ações para declarar neste ano.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Helper to format CNPJ
  const formatCNPJ = (cnpj: string | null | undefined): string => {
    if (!cnpj) return "N/A";
    // Remove non-digits
    const digits = cnpj.replace(/\D/g, "");
    // Apply mask XX.XXX.XXX/XXXX-XX
    if (digits.length === 14) {
      return `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8, 12)}-${digits.substring(12, 14)}`;
    }
    return cnpj; // Return original if not a standard CNPJ length
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Bens e Direitos - Ações em {year}</CardTitle>
        <CardDescription>
          Relação de ações em carteira em 31/12/{year}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption>
            Detalhes das ações para declaração de Bens e Direitos referente ao ano de {year}.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Preço Médio (R$)</TableHead>
              <TableHead className="text-right">Valor Total em 31/12/{year} (R$)</TableHead>
              <TableHead className="text-right">Valor Total em 31/12/{year - 1} (R$)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.ticker}>
                <TableCell className="font-medium">{item.ticker}</TableCell>
                <TableCell>{item.nome_empresa || "N/A"}</TableCell>
                <TableCell>{formatCNPJ(item.cnpj)}</TableCell>
                <TableCell className="text-right">
                  {formatInteger(item.quantidade)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.preco_medio)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.valor_total_data_base)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.valor_total_ano_anterior ?? 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

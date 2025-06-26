"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BemDireitoAcaoCard } from "@/components/BemDireitoAcaoCard";

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
  onInformarRendimentoIsento?: (cnpj: string) => void;
  onInformarRendimentoExclusivo?: (cnpj: string) => void;
}

export function BensDireitosAcoesTable({ data, year, onInformarRendimentoIsento, onInformarRendimentoExclusivo }: BensDireitosAcoesTableProps) {
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bens e Direitos - Ações em {year}</CardTitle>
          <CardDescription>
            Relação de ações em carteira em 31/12/{year}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((item) => (
              <BemDireitoAcaoCard
                key={item.ticker}
                {...item}
                year={year}
                compact
                renderInformarRendimentoIsentoButton={() => (
                  <button
                    className="px-2 py-0.5 border border-gray-300 rounded text-[10px] hover:bg-gray-50"
                    onClick={() => onInformarRendimentoIsento?.(item.cnpj ?? "")}
                    type="button"
                  >
                    Informar Rend. Isento
                  </button>
                )}
                renderInformarRendimentoExclusivoButton={() => (
                  <button
                    className="px-2 py-0.5 border border-gray-300 rounded text-[10px] hover:bg-gray-50"
                    onClick={() => onInformarRendimentoExclusivo?.(item.cnpj ?? "")}
                    type="button"
                  >
                    Informar Rend. Exclusivo
                  </button>
                )}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

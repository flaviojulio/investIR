import React from "react";
import { CopyableField } from "@/components/CopyableField";

interface RendimentoIsentoCardProps {
  ticker: string;
  nome_empresa?: string | null;
  nome_fonte_pagadora?: string | null; // Adicionado para compatibilidade
  cnpj?: string | null;
  valor_total_recebido_no_ano?: number;
  valor?: number; // Adicionado para compatibilidade
}

export function RendimentoIsentoCard({
  ticker,
  nome_empresa,
  nome_fonte_pagadora,
  cnpj,
  valor_total_recebido_no_ano,
  valor,
}: RendimentoIsentoCardProps) {
  // Prioriza nome_empresa, depois nome_fonte_pagadora
  const nomePagadora = nome_empresa || nome_fonte_pagadora || "N/A";
  // Prioriza valor_total_recebido_no_ano, depois valor
  const valorFinal =
    valor_total_recebido_no_ano !== undefined
      ? valor_total_recebido_no_ano
      : valor !== undefined
      ? valor
      : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400 to-blue-300 p-3 flex items-center">
        <div className="w-6 h-6 bg-green-600 rounded mr-2 flex items-center justify-center">
          <span className="text-white font-bold text-xs">✓</span>
        </div>
        <h1 className="text-white text-lg font-semibold">Rendimento Isento e Não Tributável</h1>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-gray-600 font-medium mb-2">Tipo de Rendimento</label>
          <div className="bg-gray-500 text-white p-2 rounded text-sm font-medium mb-2">
            09 - Lucros e dividendos recebidos
          </div>
          <div className="border border-gray-300 rounded p-3 bg-gray-50">
            <div className="text-blue-600 font-semibold mb-3">09. Lucros e dividendos recebidos</div>
            <div className="space-y-3">
              <CopyableField value="Titular" input>
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-sm">Tipo de Beneficiário</label>
                  <input
                    type="text"
                    value="Titular"
                    className="w-full p-2 text-sm border border-gray-300 rounded bg-gray-100"
                    readOnly
                  />
                </div>
              </CopyableField>
              <CopyableField value="CPF do Titular" input>
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-sm">Beneficiário</label>
                  <input
                    type="text"
                    value="CPF do Titular"
                    className="w-full p-2 text-sm border border-gray-300 rounded bg-white"
                    readOnly
                  />
                </div>
              </CopyableField>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <CopyableField value={cnpj || "N/A"} input>
                  <div>
                    <label className="block text-gray-600 font-medium mb-1 text-sm">CNPJ da Fonte Pagadora</label>
                    <input
                      type="text"
                      value={cnpj || "N/A"}
                      className="w-full p-2 text-sm border border-gray-300 rounded bg-white"
                      readOnly
                    />
                  </div>
                </CopyableField>
                <CopyableField value={nomePagadora} input>
                  <div>
                    <label className="block text-gray-600 font-medium mb-1 text-sm">Nome da Fonte Pagadora</label>
                    <input
                      type="text"
                      value={nomePagadora}
                      className="w-full p-2 text-sm border border-gray-300 rounded bg-gray-100"
                      readOnly
                    />
                  </div>
                </CopyableField>
              </div>
              <CopyableField value={valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} input>
                <div>
                  <label className="block text-gray-600 font-medium mb-1 text-sm">Valor</label>
                  <div className="flex">
                    <input
                      type="text"
                      value={valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      className="w-32 p-2 text-sm border border-gray-300 rounded bg-white text-right"
                      readOnly
                    />
                  </div>
                </div>
              </CopyableField>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

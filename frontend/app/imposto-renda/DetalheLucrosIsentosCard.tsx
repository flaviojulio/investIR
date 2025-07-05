import React, { useState } from "react";
import { CopyableField } from "@/components/CopyableField";

interface LucrosIsentosCardProps {
  valorTotal: number;
  onOpenModal: () => void;
}

export default function DetalheLucrosIsentosCard({ valorTotal, onOpenModal }: LucrosIsentosCardProps) {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden relative" style={{ minHeight: 320 }}>
        {/* Barra superior igual aos outros cards */}
        <div className="bg-gradient-to-r from-blue-400 to-blue-300 p-3 flex items-center">
          <div className="w-6 h-6 bg-green-600 rounded mr-2 flex items-center justify-center">
            <span className="text-white font-bold text-xs">✓</span>
          </div>
          <h1 className="text-white text-lg font-semibold">Rendimento Isento e Não Tributável</h1>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-gray-600 font-medium mb-2 text-sm">Tipo de Rendimento</label>
            <label className="w-full p-2 text-sm border border-gray-300 rounded bg-gray-100 block">
              20 - Ganhos líquidos em operações no mercado à vista de ações negociadas em bolsas de valores nas alienações realizadas até R$ 20.000,00 em cada mês, para o conjunto de ações
            </label>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <div className="text-blue-800 font-semibold text-sm mb-1">
              20. Ganhos líquidos em operações no mercado à vista de ações negociadas em bolsas de valores nas alienações
            </div>
            <div className="text-blue-700 text-sm">
              realizadas até R$ 20.000,00 em cada mês, para o conjunto de ações
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-gray-600 font-medium mb-1 text-sm">Tipo de Beneficiário</label>
              <label className="w-full max-w-xs p-2 text-sm border border-gray-300 rounded bg-gray-100 block">Titular</label>
            </div>
            <CopyableField value="CPF do Titular" input>
              <div>
                <label className="block text-gray-600 font-medium mb-1 text-sm">Beneficiário</label>
                <input
                  type="text"
                  value="CPF do Titular"
                  className="w-full p-2 text-sm border border-gray-300 rounded bg-gray-100"
                  readOnly
                />
              </div>
            </CopyableField>
            <CopyableField value={valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} input>
              <div>
                <label className="block text-gray-600 font-medium mb-1 text-sm">Valor Total Isento no Ano</label>
                <input
                  type="text"
                  value={valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  className="w-32 p-2 text-sm border border-gray-300 rounded bg-white text-right"
                  readOnly
                />
              </div>
            </CopyableField>
          </div>
        </div>
        <button
          className="absolute bottom-4 right-4"
          title="Ver detalhes do cálculo"
          onClick={onOpenModal}
        >
          {/* Ícone: lupa sobre folha, colorido */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="38" height="38">
            <g>
              <rect x="10" y="6" width="22" height="32" rx="3" fill="#e3e8f7" stroke="#3b82f6" strokeWidth="2" />
              <rect x="14" y="10" width="14" height="2" rx="1" fill="#60a5fa" />
              <rect x="14" y="16" width="14" height="2" rx="1" fill="#60a5fa" />
              <rect x="14" y="22" width="10" height="2" rx="1" fill="#60a5fa" />
              <circle cx="34" cy="34" r="6" fill="#fbbf24" stroke="#f59e42" strokeWidth="2" />
              <rect x="38.5" y="38.5" width="6" height="2" rx="1" fill="#3b82f6" transform="rotate(45 41.5 39.5)" />
              <circle cx="34" cy="34" r="3" fill="#fff" />
            </g>
          </svg>
        </button>
      </div>
    </div>
  );
}

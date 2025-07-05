import React from "react";
import { CopyableField } from "@/components/CopyableField";

interface JCPTributadoCardProps {
  ticker: string;
  empresa?: string | null;
  cnpj?: string | null;
  valor: number;
}

export default function JCPTributadoCard({ ticker, empresa, cnpj, valor }: JCPTributadoCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden relative">
      <div className="bg-gradient-to-r from-blue-400 to-blue-300 p-3 flex items-center">
        <div className="w-6 h-6 bg-green-600 rounded mr-2 flex items-center justify-center">
          <span className="text-white font-bold text-xs">✓</span>
        </div>
        <h1 className="text-white text-lg font-semibold">Rendimento Sujeito à Tributação Exclusiva</h1>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-gray-600 font-medium mb-2 text-sm">Tipo de Rendimento</label>
          <label className="w-full p-2 text-sm border border-gray-300 rounded bg-gray-100 block">10 - Juros sobre capital próprio</label>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="text-blue-800 font-semibold text-sm mb-1">
            10. Juros sobre capital próprio
          </div>
          <div className="text-blue-700 text-sm">
            Recebidos de pessoa jurídica como remuneração do capital investido.
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-gray-600 font-medium mb-1 text-sm">Tipo de Beneficiário</label>
            <label className="w-full max-w-xs p-2 text-sm border border-gray-300 rounded bg-gray-100 block">Titular</label>
          </div>
          <CopyableField value={"CPF do Titular"} input>
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
            <CopyableField value={empresa || "N/A"} input>
              <div>
                <label className="block text-gray-600 font-medium mb-1 text-sm">Nome da Fonte Pagadora</label>
                <input
                  type="text"
                  value={empresa || "N/A"}
                  className="w-full p-2 text-sm border border-gray-300 rounded bg-gray-100"
                  readOnly
                />
              </div>
            </CopyableField>
          </div>
          <CopyableField value={valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} input copiedTop={false} className="inline-block w-32">
            <div>
              <label className="block text-gray-600 font-medium mb-1 text-sm">Valor</label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  className="w-32 p-2 text-sm border border-gray-300 rounded bg-white text-right"
                  readOnly
                />
              </div>
            </div>
          </CopyableField>
        </div>
      </div>
    </div>
  );
}

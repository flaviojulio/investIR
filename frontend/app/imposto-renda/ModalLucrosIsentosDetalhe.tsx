import React from "react";

interface LucrosIsentosPorMes {
  mes: string;
  valor: number;
}

interface ModalLucrosIsentosDetalheProps {
  open: boolean;
  onClose: () => void;
  lucrosIsentosPorMes: LucrosIsentosPorMes[];
  ano?: number;
  valorTotal?: number;
}

export default function ModalLucrosIsentosDetalhe({ open, onClose, lucrosIsentosPorMes, ano, valorTotal }: ModalLucrosIsentosDetalheProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg relative">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
          onClick={onClose}
          title="Fechar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold mb-4">Detalhe dos Lucros Isentos por Mês</h2>
        <table className="min-w-full bg-white border border-gray-200 rounded mb-2">
          <thead>
            <tr>
              <th className="px-4 py-2 border-b text-left align-middle">Mês</th>
              <th className="px-4 py-2 border-b text-right align-middle">Lucro Isento</th>
            </tr>
          </thead>
          <tbody>
            {lucrosIsentosPorMes.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center py-4 text-gray-500">Nenhum lucro isento encontrado para o ano selecionado.</td>
              </tr>
            ) : (
              lucrosIsentosPorMes.map(({ mes, valor }, idx) => (
                <tr key={mes} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-4 py-2 border-b text-left">
                    {mes.length === 7 ? mes.split("-").reverse().join("/") : mes}
                  </td>
                  <td className="px-4 py-2 border-b text-right">
                    {`R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-2">Somente lucros de vendas até R$20.000 no mês (isentos de IR) são considerados.</p>
        <div className="mt-6 flex items-center justify-end">
          <span className="font-medium text-gray-700 mr-2">Lucro Total Isento em {ano || ""}:</span>
          <span className="font-bold text-blue-700 text-lg">R$ {(valorTotal ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}

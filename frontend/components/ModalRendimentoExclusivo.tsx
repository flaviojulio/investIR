import React from "react";
import JCPTributadoCard from "../app/imposto-renda/JCPTributadoCard";

interface JCPTributado {
  ticker: string;
  empresa?: string | null;
  cnpj?: string | null;
  valor_total_jcp_no_ano?: number;
  valor_total_recebido_no_ano?: number;
  valor_ir_descontado?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  rendimento: JCPTributado | null;
}

export default function ModalRendimentoExclusivo({ open, onClose, rendimento }: Props) {
  if (!open || !rendimento) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xl relative">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
          onClick={onClose}
          title="Fechar"
        >
          &times;
        </button>
        <JCPTributadoCard
          ticker={rendimento.ticker}
          empresa={rendimento.empresa}
          cnpj={rendimento.cnpj}
          valor={rendimento.valor_total_jcp_no_ano ?? rendimento.valor_total_recebido_no_ano ?? 0}
        />
      </div>
    </div>
  );
}

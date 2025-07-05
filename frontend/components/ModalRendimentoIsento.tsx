import React from "react";
import { RendimentoIsentoCard } from "../app/imposto-renda/RendimentoIsentoCard";

interface RendimentoIsento {
  ticker?: string;
  nome_empresa?: string;
  empresa?: string;
  cnpj: string;
  valor_total_recebido_no_ano?: number;
  [key: string]: any;
}

interface Props {
  open: boolean;
  onClose: () => void;
  rendimento: RendimentoIsento | null;
}

export default function ModalRendimentoIsento({ open, onClose, rendimento }: Props) {
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
        <RendimentoIsentoCard
          ticker={rendimento.ticker}
          nome_empresa={rendimento.nome_empresa || rendimento.empresa}
          cnpj={rendimento.cnpj}
          valor_total_recebido_no_ano={rendimento.valor_total_recebido_no_ano}
          {...rendimento}
        />
      </div>
    </div>
  );
}

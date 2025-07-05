import React, { useState } from "react";
import { formatCurrency, formatInteger } from "@/lib/utils";
import { ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Modal from "@/components/Modal"; // Importe seu componente de modal (ajuste o path se necessário)
import { RendimentoIsentoCard } from "@/app/imposto-renda/RendimentoIsentoCard"; // Ajuste o path/nome conforme seu projeto
import { useProventosPorAcaoAno } from "@/hooks/useProventosPorAcaoAno";

interface BemDireitoAcaoCardProps {
  ticker: string;
  nome_empresa?: string | null;
  cnpj?: string | null;
  quantidade: number;
  preco_medio: number;
  valor_total_data_base: number;
  valor_total_ano_anterior?: number;
  year: number;
  compact?: boolean;
  renderInformarRendimentoIsentoButton?: () => React.ReactNode;
  renderInformarRendimentoExclusivoButton?: () => React.ReactNode;
}

function CopyableField({
  value,
  children,
  className = "",
  input = false,
  copiedTop = false, // NOVO: permite posicionar o "Copiado!" acima
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  input?: boolean;
  copiedTop?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div
      className={`relative group ${input ? "w-full" : ""} ${className}`}
      tabIndex={0}
      role="button"
      title="Clique para copiar"
      onClick={handleCopy}
      style={{ cursor: "pointer" }}
    >
      {copied && (
        <span
          className={`absolute ${
            copiedTop ? "-top-6 left-1/2 -translate-x-1/2" : "top-1 right-2"
          } flex items-center gap-1 text-green-600 text-xs animate-fade-in z-10`}
        >
          <ClipboardCheck size={16} /> Copiado!
        </span>
      )}
      {children}
    </div>
  );
}

export function BemDireitoAcaoCard({
  ticker,
  nome_empresa,
  cnpj,
  quantidade,
  preco_medio,
  valor_total_data_base,
  valor_total_ano_anterior,
  year,
  compact = false,
  renderInformarRendimentoIsentoButton,
  renderInformarRendimentoExclusivoButton,
}: BemDireitoAcaoCardProps) {
  // Campos fixos
  const grupo = "03 - Participações Societárias";
  const codigo = "01 - Ações (inclusive as listadas em bolsa)";
  const bemTitular = "Titular";
  const localizacao = "105 - Brasil";
  const negociadoBolsa = "Sim";
  const codigoNegociacao = ticker;
  const situacaoAnoAnterior = (valor_total_ano_anterior ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const situacaoAnoAtual = valor_total_data_base.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const discriminacao = `${ticker} - ${formatInteger(quantidade)} AÇÕES AO PREÇO MÉDIO DE ${formatCurrency(preco_medio)}`;

  const [showModal, setShowModal] = useState(false);

  // Busca o rendimento isento já carregado na página (igual ao card da aba)
  // O array de rendimentos isentos está disponível no window.__RENDITIONS_ISENTOS__
  // ou pode ser passado via prop/context. Aqui, vamos buscar do window para não alterar a estrutura geral.
  let rendimentoIsento = null;
  if (typeof window !== "undefined" && Array.isArray(window.__RENDITIONS_ISENTOS__)) {
    rendimentoIsento = window.__RENDITIONS_ISENTOS__.find((item) => item.ticker === ticker);
  }

  return (
    <>
      <div className={`bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden ${compact ? 'mb-2 p-2 text-xs' : 'mb-6'}`} style={compact ? { minWidth: 0 } : {}}>
        <div className={`bg-gradient-to-r from-blue-400 to-blue-300 ${compact ? 'p-2' : 'p-3'} flex items-center`}>
          <div className={`w-6 h-6 bg-green-500 rounded mr-2 flex items-center justify-center ${compact ? 'w-5 h-5 mr-1' : ''}`}>
            <span className={`text-white font-bold ${compact ? 'text-[10px]' : 'text-xs'}`}>B</span>
          </div>
          <h1 className={`text-white font-semibold ${compact ? 'text-base' : 'text-lg'}`}>Detalhe Bem e Direito</h1>
        </div>
        <div className={`${compact ? 'p-2 space-y-2' : 'p-4 space-y-4'}`}>
          <div>
            <h2 className={`text-blue-600 font-semibold mb-2 ${compact ? 'text-xs' : ''}`}>Dados do Bem</h2>
            <div className={`${compact ? 'space-y-1' : 'space-y-2'}`}>
              <div>
                <label className="block text-gray-600 font-medium mb-1">Grupo</label>
                <input type="text" value={grupo} className={`w-full p-1 border border-gray-300 rounded bg-gray-50 ${compact ? 'text-xs' : 'text-sm'}`} readOnly />
              </div>
              <div>
                <label className="block text-gray-600 font-medium mb-1">Código</label>
                <input type="text" value={codigo} className={`w-full p-1 border border-gray-300 rounded bg-gray-50 ${compact ? 'text-xs' : 'text-sm'}`} readOnly />
              </div>
              <div>
                <label className="block text-gray-600 font-medium mb-1">Bem ou direito pertencente ao</label>
                <div className="flex items-center">
                  <input type="radio" id="titular" checked className="mr-2" readOnly />
                  <label htmlFor="titular" className={`${compact ? 'text-xs' : 'text-sm'}`}>{bemTitular}</label>
                </div>
              </div>
              <div>
                <label className="block text-gray-600 font-medium mb-1">Localização (País)</label>
                <input type="text" value={localizacao} className={`w-full p-1 border border-gray-300 rounded bg-gray-50 ${compact ? 'text-xs' : 'text-sm'}`} readOnly />
              </div>
              {/* CNPJ copyable */}
              <div>
                <label className="block text-gray-600 font-medium mb-1">CNPJ</label>
                <CopyableField value={cnpj || "N/A"} input>
                  <input
                    type="text"
                    value={cnpj || "N/A"}
                    className={`w-full p-1 border border-gray-300 rounded bg-white ${compact ? 'text-xs' : 'text-sm'}`}
                    readOnly
                  />
                </CopyableField>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <label className="block text-gray-600 font-medium mb-1">Negociados em Bolsa?</label>
                  <div className="flex items-center">
                    <input type="radio" id="sim" checked className="mr-2" readOnly />
                    <label htmlFor="sim" className={`${compact ? 'text-xs' : 'text-sm'}`}>{negociadoBolsa}</label>
                  </div>
                </div>
                {/* Código de Negociação copyable */}
                <div className="flex-1">
                  <label className="block text-gray-600 font-medium mb-1">Código de Negociação</label>
                  <CopyableField value={codigoNegociacao} input>
                    <input
                      type="text"
                      value={codigoNegociacao}
                      className={`w-full p-1 border border-gray-300 rounded bg-gray-50 ${compact ? 'text-xs' : 'text-sm'}`}
                      readOnly
                    />
                  </CopyableField>
                </div>
              </div>
              {/* Discriminação copyable */}
              <div className="relative">
                <label className="block text-gray-600 font-medium mb-1">Discriminação</label>
                <CopyableField value={discriminacao}>
                  <div
                    className={`w-full border border-gray-300 rounded bg-gray-100 ${compact ? 'h-10 p-1 text-xs' : 'h-16 p-2 text-sm'} resize-none cursor-pointer relative transition hover:ring-2 hover:ring-blue-300`}
                  >
                    {discriminacao}
                  </div>
                </CopyableField>
              </div>
            </div>
          </div>
          {/* Situação copyable */}
          <div className="border border-gray-300 rounded">
            <div className={`grid grid-cols-4 bg-gray-50 ${compact ? 'text-[10px]' : 'text-xs'}`}>
              <div className="p-1 text-center font-medium">
                Situação em 31/12/{year - 1} (R$)
              </div>
              <div className="p-1 text-center font-medium">
                Situação em 31/12/{year} (R$)
              </div>
              <div className="p-1 text-center"></div>
              <div className="p-1 text-center"></div>
            </div>
            <div className="grid grid-cols-4">
              <div className="p-1 text-center font-semibold flex items-center justify-center">
                <CopyableField value={situacaoAnoAnterior} input copiedTop>
                  <input
                    type="text"
                    value={situacaoAnoAnterior}
                    readOnly
                    className="w-full p-1 border border-gray-300 rounded bg-gray-50 text-center"
                  />
                </CopyableField>
              </div>
              <div className="p-1 text-center font-semibold flex items-center justify-center">
                <CopyableField value={situacaoAnoAtual} input copiedTop>
                  <input
                    type="text"
                    value={situacaoAnoAtual}
                    readOnly
                    className="w-full p-1 border border-gray-300 rounded bg-gray-50 text-center"
                  />
                </CopyableField>
              </div>
              <div className="p-1 text-center flex items-center justify-center">
                <div className="relative group">
                  <button
                    className="px-1 py-0.5 border border-gray-300 rounded text-[10px] bg-white opacity-60 group-hover:opacity-100 group-hover:bg-blue-50 transition cursor-pointer"
                    disabled
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    Repetir
                  </button>
                  <div className="absolute z-10 left-1/2 -translate-x-1/2 mt-2 w-56 bg-gray-800 text-white text-xs rounded shadow-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition pointer-events-none select-none">
                    Este botão é meramente decorativo para deixar a página o mais fiel possível ao programa da Receita Federal
                  </div>
                </div>
              </div>
              <div className="p-1 text-center flex items-center justify-center">
                <div className="text-[10px] text-gray-600">
                  Repete em 31/12/{year} o valor<br />em reais de 31/12/{year - 1}
                </div>
              </div>
            </div>
          </div>
          <div>
            <h3 className={`text-blue-600 font-semibold mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>Rendimentos Associados</h3>
            <div className="flex gap-2">
              {renderInformarRendimentoIsentoButton && renderInformarRendimentoIsentoButton()}
              {renderInformarRendimentoExclusivoButton && renderInformarRendimentoExclusivoButton()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

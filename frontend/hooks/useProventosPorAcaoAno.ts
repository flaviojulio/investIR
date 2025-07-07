import useSWR from "swr";
import { api } from "@/lib/api";
import { ResumoProventoPorAcaoAPI } from "@/lib/types";

export function useProventosPorAcaoAno(ticker: string, ano: number) {
  // Busca o resumo de proventos por ação para o usuário logado
  const { data, error, isLoading } = useSWR<ResumoProventoPorAcaoAPI[]>(
    ticker && ano ? `/usuario/proventos/resumo_por_acao/${ano}` : null,
    async (url: string) => {
      // Busca todos os proventos por ação do usuário para o ano
      const response = await api.get<ResumoProventoPorAcaoAPI[]>("/usuario/proventos/resumo_por_acao/", { params: { ano } });
      return response.data;
    }
  );

  // Busca o valor total recebido para o ticker informado
  let valorTotalRecebido = 0;
  if (data && ticker) {
    const acao = data.find((a) => a.ticker_acao === ticker);
    valorTotalRecebido = acao?.total_recebido_geral_acao || 0;
  }

  return {
    valorTotalRecebido,
    isLoading,
    error,
  };
}

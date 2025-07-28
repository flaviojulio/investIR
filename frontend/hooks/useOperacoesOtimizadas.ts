import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface OperacaoOtimizada {
  // Dados base da operação
  id: number;
  ticker: string;
  data_fechamento: string;
  data_abertura: string;
  quantidade: number;
  resultado: number;
  day_trade: boolean;
  status_ir: string;
  valor_compra: number;
  valor_venda: number;
  preco_medio_compra: number;
  preco_medio_venda: number;
  
  // Dados pré-calculados (novos)
  prejuizo_acumulado_ate: number;
  detalhes_compensacao: {
    valor_compensado: number;
    lucro_tributavel: number;
    tem_compensacao: boolean;
    eh_compensacao_parcial: boolean;
  };
  deve_gerar_darf: boolean;
  estatisticas_mes: {
    prejuizo_acumulado_swing: number;
    prejuizo_acumulado_day: number;
    ir_devido_swing: number;
    ir_devido_day: number;
  };
}

interface UseOperacoesOtimizadasResult {
  operacoes: OperacaoOtimizada[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOperacoesOtimizadas(): UseOperacoesOtimizadasResult {
  const [operacoes, setOperacoes] = useState<OperacaoOtimizada[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOperacoes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🚀 [HOOK] Buscando operações otimizadas...');
      
      const response = await api.get('/operacoes/fechadas/otimizado');
      const data: OperacaoOtimizada[] = response.data;
      
      console.log('🚀 [HOOK] Operações otimizadas recebidas:', data.length);
      
      setOperacoes(data);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Erro desconhecido';
      console.error('🚀 [HOOK] Erro ao buscar operações otimizadas:', errorMessage);
      setError(errorMessage);
      
      // Fallback: tentar API original se a otimizada falhar
      try {
        console.log('🔄 [HOOK] Tentando fallback para API original...');
        const fallbackResponse = await api.get('/operacoes/fechadas');
        const fallbackData = fallbackResponse.data;
        
        console.log('🔄 [HOOK] Fallback bem-sucedido:', fallbackData.length);
        
        // Transformar dados da API original para formato otimizado (dados básicos)
        const operacoesFallback: OperacaoOtimizada[] = fallbackData.map((op: any) => ({
          ...op,
          prejuizo_acumulado_ate: 0, // Será calculado no frontend se necessário
          detalhes_compensacao: {
            valor_compensado: 0,
            lucro_tributavel: Math.max(0, op.resultado || 0),
            tem_compensacao: false,
            eh_compensacao_parcial: false
          },
          deve_gerar_darf: op.deve_gerar_darf || false,
          estatisticas_mes: {
            prejuizo_acumulado_swing: 0,
            prejuizo_acumulado_day: 0,
            ir_devido_swing: 0,
            ir_devido_day: 0
          }
        }));
        
        setOperacoes(operacoesFallback);
        setError(null); // Limpar erro se fallback funcionou
      } catch (fallbackErr) {
        console.error('🔄 [HOOK] Fallback também falhou:', fallbackErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => fetchOperacoes(), [fetchOperacoes]);

  useEffect(() => {
    fetchOperacoes();
  }, [fetchOperacoes]);

  return {
    operacoes,
    isLoading,
    error,
    refetch,
  };
}

// Hook para operações com status corrigido (compatibilidade)
export function useOperacoesComStatusCorrigidoOtimizado(
  operacoesFechadas: any[],
  resultadosMensais: any[]
): OperacaoOtimizada[] {
  const { operacoes: operacoesOtimizadas } = useOperacoesOtimizadas();
  
  // Se temos operações otimizadas, usar elas
  if (operacoesOtimizadas.length > 0) {
    return operacoesOtimizadas;
  }
  
  // Fallback para dados originais
  return operacoesFechadas.map((op: any) => ({
    ...op,
    prejuizo_acumulado_ate: 0,
    detalhes_compensacao: {
      valor_compensado: 0,
      lucro_tributavel: Math.max(0, op.resultado || 0),
      tem_compensacao: false,
      eh_compensacao_parcial: false
    },
    deve_gerar_darf: op.deve_gerar_darf || false,
    estatisticas_mes: {
      prejuizo_acumulado_swing: 0,
      prejuizo_acumulado_day: 0,
      ir_devido_swing: 0,
      ir_devido_day: 0
    }
  }));
}
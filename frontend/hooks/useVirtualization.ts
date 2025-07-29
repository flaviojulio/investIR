import { useMemo } from 'react';

interface UseVirtualizationProps {
  itemCount: number;
  threshold?: number;
}

interface UseVirtualizationReturn {
  shouldVirtualize: boolean;
  recommendedHeight: number;
  itemsPerPage: number;
}

/**
 * Hook para determinar se deve usar virtualização baseado no volume de dados
 * e calcular configurações otimizadas
 */
export function useVirtualization({ 
  itemCount, 
  threshold = 100 
}: UseVirtualizationProps): UseVirtualizationReturn {
  
  return useMemo(() => {
    const shouldVirtualize = itemCount > threshold;
    
    // Calcular altura recomendada baseada no número de itens
    let recommendedHeight: number;
    if (itemCount <= 50) {
      recommendedHeight = 400; // Altura pequena para poucos itens
    } else if (itemCount <= 200) {
      recommendedHeight = 500; // Altura média
    } else if (itemCount <= 500) {
      recommendedHeight = 600; // Altura grande
    } else {
      recommendedHeight = 700; // Altura máxima para muitos itens
    }
    
    // Calcular itens por página para paginação tradicional
    const itemsPerPage = itemCount <= 50 ? itemCount : Math.min(50, Math.ceil(itemCount / 10));
    
    return {
      shouldVirtualize,
      recommendedHeight,
      itemsPerPage
    };
  }, [itemCount, threshold]);
}

/**
 * Hook especializado para performance de componentes de extrato
 */
export function useExtratoPerformance(items: any[]) {
  return useMemo(() => {
    const itemCount = items.length;
    const shouldVirtualize = itemCount > 100;
    
    // Análise de complexidade dos dados
    const hasComplexData = items.some(item => 
      item.operacoes && item.operacoes.length > 5 || // Operações com muitos detalhes
      item.valor_total_recebido || // Proventos com cálculos
      item.resultado !== undefined // Operações com resultados
    );
    
    // Ajustar threshold baseado na complexidade
    const adjustedThreshold = hasComplexData ? 50 : 100;
    const finalShouldVirtualize = itemCount > adjustedThreshold;
    
    // Altura otimizada baseada no tipo de dados
    let optimalHeight: number;
    if (itemCount <= 30) {
      optimalHeight = 350;
    } else if (itemCount <= 100) {
      optimalHeight = hasComplexData ? 550 : 450;
    } else if (itemCount <= 300) {
      optimalHeight = hasComplexData ? 650 : 550;
    } else {
      optimalHeight = hasComplexData ? 750 : 650;
    }
    
    return {
      shouldVirtualize: finalShouldVirtualize,
      recommendedHeight: optimalHeight,
      itemCount,
      hasComplexData,
      threshold: adjustedThreshold,
      performanceLevel: itemCount <= 50 ? 'low' : itemCount <= 200 ? 'medium' : 'high'
    };
  }, [items]);
}
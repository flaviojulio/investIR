// /lib/fiscal-utils.ts

import { useMemo } from "react";
import type { OperacaoFechada, ResultadoMensal } from "@/lib/types";

// ✅ FUNÇÃO HELPER: Normalizar campo day_trade
const isDayTradeNormalized = (op: OperacaoFechada): boolean => {
  // Aceita: true, 1, "1", "true"
  // Rejeita: false, 0, "0", "false", null, undefined
  if (typeof op.day_trade === "boolean") {
    return op.day_trade;
  }
  if (typeof op.day_trade === "number") {
    return op.day_trade === 1;
  }
  if (typeof op.day_trade === "string") {
    return op.day_trade === "1" || op.day_trade.toLowerCase() === "true";
  }
  return false;
};

export interface CompensacaoInfo {
  temCompensacao: boolean;
  ehCompensacaoTotal: boolean;
  ehCompensacaoParcial: boolean;
  valorCompensado: number;
  lucroTributavel: number;
}

export interface DetalhesCompensacao {
  lucroOperacao: number;
  prejuizoAnteriorDisponivel: number;
  valorCompensado: number;
  lucroTributavel: number;
  prejuizoRestante: number;
  operacoesAnteriores: OperacaoFechada[];
  historicoPrejuizos: Array<{
    data: string;
    ticker: string;
    valor: number;
    usado: boolean;
    tipo: "day_trade" | "swing_trade";
  }>;
}

export interface PrejuizoAcumuladoInfo {
  prejuizoAnterior: number;
  prejuizoAteOperacao: number;
  operacoesAnteriores: OperacaoFechada[];
}

/**
 * Calcula informações básicas de compensação para uma operação
 */
export function getCompensacaoInfo(
  op: OperacaoFechada,
  operacoesFechadas: OperacaoFechada[]
): CompensacaoInfo {
  // Só verifica compensação para operações com lucro
  if (!op || op.resultado <= 0) {
    return {
      temCompensacao: false,
      ehCompensacaoTotal: false,
      ehCompensacaoParcial: false,
      valorCompensado: 0,
      lucroTributavel: 0,
    };
  }

  const tipoOperacao = op.day_trade ? "day_trade" : "swing_trade";
  const lucroOperacao = op.resultado;

  // Calcular prejuízo anterior disponível
  const operacoesAnteriores = operacoesFechadas
    .filter((opAnt) => {
      const mesmaTipo =
        (opAnt.day_trade ? "day_trade" : "swing_trade") === tipoOperacao;
      const dataAnterior =
        new Date(opAnt.data_fechamento) < new Date(op.data_fechamento);
      return mesmaTipo && dataAnterior;
    })
    .sort(
      (a, b) =>
        new Date(a.data_fechamento).getTime() -
        new Date(b.data_fechamento).getTime()
    );

  // Calcular saldo de prejuízo disponível
  let prejuizoAcumulado = 0;
  for (const opAnt of operacoesAnteriores) {
    if (opAnt.resultado < 0) {
      prejuizoAcumulado += Math.abs(opAnt.resultado);
    } else if (opAnt.resultado > 0) {
      const compensacaoUsada = Math.min(prejuizoAcumulado, opAnt.resultado);
      prejuizoAcumulado -= compensacaoUsada;
    }
  }

  const valorCompensado = Math.min(lucroOperacao, prejuizoAcumulado);
  const lucroTributavel = Math.max(0, lucroOperacao - valorCompensado);

  return {
    temCompensacao: valorCompensado > 0,
    ehCompensacaoTotal: valorCompensado > 0 && lucroTributavel === 0,
    ehCompensacaoParcial: valorCompensado > 0 && lucroTributavel > 0,
    valorCompensado,
    lucroTributavel,
  };
}

/**
 * Calcula o prejuízo acumulado até uma operação específica
 * ✅ CORRIGIDO: Agora considera compensações já utilizadas por operações de lucro intermediárias
 */
export function calcularPrejuizoAcumuladoAteOperacao(
  operacaoAtual: OperacaoFechada,
  todasOperacoes: OperacaoFechada[]
): PrejuizoAcumuladoInfo {
  const tipoOperacao = operacaoAtual.day_trade ? "day_trade" : "swing_trade";

  // Filtrar operações do mesmo tipo até a data/hora da operação atual
  const operacoesRelevantes = todasOperacoes
    .filter((op) => {
      const mesmaTipoOperacao =
        (op.day_trade ? "day_trade" : "swing_trade") === tipoOperacao;

      // Incluir apenas operações até a data da operação atual (inclusive)
      const dataOp = new Date(op.data_fechamento);
      const dataAtual = new Date(operacaoAtual.data_fechamento);

      return mesmaTipoOperacao && dataOp <= dataAtual;
    })
    .sort(
      (a, b) =>
        new Date(a.data_fechamento).getTime() -
        new Date(b.data_fechamento).getTime()
    );

  // Encontrar o índice da operação atual
  const indiceOperacaoAtual = operacoesRelevantes.findIndex(
    (op) =>
      op.ticker === operacaoAtual.ticker &&
      op.data_fechamento === operacaoAtual.data_fechamento &&
      op.resultado === operacaoAtual.resultado &&
      op.quantidade === operacaoAtual.quantidade
  );

  // Operações anteriores (não incluindo a atual)
  const operacoesAnteriores = operacoesRelevantes.slice(0, indiceOperacaoAtual);

  // Operações até a atual (incluindo a atual)
  const operacoesAteAtual = operacoesRelevantes.slice(
    0,
    indiceOperacaoAtual + 1
  );

  // ✅ NOVO CÁLCULO: Simular o fluxo cronológico de prejuízos e compensações
  let prejuizoDisponivel = 0;
  let prejuizoAnterior = 0;

  // Calcular prejuízo anterior (apenas operações anteriores à atual)
  for (const op of operacoesAnteriores) {
    if (op.resultado < 0) {
      // Acumular prejuízo
      prejuizoDisponivel += Math.abs(op.resultado);
    } else if (op.resultado > 0) {
      // Lucro consome prejuízo disponível
      const compensacao = Math.min(prejuizoDisponivel, op.resultado);
      prejuizoDisponivel -= compensacao;
    }
  }
  
  prejuizoAnterior = prejuizoDisponivel;

  // Calcular prejuízo até a operação atual (incluindo a operação atual se for prejuízo)
  let prejuizoAteOperacao = prejuizoDisponivel;
  if (operacaoAtual.resultado < 0) {
    prejuizoAteOperacao += Math.abs(operacaoAtual.resultado);
  } else if (operacaoAtual.resultado > 0) {
    // Se a operação atual é lucro, ela também pode consumir prejuízo
    const compensacao = Math.min(prejuizoAteOperacao, operacaoAtual.resultado);
    prejuizoAteOperacao -= compensacao;
  }

  return {
    prejuizoAnterior,
    prejuizoAteOperacao,
    operacoesAnteriores,
  };
}

/**
 * Calcula detalhes completos de compensação para uma operação do mesmo tipo
 * Considera todas as operações anteriores do mesmo tipo (day trade ou swing trade)
 */
// Em fiscal-utils.ts - função calcularDetalhesCompensacao
// Em fiscal-utils.ts - função calcularDetalhesCompensacao COMPLETA
export function calcularDetalhesCompensacao(
  operacao: OperacaoFechada,
  todasOperacoes: OperacaoFechada[]
): DetalhesCompensacao {
  const lucroOperacao = Math.max(0, operacao.resultado);

  console.log(`🔍 [DEBUG COMPENSACAO] ${operacao.ticker}:`, {
    lucroOperacao,
    statusIr: operacao.status_ir,
    isDayTrade: operacao.day_trade,
    dataFechamento: operacao.data_fechamento
  });

  if (lucroOperacao === 0) {
    console.log(`🚫 [DEBUG COMPENSACAO] ${operacao.ticker}: Sem lucro - retornando zeros`);
    return {
      lucroOperacao: 0,
      prejuizoAnteriorDisponivel: 0,
      valorCompensado: 0,
      lucroTributavel: 0,
      prejuizoRestante: 0,
      operacoesAnteriores: [],
      historicoPrejuizos: [],
    };
  }

  // ✅ CORREÇÃO: Filtrar operações APENAS do mesmo tipo
  const operacoesAnteriores = todasOperacoes
    .filter(
      (op) =>
        op.data_fechamento < operacao.data_fechamento &&
        isDayTradeNormalized(op) === isDayTradeNormalized(operacao) && // ✅ MESMO TIPO!
        op.resultado < 0
    )
    .sort((a, b) => a.data_fechamento.localeCompare(b.data_fechamento));

  // Calcular prejuízo total disponível do mesmo tipo
  const prejuizoTotalDisponivel = operacoesAnteriores.reduce((acc, op) => {
    return acc + Math.abs(op.resultado);
  }, 0);

  // Calcular compensações já usadas por operações anteriores (mesmo tipo)
  const operacoesLucroAnteriores = todasOperacoes
    .filter(
      (op) =>
        op.data_fechamento < operacao.data_fechamento &&
        op.day_trade === operacao.day_trade && // ✅ MESMO TIPO!
        op.resultado > 0
    )
    .sort((a, b) => a.data_fechamento.localeCompare(b.data_fechamento));

  let compensacoesJaUsadas = 0;
  for (const opLucro of operacoesLucroAnteriores) {
    // Recursão para calcular compensação desta operação anterior
    const detalhesAnterior = calcularDetalhesCompensacao(
      opLucro,
      todasOperacoes.filter((o) => o.data_fechamento <= opLucro.data_fechamento)
    );
    compensacoesJaUsadas += detalhesAnterior.valorCompensado;
  }

  const prejuizoAnteriorDisponivel = Math.max(
    0,
    prejuizoTotalDisponivel - compensacoesJaUsadas
  );
  const valorCompensado = Math.min(lucroOperacao, prejuizoAnteriorDisponivel);
  const lucroTributavel = lucroOperacao - valorCompensado;
  const prejuizoRestante = prejuizoAnteriorDisponivel - valorCompensado;

  console.log(`💰 [DEBUG COMPENSACAO] ${operacao.ticker} RESULTADO:`, {
    prejuizoTotalDisponivel,
    compensacoesJaUsadas,
    prejuizoAnteriorDisponivel,
    valorCompensado,
    lucroTributavel,
    prejuizoRestante
  });

  // Criar histórico de prejuízos com detalhes
  const historicoPrejuizos = operacoesAnteriores.map((op) => ({
    data: op.data_fechamento,
    ticker: op.ticker,
    valor: Math.abs(op.resultado),
    usado: false, // Você pode implementar lógica mais detalhada aqui se necessário
    tipo: (isDayTradeNormalized(op) ? "day_trade" : "swing_trade") as "day_trade" | "swing_trade",
  }));

  return {
    lucroOperacao,
    prejuizoAnteriorDisponivel,
    valorCompensado,
    lucroTributavel,
    prejuizoRestante,
    operacoesAnteriores,
    historicoPrejuizos,
  };
}

// ======================================
// ✅ FUNÇÕES PARA CORREÇÃO FISCAL
// ======================================

/**
 * 🚨 DEPRECATED: Recalcula status fiscal baseado no contexto mensal
 * 
 * MOTIVO DA DEPRECIAÇÃO:
 * - Frontend não deve alterar dados calculados pelo backend
 * - Pode criar inconsistências entre backend e frontend
 * - Backend é a fonte autorizada para cálculos fiscais
 * 
 * MANTIDO APENAS PARA REFERÊNCIA HISTÓRICA
 * NÃO USAR EM PRODUÇÃO
 */
export function recalcularStatusFiscalMensal(
  operacoes: OperacaoFechada[],
  resultadosMensais?: ResultadoMensal[]
): OperacaoFechada[] {
  if (!operacoes.length) return operacoes;

  // Agrupar operações por mês e tipo
  const operacoesPorMesTipo = new Map<string, OperacaoFechada[]>();

  operacoes.forEach((op) => {
    const mes = op.data_fechamento.substring(0, 7);
    const tipo = isDayTradeNormalized(op) ? "day_trade" : "swing_trade";
    const chave = `${mes}-${tipo}`;

    if (!operacoesPorMesTipo.has(chave)) {
      operacoesPorMesTipo.set(chave, []);
    }
    operacoesPorMesTipo.get(chave)!.push(op);
  });

  // Processar cada grupo mensal
  const operacoesCorrigidas: OperacaoFechada[] = [];

  for (const [chave, operacoesMesTipo] of operacoesPorMesTipo) {
    const [mes, tipo] = chave.split("-");
    const isDayTrade = tipo === "day_trade";

    // Encontrar resultado mensal correspondente
    const resultadoMensal = resultadosMensais?.find((rm) => rm.mes === mes);

    // Ordenar operações por data
    operacoesMesTipo.sort((a, b) =>
      a.data_fechamento.localeCompare(b.data_fechamento)
    );

    // ✅ NOVA LÓGICA: Calcular localmente ao invés de confiar no backend
    const lucroTotalMes = operacoesMesTipo
      .filter((op) => op.resultado > 0)
      .reduce((acc, op) => acc + op.resultado, 0);

    const prejuizoTotalMes = operacoesMesTipo
      .filter((op) => op.resultado < 0)
      .reduce((acc, op) => acc + Math.abs(op.resultado), 0);

    // Calcular prejuízo acumulado de meses anteriores
    const prejuizoAcumuladoAnterior = calcularPrejuizoAcumuladoAntesMes(
      mes,
      isDayTrade,
      operacoes
    );

    const prejuizoTotalDisponivel =
      prejuizoAcumuladoAnterior + prejuizoTotalMes;
    const saldoMensal = lucroTotalMes - prejuizoTotalDisponivel;

    // Valores do backend (apenas para comparação/debug)
    const valorTributavelBackend = isDayTrade
      ? resultadoMensal?.ir_devido_day || 0
      : resultadoMensal?.ir_devido_swing || 0;

    const ganhoLiquidoBackend = isDayTrade
      ? resultadoMensal?.ganho_liquido_day || 0
      : resultadoMensal?.ganho_liquido_swing || 0;

    console.log(`🔍 [CORREÇÃO FISCAL MELHORADA] ${mes} - ${tipo}:`, {
      operacoes: operacoesMesTipo.length,
      lucroTotalMes,
      prejuizoTotalMes,
      prejuizoAcumuladoAnterior,
      prejuizoTotalDisponivel,
      saldoMensal,
      backend: {
        valorTributavelBackend,
        ganhoLiquidoBackend,
      },
    });

    // ✅ CORRIGIR STATUS BASEADO NO CÁLCULO LOCAL
    for (const op of operacoesMesTipo) {
      let statusCorrigido = op.status_ir;

      if (op.resultado === 0) {
        statusCorrigido = "Isento";
      } else if (op.resultado < 0) {
        statusCorrigido = "Prejuízo Acumulado";
      } else if (op.resultado > 0) {
        // ✅ NOVA LÓGICA PARA OPERAÇÕES DE LUCRO

        // Se há saldo positivo no mês (lucro > prejuízos), deve ser tributável
        if (saldoMensal > 0) {
          statusCorrigido = isDayTrade
            ? "Tributável Day Trade"
            : "Tributável Swing";
          console.log(
            `💰 [DEVE TRIBUTAR] ${op.ticker}: Saldo mensal positivo = ${saldoMensal}`
          );
        }
        // Se todo lucro foi compensado por prejuízos
        else if (lucroTotalMes <= prejuizoTotalDisponivel) {
          statusCorrigido = "Lucro Compensado";
          console.log(
            `⚖️ [COMPENSADO] ${op.ticker}: Lucro ${lucroTotalMes} <= Prejuízo disponível ${prejuizoTotalDisponivel}`
          );
        }
        // Fallback: se não há prejuízo, deve ser tributável
        else {
          statusCorrigido = isDayTrade
            ? "Tributável Day Trade"
            : "Tributável Swing";
          console.log(
            `🎯 [FALLBACK TRIBUTÁVEL] ${op.ticker}: Primeira operação ou sem prejuízo anterior`
          );
        }
      }

      // Log se houve mudança
      if (statusCorrigido !== op.status_ir) {
        console.log(
          `✅ [CORREÇÃO MELHORADA] ${op.ticker} ${op.data_fechamento}:`,
          {
            statusAnterior: op.status_ir,
            statusCorrigido,
            resultado: op.resultado,
            contexto: {
              saldoMensal,
              lucroMes: lucroTotalMes,
              prejuizoDisponivel: prejuizoTotalDisponivel,
              valorTributavelBackend,
              // ✅ Indicar se usou backend ou cálculo local
              fontePrincipal:
                saldoMensal > 0 ? "cálculo local" : "cálculo local + prejuízos",
            },
          }
        );
      }

      operacoesCorrigidas.push({
        ...op,
        status_ir: statusCorrigido,
      });
    }
  }

  return operacoesCorrigidas;
}

/**
 * ✅ FUNÇÃO: Hook para usar dados da API sem recálculo frontend
 * 
 * DECISÃO ARQUITETURAL: Confiar completamente no backend para cálculos fiscais
 * - Backend tem acesso completo ao banco de dados
 * - Backend implementa lógica fiscal robusta e testada
 * - Frontend deve apenas exibir dados, não recalcular
 */
export function useOperacoesComStatusCorrigido(
  operacoes: OperacaoFechada[],
  resultadosMensais?: ResultadoMensal[]
): OperacaoFechada[] {
  return useMemo(() => {
    if (!operacoes.length) return operacoes;

    // ✅ ARQUITETURA LIMPA: Usar dados da API sem modificação
    console.log("✅ [DADOS PUROS] Usando dados da API sem recálculo frontend");
    return operacoes; // Dados originais da API são a fonte da verdade
    
    // DEPRECATED: Frontend não deve recalcular dados do backend
    // return recalcularStatusFiscalMensal(operacoes, resultadosMensais);
  }, [operacoes, resultadosMensais]);
}

/**
 * ✅ FUNÇÃO CORRIGIDA: Verificar se operação deve gerar DARF
 */
export function deveGerarDarf(
  operacao: OperacaoFechada,
  resultadoMensal?: ResultadoMensal
): boolean {
  if (!operacao || operacao.resultado <= 0) return false;

  // ✅ PRIORIDADE MÁXIMA: Se a API já calculou deve_gerar_darf, usar esse valor
  if (operacao.deve_gerar_darf !== undefined) {
    const deveGerar = Boolean(operacao.deve_gerar_darf);
    console.log(`🎯 [DEVE GERAR DARF] ${operacao.ticker}: API diz deve_gerar_darf=${deveGerar} → ${deveGerar}`);
    return deveGerar;
  }

  // ✅ FALLBACK: Se não há resultado mensal, usar status da operação
  if (!resultadoMensal) {
    const baseadoNoStatus = (
      operacao.status_ir === "Tributável Day Trade" ||
      operacao.status_ir === "Tributável Swing"
    );
    console.log(`🔄 [DEVE GERAR DARF] ${operacao.ticker}: Baseado no status → ${baseadoNoStatus}`);
    return baseadoNoStatus;
  }

  // ✅ ÚLTIMO FALLBACK: Verificar valor tributável do backend
  const valorTributavel = isDayTradeNormalized(operacao)
    ? resultadoMensal.ir_devido_day || 0
    : resultadoMensal.ir_devido_swing || 0;

  const deveGerarPorValor = valorTributavel > 0;
  console.log(`📊 [DEVE GERAR DARF] ${operacao.ticker}: Valor tributável=${valorTributavel} → ${deveGerarPorValor}`);
  return deveGerarPorValor;
  return false;
}

/**
 * ✅ FUNÇÃO: Debug para investigar problemas fiscais
 */
export function debugLogicaFiscal(
  operacaoAtual: OperacaoFechada,
  todasOperacoes: OperacaoFechada[],
  resultadoMensal?: ResultadoMensal
) {
  const mesOperacao = operacaoAtual.data_fechamento.substring(0, 7);
  const tipoOperacao = operacaoAtual.day_trade ? "day_trade" : "swing_trade";

  // Filtrar operações do mesmo mês e tipo
  const operacoesMesmoTipo = todasOperacoes.filter((op) => {
    const mesDaOp = op.data_fechamento.substring(0, 7);
    const tipoDaOp = op.day_trade ? "day_trade" : "swing_trade";
    return mesDaOp === mesOperacao && tipoDaOp === tipoOperacao;
  });

  // Calcular totais do mês
  const lucroTotalMes = operacoesMesmoTipo
    .filter((op) => op.resultado > 0)
    .reduce((acc, op) => acc + op.resultado, 0);

  const prejuizoTotalMes = operacoesMesmoTipo
    .filter((op) => op.resultado < 0)
    .reduce((acc, op) => acc + Math.abs(op.resultado), 0);

  const valorTributavelBackend = isDayTradeNormalized(operacaoAtual)
    ? resultadoMensal?.ir_devido_day || 0
    : resultadoMensal?.ir_devido_swing || 0;

  // Determinar status correto
  let statusCorreto = "";
  if (operacaoAtual.resultado < 0) {
    statusCorreto = "Prejuízo Acumulado";
  } else if (operacaoAtual.resultado > 0) {
    if (valorTributavelBackend > 0) {
      statusCorreto = isDayTradeNormalized(operacaoAtual)
        ? "Tributável Day Trade"
        : "Tributável Swing";
    } else {
      statusCorreto = "Lucro Compensado";
    }
  } else {
    statusCorreto = "Isento";
  }

  console.log("🔍 [DEBUG FISCAL] Análise completa:", {
    operacao: {
      ticker: operacaoAtual.ticker,
      data: operacaoAtual.data_fechamento,
      resultado: operacaoAtual.resultado,
      statusAtual: operacaoAtual.status_ir,
      statusCorreto,
    },
    mes: mesOperacao,
    tipo: tipoOperacao,
    totaisMes: {
      operacoes: operacoesMesmoTipo.length,
      lucroTotal: lucroTotalMes,
      prejuizoTotal: prejuizoTotalMes,
      saldoMes: lucroTotalMes - prejuizoTotalMes,
    },
    backend: {
      valorTributavel: valorTributavelBackend,
      deveGerarDARF: valorTributavelBackend > 0,
    },
  });

  return {
    statusCorreto,
    deveGerarDARF: valorTributavelBackend > 0,
    inconsistencia: statusCorreto !== operacaoAtual.status_ir,
  };
}

// ======================================
// ✅ NOVAS FUNÇÕES PARA COMPENSAÇÃO MENSAL
// ======================================

/**
 * ✅ NOVA FUNÇÃO: Calcula compensação considerando o mês completo
 */
export function calcularCompensacaoMensal(
  operacaoAtual: OperacaoFechada,
  todasOperacoes: OperacaoFechada[],
  resultadoMensal?: ResultadoMensal
): DetalhesCompensacao {
  const tipoOperacao = isDayTradeNormalized(operacaoAtual)
    ? "day_trade"
    : "swing_trade";
  const mesOperacao = operacaoAtual.data_fechamento.substring(0, 7);
  const lucroOperacao = operacaoAtual.resultado;

  // Se não é operação de lucro, retorna detalhes vazios
  if (lucroOperacao <= 0) {
    return {
      lucroOperacao: 0,
      prejuizoAnteriorDisponivel: 0,
      valorCompensado: 0,
      prejuizoRestante: 0,
      lucroTributavel: 0,
      operacoesAnteriores: [],
      historicoPrejuizos: [],
    };
  }

  // 1. BUSCAR OPERAÇÕES ANTERIORES AO MÊS (prejuízo acumulado)
  const operacoesAnterioresAoMes = todasOperacoes
    .filter((op) => {
      const mesmaTipo =
        (op.day_trade ? "day_trade" : "swing_trade") === tipoOperacao;
      const mesAnterior = op.data_fechamento.substring(0, 7) < mesOperacao;
      return mesmaTipo && mesAnterior && op.resultado < 0;
    })
    .sort(
      (a, b) =>
        new Date(a.data_fechamento).getTime() -
        new Date(b.data_fechamento).getTime()
    );

  // 2. BUSCAR OPERAÇÕES DO MESMO MÊS
  const operacoesMesmoMes = todasOperacoes
    .filter((op) => {
      const mesmaTipo =
        (op.day_trade ? "day_trade" : "swing_trade") === tipoOperacao;
      const mesmoMes = op.data_fechamento.substring(0, 7) === mesOperacao;
      return mesmaTipo && mesmoMes;
    })
    .sort(
      (a, b) =>
        new Date(a.data_fechamento).getTime() -
        new Date(b.data_fechamento).getTime()
    );

  // 3. CALCULAR TOTAIS DO MÊS
  const lucroTotalMes = operacoesMesmoMes
    .filter((op) => op.resultado > 0)
    .reduce((acc, op) => acc + op.resultado, 0);

  const prejuizoTotalMes = operacoesMesmoMes
    .filter((op) => op.resultado < 0)
    .reduce((acc, op) => acc + Math.abs(op.resultado), 0);

  // 4. CALCULAR PREJUÍZO ANTERIOR ACUMULADO
  const prejuizoAnteriorTotal = operacoesAnterioresAoMes.reduce(
    (acc, op) => acc + Math.abs(op.resultado),
    0
  );

  // 5. USAR DADOS DO BACKEND PARA VALIDAR
  const valorTributavelBackend = operacaoAtual.day_trade
    ? resultadoMensal?.ir_devido_day || 0
    : resultadoMensal?.ir_devido_swing || 0;

  const ganhoLiquidoBackend = operacaoAtual.day_trade
    ? resultadoMensal?.ganho_liquido_day || 0
    : resultadoMensal?.ganho_liquido_swing || 0;

  // 6. CALCULAR COMPENSAÇÃO BASEADA NO CONTEXTO MENSAL
  const prejuizoTotalDisponivel = prejuizoAnteriorTotal + prejuizoTotalMes;
  const valorCompensadoTotal = Math.min(lucroTotalMes, prejuizoTotalDisponivel);

  // Para esta operação específica, calcular proporcionalmente
  const proporcaoOperacao =
    lucroTotalMes > 0 ? lucroOperacao / lucroTotalMes : 0;
  const valorCompensadoOperacao = valorCompensadoTotal * proporcaoOperacao;
  const lucroTributavelOperacao = Math.max(
    0,
    lucroOperacao - valorCompensadoOperacao
  );

  // 7. VERIFICAR CONSISTÊNCIA COM BACKEND
  const temCompensacao = valorCompensadoOperacao > 0;
  const ehCompensacaoTotal =
    temCompensacao &&
    (valorTributavelBackend === 0 || ganhoLiquidoBackend <= 0);

  console.log(
    `💡 [COMPENSAÇÃO MENSAL] ${operacaoAtual.ticker} ${mesOperacao}:`,
    {
      operacao: {
        ticker: operacaoAtual.ticker,
        lucro: lucroOperacao,
      },
      contextoMensal: {
        lucroTotalMes,
        prejuizoTotalMes,
        saldoMes: lucroTotalMes - prejuizoTotalMes,
      },
      prejuizosDisponiveis: {
        anterior: prejuizoAnteriorTotal,
        mes: prejuizoTotalMes,
        total: prejuizoTotalDisponivel,
      },
      compensacao: {
        valorCompensadoTotal,
        valorCompensadoOperacao,
        lucroTributavelOperacao,
        temCompensacao,
        ehCompensacaoTotal,
      },
      backend: {
        valorTributavel: valorTributavelBackend,
        ganhoLiquido: ganhoLiquidoBackend,
      },
    }
  );

  // 8. CONSTRUIR HISTÓRICO DE PREJUÍZOS
  const historicoPrejuizos: Array<{
    data: string;
    ticker: string;
    valor: number;
    usado: boolean;
    tipo: "day_trade" | "swing_trade";
  }> = [];

  // Prejuízos anteriores ao mês
  for (const op of operacoesAnterioresAoMes) {
    historicoPrejuizos.push({
      data: op.data_fechamento,
      ticker: op.ticker,
      valor: Math.abs(op.resultado),
      usado: false,
      tipo: isDayTradeNormalized(op) ? "day_trade" : "swing_trade", // ✅ ADICIONADO
    });
  }

  // Prejuízos do mesmo mês
  for (const op of operacoesMesmoMes.filter((op) => op.resultado < 0)) {
    historicoPrejuizos.push({
      data: op.data_fechamento,
      ticker: op.ticker,
      valor: Math.abs(op.resultado),
      usado: false,
      tipo: isDayTradeNormalized(op) ? "day_trade" : "swing_trade", // ✅ ADICIONADO
    });
  }
  return {
    lucroOperacao,
    prejuizoAnteriorDisponivel: prejuizoTotalDisponivel,
    valorCompensado: ehCompensacaoTotal
      ? valorCompensadoOperacao
      : Math.min(valorCompensadoOperacao, lucroOperacao),
    prejuizoRestante: Math.max(
      0,
      prejuizoTotalDisponivel - valorCompensadoTotal
    ),
    lucroTributavel: ehCompensacaoTotal ? 0 : lucroTributavelOperacao,
    operacoesAnteriores: [
      ...operacoesAnterioresAoMes,
      ...operacoesMesmoMes.filter((op) => op.resultado < 0),
    ],
    historicoPrejuizos,
  };
}

/**
 * ✅ NOVA FUNÇÃO: Verificar compensação considerando contexto mensal
 */
export function getCompensacaoInfoMensal(
  op: OperacaoFechada,
  operacoesFechadas: OperacaoFechada[],
  resultadoMensal?: ResultadoMensal
): CompensacaoInfo {
  // Só verifica compensação para operações com lucro
  if (!op || op.resultado <= 0) {
    return {
      temCompensacao: false,
      ehCompensacaoTotal: false,
      ehCompensacaoParcial: false,
      valorCompensado: 0,
      lucroTributavel: 0,
    };
  }

  const detalhes = calcularCompensacaoMensal(
    op,
    operacoesFechadas,
    resultadoMensal
  );

  return {
    temCompensacao: detalhes.valorCompensado > 0,
    ehCompensacaoTotal:
      detalhes.valorCompensado > 0 && detalhes.lucroTributavel === 0,
    ehCompensacaoParcial:
      detalhes.valorCompensado > 0 && detalhes.lucroTributavel > 0,
    valorCompensado: detalhes.valorCompensado,
    lucroTributavel: detalhes.lucroTributavel,
  };
}

/**
 * ✅ NOVA FUNÇÃO: Calcular prejuízo acumulado antes de um mês específico
 */
function calcularPrejuizoAcumuladoAntesMes(
  mesAtual: string,
  isDayTrade: boolean,
  todasOperacoes: OperacaoFechada[]
): number {
  const operacoesAnteriores = todasOperacoes
    .filter((op) => {
      const mesOp = op.data_fechamento.substring(0, 7);
      const tipoCorreto = op.day_trade === isDayTrade;
      const mesAnterior = mesOp < mesAtual;
      return tipoCorreto && mesAnterior;
    })
    .sort((a, b) => a.data_fechamento.localeCompare(b.data_fechamento));

  // Simular fluxo de compensação mês a mês
  let prejuizoAcumulado = 0;

  // Processar por mês
  const operacoesPorMes = new Map<string, OperacaoFechada[]>();
  operacoesAnteriores.forEach((op) => {
    const mes = op.data_fechamento.substring(0, 7);
    if (!operacoesPorMes.has(mes)) {
      operacoesPorMes.set(mes, []);
    }
    operacoesPorMes.get(mes)!.push(op);
  });

  // Processar cada mês anterior em ordem cronológica
  for (const [mes, operacoesMes] of [...operacoesPorMes.entries()].sort()) {
    const lucroMes = operacoesMes
      .filter((op) => op.resultado > 0)
      .reduce((acc, op) => acc + op.resultado, 0);

    const prejuizoMes = operacoesMes
      .filter((op) => op.resultado < 0)
      .reduce((acc, op) => acc + Math.abs(op.resultado), 0);

    // Adicionar prejuízos do mês
    prejuizoAcumulado += prejuizoMes;

    // Subtrair compensação feita pelos lucros do mês
    const compensacaoUsada = Math.min(prejuizoAcumulado, lucroMes);
    prejuizoAcumulado -= compensacaoUsada;

    console.log(`📊 [PREJUÍZO ANTERIOR] ${mes}:`, {
      lucroMes,
      prejuizoMes,
      compensacaoUsada,
      prejuizoAcumulado,
    });
  }

  return prejuizoAcumulado;
}

/**
 * ✅ NOVA FUNÇÃO: Calcular prejuízo restante após compensação de uma operação
 */
export function calcularPrejuizoRestanteAposCompensacao(
  operacaoCompensada: OperacaoFechada,
  todasOperacoes: OperacaoFechada[]
): {
  prejuizoAntes: number;
  valorCompensado: number;
  prejuizoRestante: number;
  tipoOperacao: 'Day Trade' | 'Swing Trade';
} {
  const tipoOperacao = operacaoCompensada.day_trade ? 'Day Trade' : 'Swing Trade';
  
  // 1. Usar a mesma lógica de calcularDetalhesCompensacao para obter dados consistentes
  const detalhes = calcularDetalhesCompensacao(operacaoCompensada, todasOperacoes);
  
  // 2. Prejuízo disponível antes da compensação
  const prejuizoAntes = detalhes.prejuizoAnteriorDisponivel;
  
  // 3. Valor compensado nesta operação
  const valorCompensado = detalhes.valorCompensado;
  
  // 4. Prejuízo restante = prejuízo antes - valor compensado
  const prejuizoRestante = Math.max(0, prejuizoAntes - valorCompensado);

  console.log(`💰 [PREJUÍZO RESTANTE] ${operacaoCompensada.ticker}:`, {
    tipoOperacao,
    prejuizoAntes,
    valorCompensado,
    prejuizoRestante,
    detalhes: {
      prejuizoAnteriorDisponivel: detalhes.prejuizoAnteriorDisponivel,
      lucroOperacao: detalhes.lucroOperacao,
      valorCompensado: detalhes.valorCompensado
    }
  });

  return {
    prejuizoAntes,
    valorCompensado,
    prejuizoRestante,
    tipoOperacao
  };
}

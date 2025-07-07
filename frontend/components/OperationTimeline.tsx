"use client";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Gift,
  GitBranch,
  GitMerge,
  Coins,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  Target,
  Building2
} from "lucide-react";
import type { Operacao, OperacaoDetalhe } from "@/lib/types";

// Sistema de cores consistente e acessível
const COLORS = {
  buy: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: "text-emerald-600",
    dot: "bg-emerald-500"
  },
  sell: {
    bg: "bg-orange-50", 
    border: "border-orange-200",
    text: "text-orange-700",
    icon: "text-orange-600",
    dot: "bg-orange-500"
  },
  position_closed: {
    bg: "bg-slate-50",
    border: "border-slate-300", 
    text: "text-slate-700",
    icon: "text-slate-600",
    dot: "bg-slate-500"
  },
  dividend: {
    bg: "bg-blue-50",
    border: "border-blue-200", 
    text: "text-blue-700",
    icon: "text-blue-600",
    dot: "bg-blue-500"
  },
  jcp: {
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-700", 
    icon: "text-cyan-600",
    dot: "bg-cyan-500"
  },
  rendimento: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: "text-amber-600", 
    dot: "bg-amber-500"
  },
  bonificacao: {
    bg: "bg-gradient-to-r from-purple-50 to-indigo-50",
    border: "border-purple-300",
    text: "text-purple-800",
    icon: "text-purple-700",
    dot: "bg-purple-500"
  },
  desdobramento: {
    bg: "bg-gradient-to-r from-purple-50 to-indigo-50",
    border: "border-purple-300",
    text: "text-purple-800",
    icon: "text-purple-700",
    dot: "bg-purple-500"
  },
  agrupamento: {
    bg: "bg-gradient-to-r from-purple-50 to-indigo-50",
    border: "border-purple-300",
    text: "text-purple-800",
    icon: "text-purple-700",
    dot: "bg-purple-500"
  },
  default: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-700", 
    icon: "text-gray-600",
    dot: "bg-gray-400"
  }
};

// Ícones mais claros e consistentes
const ICONS = {
  buy: <TrendingUp className="w-4 h-4" />,
  sell: <TrendingDown className="w-4 h-4" />,
  position_closed: <Target className="w-4 h-4" />,
  fechamento: <Target className="w-4 h-4" />,
  dividend: <DollarSign className="w-4 h-4" />,
  jcp: <Coins className="w-4 h-4" />,
  rendimento: <DollarSign className="w-4 h-4" />,
  desdobramento: <GitBranch className="w-4 h-4" />,
  agrupamento: <GitMerge className="w-4 h-4" />,
  bonificacao: <Gift className="w-4 h-4" />,
  default: <DollarSign className="w-4 h-4" />
};

// Configuração dos filtros com cores e ícones
type FilterKey = 'all' | 'operations' | 'proventos' | 'events' | 'positions';
interface FilterConfig {
  label: string;
  icon: React.ReactNode;
  color: string;
  types?: string[];
}

const FILTER_CONFIG: Record<FilterKey, FilterConfig> = {
  all: {
    label: "Todos",
    icon: <Filter className="w-4 h-4 text-gray-500" />,
    color: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
  },
  operations: {
    label: "Operações", 
    icon: <TrendingUp className="w-4 h-4 text-blue-600" />,
    color: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200",
    types: ["buy", "sell"]
  },
  positions: {
    label: "Posições",
    icon: <Target className="w-4 h-4 text-slate-600" />,
    color: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
    types: ["position_closed", "fechamento"]
  },
  proventos: {
    label: "Proventos",
    icon: <DollarSign className="w-4 h-4 text-green-600" />, 
    color: "bg-green-100 text-green-700 border-green-200 hover:bg-green-200",
    types: ["dividend", "jcp", "rendimento", "bonificacao"]
  },
  events: {
    label: "Eventos Corporativos",
    icon: <Building2 className="w-4 h-4 text-purple-700" />,
    color: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200", 
    types: ["desdobramento", "agrupamento", "bonificacao"]
  }
};

const LABELS = {
  buy: "Compra",
  sell: "Venda", 
  position_closed: "Posição Encerrada",
  fechamento: "Posição Encerrada",
  dividend: "Dividendo",
  jcp: "JCP",
  rendimento: "Rendimento",
  bonificacao: "Bonificação",
  desdobramento: "Desdobramento",
  agrupamento: "Agrupamento"
};

function formatCurrency(value: number | undefined | null): string {
  if (!value) return "R$ 0,00";
  // Se for menor que 0,01, mostrar até 3 casas decimais
  if (value > 0 && value < 0.01) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  
  // DEBUG: Log para investigar problema de datas
  const originalDateStr = dateStr;
  
  // Garantir que a data seja tratada como local (não UTC)
  // Se a string estiver no formato YYYY-MM-DD, adicionar horário para evitar problemas de timezone
  const dateToFormat = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
  const date = new Date(dateToFormat);
  
  // Verificar se a data é válida
  if (isNaN(date.getTime())) {
    console.warn("formatDate: Data inválida recebida:", dateStr);
    return dateStr; // Retorna a string original se não conseguir parsear
  }
  
  const formatted = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).replace(".", "");
  
  // DEBUG: Log para comparar entrada e saída
  if (originalDateStr.includes('2025-06-12') || originalDateStr.includes('2025-03-20')) {
    console.log("🔍 [formatDate] Debug:", {
      input: originalDateStr,
      dateToFormat: dateToFormat,
      dateObject: date.toISOString(),
      formatted: formatted,
      getDate: date.getDate(),
      getMonth: date.getMonth() + 1,
      getFullYear: date.getFullYear()
    });
  }
  
  return formatted;
}

function getColorScheme(operation: string) {
  return COLORS[operation?.toLowerCase() as keyof typeof COLORS] || COLORS.default;
}

function getIcon(operation: string) {
  return ICONS[operation?.toLowerCase() as keyof typeof ICONS] || ICONS.default;
}

function getOperationLabel(operation: string) {
  return LABELS[operation?.toLowerCase() as keyof typeof LABELS] || operation;
}

// Função para gerar explicação humanizada dos eventos corporativos
function getEventoExplicacao(tipoEvento: string, razao: string, ticker: string): string {
  if (!razao || !razao.includes(':')) {
    return `A empresa ${ticker} realizou um evento corporativo que afetou suas ações.`;
  }

  const [numerador, denominador] = razao.split(':').map(n => parseInt(n.trim()));
  const tipo = tipoEvento?.toLowerCase();

  if (tipo === 'desdobramento') {
    if (denominador > numerador) {
      // Ex: 1:4 = cada 1 ação vira 4
      const multiplicador = denominador / numerador;
      return `🎯 Suas ações foram multiplicadas! Cada ${numerador} ação que você tinha se transformou em ${denominador} ações. Resultado: você ficou com ${multiplicador}x mais ações, mas o preço de cada uma diminuiu proporcionalmente. Seu patrimônio total permanece o mesmo.`;
    } else {
      // Ex: 4:1 = cada 4 ações vira 1 (tecnicamente um agrupamento)
      const divisor = numerador / denominador;
      return `📉 Suas ações foram reagrupadas. Cada ${numerador} ações que você tinha se transformaram em ${denominador} ação${denominador > 1 ? 's' : ''}. Resultado: você ficou com menos ações (÷${divisor}), mas o preço de cada uma aumentou proporcionalmente.`;
    }
  }
  
  if (tipo === 'agrupamento') {
    const divisor = numerador / denominador;
    return `📉 Suas ações foram reagrupadas. Cada ${numerador} ações que você tinha se transformaram em ${denominador} ação${denominador > 1 ? 's' : ''}. Resultado: você ficou com menos ações físicas (÷${divisor}), mas o preço de cada uma aumentou proporcionalmente. Seu patrimônio total permanece o mesmo.`;
  }
  
  if (tipo === 'bonificacao' || tipo === 'bonificação') {
    const percentual = (numerador / denominador * 100).toFixed(1);
    return `🎁 Você ganhou ações gratuitas! Para cada ${denominador} ações que você possuía, recebeu ${numerador} ação${numerador > 1 ? 's' : ''} adicional${numerador > 1 ? 's' : ''} de presente da empresa. Isso representa um bônus de ${percentual}% sobre sua posição.`;
  }

  return `A empresa ${ticker} realizou um evento corporativo na proporção ${razao} que pode ter alterado a quantidade ou características de suas ações.`;
}

// Função para distribuir items de forma balanceada na timeline
function distributeItemsBalanced(items: any[]): any[] {
  const sortedItems = [...items].sort((a, b) => 
    new Date(b.date || b.data_fechamento || '').getTime() - 
    new Date(a.date || a.data_fechamento || '').getTime()
  );

  // Estratégia de distribuição inteligente
  return sortedItems.map((item, index) => {
    let side: 'left' | 'right';
    
    // Regras de distribuição:
    // 1. Posições encerradas sempre à esquerda para destaque
    if (item.operation === 'fechamento' || item.operation === 'position_closed') {
      side = 'left';
    }
    // 2. Proventos sempre à direita para diferenciação visual
    else if (['dividend', 'jcp', 'rendimento', 'bonificacao'].includes(item.operation)) {
      side = 'right';
    }
    // 3. Operações de compra/venda alternam para balance visual
    else {
      side = index % 2 === 0 ? 'left' : 'right';
    }
    
    return {
      ...item,
      visualBranch: side
    };
  });
}

// Componente de filtro individual
interface FilterButtonProps {
  filterKey: FilterKey;
  config: FilterConfig;
  isActive: boolean;
  onClick: (key: FilterKey) => void;
  count?: number;
}

function FilterButton({ filterKey, config, isActive, onClick, count = 0 }: FilterButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(filterKey)}
      className={`
        flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200
        ${isActive 
          ? config.color.replace('hover:', '').replace('bg-', 'bg-') + ' shadow-sm' 
          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
        }
      `}
    >
      {config.icon}
      <span>{config.label}</span>
      {count > 0 && (
        <span className={`
          px-1.5 py-0.5 text-xs rounded-full
          ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}
        `}>
          {count}
        </span>
      )}
    </motion.button>
  );
}

// Componente de busca
interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}

function SearchInput({ value, onChange, onClear }: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
      <input
        type="text"
        placeholder="Buscar por ticker (ex: VALE3)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10 py-2 w-full md:w-80 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// Componente para posição encerrada expandível
interface ClosedPositionCardProps {
  item: any;
  idx: number;
}

function ClosedPositionCard({ item, idx }: ClosedPositionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = getColorScheme("position_closed");
  
  const resultadoPositivo = (item.resultado || 0) > 0;
  const resultadoClass = resultadoPositivo ? "text-emerald-700" : (item.resultado || 0) < 0 ? "text-red-600" : "text-gray-700";
  const bgResultado = resultadoPositivo ? "bg-emerald-50" : (item.resultado || 0) < 0 ? "bg-red-50" : "bg-gray-50";

  const isRight = item.visualBranch === "right";

  // Badge de tributação com tooltip elegante (header)
  function TaxBadgeHeader() {
    let badge = null;
    let tooltip = '';
    let color = '';
    if (item.day_trade) {
      badge = 'Tributável';
      tooltip = 'Day Trade é sempre tributável, independentemente do valor de venda.';
      color = 'bg-red-100 text-red-700';
    } else if (typeof item.valor_venda === 'number' && item.valor_venda <= 20000) {
      badge = 'Isenta';
      tooltip = 'Swing Trade isento de IR se o total vendido no mês for até R$ 20.000';
      color = 'bg-green-100 text-green-700';
    } else {
      badge = 'Tributável';
      tooltip = 'Swing Trade tributável se o total vendido no mês for acima de R$ 20.000';
      color = 'bg-red-100 text-red-700';
    }
    return (
      <span className="relative group ml-2">
        <span className={`text-xs ${color} px-2 py-0.5 rounded-full font-semibold cursor-pointer transition-shadow group-hover:shadow-lg`}>
          {badge}
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 mt-2 z-20 hidden group-hover:flex px-3 py-2 rounded bg-white text-xs text-gray-700 shadow-lg transition-all duration-200 min-w-[180px] max-w-[220px] text-center pointer-events-none border border-gray-200 break-words whitespace-normal">
          {tooltip}
        </span>
      </span>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: isRight ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        delay: idx * 0.05,
        type: "spring",
        stiffness: 400,
        damping: 25
      }}
      className="relative flex items-center"
    >
      <div className="absolute left-1/2 transform -translate-x-1/2 z-10">
        <div className={`w-3 h-3 rounded-full ${colors.dot} border-2 border-white shadow-sm`} />
      </div>

      <div className={`w-5/12 ${isRight ? "ml-auto" : ""}`}>
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={`${colors.bg} ${colors.border} border rounded-lg shadow-sm hover:shadow-md transition-all duration-200`}
        >
          {/* Header principal - sempre visível */}
          <div 
            className="p-3 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className={colors.icon}>
                  {getIcon("position_closed")}
                </div>
                <span className={`text-sm font-medium ${colors.text}`}>
                  Posição Encerrada
                </span>
                {/* Badge de tributação (header) */}
                <TaxBadgeHeader />
                <div className="flex items-center space-x-1">
                  {isExpanded ? 
                    <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                </div>
              </div>
              <span className="text-xs text-gray-500 font-mono">
                {formatDate(item.date || item.data_fechamento)}
              </span>
            </div>

            {/* Resumo principal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900 text-lg">{item.ticker}</span>
                {item.day_trade && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                    Day Trade
                  </span>
                )}
              </div>

              <div className={`${bgResultado} rounded-lg p-2 border`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Resultado Final:</span>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${resultadoClass}`}>
                      {formatCurrency(item.resultado)}
                    </div>
                    {typeof item.percentual_lucro === 'number' && (
                      <div className={`text-sm font-medium ${resultadoClass}`}>
                        {item.percentual_lucro > 0 ? '+' : ''}{item.percentual_lucro.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
                {/* Removido badge de tributação abaixo do resultado final */}
              </div>
            </div>
          </div>
          
          {/* Detalhes expandidos */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 pt-1 border-t border-gray-200 bg-gray-50/50">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 block">Compra:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(item.valor_compra)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Venda:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(item.valor_venda)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Quantidade:</span>
                      <span className="font-semibold text-gray-900">{item.quantidade} ações</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Tipo:</span>
                      <span className="font-semibold text-gray-900">
                        {item.day_trade ? 'Day Trade' : 'Swing Trade'}
                      </span>
                    </div>
                  </div>
                  {/* Timeline das operações que compõem a posição */}
                  {item.operacoes && item.operacoes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <span className="text-xs font-semibold text-gray-700 tracking-wide flex items-center gap-1 mb-2 uppercase">
                        <GitBranch className="w-4 h-4 text-gray-400" /> Operações da Posição
                      </span>
                      <div className="space-y-1">
                        {item.operacoes?.map((op: OperacaoDetalhe, i: number) => {
                          const opType = (op.operation || '').toLowerCase();
                          const opIcon = getIcon(opType);
                          const opColor = getColorScheme(opType);
                          // Função para formatar a data no padrão dd/mm/aaaa
                          function formatDateBR(dateStr: string) {
                            if (!dateStr) return '';
                            
                            // Garantir que a data seja tratada como local (não UTC)
                            const dateToFormat = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
                            const d = new Date(dateToFormat);
                            
                            if (isNaN(d.getTime())) return dateStr;
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            return `${day}/${month}/${year}`;
                          }
                          return (
                            <div key={i} className="flex items-center text-xs rounded px-2 py-1 gap-2 bg-gray-50 hover:bg-gray-100 transition">
                              <span className={"" + opColor.icon}>{opIcon}</span>
                              <span className="font-mono text-gray-500 mr-1">{formatDateBR(op.date)}</span>
                              <span className="font-semibold text-gray-800 mr-1">{item.ticker}</span>
                              <span className={`mr-1 font-medium capitalize ${opColor.text}`}>{getOperationLabel(opType)}</span>
                              <span className="mr-1 text-gray-600">Qtd: <span className="font-semibold">{op.quantity}</span></span>
                              <span className="text-gray-600">Preço: <span className="font-semibold">{op.price}</span></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Componente para operação individual
interface OperationCardProps {
  item: any;
  idx: number;
}

function OperationCard({ item, idx }: OperationCardProps) {
  const colors = getColorScheme(item.operation);
  const isRight = item.visualBranch === "right";
  const isProvento = ["dividend", "jcp", "rendimento", "bonificacao"].includes(item.operation?.toLowerCase());
  const isEventoCorporativo = ["desdobramento", "agrupamento", "bonificacao"].includes(item.operation?.toLowerCase());
  
  return (
    <motion.div
      initial={{ opacity: 0, x: isRight ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        delay: idx * 0.05,
        type: "spring",
        stiffness: 400,
        damping: 25
      }}
      className="relative flex items-center"
    >
      <div className="absolute left-1/2 transform -translate-x-1/2 z-10">
        <div className={`w-3 h-3 rounded-full ${colors.dot} border-2 border-white shadow-sm`} />
      </div>
      
      <div className={`w-5/12 ${isRight ? "ml-auto" : ""}`}>
        <motion.div
          whileHover={{ scale: 1.02 }}
          className={`
            ${isEventoCorporativo 
              ? "bg-gradient-to-br from-purple-500 to-indigo-600 border-purple-400 text-white shadow-lg" 
              : `${colors.bg} ${colors.border} border`
            } rounded-lg p-3 shadow-sm
            hover:shadow-md transition-all duration-200
          `}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className={isEventoCorporativo ? "text-white" : colors.icon}>
                {getIcon(item.operation)}
              </div>
              <span className={`text-sm font-medium ${isEventoCorporativo ? "text-white" : colors.text}`}>
                {getOperationLabel(item.operation)}
              </span>
            </div>
            <span className={`text-xs font-mono ${isEventoCorporativo ? "text-white/80" : "text-gray-500"}`}>
              {formatDate(item.date)}
            </span>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className={`font-semibold text-sm ${isEventoCorporativo ? "text-white" : "text-gray-900"}`}>
                {item.ticker}
              </span>
              {/* Não exibir nome_acao para eventos corporativos para evitar repetição */}
              {!isEventoCorporativo && item.nome_acao && (
                <span className="text-xs truncate ml-2 max-w-24 text-gray-500">
                  {item.nome_acao}
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              {isEventoCorporativo ? (
                <div className="flex-1 mt-2">
                  {/* Layout específico para eventos corporativos */}
                  <div className="space-y-3">
                    {/* Proporção em destaque */}
                    {(item as any).razao && (
                      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2 border border-white/30">
                        <div className="text-sm font-bold text-white">
                          📊 Proporção: {(item as any).razao}
                        </div>
                      </div>
                    )}
                    
                    {/* Explicação humanizada em destaque */}
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
                      <div className="text-sm font-medium text-white mb-1">
                        💡 O que isso significa:
                      </div>
                      <div className="text-sm text-white/95 leading-relaxed">
                        {getEventoExplicacao(item.operation, (item as any).razao || '', item.ticker)}
                      </div>
                    </div>
                    
                    {/* Removido texto de data para eventos corporativos, pois já está no título do card */}
                  </div>
                </div>
              ) : isProvento ? (
                <div className="flex-1">
                  {/* Mostrar valor total recebido se disponível - DESTAQUE PRINCIPAL */}
                  {(item as any).valor_total_recebido ? (
                    <div className="space-y-2">
                      {/* VALOR TOTAL RECEBIDO - DESTAQUE MÁXIMO */}
                      <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-lg p-3 shadow-sm">
                        <div className="text-2xl font-bold text-emerald-800 mb-1">
                          {formatCurrency((item as any).valor_total_recebido)}
                        </div>
                        <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                          💰 TOTAL RECEBIDO
                        </div>
                      </div>
                      
                      {/* Detalhes do cálculo - visual secundário */}
                      <div className="bg-gray-50 px-2 py-1 rounded text-xs text-gray-500 border-l-2 border-gray-300">
                        {item.quantity > 0 ? (
                          <>
                            <span className="font-medium">Cálculo:</span> {item.quantity} ações × {formatCurrency(item.price)}
                          </>
                        ) : (
                          <>
                            <span className="font-medium">Valor unitário:</span> {formatCurrency(item.price)}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Valor unitário como principal quando não há total */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                        <div className="text-lg font-bold text-gray-900 mb-1">
                          {formatCurrency(item.price)}
                        </div>
                        <div className="text-xs font-medium text-gray-600">
                          Valor por ação
                        </div>
                      </div>
                      
                      {/* Mostrar cálculo se disponível e quantity for válido */}
                      {item.quantity > 0 && (
                        <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border-l-2 border-gray-300">
                          <span className="font-medium">Total calculado:</span> {item.quantity} × {formatCurrency(item.price)} = {formatCurrency(item.quantity * item.price)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{item.quantity} ações a </span>
                  <span className="font-semibold">{formatCurrency(item.price)}</span>
                </div>
              )}
            </div>
            
            {!isProvento && !isEventoCorporativo && item.quantity && item.price && (
              <div className="text-right">
                <span className="text-xs text-gray-500">Total: </span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(item.quantity * item.price)}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

interface TimelineItem {
  id: number;
  date: string;
  ticker: string;
  operation: string; // More flexible than 'buy' | 'sell' to allow dividends, etc.
  quantity: number;
  price: number;
  fees: number;
  usuario_id?: number;
  corretora_id?: number | null;
  corretora_nome?: string | null;
  visualBranch?: "left" | "right";
  // Campos adicionais para posições encerradas
  resultado?: number;
  percentual_lucro?: number;
  valor_compra?: number;
  valor_venda?: number;
  day_trade?: boolean;
  data_fechamento?: string;
  operacoes?: OperacaoDetalhe[]; // Add the operacoes property
}

interface Props {
  items?: TimelineItem[];
}

export default function OperationTimeline({ items = [] }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // DEBUG: Log dos items recebidos para identificar valores zerados
  console.log("🔍 [OperationTimeline] Items recebidos:", items);
  console.log("🔍 [OperationTimeline] Items com valores zerados:", 
    items.filter(item => 
      (item.price === 0 || item.price === null || item.price === undefined) ||
      (item.quantity === 0 || item.quantity === null || item.quantity === undefined)
    )
  );

  // Filtrar e buscar items
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Aplicar filtro por categoria
    if (activeFilter !== "all") {
      const filterTypes = FILTER_CONFIG[activeFilter]?.types || [];
      filtered = filtered.filter(item => 
        filterTypes.includes(item.operation?.toLowerCase())
      );
    }

    // Aplicar busca por ticker
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item => {
        const tickerMatch = item.ticker?.toLowerCase().includes(searchLower);
        const nomeAcaoMatch = (item as any).nome_acao?.toLowerCase().includes(searchLower);
        return tickerMatch || nomeAcaoMatch;
      });
    }

    return filtered;
  }, [items, activeFilter, searchTerm]);

  // Calcular contadores para os filtros
  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      all: items.length,
      operations: 0,
      positions: 0,
      proventos: 0, 
      events: 0
    };

    items.forEach(item => {
      const operation = item.operation?.toLowerCase();
      if (FILTER_CONFIG.operations.types?.includes(operation)) {
        counts.operations++;
      }
      if (FILTER_CONFIG.positions.types?.includes(operation)) {
        counts.positions++;
      }
      if (FILTER_CONFIG.proventos.types?.includes(operation)) {
        counts.proventos++;
      }
      if (FILTER_CONFIG.events.types?.includes(operation)) {
        counts.events++;
      }
    });

    return counts;
  }, [items]);

  const handleFilterChange = (filterKey: FilterKey) => {
    setActiveFilter(filterKey);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleSearchClear = () => {
    setSearchTerm("");
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* Header com filtros e busca */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col w-full gap-4">
            <div className="flex w-full justify-center">
              <div className="min-w-[180px] w-full max-w-md">
                <SearchInput 
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onClear={handleSearchClear}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-center w-full pt-1">
              {Object.entries(FILTER_CONFIG).map(([key, config]) => (
                <FilterButton
                  key={key}
                  filterKey={key as FilterKey}
                  config={config}
                  isActive={activeFilter === key}
                  onClick={handleFilterChange}
                  count={filterCounts[key as FilterKey]}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {filteredItems.length === items.length 
              ? `${items.length} operações`
              : `${filteredItems.length} de ${items.length} operações`
            }
            {searchTerm && (
              <span className="ml-1">
                para "<span className="font-medium text-gray-700">{searchTerm}</span>"
              </span>
            )}
          </span>
          
          {(activeFilter !== "all" || searchTerm) && (
            <button
              onClick={() => {
                setActiveFilter("all");
                setSearchTerm("");
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {filteredItems.length > 0 ? (
        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 transform -translate-x-px" />
          
          <div className="space-y-4">
            {distributeItemsBalanced(filteredItems).map((item, idx) => {
              if (item.operation === 'fechamento' || item.operation === 'position_closed') {
                return <ClosedPositionCard key={item.id || idx} item={item} idx={idx} />;
              }
              return <OperationCard key={item.id || idx} item={item} idx={idx} />;
            })}
          </div>
          
          <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-4">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhuma operação encontrada
          </h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            {searchTerm 
              ? `Não foram encontradas operações para "${searchTerm}". Tente outro termo de busca.`
              : "Não há operações para o filtro selecionado."
            }
          </p>
          {(activeFilter !== "all" || searchTerm) && (
            <button
              onClick={() => {
                setActiveFilter("all");
                setSearchTerm("");
              }}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todas as operações
            </button>
          )}
        </div>
      )}
    </div>
  );
}
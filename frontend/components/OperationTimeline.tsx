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
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from "lucide-react";

interface OperacaoDetalhe {
  id: number;
  date: string;
  ticker: string;
  operation: string;
  quantity: number;
  price: number;
  fees?: number;
}

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
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
    icon: "text-teal-600",
    dot: "bg-teal-500"
  },
  bonificacao: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    icon: "text-yellow-600",
    dot: "bg-yellow-500"
  },
  desdobramento: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    icon: "text-indigo-600",
    dot: "bg-indigo-500"
  },
  agrupamento: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    icon: "text-purple-600",
    dot: "bg-purple-500"
  },
  default: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-700",
    icon: "text-gray-600",
    dot: "bg-gray-500"
  }
};

// Configuração de filtros
type FilterKey = "all" | "buy" | "sell" | "proventos" | "events";

const FILTER_CONFIG: Record<FilterKey, { label: string; icon: React.ReactNode; color: string; types?: string[] }> = {
  all: {
    label: "Todos",
    icon: <Filter className="w-4 h-4 text-gray-600" />,
    color: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200",
    types: []
  },
  buy: {
    label: "Compras",
    icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200",
    types: ["buy"]
  },
  sell: {
    label: "Vendas",
    icon: <TrendingDown className="w-4 h-4 text-orange-600" />,
    color: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200",
    types: ["sell"]
  },
  proventos: {
    label: "Proventos",
    icon: <DollarSign className="w-4 h-4 text-blue-600" />, 
    color: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200",
    types: ["dividend", "jcp", "rendimento"]
  },
  events: {
    label: "Eventos Corporativos",
    icon: <Building2 className="w-4 h-4 text-indigo-600" />,
    color: "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200",
    types: ["bonificacao", "desdobramento", "agrupamento"]
  }
};

// Props do componente
interface Props {
  items: any[];
}

// Utilitários
function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', 
    currency: 'BRL'
  }).format(value);
}

function formatDate(dateString: string) {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

function getColorScheme(operation: string) {
  return COLORS[operation as keyof typeof COLORS] || COLORS.default;
}

function getIcon(operation: string) {
  switch (operation.toLowerCase()) {
    case 'buy':
      return <TrendingUp className="w-4 h-4" />;
    case 'sell':
      return <ArrowUpRight className="w-4 h-4" />;
    case 'dividend':
    case 'jcp':
    case 'rendimento':
      return <DollarSign className="w-4 h-4" />;
    case 'bonificacao':
      return <Gift className="w-4 h-4" />;
    case 'desdobramento':
      return <GitBranch className="w-4 h-4" />;
    case 'agrupamento':
      return <GitMerge className="w-4 h-4" />;
    default:
      return <Coins className="w-4 h-4" />;
  }
}

// Função específica para obter ícone de venda baseado no resultado
function getSellIcon(resultado?: number) {
  if (resultado !== undefined && resultado < 0) {
    return <TrendingDown className="w-4 h-4" />; // Gráfico em queda para prejuízo
  }
  return <ArrowUpRight className="w-4 h-4" />; // Ícone padrão de venda
}

function getOperationLabel(operation: string) {
  const labels: { [key: string]: string } = {
    'buy': 'Compra',
    'sell': 'Venda',
    'dividend': 'Dividendo',
    'jcp': 'JCP',
    'rendimento': 'Rendimento',
    'bonificacao': 'Bonificação',
    'desdobramento': 'Desdobramento',
    'agrupamento': 'Agrupamento'
  };
  return labels[operation] || operation;
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
  const sortedItems = [...items].sort((a, b) => {
    // Para proventos, usar data_ex; para outros, usar date ou data_fechamento
    const dateA = a.data_ex || a.date || a.data_fechamento || '';
    const dateB = b.data_ex || b.date || b.data_fechamento || '';
    
    const timeA = new Date(dateA).getTime();
    const timeB = new Date(dateB).getTime();
    
    // Primeiro ordenar por data (mais recente primeiro)
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    
    return 0;
  });

  // Estratégia de distribuição inteligente
  return sortedItems.map((item, index) => {
    let side: 'left' | 'right';
    
    // Regras de distribuição:
    // 1. Proventos sempre à direita para diferenciação visual
    if (['dividend', 'jcp', 'rendimento'].includes(item.operation)) {
      side = 'right';
    }
    // 2. Operações de compra/venda alternam para balance visual
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
  config: { label: string; icon: React.ReactNode; color: string };
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
  onChange: (value: string) => void;
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

// Componente para operação individual
interface OperationCardProps {
  item: any;
  idx: number;
}

function OperationCard({ item, idx }: OperationCardProps) {
  const operation = item.operation?.toLowerCase() || '';
  const colors = getColorScheme(operation);
  const isProvento = ['dividend', 'jcp', 'rendimento'].includes(operation);
  const isEventoCorporativo = ['bonificacao', 'desdobramento', 'agrupamento'].includes(operation);
  const isRight = item.visualBranch === "right";
  
  // ✅ Eventos corporativos agora têm interface didática completa
  
  // Usar campos corretos para exibição
  const displayTicker = item.ticker_acao || item.ticker;
  const displayNomeAcao = item.nome_acao;
  const displayDate = item.data_ex || item.date;
  
  // 🎯 Para eventos corporativos, usar dados didáticos do backend
  const displayQuantity = isEventoCorporativo && (item as any).quantidade_depois 
    ? (item as any).quantidade_depois 
    : (item.quantidade_na_data_ex || item.quantity);
    
  const displayPrice = isEventoCorporativo && (item as any).preco_depois 
    ? (item as any).preco_depois 
    : (item.valor_unitario_provento || item.price);
    
  const displayValorTotal = item.valor_total_recebido;

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
            } rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200
          `}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className={isEventoCorporativo ? "text-white" : colors.icon}>
                {operation === 'sell' ? getSellIcon(item.resultado) : getIcon(operation)}
              </div>
              <span className={`text-sm font-medium ${isEventoCorporativo ? "text-white" : colors.text}`}>
                {getOperationLabel(operation)}
              </span>
            </div>
            <span className={`text-xs font-mono ${isEventoCorporativo ? "text-white/80" : "text-gray-500"}`}>
              {formatDate(displayDate)}
            </span>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className={`font-semibold text-sm ${isEventoCorporativo ? "text-white" : "text-gray-900"}`}>
                {displayTicker}
              </span>
              {!isEventoCorporativo && displayNomeAcao && (
                <span className="text-xs truncate ml-2 max-w-24 text-gray-500">
                  {displayNomeAcao}
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              {isEventoCorporativo ? (
                <div className="flex-1 mt-2">
                  {/* 🎓 INTERFACE DIDÁTICA PARA INVESTIDORES INICIANTES */}
                  <div className="space-y-4">
                    
                    {/* 📋 TÍTULO EXPLICATIVO */}
                    <div className="bg-white/30 backdrop-blur-sm rounded-lg p-3 border border-white/40">
                      <div className="text-center">
                        <h3 className="text-white font-bold text-sm mb-1">
                          🎯 O que aconteceu com suas ações {displayTicker}
                        </h3>
                        <p className="text-white/90 text-xs">
                          {operation === 'desdobramento' && 'Suas ações se multiplicaram!'}
                          {operation === 'bonificacao' && 'Você ganhou ações de presente!'}
                          {operation === 'agrupamento' && 'Suas ações foram reagrupadas'}
                        </p>
                      </div>
                    </div>

                    {/* 🎯 INTERFACE DIDÁTICA SEMPRE PRESENTE para eventos corporativos */}
                    {true ? (
                      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                        {/* Verificar se usuário tinha ações na data do evento */}
                        {((item as any).quantidade_antes > 0 || (item as any).quantidade_depois > 0) ? (
                          <>
                            {/* CASO: USUÁRIO TINHA AÇÕES - MOSTRAR COMPARATIVO */}
                            <div className="grid grid-cols-3 gap-3 items-center">
                              
                              {/* ANTES */}
                              <div className="text-center">
                                <div className="text-white/70 text-xs mb-2 font-medium">ANTES</div>
                                <div className="bg-red-500/20 rounded-lg p-3 border border-red-400/30">
                                  <div className="text-white font-bold text-lg">
                                    {(item as any).quantidade_antes || 0}
                                  </div>
                                  <div className="text-white/80 text-xs">ações</div>
                                  <div className="text-white/70 text-xs mt-1">
                                    R$ {((item as any).preco_antes || 0).toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              {/* SETA + PROPORÇÃO */}
                              <div className="text-center">
                                <div className="text-white text-2xl mb-1">➡️</div>
                                <div className="bg-blue-500/30 rounded-lg px-2 py-1 border border-blue-400/40">
                                  <div className="text-white font-bold text-xs">
                                    {(item as any).razao || 'N/A'}
                                  </div>
                                </div>
                              </div>

                              {/* DEPOIS */}
                              <div className="text-center">
                                <div className="text-white/70 text-xs mb-2 font-medium">DEPOIS</div>
                                <div className="bg-green-500/20 rounded-lg p-3 border border-green-400/30">
                                  <div className="text-white font-bold text-lg">
                                    {(item as any).quantidade_depois || 0}
                                  </div>
                                  <div className="text-white/80 text-xs">ações</div>
                                  <div className="text-white/70 text-xs mt-1">
                                    R$ {((item as any).preco_depois || 0).toFixed(2)}
                                  </div>
                                </div>
                              </div>

                            </div>

                            {/* RESUMO DO BENEFÍCIO */}
                            <div className="mt-4 pt-3 border-t border-white/20">
                              <div className="text-center">
                                {operation === 'bonificacao' ? (
                                  <div className="text-green-300 font-bold text-sm">
                                    🎁 Você ganhou {((item as any).quantidade_depois || 0) - ((item as any).quantidade_antes || 0)} ações de presente!
                                  </div>
                                ) : (
                                  <div className="text-blue-300 font-bold text-sm">
                                    📊 Suas ações foram transformadas: {(item as any).quantidade_antes} → {(item as any).quantidade_depois}
                                  </div>
                                )}
                                <div className="text-white/80 text-xs mt-1">
                                  Patrimônio: R$ {(((item as any).quantidade_antes || 0) * ((item as any).preco_antes || 0)).toFixed(2)} → R$ {(((item as any).quantidade_depois || 0) * ((item as any).preco_depois || 0)).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          /* CASO: USUÁRIO NÃO TINHA AÇÕES */
                          <div className="text-center">
                            <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-400/30">
                              <div className="text-yellow-200 font-bold text-sm mb-2">
                                ℹ️ Evento não afetou você
                              </div>
                              <div className="text-white/90 text-xs">
                                Você não possuía ações de {displayTicker} na data deste evento corporativo
                                ({formatDate(displayDate)})
                              </div>
                              {(item as any).razao && (
                                <div className="mt-2 pt-2 border-t border-yellow-400/30">
                                  <div className="text-white/80 text-xs">
                                    <strong>Proporção do evento:</strong> {(item as any).razao}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* CASO: Dados didáticos não disponíveis - FALLBACK */
                      <div className="bg-orange-500/20 backdrop-blur-sm rounded-lg p-4 border border-orange-400/30">
                        <div className="text-center">
                          <div className="text-orange-200 font-bold text-sm mb-2">
                            📋 Informação básica do evento
                          </div>
                          <div className="text-white/90 text-xs space-y-2">
                            <div>
                              <strong>Evento:</strong> {getOperationLabel(operation)}
                            </div>
                            <div>
                              <strong>Ticker:</strong> {displayTicker}
                            </div>
                            <div>
                              <strong>Data:</strong> {formatDate(displayDate)}
                            </div>
                            {item.razao && (
                              <div>
                                <strong>Proporção:</strong> {item.razao}
                              </div>
                            )}
                            <div className="mt-3 pt-2 border-t border-orange-400/30">
                              <div className="text-orange-100 text-xs">
                                ⚠️ Dados detalhados não disponíveis para este evento
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 📚 EXPLICAÇÃO EDUCATIVA - USAR DADOS DO BACKEND SE DISPONÍVEL */}
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3 border border-white/25">
                      <div className="text-white/90 text-xs leading-relaxed">
                        <div className="font-medium mb-2">💡 O que isso significa:</div>
                        {(item as any).impacto_didatico ? (
                          /* Usar explicação gerada pelo backend */
                          <div dangerouslySetInnerHTML={{ __html: (item as any).impacto_didatico.replace(/\n/g, '<br />') }} />
                        ) : (
                          /* Fallback para explicações padrão */
                          <>
                            {operation === 'desdobramento' && (
                              <div>
                                Em um <strong>desdobramento</strong>, a empresa divide suas ações para torná-las mais baratas e acessíveis. 
                                Você ganha mais ações, mas o preço de cada uma diminui proporcionalmente. 
                                <strong> Seu dinheiro investido continua exatamente o mesmo!</strong>
                              </div>
                            )}
                            {operation === 'bonificacao' && (
                              <div>
                                Em uma <strong>bonificação</strong>, a empresa distribui ações gratuitas para seus acionistas como um presente. 
                                Você realmente ganha ações extras sem pagar nada adicional. 
                                <strong> É literalmente um presente da empresa!</strong>
                              </div>
                            )}
                            {operation === 'agrupamento' && (
                              <div>
                                Em um <strong>agrupamento</strong>, a empresa junta várias ações em uma só para aumentar o preço unitário. 
                                Você fica com menos ações, mas cada uma vale mais. 
                                <strong> Seu patrimônio total continua o mesmo!</strong>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              ) : isProvento ? (
                <div className="flex-1">
                  {displayValorTotal ? (
                    <div className="space-y-2">
                      {/* VALOR TOTAL RECEBIDO - DESTAQUE MÁXIMO */}
                      <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-lg p-3 shadow-sm">
                        <div className="text-2xl font-bold text-emerald-800 mb-1">
                          {formatCurrency(displayValorTotal)}
                        </div>
                        <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                          💰 TOTAL RECEBIDO
                        </div>
                      </div>
                      
                      {/* Detalhes do cálculo - visual secundário */}
                      <div className="bg-gray-50 px-2 py-1 rounded text-xs text-gray-500 border-l-2 border-gray-300">
                        <div>📊 {displayQuantity} ações × {formatCurrency(displayPrice)}</div>
                        <div className="text-gray-400">💸 Valor unitário do provento</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">{displayQuantity} ações a </span>
                      <span className="font-semibold">{formatCurrency(displayPrice)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{displayQuantity} ações a </span>
                  <span className="font-semibold">{formatCurrency(displayPrice)}</span>
                </div>
              )}
            </div>
            
            {!isProvento && !isEventoCorporativo && displayQuantity && displayPrice && (
              <div className="text-right">
                <span className="text-xs text-gray-500">Total: </span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(displayQuantity * displayPrice)}
                </span>
                
                {/* Mostrar resultado se for uma venda com resultado */}
                {operation === 'sell' && item.resultado !== undefined && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-end gap-1">
                      {item.resultado >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-xs text-gray-500">Resultado: </span>
                      <span className={`text-sm font-bold ${item.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.resultado >= 0 ? '+' : ''}{formatCurrency(item.resultado)}
                      </span>
                    </div>
                    {item.percentual_lucro !== undefined && (
                      <div className="text-xs text-gray-500 text-right">
                        ({item.percentual_lucro >= 0 ? '+' : ''}{item.percentual_lucro.toFixed(2)}%)
                      </div>
                    )}
                    {item.day_trade && (
                      <div className="text-xs text-center mt-1">
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                          Day Trade
                        </span>
                      </div>
                    )}
                  </div>
                )}
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
  
  // Campos específicos para proventos (da API)
  ticker_acao?: string;
  nome_acao?: string;
  tipo?: string;
  valor?: number;
  data_ex?: string;
  quantidade_na_data_ex?: number;
  valor_total_recebido?: number;
  
  // Campos específicos para eventos corporativos
  razao?: string;
}

export default function OperationTimeline({ items = [] }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [searchTerm, setSearchTerm] = useState("");


  // Filtrar itens pela busca primeiro
  const searchFilteredItems = useMemo(() => {
    let filtered = items;

    // Aplicar busca por ticker
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item => {
        // Para proventos da API, usar ticker_acao; para outros, usar ticker
        const ticker = item.ticker_acao || item.ticker || '';
        const nomeAcao = item.nome_acao || '';
        
        const tickerMatch = ticker.toLowerCase().includes(searchLower);
        const nomeAcaoMatch = nomeAcao.toLowerCase().includes(searchLower);
        return tickerMatch || nomeAcaoMatch;
      });
    }

    return filtered;
  }, [items, searchTerm]);

  // Filtrar e buscar items (aplicar filtro de categoria aos itens já filtrados pela busca)
  const filteredItems = useMemo(() => {
    let filtered = searchFilteredItems;

    // Aplicar filtro por categoria
    if (activeFilter !== "all") {
      const filterTypes = FILTER_CONFIG[activeFilter]?.types || [];
      filtered = filtered.filter(item => 
        filterTypes.includes(item.operation?.toLowerCase())
      );
    }

    return filtered;
  }, [searchFilteredItems, activeFilter]);

  // Calcular contadores para os filtros baseado nos itens filtrados pela busca
  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      all: searchFilteredItems.length,
      buy: 0,
      sell: 0,
      proventos: 0, 
      events: 0
    };

    searchFilteredItems.forEach(item => {
      const operation = item.operation?.toLowerCase();
      if (FILTER_CONFIG.buy.types?.includes(operation)) {
        counts.buy++;
      }
      if (FILTER_CONFIG.sell.types?.includes(operation)) {
        counts.sell++;
      }
      if (FILTER_CONFIG.proventos.types?.includes(operation)) {
        counts.proventos++;
      }
      if (FILTER_CONFIG.events.types?.includes(operation)) {
        counts.events++;
      }
    });

    return counts;
  }, [searchFilteredItems]);

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
        {/* Campo de busca centralizado */}
        <div className="flex justify-center">
          <SearchInput 
            value={searchTerm}
            onChange={handleSearchChange}
            onClear={handleSearchClear}
          />
        </div>
        
        {/* Botões de filtro centralizados */}
        <div className="flex flex-wrap gap-2 justify-center">
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
          {/* Linha central da timeline mais sutil */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 transform -translate-x-px" />
          
          {/* Cards da timeline com espaçamento otimizado */}
          <div className="space-y-8">
            {distributeItemsBalanced(filteredItems).map((item, idx) => {
              return <OperationCard key={item.id || idx} item={item} idx={idx} />;
            })}
          </div>
          
          {/* Marcador final mais sutil */}
          <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-4">
            <div className="w-2 h-2 rounded-full bg-gray-400 border border-white shadow-sm" />
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

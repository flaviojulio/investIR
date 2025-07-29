"use client";
import React, { useState, useMemo, useCallback } from "react";
import { FixedSizeList as List } from "react-window";
import { motion } from "framer-motion";
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
  Building2,
  ArrowUpRight,
} from "lucide-react";

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

interface VirtualizedTimelineProps {
  items: any[];
  height?: number;
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

function getSellIcon(resultado?: number) {
  if (resultado !== undefined && resultado < 0) {
    return <TrendingDown className="w-4 h-4" />;
  }
  return <ArrowUpRight className="w-4 h-4" />;
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
    <button
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
    </button>
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

const VirtualizedTimeline: React.FC<VirtualizedTimelineProps> = ({ 
  items = [], 
  height = 500 
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Filtrar itens pela busca primeiro
  const searchFilteredItems = useMemo(() => {
    let filtered = items;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item => {
        const ticker = item.ticker_acao || item.ticker || '';
        const nomeAcao = item.nome_acao || '';
        
        const tickerMatch = ticker.toLowerCase().includes(searchLower);
        const nomeAcaoMatch = nomeAcao.toLowerCase().includes(searchLower);
        return tickerMatch || nomeAcaoMatch;
      });
    }

    return filtered;
  }, [items, searchTerm]);

  // Filtrar por categoria
  const filteredItems = useMemo(() => {
    let filtered = searchFilteredItems;

    if (activeFilter !== "all") {
      const filterTypes = FILTER_CONFIG[activeFilter]?.types || [];
      filtered = filtered.filter(item => 
        filterTypes.includes(item.operation?.toLowerCase())
      );
    }

    // Ordenar por data
    filtered.sort((a, b) => {
      const dateA = a.data_ex || a.date || a.data_fechamento || '';
      const dateB = b.data_ex || b.date || b.data_fechamento || '';
      
      const timeA = new Date(dateA).getTime();
      const timeB = new Date(dateB).getTime();
      
      return timeB - timeA; // Mais recente primeiro
    });

    return filtered;
  }, [searchFilteredItems, activeFilter]);

  // Calcular contadores para os filtros
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

  const handleFilterChange = useCallback((filterKey: FilterKey) => {
    setActiveFilter(filterKey);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchTerm("");
  }, []);

  // Componente para renderizar cada item da timeline virtual
  const TimelineRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredItems[index];
    const operation = item.operation?.toLowerCase() || '';
    const colors = getColorScheme(operation);
    const isProvento = ['dividend', 'jcp', 'rendimento'].includes(operation);
    const isEventoCorporativo = ['bonificacao', 'desdobramento', 'agrupamento'].includes(operation);
    
    const displayTicker = item.ticker_acao || item.ticker;
    const displayNomeAcao = item.nome_acao;
    const displayDate = item.data_ex || item.date;
    const displayQuantity = item.quantidade_na_data_ex || item.quantity;
    const displayPrice = item.valor_unitario_provento || item.price;
    const displayValorTotal = item.valor_total_recebido;

    return (
      <div style={style} className="relative flex items-center">
        {/* Linha central da timeline */}
        {index < filteredItems.length - 1 && (
          <div className="absolute left-1/2 top-16 bottom-0 w-0.5 bg-gray-200 transform -translate-x-px" />
        )}
        
        {/* Ponto na timeline */}
        <div className="absolute left-1/2 top-8 transform -translate-x-1/2 z-10">
          <div className={`w-3 h-3 rounded-full ${colors.dot} border-2 border-white shadow-sm`} />
        </div>
        
        {/* Card da operação */}
        <div className={`w-5/12 ${index % 2 === 0 ? "" : "ml-auto"}`}>
          <div
            className={`
              ${isEventoCorporativo 
                ? "bg-gradient-to-br from-purple-500 to-indigo-600 border-purple-400 text-white shadow-lg" 
                : `${colors.bg} ${colors.border} border`
              } rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 mx-4
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
                  <div className="flex-1">
                    {/* 🎯 INTERFACE DIDÁTICA ULTRA-COMPACTA PARA VIRTUALIZAÇÃO */}
                    <div className="space-y-2">
                      
                      {/* Informação compacta em uma linha */}
                      <div className="flex items-center justify-between">
                        <div className="text-white text-xs">
                          <span className="font-bold">
                            {(item as any).quantidade_antes || 0} → {(item as any).quantidade_depois || 0} ações
                          </span>
                          {(item as any).razao && (
                            <span className="ml-2 text-white/80">({(item as any).razao})</span>
                          )}
                        </div>
                      </div>

                      {/* Status visual simples */}
                      <div className="text-white/90 text-xs">
                        {operation === 'bonificacao' && '🎁 Ações gratuitas da empresa'}
                        {operation === 'desdobramento' && '📈 Ações multiplicadas'}
                        {operation === 'agrupamento' && '📊 Ações reagrupadas'}
                      </div>

                    </div>
                  </div>
                ) : isProvento ? (
                  <div className="flex-1">
                    {displayValorTotal ? (
                      <div className="space-y-2">
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-lg p-2 shadow-sm">
                          <div className="text-lg font-bold text-emerald-800">
                            {formatCurrency(displayValorTotal)}
                          </div>
                          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                            💰 TOTAL RECEBIDO
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 px-2 py-1 rounded text-xs text-gray-500 border-l-2 border-gray-300">
                          <div>📊 {displayQuantity} ações × {formatCurrency(displayPrice)}</div>
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [filteredItems]);

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* Header com filtros e busca */}
      <div className="mb-8 space-y-4">
        <div className="flex justify-center">
          <SearchInput 
            value={searchTerm}
            onChange={handleSearchChange}
            onClear={handleSearchClear}
          />
        </div>
        
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

      {/* Timeline virtualizada */}
      {filteredItems.length > 0 ? (
        <div className="relative">
          <List
            height={height}
            itemCount={filteredItems.length}
            itemSize={140} // Altura de cada item da timeline
            width="100%"
          >
            {TimelineRow}
          </List>
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
};

export default VirtualizedTimeline;
import React, { useState, useEffect } from 'react';
import { Bell, Calendar, TrendingUp, Clock, Sparkles, X } from 'lucide-react';

interface DividendNotification {
  id: number;
  ticker: string;
  nome_acao: string;
  tipo_provento: string;
  valor_unitario: number;
  data_ex: string;
  dt_pagamento: string;
  data_calculo: string;
  valor_total_recebido: number;
  quantidade_possuida: number;
  is_new: boolean;
}

interface UpcomingDividend {
  id: number;
  ticker: string;
  nome_acao: string;
  tipo_provento: string;
  valor_unitario: number;
  dt_pagamento: string;
  days_until_payment: number;
  estimated_amount: number;
}

interface DividendNotificationsProps {
  showValues: boolean;
}

const DividendNotifications: React.FC<DividendNotificationsProps> = ({ showValues }) => {
  const [newDividends, setNewDividends] = useState<DividendNotification[]>([]);
  const [upcomingDividends, setUpcomingDividends] = useState<UpcomingDividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedNewCard, setDismissedNewCard] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    
    try {
      const [newDividendsResponse, upcomingResponse] = await Promise.all([
        fetch('/api/dividendos/novos'),
        fetch('/api/dividendos/proximos')
      ]);

      if (newDividendsResponse.ok) {
        const newData = await newDividendsResponse.json();
        setNewDividends(newData);
      }

      if (upcomingResponse.ok) {
        const upcomingData = await upcomingResponse.json();
        setUpcomingDividends(upcomingData);
      }
    } catch (error) {
      console.error('Erro ao carregar notificações de dividendos:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissNewCard = () => {
    setDismissedNewCard(true);
  };

  const formatCurrency = (value: number) => {
    if (!showValues) return "R$ ••••";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getVisibleNewDividends = () => {
    return showAll ? newDividends : newDividends.slice(0, 3);
  };

  const getVisibleUpcomingDividends = () => {
    return showAll ? upcomingDividends : upcomingDividends.slice(0, 3);
  };

  const totalNewDividends = dismissedNewCard ? 0 : newDividends.length;
  const totalUpcoming = upcomingDividends.length;

  if (loading) {
    return (
      <div className="mb-6 bg-white rounded-xl shadow-lg border p-6">
        <div className="animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
            <div className="h-6 bg-gray-200 rounded w-48"></div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (totalNewDividends === 0 && totalUpcoming === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Novos Dividendos */}
      {totalNewDividends > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-2 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-green-600" />
              <h4 className="text-xs font-medium text-green-700">Novos ({totalNewDividends})</h4>
            </div>
            <button
              onClick={dismissNewCard}
              className="opacity-70 hover:opacity-100 transition-opacity p-1 hover:bg-green-200 rounded"
              title="Dispensar notificações de novos dividendos"
            >
              <X className="h-3 w-3 text-green-600" />
            </button>
          </div>
          
          <div className="flex gap-2 overflow-x-auto">
            {getVisibleNewDividends().map((dividend) => (
              <div key={dividend.id} className="flex items-center gap-2 bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300 rounded px-2 py-1 flex-shrink-0 min-w-0">
                <span className="font-medium text-gray-800 text-xs whitespace-nowrap">{dividend.ticker}</span>
                <span className="bg-green-200 text-green-800 text-[10px] px-1 py-0.5 rounded">
                  {dividend.tipo_provento.slice(0, 3)}
                </span>
                <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">
                  {formatCurrency(dividend.valor_total_recebido)}
                </span>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {formatDate(dividend.dt_pagamento)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próximos Dividendos */}
      {totalUpcoming > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3 w-3 text-green-600" />
            <h4 className="text-xs font-medium text-green-700">Próximos ({totalUpcoming})</h4>
          </div>
          
          <div className="flex gap-2 overflow-x-auto">
            {getVisibleUpcomingDividends().map((dividend) => (
              <div key={dividend.id} className="flex items-center gap-2 bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300 rounded px-2 py-1 flex-shrink-0 min-w-0">
                <span className="font-medium text-gray-800 text-xs whitespace-nowrap">{dividend.ticker}</span>
                <span className="bg-green-200 text-green-800 text-[10px] px-1 py-0.5 rounded">
                  {dividend.tipo_provento.slice(0, 3)}
                </span>
                <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">
                  {formatCurrency(dividend.estimated_amount)}
                </span>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {formatDate(dividend.dt_pagamento)} ({dividend.days_until_payment}d)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DividendNotifications;
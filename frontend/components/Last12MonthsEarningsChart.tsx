"use client";

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { getSumEarningsLast12Months } from '@/lib/api';
import type { MonthlyEarnings } from '@/lib/types';
import { formatCurrency } from '@/lib/utils'; // Using from utils.ts
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state

// Helper function to format month name from "YYYY-MM"
const formatMonthName = (monthStr: string): string => {
  if (!monthStr || !monthStr.includes('-')) return 'N/A';
  const [year, monthNum] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1); // Use year for robust date creation
  if (isNaN(date.getTime())) return 'N/A'; // Handle invalid date strings
  return date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
};

const Last12MonthsEarningsChart: React.FC<{ shouldLoad?: boolean }> = ({ shouldLoad = true }) => {
  const [data, setData] = useState<MonthlyEarnings[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (!shouldLoad || hasLoaded) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const earningsData = await getSumEarningsLast12Months();
        setData(earningsData);
        setHasLoaded(true);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Um erro desconhecido ocorreu.");
        }
        setData([]); // Clear data on error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shouldLoad, hasLoaded]);

  // Encontrar o maior valor de provento
  const maxEarnings = Math.max(...data.map(item => typeof item.total_earnings === 'number' ? item.total_earnings : 0));

  // Adicionar destaque ao melhor mês
  const chartData = data.map(item => {
    const total = typeof item.total_earnings === 'number' ? item.total_earnings : 0;
    return {
      ...item,
      shortMonth: formatMonthName(item.month),
      total_earnings: total,
      isBestMonth: total === maxEarnings && maxEarnings > 0,
    };
  });

  // Calcular o total recebido nos últimos 12 meses
  const totalRecebido = chartData.reduce((acc, item) => acc + (item.total_earnings || 0), 0);
  
  // Calcular a média mensal
  const mediaMensal = chartData.length > 0 ? totalRecebido / chartData.length : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proventos - Últimos 12 Meses</CardTitle>
        </CardHeader>
        <CardContent className="h-[450px] w-full flex items-center justify-center">
          {/* Skeleton loader for chart area */}
          <div className="space-y-2 w-full">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proventos - Últimos 12 Meses</CardTitle>
        </CardHeader>
        <CardContent className="h-[450px] w-full flex items-center justify-center">
          <p className="text-red-500">Erro ao carregar dados: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
     return (
      <Card>
        <CardHeader>
          <CardTitle>Proventos - Últimos 12 Meses</CardTitle>
        </CardHeader>
        <CardContent className="h-[450px] w-full flex items-center justify-center">
          <p>Nenhum dado de proventos encontrado para os últimos 12 meses.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proventos - Últimos 12 Meses</CardTitle>
      </CardHeader>
      <CardContent className="w-full p-0">
        <div className="h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 32,
              left: 32,
              bottom: 20,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="shortMonth"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              formatter={(value: number, name: string, props: any) => {
                // Valor, nome, props
                const { payload } = props;
                const isBest = payload?.isBestMonth;
                return [
                  formatCurrency(value),
                  `${isBest ? '🏆 Melhor mês! ' : ''}Proventos recebidos`
                ];
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload.length > 0 && payload[0].payload) {
                  const { month } = payload[0].payload;
                  // month está no formato YYYY-MM
                  if (typeof month === 'string' && month.includes('-')) {
                    const [yyyy, mm] = month.split('-');
                    return `${mm}-${yyyy}`;
                  }
                  return month || label;
                }
                return label;
              }}
              labelStyle={{ fontWeight: 'bold' }}
              itemStyle={{ color: '#2563eb' }}
              cursor={{ fill: 'rgba(200, 200, 200, 0.2)' }}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            {/* Barra com cores dinâmicas */}
            <Bar
              dataKey="total_earnings"
              name="Total Recebido"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isBestMonth ? '#22c55e' : '#2563eb'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
      
      {/* Estatísticas resumidas - compactas */}
      <div className="w-full px-6 py-4 bg-gradient-to-r from-blue-50 to-green-50 border-t rounded-b-lg">
        <div className="flex justify-between items-center">
          <div className="text-center flex-1">
            <div className="text-sm text-gray-600 mb-1">Total no período</div>
            <div className="text-xl font-bold text-blue-600">{formatCurrency(totalRecebido)}</div>
          </div>
          <div className="w-px h-12 bg-gray-300 mx-4"></div>
          <div className="text-center flex-1">
            <div className="text-sm text-gray-600 mb-1">Média mensal</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(mediaMensal)}</div>
          </div>
        </div>
        
        {/* Melhor mês */}
        {maxEarnings > 0 && (
          <div className="text-center pt-3 mt-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              🏆 Melhor mês: <span className="font-semibold text-green-600">{formatCurrency(maxEarnings)}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default Last12MonthsEarningsChart;

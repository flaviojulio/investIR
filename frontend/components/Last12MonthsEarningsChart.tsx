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

const Last12MonthsEarningsChart: React.FC = () => {
  const [data, setData] = useState<MonthlyEarnings[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const earningsData = await getSumEarningsLast12Months();
        setData(earningsData);
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
  }, []);

  const chartData = data.map(item => ({
    ...item,
    shortMonth: formatMonthName(item.month),
    // Ensure total_earnings is a number, default to 0 if not
    total_earnings: typeof item.total_earnings === 'number' ? item.total_earnings : 0,
  }));

  // Calcular o total recebido nos últimos 12 meses
  const totalRecebido = chartData.reduce((acc, item) => acc + (item.total_earnings || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proventos - Últimos 12 Meses</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] w-full flex items-center justify-center">
          {/* Skeleton loader for chart area */}
          <div className="space-y-2 w-full">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-[250px] w-full" />
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
        <CardContent className="h-[350px] w-full flex items-center justify-center">
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
        <CardContent className="h-[350px] w-full flex items-center justify-center">
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
      <CardContent className="h-[420px] w-full p-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 10,
              right: 32, // margem maior à direita
              left: 32,  // margem maior à esquerda
              bottom: 10,
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
              formatter={(value: number) => [formatCurrency(value), "Total Recebido"]}
              labelStyle={{ fontWeight: 'bold' }}
              itemStyle={{ color: '#2563eb' }}
              cursor={{ fill: 'rgba(200, 200, 200, 0.2)' }}
            />
            {/* Legenda removida */}
            <Bar dataKey="total_earnings" fill="#2563eb" name="Total Recebido" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="w-full text-center py-2 font-semibold text-base text-primary">
          Total de dividendos no período: {formatCurrency(totalRecebido)}
        </div>
      </CardContent>
    </Card>
  );
};

export default Last12MonthsEarningsChart;

"use client";
import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { ProventoRecebidoUsuario } from "@/lib/types";

// Paleta de cores atualizada para maior contraste e modernidade
const COLORS = [
  "#2563eb", // Azul forte
  "#22c55e", // Verde
  "#fbbf24", // Amarelo
  "#ef4444", // Vermelho
  "#a21caf", // Roxo
  "#0ea5e9", // Azul claro
  "#e11d48", // Rosa escuro
  "#f59e42", // Laranja
  "#14b8a6", // Teal
  "#f472b6", // Pink
];

export interface ProventosChartProps {
  data: ProventoRecebidoUsuario[];
  chartType?: "bar" | "line" | "pie";
}

export function ProventosChart({ data, chartType = "bar" }: ProventosChartProps) {
  // Agrupa por mês/ano e soma total recebido
  const monthlyData = React.useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      const key = item.dt_pagamento?.slice(0, 7) || "Sem Data";
      map.set(key, (map.get(key) || 0) + (item.valor_total_recebido || 0));
    });
    return Array.from(map.entries()).map(([mes, total]) => ({ mes, total }));
  }, [data]);

  // Agrupa por tipo de provento
  const tipoData = React.useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      map.set(item.tipo_provento, (map.get(item.tipo_provento) || 0) + (item.valor_total_recebido || 0));
    });
    return Array.from(map.entries()).map(([tipo, total]) => ({ tipo, total }));
  }, [data]);

  // Agrupa por ação
  const acaoData = React.useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      map.set(item.ticker_acao, (map.get(item.ticker_acao) || 0) + (item.valor_total_recebido || 0));
    });
    return Array.from(map.entries()).map(([ticker, total]) => ({ ticker, total }));
  }, [data]);

  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Nenhum provento para exibir com os filtros atuais.</p>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      <div className="flex gap-2 mb-4">
        <span className="font-semibold text-sm">Visualização:</span>
        {/* Aqui você pode adicionar botões para alternar o tipo de gráfico se quiser */}
      </div>
      {chartType === "bar" && (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={monthlyData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
            <Tooltip formatter={formatCurrency} />
            <Legend />
            <Bar dataKey="total" name="Total Recebido">
              {monthlyData.map((entry, idx) => (
                <Cell key={`cell-bar-${entry.mes}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      {chartType === "line" && (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={monthlyData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
            <Tooltip formatter={formatCurrency} />
            <Legend />
            <Line type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} name="Total Recebido" />
            {monthlyData.map((entry, idx) => (
              <Line key={entry.mes} type="monotone" dataKey="total" stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      {chartType === "pie" && (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={tipoData}
              dataKey="total"
              nameKey="tipo"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {tipoData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={formatCurrency} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
      <div className="flex flex-wrap gap-4 mt-8">
        <div className="flex-1 min-w-[220px] bg-muted rounded-lg p-4">
          <h4 className="font-semibold mb-2 text-sm">Por Tipo de Provento</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={tipoData} layout="vertical">
              <XAxis type="number" hide tickFormatter={formatCurrency} />
              <YAxis dataKey="tipo" type="category" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={formatCurrency} />
              {tipoData.map((entry, idx) => (
                <Bar key={entry.tipo} dataKey="total" fill={COLORS[idx % COLORS.length]} radius={4} name="Total" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 min-w-[220px] bg-muted rounded-lg p-4">
          <h4 className="font-semibold mb-2 text-sm">Por Ação</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={acaoData} layout="vertical">
              <XAxis type="number" hide tickFormatter={formatCurrency} />
              <YAxis dataKey="ticker" type="category" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={formatCurrency} />
              {acaoData.map((entry, idx) => (
                <Bar key={entry.ticker} dataKey="total" fill={COLORS[idx % COLORS.length]} radius={4} name="Total" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

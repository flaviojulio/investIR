"use client";
import React from "react";
import { motion } from "framer-motion";
import { DollarSign, Gift } from "lucide-react";

interface ProventoItem {
  id?: string | number;
  date: string;
  ticker: string;
  operation: string;
  price: number;
  nome_acao?: string;
}

function getIcon(type: string) {
  switch (type?.toLowerCase()) {
    case "dividend":
      return <DollarSign className="text-green-600" />;
    case "jcp":
      return <DollarSign className="text-green-500" />;
    case "rendimento":
      return <DollarSign className="text-amber-500" />;
    case "bonificacao":
      return <Gift className="text-yellow-500" />;
    default:
      return <DollarSign className="text-gray-400" />;
  }
}

function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return "R$ 0,00";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getLabel(item: ProventoItem) {
  switch (item.operation?.toLowerCase()) {
    case "dividend":
      return `Dividendo (${item.ticker}): ${formatCurrency(item.price)}`;
    case "jcp":
      return `JCP (${item.ticker}): ${formatCurrency(item.price)}`;
    case "rendimento":
      return `Rendimento (${item.ticker}): ${formatCurrency(item.price)}`;
    case "bonificacao":
      return `Bonificação (${item.ticker})`;
    default:
      return `${item.operation} (${item.ticker})`;
  }
}

interface Props {
  items: ProventoItem[];
}

export default function ProventosTimeline({ items }: Props) {
  return (
    <div className="relative pl-6 border-l-2 border-green-200">
      {items.map((item, idx) => (
        <motion.div
          key={item.id || idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="mb-6 flex items-start gap-3"
        >
          <div className="absolute -left-4 top-1.5">
            {getIcon(item.operation)}
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">
              {item.date ? new Date(item.date).toLocaleDateString("pt-BR") : ""}
            </div>
            <div className="text-sm font-medium text-gray-800">
              {getLabel(item)}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

"use client";
import React from "react";

interface TimelineItem {
  id: number;
  date: string;
  ticker: string;
  operation: string;
  quantity: number;
  price: number;
}

interface Props {
  items?: TimelineItem[];
}

export default function OperationTimelineTest({ items = [] }: Props) {
  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Timeline de Operações</h2>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id || index} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bold">{item.ticker}</span>
                <span className="ml-2 text-gray-600">{item.operation}</span>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">{item.date}</div>
                <div className="font-semibold">
                  {item.quantity} × R$ {item.price?.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhuma operação encontrada
          </div>
        )}
      </div>
    </div>
  );
}

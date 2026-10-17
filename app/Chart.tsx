'use client';

import React from 'react';
import { Transaction } from './storage';

interface ChartProps {
  sales: Transaction[];
}

export default function PerformanceChart({ sales }: ChartProps) {
  // Tomar las últimas transferencias para mostrarlas en la gráfica
  const recentSales = sales.slice(0, 7).reverse();

  // Calcular el monto máximo para escalar las alturas de las barras proporcionalmente
  const amounts = recentSales.map(s => parseFloat(s.amount.replace(' MON', '')) || 0);
  const maxAmount = Math.max(...amounts, 0.1);

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white">Rendimiento en Tiempo Real (Últimas Transferencias)</h2>
          <p className="text-xs text-slate-400">Volumen basado en tus transacciones reales en Monad Testnet</p>
        </div>
        <span className="text-xs px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 font-medium">
          {sales.length} Operaciones Registradas
        </span>
      </div>

      {/* Dynamic Bar Visualizer */}
      <div className="h-44 pt-6 flex items-end justify-between gap-3 border-b border-slate-800/80 pb-3 px-2">
        {recentSales.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
            Realiza una transferencia para ver los datos en la gráfica
          </div>
        ) : (
          recentSales.map((sale, idx) => {
            const val = parseFloat(sale.amount.replace(' MON', '')) || 0;
            const percentage = Math.max((val / maxAmount) * 100, 15);
            return (
              <div key={sale.id || idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition font-mono whitespace-nowrap">
                  {sale.amount}
                </span>
                <div 
                  className="w-full bg-indigo-600/70 group-hover:bg-indigo-500 rounded-t-md transition-all duration-300 relative shadow-lg shadow-indigo-600/20" 
                  style={{ height: `${percentage}%` }}
                />
                <span className="text-[10px] text-slate-400 font-mono truncate w-full text-center" title={sale.item}>
                  {sale.item.length > 8 ? sale.item.substring(0, 8) + '...' : sale.item}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

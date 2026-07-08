// src/components/market/PriceChart.tsx
'use client';

import { useState } from 'react';
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatMarketPrice } from '@/lib/market-prices';

interface PriceHistory {
  date: string;
  price: number;
  average: number;
  high: number;
  low: number;
}

interface PriceChartProps {
  data: PriceHistory[];
  commodityName: string;
  currentPrice: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export function PriceChart({ 
  data, 
  commodityName, 
  currentPrice, 
  change, 
  trend 
}: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<'7' | '14' | '30'>('30');

  // Filter data based on time range
  const filteredData = data.slice(-Number(timeRange));

  // Calculate stats
  const highestPrice = Math.max(...filteredData.map(d => d.high));
  const lowestPrice = Math.min(...filteredData.map(d => d.low));
  const avgPrice = filteredData.reduce((sum, d) => sum + d.average, 0) / filteredData.length;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' 
    ? 'text-red-600 dark:text-red-400' 
    : trend === 'down' 
    ? 'text-green-600 dark:text-green-400' 
    : 'text-text-secondary';

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-text-primary">
            {commodityName}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold text-text-primary">
              {formatMarketPrice(currentPrice)}
            </p>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              trend === 'up' ? 'bg-red-50 dark:bg-red-900/20' :
              trend === 'down' ? 'bg-green-50 dark:bg-green-900/20' :
              'bg-surface'
            }`}>
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
              <span className={`text-sm font-semibold ${trendColor}`}>
                {change > 0 ? '+' : ''}{change}%
              </span>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-1 bg-surface rounded-lg p-1">
          {(['7', '14', '30'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                timeRange === range
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {range}H
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filteredData}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#166534" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#166534" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11 }}
              stroke="#78716c"
              tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: id })}
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              stroke="#78716c"
              tickFormatter={(value) => `Rp${(value/1000).toFixed(0)}k`}
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              labelFormatter={(value) => format(new Date(value), 'dd MMM yyyy', { locale: id })}
              formatter={(value: any, name: string | number | undefined) => {
                const numericValue = typeof value === 'number' ? value : 0;
                const labels: Record<string, string> = {
                  price: 'Harga',
                  average: 'Rata-rata',
                  high: 'Tertinggi',
                  low: 'Terendah',
                };
                return [formatMarketPrice(numericValue), labels[String(name)] || String(name)];
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#166534"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPrice)"
            />
            <Line
              type="monotone"
              dataKey="average"
              stroke="#f59e0b"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-text-secondary mb-1">Tertinggi</p>
          <p className="text-sm font-bold text-red-600 dark:text-red-400">
            {formatMarketPrice(highestPrice)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-secondary mb-1">Rata-rata</p>
          <p className="text-sm font-bold text-text-primary">
            {formatMarketPrice(avgPrice)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-secondary mb-1">Terendah</p>
          <p className="text-sm font-bold text-green-600 dark:text-green-400">
            {formatMarketPrice(lowestPrice)}
          </p>
        </div>
      </div>
    </div>
  );
}
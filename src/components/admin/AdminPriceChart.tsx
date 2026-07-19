'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { formatMarketPrice } from '@/lib/market-prices';

interface MarketPrice {
  id: string;
  commodity: string;
  price: number;
  unit: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  market: string;
  lastUpdate: string;
}

interface PriceHistory {
  date: string;
  price: number;
  average: number;
  high: number;
  low: number;
}

export function AdminPriceChart() {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [selectedCommodity, setSelectedCommodity] = useState<MarketPrice | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [timeRange, setTimeRange] = useState<'7' | '14' | '30'>('30');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // ============================================
  // FETCH MARKET PRICES
  // ============================================
  const fetchMarketPrices = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/market-prices');
      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal memuat data');
      }

      setPrices(result.data);
      if (!selectedCommodity && result.data.length > 0) {
        setSelectedCommodity(result.data[0]);
      }
    } catch (err) {
      console.error('❌ Fetch market prices error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCommodity]);

  // ============================================
  // FETCH PRICE HISTORY
  // ============================================
  const fetchPriceHistory = useCallback(async (commodityId: string) => {
    try {
      setIsLoadingHistory(true);
      const res = await fetch(`/api/market-prices?commodityId=${commodityId}`);
      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal memuat riwayat harga');
      }

      setPriceHistory(result.data.history);
    } catch (err) {
      console.error('❌ Fetch price history error:', err);
      setPriceHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    fetchMarketPrices();
  }, []);

  useEffect(() => {
    if (selectedCommodity) {
      fetchPriceHistory(selectedCommodity.id);
    }
  }, [selectedCommodity]);

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-text-secondary">Memuat data harga pasar...</p>
        </div>
      </div>
    );
  }

  if (!selectedCommodity || priceHistory.length === 0) {
    return (
      <div className="card">
        <p className="text-center text-text-secondary py-8">Tidak ada data harga tersedia</p>
      </div>
    );
  }

  // Filter data based on time range
  const filteredData = priceHistory.slice(-Number(timeRange));

  // Calculate stats
  const highestPrice = Math.max(...filteredData.map((d) => d.high));
  const lowestPrice = Math.min(...filteredData.map((d) => d.low));
  const avgPrice = filteredData.reduce((sum, d) => sum + d.average, 0) / filteredData.length;

  const TrendIcon =
    selectedCommodity.trend === 'up'
      ? TrendingUp
      : selectedCommodity.trend === 'down'
        ? TrendingDown
        : Minus;
  const trendColor =
    selectedCommodity.trend === 'up'
      ? 'text-red-600 dark:text-red-400'
      : selectedCommodity.trend === 'down'
        ? 'text-green-600 dark:text-green-400'
        : 'text-text-secondary';

  return (
    <div className="card">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              Grafik Harga Komoditas
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Monitoring tren harga di pasar
            </p>
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

        {/* Commodity Selector */}
        <div className="flex gap-2 flex-wrap">
          {prices.slice(0, 6).map((price) => (
            <button
              key={price.id}
              onClick={() => setSelectedCommodity(price)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCommodity.id === price.id
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {price.commodity}
            </button>
          ))}
        </div>
      </div>

      {/* Current Price */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
        <div>
          <p className="text-sm text-text-secondary mb-1">Harga Saat Ini</p>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-text-primary">
              {formatMarketPrice(selectedCommodity.price)}
            </p>
            <div
              className={`flex items-center gap-1 px-3 py-1 rounded-lg ${
                selectedCommodity.trend === 'up'
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : selectedCommodity.trend === 'down'
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'bg-surface'
              }`}
            >
              <TrendIcon className={`w-5 h-5 ${trendColor}`} />
              <span className={`text-sm font-semibold ${trendColor}`}>
                {selectedCommodity.change > 0 ? '+' : ''}
                {selectedCommodity.change}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80 mb-6">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs text-text-secondary">Memuat grafik...</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#166534" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                className="dark:stroke-gray-700"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="#78716c"
                tickFormatter={(value) =>
                  format(new Date(value), 'dd/MM', { locale: id })
                }
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#78716c"
                tickFormatter={(value) => `Rp${(value / 1000).toFixed(0)}k`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                labelFormatter={(value) =>
                  format(new Date(value), 'dd MMM yyyy', { locale: id })
                }
                formatter={(value: any, name: string | number | undefined) => {
                  const numericValue = typeof value === 'number' ? value : 0;
                  const labels: Record<string, string> = {
                    price: 'Harga',
                    average: 'Rata-rata',
                    high: 'Tertinggi',
                    low: 'Terendah',
                  };
                  return [
                    formatMarketPrice(numericValue),
                    labels[String(name)] || String(name),
                  ];
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
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-text-secondary mb-2">Harga Tertinggi</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {formatMarketPrice(highestPrice)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-secondary mb-2">Rata-rata</p>
          <p className="text-lg font-bold text-text-primary">
            {formatMarketPrice(avgPrice)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-secondary mb-2">Harga Terendah</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {formatMarketPrice(lowestPrice)}
          </p>
        </div>
      </div>
    </div>
  );
}

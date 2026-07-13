// src/components/market/PriceTicker.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { formatMarketPrice, formatLastUpdate } from '@/lib/market-prices';

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

interface PriceTickerProps {
  prices: MarketPrice[];
  lastUpdate: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function PriceTicker({ 
  prices, 
  lastUpdate, 
  onRefresh, 
  isLoading 
}: PriceTickerProps) {
  const [isPaused, setIsPaused] = useState(false);

  if (!prices || prices.length === 0) {
    return null;
  }

  // Duplicate prices for seamless loop
  const duplicatedPrices = [...prices, ...prices];

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <h3 className="text-sm font-semibold text-text-primary">
            Harga Pasar Realtime
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">
            Update: {formatLastUpdate(lastUpdate)}
          </span>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 hover:bg-surface rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 text-text-secondary ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Ticker */}
      <div 
        className="relative overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <motion.div
          className="flex gap-4"
          animate={{
            x: isPaused ? 0 : ['-0%', '-50%'],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 30,
              ease: 'linear',
            },
          }}
        >
          {duplicatedPrices.map((price, index) => {
            const TrendIcon = price.trend === 'up' 
              ? TrendingUp 
              : price.trend === 'down' 
              ? TrendingDown 
              : Minus;

            const trendColor = price.trend === 'up'
              ? 'text-red-600 dark:text-red-900'
              : price.trend === 'down'
              ? 'text-green-600 dark:text-green-900'
              : 'text-text-secondary';

            const trendBg = price.trend === 'up'
              ? 'bg-red-50 dark:bg-red-900/20'
              : price.trend === 'down'
              ? 'bg-green-50 dark:bg-green-900/20'
              : 'bg-surface';

            return (
              <div
                key={`${price.id}-${index}`}
                className={`shrink-0 flex items-center gap-3 px-4 py-2 rounded-xl ${trendBg} border border-border`}
              >
                {/* Commodity Name */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate max-w-30">
                    {price.commodity}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {price.market}
                  </p>
                </div>

                {/* Price */}
                <div className="text-right">
                  <p className="text-sm font-bold text-text-primary">
                    {formatMarketPrice(price.price)}
                  </p>
                  <p className="text-xs text-text-secondary">
                    /{price.unit}
                  </p>
                </div>

                {/* Trend */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${trendBg}`}>
                  <TrendIcon className={`w-3 h-3 ${trendColor}`} />
                  <span className={`text-xs font-semibold ${trendColor}`}>
                    {price.change > 0 ? '+' : ''}{price.change}%
                  </span>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Info */}
      <div className="mt-3 px-2">
        <p className="text-xs text-text-muted text-center">
          💡 Hover untuk pause • Data dari PIHPS Bank Indonesia
        </p>
      </div>
    </div>
  );
}
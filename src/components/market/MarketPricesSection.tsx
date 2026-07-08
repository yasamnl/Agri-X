// src/components/market/MarketPricesSection.tsx
`use client`;

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Loader2, AlertCircle, X } from 'lucide-react';
import { PriceTicker } from './PriceTicker';
import { PriceChart } from './PriceChart';
import { formatLastUpdate, getSourceBadge } from '@/lib/market-prices';

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

export function MarketPricesSection() {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [selectedCommodity, setSelectedCommodity] = useState<MarketPrice | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('');
  
  // ✅ NEW: Modal state
  const [showCommodityModal, setShowCommodityModal] = useState(false);

  // ============================================
  // FETCH MARKET PRICES
  // ============================================
  const fetchMarketPrices = useCallback(async (showLoading = true) => {
  try {
    if (showLoading) setIsLoading(true);
    setError(null);

    const res = await fetch('/api/market-prices');
    const result = await res.json();

    if (!result.success) {
      throw new Error(result.error || 'Gagal memuat data');
    }

    setPrices(result.data);
    setLastUpdate(result.lastUpdate);
    setSource(result.source || 'mock'); // ✅ NEW

    if (!selectedCommodity && result.data.length > 0) {
      setSelectedCommodity(result.data[0]);
    }
  } catch (err: any) {
    console.error('❌ Fetch market prices error:', err);
    setError(err.message || 'Gagal memuat data harga pasar');
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
    } catch (err: any) {
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

    // Auto-refresh setiap 5 menit
    const interval = setInterval(() => {
      fetchMarketPrices(false);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchMarketPrices]);

  useEffect(() => {
    if (selectedCommodity) {
      fetchPriceHistory(selectedCommodity.id);
    }
  }, [selectedCommodity, fetchPriceHistory]);

  // ============================================
  // HANDLERS
  // ============================================
  const handleRefresh = () => {
    fetchMarketPrices();
  };

  const handleSelectCommodity = (commodity: MarketPrice) => {
    setSelectedCommodity(commodity);
    setShowCommodityModal(false); // ✅ Close modal setelah pilih
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Harga Pasar Hari Ini
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-text-secondary">
              Update: {formatLastUpdate(lastUpdate)}
            </p>
            {/* ✅ NEW: Source Badge */}
            {source && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSourceBadge(source).color}`}>
                {getSourceBadge(source).label}
              </span>
            )}
          </div>
        </div>
      </div>


      {/* Error State */}
      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-800 dark:text-red-300">
                Gagal memuat data
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                {error}
              </p>
              <button
                onClick={handleRefresh}
                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Coba lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && prices.length === 0 ? (
        <div className="card flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-text-secondary">Memuat data harga pasar...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Price Ticker */}
          <PriceTicker
            prices={prices}
            lastUpdate={lastUpdate}
            onRefresh={handleRefresh}
            isLoading={isLoading}
          />

          {/* ✅ Commodity Selector Button */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Komoditas Terpilih
              </h3>
              <button
                onClick={() => setShowCommodityModal(true)}
                className="btn-outline flex items-center gap-2 text-sm"
              >
                <span>Pilih Komoditas</span>
                <span className="text-text-secondary">
                  ({prices.length} tersedia)
                </span>
              </button>
            </div>

            {selectedCommodity ? (
              <div className="flex items-center gap-3 p-4 bg-surface rounded-xl">
                <div className="flex-1">
                  <p className="font-semibold text-text-primary">
                    {selectedCommodity.commodity}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {selectedCommodity.market}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-text-primary">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0,
                    }).format(selectedCommodity.price)}
                  </p>
                  <p className="text-xs text-text-secondary">
                    /{selectedCommodity.unit}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedCommodity.trend === 'up'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    : selectedCommodity.trend === 'down'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {selectedCommodity.change > 0 ? '+' : ''}{selectedCommodity.change}%
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-text-secondary">
                <p>Belum ada komoditas dipilih</p>
                <button
                  onClick={() => setShowCommodityModal(true)}
                  className="btn-primary mt-4"
                >
                  Pilih Komoditas
                </button>
              </div>
            )}
          </div>

          {/* Price Chart */}
          {selectedCommodity && (
            <>
              {isLoadingHistory ? (
                <div className="card flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : (
                <PriceChart
                  data={priceHistory}
                  commodityName={selectedCommodity.commodity}
                  currentPrice={selectedCommodity.price}
                  change={selectedCommodity.change}
                  trend={selectedCommodity.trend}
                />
              )}
            </>
          )}
        </>
      )}

      {/* ✅ COMMODITY SELECTION MODAL */}
      {showCommodityModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl w-full max-w-200 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">
                Pilih Komoditas untuk Grafik
              </h3>
              <button
                onClick={() => setShowCommodityModal(false)}
                className="p-2 hover:bg-surface rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : prices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {prices.map((commodity) => {
                    const isSelected = selectedCommodity?.id === commodity.id;
                    
                    return (
                      <button
                        key={commodity.id}
                        onClick={() => handleSelectCommodity(commodity)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/50 hover:bg-surface'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-text-primary truncate">
                              {commodity.commodity}
                            </p>
                            <p className="text-xs text-text-secondary mt-1">
                              {commodity.market}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 ml-2">
                              <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-lg font-bold text-text-primary">
                            {new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              minimumFractionDigits: 0,
                            }).format(commodity.price)}
                          </p>
                          <div className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            commodity.trend === 'up'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              : commodity.trend === 'down'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {commodity.change > 0 ? '+' : ''}{commodity.change}%
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-text-secondary">
                  <p>Tidak ada komoditas tersedia</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-surface/50">
              <button
                onClick={() => setShowCommodityModal(false)}
                className="btn-outline w-full"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
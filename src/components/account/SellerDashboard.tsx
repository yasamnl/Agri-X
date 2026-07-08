// src/components/account/SellerDashboard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store, DollarSign, TrendingUp, Package, ShoppingBag, Star, Award,
  BarChart3, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSellerData } from '@/hooks/useSellerData';
import { SalesLineChart } from './SalesLineChart';

// ✅ Helper: Format currency dengan benar
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function SellerDashboard() {
  const router = useRouter();
  const { data, isLoading, error, refetch, lastUpdated } = useSellerData({
    enabled: true,
  });

  const [chartMode, setChartMode] = useState<'revenue' | 'orders'>('revenue');

  const handleRefresh = async () => {
    try {
      await refetch(true);
      toast.success('Data berhasil di-refresh');
    } catch (err: any) {
      toast.error(err.message || 'Gagal refresh data');
    }
  };

  // Loading state
  if (isLoading && !data.stats && data.chart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-text-secondary">Memuat dashboard...</p>
      </div>
    );
  }

  // Error state
  if (error && !data.stats && data.chart.length === 0 && data.topProducts.length === 0) {
    return (
      <div className="card text-center py-16">
        <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-text-primary mb-2">
          Gagal Memuat Dashboard
        </h3>
        <p className="text-text-secondary mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="btn-primary flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Coba Lagi
        </button>
      </div>
    );
  }

  const { stats, chart, topProducts } = data;

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="card bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-800">
                Sebagian data gagal dimuat
              </p>
              <p className="text-sm text-yellow-600 mt-1">{error}</p>
            </div>
            <button
              onClick={handleRefresh}
              className="btn-outline text-sm py-1 px-3 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="card bg-gradient-to-br from-primary to-secondary text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-5 h-5" />
              <span className="text-sm opacity-90">Dashboard Penjual</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">
              Selamat Datang, Penjual! 🌾
            </h2>
            <p className="text-sm opacity-90">Pantau performa toko Anda</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw
              className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
        {lastUpdated && (
          <p className="text-xs opacity-70 mt-2">
            Terakhir update:{' '}
            {new Date(lastUpdated).toLocaleTimeString('id-ID')}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <DollarSign className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-xs opacity-90">Pendapatan Hari Ini</p>
              <p className="text-xl font-bold mt-1">
                {formatCurrency(stats.dailyRevenue)}
              </p>
              <p className="text-xs opacity-70 mt-1">
                {stats.dailyOrders} pesanan
              </p>
            </div>
            <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
              <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-xs opacity-90">Pendapatan Bulan Ini</p>
              <p className="text-xl font-bold mt-1">
                {formatCurrency(stats.monthlyRevenue)}
              </p>
            </div>
            <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <Package className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-xs opacity-90">Total Produk</p>
              <p className="text-2xl font-bold mt-1">{stats.totalProducts}</p>
            </div>
            <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <ShoppingBag className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-xs opacity-90">Pesanan Aktif</p>
              <p className="text-2xl font-bold mt-1">{stats.activeOrders}</p>
            </div>
          </div>

          {/* Rating & Total Sales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-bold text-text-primary flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-yellow-500" />
                Rating Toko
              </h3>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-primary">
                  {stats.avgRating.toFixed(1)}
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(stats.avgRating)
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-text-secondary">
                    {stats.totalReviews} ulasan
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-text-primary flex items-center gap-2 mb-3">
                <Award className="w-5 h-5 text-primary" />
                Total Penjualan
              </h3>
              <p className="text-2xl font-bold text-text-primary">
                {formatCurrency(stats.totalSales)}
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Dari {stats.totalOrders} pesanan
              </p>
            </div>
          </div>
        </>
      )}

      {/* Sales Chart */}
      {chart.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Performa Penjualan
              </h3>
              <p className="text-xs text-text-secondary mt-1">7 hari terakhir</p>
            </div>
            <div className="flex gap-1 bg-surface rounded-lg p-1">
              <button
                onClick={() => setChartMode('revenue')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  chartMode === 'revenue'
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Pendapatan
              </button>
              <button
                onClick={() => setChartMode('orders')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  chartMode === 'orders'
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Pesanan
              </button>
            </div>
          </div>

          <SalesLineChart data={chart} height={250} mode={chartMode} />
        </div>
      )}

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Produk Terlaris
          </h3>
          <div className="space-y-3">
            {topProducts.map((product, idx) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-3 bg-surface rounded-xl hover:bg-surface-hover transition-colors cursor-pointer"
                onClick={() => router.push(`/produk/${product.id}`)}
              >
                {/* Rank Badge */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    idx === 0
                      ? 'bg-yellow-400 text-white'
                      : idx === 1
                      ? 'bg-gray-400 text-white'
                      : idx === 2
                      ? 'bg-orange-400 text-white'
                      : 'bg-surface text-text-secondary'
                  }`}
                >
                  #{idx + 1}
                </div>

                {/* Product Image */}
                <div className="w-14 h-14 bg-background rounded-lg overflow-hidden flex-shrink-0 border border-border">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-text-muted" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {product.totalSold.toLocaleString('id-ID')} terjual • Stok: {product.stock}
                  </p>
                  {product.reviewCount > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs text-text-secondary">
                        {product.avgRating.toFixed(1)} ({product.reviewCount})
                      </span>
                    </div>
                  )}
                </div>

                {/* Revenue */}
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-primary text-sm">
                    {formatCurrency(product.totalRevenue)}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {formatCurrency(product.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!stats && chart.length === 0 && topProducts.length === 0 && !error && (
        <div className="card text-center py-16">
          <Package className="w-16 h-16 mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">Belum ada data untuk ditampilkan</p>
        </div>
      )}
    </div>
  );
}
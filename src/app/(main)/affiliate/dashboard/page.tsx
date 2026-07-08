'use client';

import { useEffect, useState, useCallback , useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  Award, TrendingUp, DollarSign, MousePointer, ShoppingCart,
  Copy, Share2, ExternalLink, Loader2, RefreshCw, ArrowRight,
  CheckCircle, Clock, XCircle, AlertCircle
} from 'lucide-react';
import {
  FaWhatsapp, FaFacebook, FaTwitter, FaInstagram
} from 'react-icons/fa';

interface AffiliateStats {
  totalClicks: number;
  totalTransactions: number;
  totalCommission: number;
  availableBalance: number;
  withdrawnAmount: number;
  commissionRate: number;
  referralCode: string;
}

interface Transaction {
  id: number;
  orderId: number;
  orderNumber: string;
  productName: string;
  nominalTransaksi: number;
  komisi: number;
  status: string;
  createdAt: string;
}

interface ChartData {
  date: string;
  label: string;
  transactions: number;
  commission: number;
}

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const res = await fetch('/api/affiliate/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      setStats(result.data.stats);
      setRecentTransactions(result.data.recentTransactions);
      setChartData(result.data.chartData);
    } catch (error: any) {
      console.error('Fetch dashboard error:', error);
      toast.error(error.message || 'Gagal memuat dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboard();
    }
  }, [isAuthenticated, fetchDashboard]);

  const copyReferralLink = async () => {
    if (!stats?.referralCode) return;

    setIsCopying(true);
    try {
      const baseUrl = window.location.origin;
      const link = `${baseUrl}?ref=${stats.referralCode}`;
      await navigator.clipboard.writeText(link);
      toast.success('Link referral berhasil disalin!');
    } catch (error) {
      toast.error('Gagal menyalin link');
    } finally {
      setIsCopying(false);
    }
  };

  const shareToWhatsApp = () => {
    if (!stats?.referralCode) return;
    
    const baseUrl = window.location.origin;
    const link = `${baseUrl}?ref=${stats.referralCode}`;
    const text = `🛒 Belanja produk pertanian segar di Agri-X!\n\nGunakan kode referral saya: ${stats.referralCode}\n\n${link}\n\nDapatkan diskon spesial! 🎉`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareToFacebook = () => {
    if (!stats?.referralCode) return;
    
    const baseUrl = window.location.origin;
    const link = `${baseUrl}?ref=${stats.referralCode}`;
    
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { icon: any; color: string; label: string }> = {
      pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: 'Pending' },
      completed: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'Selesai' },
      cancelled: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Dibatalkan' },
      refunded: { icon: AlertCircle, color: 'text-orange-600 bg-orange-50', label: 'Refund' },
    };

    const { icon: Icon, color, label } = config[status] || config.pending;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/login?callbackUrl=/affiliate/dashboard');
    return null;
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center max-w-200">
          <Award className="w-16 h-16 mx-auto text-text-muted mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">
            Belum Terdaftar Affiliate
          </h2>
          <p className="text-text-secondary mb-4">
            Anda belum terdaftar sebagai affiliate. Daftar sekarang untuk mulai mendapatkan komisi!
          </p>
          <button
            onClick={() => router.push('/affiliate/apply')}
            className="btn-primary"
          >
            Daftar Affiliate
          </button>
        </div>
      </div>
    );
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = `${baseUrl}?ref=${stats.referralCode}`;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
              <Award className="w-8 h-8 text-primary" />
              Dashboard Affiliate
            </h1>
            <p className="text-text-secondary mt-1">
              Pantau performa dan komisi Anda
            </p>
          </div>
          <button
            onClick={fetchDashboard}
            className="btn-outline flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total Klik</p>
                <p className="text-3xl font-bold mt-1">{stats.totalClicks.toLocaleString('id-ID')}</p>
              </div>
              <MousePointer className="w-10 h-10 text-white/30" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total Transaksi</p>
                <p className="text-3xl font-bold mt-1">{stats.totalTransactions}</p>
              </div>
              <ShoppingCart className="w-10 h-10 text-white/30" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total Komisi</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalCommission)}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-white/30" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Saldo Tersedia</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(stats.availableBalance)}</p>
              </div>
              <DollarSign className="w-10 h-10 text-white/30" />
            </div>
            <button
              onClick={() => router.push('/affiliate/withdraw')}
              className="mt-3 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              Tarik Saldo
            </button>
          </div>
        </div>

        {/* Referral Link Card */}
        <div className="card">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Link Referral Anda
          </h2>

          <div className="space-y-4">
            {/* Link Display */}
            <div className="flex items-center gap-2 p-3 bg-surface rounded-xl">
              <code className="flex-1 text-sm text-text-primary font-mono break-all">
                {referralLink}
              </code>
              <button
                onClick={copyReferralLink}
                disabled={isCopying}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors flex-shrink-0"
                title="Copy link"
              >
                <Copy className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {/* Kode Referral */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">Kode:</span>
              <code className="px-3 py-1 bg-primary/10 text-primary rounded-lg font-mono font-bold">
                {stats.referralCode}
              </code>
              <span className="text-sm text-text-secondary">
                (Komisi {stats.commissionRate}% per transaksi)
              </span>
            </div>

            {/* Share Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={shareToWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                <FaWhatsapp className="w-5 h-5" />
                Share WhatsApp
              </button>
              <button
                onClick={shareToFacebook}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <FaFacebook className="w-5 h-5" />
                Share Facebook
              </button>
              <button
                onClick={copyReferralLink}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <Copy className="w-5 h-5" />
                Copy Link
              </button>
            </div>
          </div>
        </div>

        {/* Chart & Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart */}
          <div className="card">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Performa 7 Hari Terakhir
            </h2>

            {chartData.length > 0 ? (
              <div className="space-y-3">
                {chartData.map((day, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-sm text-text-secondary w-16 flex-shrink-0">
                      {day.label}
                    </span>
                    <div className="flex-1 h-8 bg-surface rounded-lg overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-secondary transition-all"
                        style={{
                          width: `${Math.min((day.commission / Math.max(...chartData.map(d => d.commission), 1)) * 100, 100)}%`,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span className="text-xs font-semibold text-text-primary">
                          {formatCurrency(day.commission)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-text-secondary w-20 text-right">
                      {day.transactions} trx
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-secondary">
                <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Belum ada data transaksi</p>
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Transaksi Terbaru
              </h2>
              <button
                onClick={() => router.push('/affiliate/transactions')}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Lihat Semua
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.map((trx) => (
                  <div key={trx.id} className="p-3 bg-surface rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">
                          {trx.productName}
                        </p>
                        <p className="text-xs text-text-secondary">
                          Order #{trx.orderNumber || trx.orderId}
                        </p>
                      </div>
                      {getStatusBadge(trx.status)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">
                        {formatCurrency(trx.nominalTransaksi)}
                      </span>
                      <span className="font-bold text-green-600">
                        +{formatCurrency(trx.komisi)}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {format(new Date(trx.createdAt), 'dd MMM yyyy, HH:mm', { locale: id })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-secondary">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Belum ada transaksi</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
// File: src/app/(main)/affiliate/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { 
  TrendingUp, Users, ShoppingBag, Eye, Wallet, 
  Copy, Check, ArrowRight, Loader2} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface DashboardData {
  referralCode: string;
  balance: number;
  totalClicks: number;
  totalTransactions: number;
  totalCommission: number;
  totalWithdrawn: number;
  recentTransactions: Array<{
    id: number;
    productName: string;
    nominalTransaksi: number;
    komisi: number;
    status: string;
    createdAt: string;
  }>;
}

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/affiliate');
      return;
    }
    fetchDashboard();
  }, [isAuthenticated]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/affiliate/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await res.json();

      if (!result.success) {
        if (res.status === 404) {
          router.push('/affiliate/apply');
          return;
        }
        throw new Error(result.error);
      }

      setData(result.data);
    } catch (error: any) {
      console.error('Error fetching dashboard:', error);
      toast.error(error.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = async () => {
    if (!data) return;
    const link = `${window.location.origin}/ref/${data.referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/ref/${data.referralCode}`;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Affiliate Dashboard
          </h1>
          <p className="text-text-secondary">
            Kelola referral dan pantau komisi Anda
          </p>
        </div>

        {/* Referral Link Card */}
        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Copy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary">Link Referral Anda</h2>
              <p className="text-sm text-text-secondary">Bagikan untuk mendapatkan komisi</p>
            </div>
          </div>

          <div className="bg-surface rounded-xl p-4 mb-4 border border-border">
            <p className="text-sm text-text-primary font-mono break-all">
              {referralLink}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyReferralLink}
              className="btn-primary flex-1"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Tersalin!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Salin Link
                </>
              )}
            </button>
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-linear-to-br from-primary to-secondary rounded-3xl p-6 text-white mb-6 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Saldo Tersedia</p>
                  <p className="text-xs text-white/60">Dapat ditarik kapan saja</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/affiliate/withdrawals/new')}
                className="bg-white text-primary px-4 py-2 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all hover:shadow-lg active:scale-95"
              >
                <ArrowRight className="w-4 h-4 inline mr-1" />
                Tarik Saldo
              </button>
            </div>

            <div className="mb-6">
              <p className="text-4xl font-bold mb-1">
                {formatCurrency(data.balance)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-white/80" />
                  <p className="text-xs text-white/80">Total Komisi</p>
                </div>
                <p className="text-lg font-semibold">
                  {formatCurrency(data.totalCommission)}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRight className="w-4 h-4 text-white/80" />
                  <p className="text-xs text-white/80">Sudah Ditarik</p>
                </div>
                <p className="text-lg font-semibold">
                  {formatCurrency(data.totalWithdrawn)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-text-primary">
                {data.totalClicks.toLocaleString('id-ID')}
              </p>
              <p className="text-sm text-text-secondary">Total Klik</p>
            </div>
          </div>

          <div className="card hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-text-primary">
                {data.totalTransactions.toLocaleString('id-ID')}
              </p>
              <p className="text-sm text-text-secondary">Total Transaksi</p>
            </div>
          </div>

          <div className="card hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-text-primary">
                {formatCurrency(data.totalCommission)}
              </p>
              <p className="text-sm text-text-secondary">Total Komisi</p>
            </div>
          </div>

          <div className="card hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-text-primary">
                {data.totalClicks.toLocaleString('id-ID')}
              </p>
              <p className="text-sm text-text-secondary">Total Referral</p>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">
              Transaksi Terbaru
            </h2>
            <button
              onClick={() => router.push('/affiliate/transactions')}
              className="text-primary font-semibold text-sm flex items-center gap-1 hover:underline"
            >
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {data.recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {data.recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start gap-4 p-4 bg-surface/50 rounded-xl hover:bg-surface transition-colors"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-6 h-6 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-text-primary truncate">
                        {transaction.productName}
                      </h4>
                      <span className={`badge ${
                        transaction.status === 'completed' ? 'badge-success' :
                        transaction.status === 'pending' ? 'badge-warning' :
                        'badge-danger'
                      }`}>
                        {transaction.status === 'completed' ? 'Selesai' :
                         transaction.status === 'pending' ? 'Pending' :
                         'Dibatalkan'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-text-secondary mb-2">
                      <span>
                        {format(new Date(transaction.createdAt), 'dd MMM yyyy', { locale: id })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-text-muted">Nilai Transaksi</p>
                        <p className="font-semibold text-text-primary">
                          {formatCurrency(transaction.nominalTransaksi)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-muted">Komisi Anda</p>
                        <p className="font-bold text-primary">
                          {formatCurrency(transaction.komisi)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <ShoppingBag className="w-16 h-16 mx-auto text-text-muted mb-4" />
              <p className="text-text-secondary mb-2">Belum ada transaksi</p>
              <p className="text-sm text-text-muted">
                Transaksi referral Anda akan muncul di sini
              </p>
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
// src/app/(main)/affiliate/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  Users, DollarSign, TrendingUp, ShoppingBag,
  Copy, ExternalLink, Loader2, CheckCircle, XCircle,
  Clock, Banknote, ArrowUpRight
} from 'lucide-react';

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    bank: '',
    noRekening: '',
    namaPemilik: '',
    nominal: '',
  });
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/affiliate/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboard();
    }
  }, [isAuthenticated]);

  const fetchDashboard = async () => {
    try {
      setIsLoadingData(true);
      const token = getCookie('accessToken');
      const res = await fetch('/api/affiliate/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      setDashboard(result.data);
    } catch (error: any) {
      toast.error(error.message);
      if (error.message.includes('belum menjadi affiliate')) {
        router.push('/affiliate');
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(dashboard.referralLink);
    toast.success('Link referral disalin!');
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!withdrawForm.bank || !withdrawForm.noRekening || !withdrawForm.namaPemilik || !withdrawForm.nominal) {
      toast.error('Semua field harus diisi');
      return;
    }

    setIsWithdrawing(true);
    try {
      const token = getCookie('accessToken');
      const res = await fetch('/api/affiliate/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...withdrawForm,
          nominal: Number(withdrawForm.nominal),
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      toast.success('Permintaan penarikan berhasil dikirim');
      setShowWithdrawModal(false);
      setWithdrawForm({ bank: '', noRekening: '', namaPemilik: '', nominal: '' });
      fetchDashboard();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      completed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Selesai' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'Pending' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle, label: 'Dibatalkan' },
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Selesai' },
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'Pending' },
      FAILED: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle, label: 'Gagal' },
    };
    const { bg, text, icon: Icon, label } = config[status] || config.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Dashboard Affiliate</h1>
            <p className="text-text-secondary">Pantau performa dan komisi Anda</p>
          </div>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Banknote className="w-4 h-4" />
            Tarik Saldo
          </button>
        </div>

        {/* Referral Link */}
        <div className="card bg-gradient-to-br from-primary to-secondary text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-white/80 text-sm mb-1">Link Referral Anda</p>
              <p className="font-mono text-lg">{dashboard.referralLink}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyReferralLink}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Salin
              </button>
              <a
                href={dashboard.referralLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white text-primary rounded-lg flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Buka
              </a>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Total Klik</p>
                <p className="text-3xl font-bold text-text-primary mt-1">
                  {dashboard.stats.totalClicks}
                </p>
              </div>
              <Users className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Total Transaksi</p>
                <p className="text-3xl font-bold text-text-primary mt-1">
                  {dashboard.stats.totalTransactions}
                </p>
              </div>
              <ShoppingBag className="w-10 h-10 text-purple-500" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Total Komisi</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {formatCurrency(dashboard.stats.totalCommission)}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Saldo Tersedia</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(dashboard.stats.availableBalance)}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  Pending: {formatCurrency(dashboard.stats.pendingCommission)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-white/30" />
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <h3 className="text-lg font-bold text-text-primary mb-4">Transaksi Terbaru</h3>
          {dashboard.recentTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Produk</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Nominal</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Komisi</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Status</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dashboard.recentTransactions.map((t: any) => (
                    <tr key={t.id} className="hover:bg-surface/50">
                      <td className="py-3 px-3 text-sm text-text-primary">{t.productName}</td>
                      <td className="py-3 px-3 text-sm font-semibold">{formatCurrency(t.nominalTransaksi)}</td>
                      <td className="py-3 px-3 text-sm font-semibold text-green-500">
                        {formatCurrency(t.komisi)}
                        <span className="text-xs text-text-secondary ml-1">({t.persenKomisi}%)</span>
                      </td>
                      <td className="py-3 px-3">{getStatusBadge(t.status)}</td>
                      <td className="py-3 px-3 text-xs text-text-secondary">
                        {format(new Date(t.createdAt), 'dd MMM yyyy', { locale: id })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-text-secondary py-8">Belum ada transaksi</p>
          )}
        </div>

        {/* Recent Withdrawals */}
        <div className="card">
          <h3 className="text-lg font-bold text-text-primary mb-4">Riwayat Penarikan</h3>
          {dashboard.recentWithdrawals.length > 0 ? (
            <div className="space-y-3">
              {dashboard.recentWithdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-4 bg-surface rounded-xl">
                  <div>
                    <p className="font-medium text-text-primary">{w.bank} - {w.noRekening}</p>
                    <p className="text-xs text-text-secondary">{w.namaPemilik}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-text-primary">{formatCurrency(w.nominal)}</p>
                    {getStatusBadge(w.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-text-secondary py-8">Belum ada penarikan</p>
          )}
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-text-primary mb-4">Tarik Saldo</h2>
              
              <div className="bg-surface rounded-xl p-4 mb-4">
                <p className="text-sm text-text-secondary">Saldo Tersedia</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(dashboard.stats.availableBalance)}
                </p>
              </div>

              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Bank</label>
                  <select
                    value={withdrawForm.bank}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, bank: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">Pilih Bank</option>
                    <option value="BCA">BCA</option>
                    <option value="BNI">BNI</option>
                    <option value="BRI">BRI</option>
                    <option value="Mandiri">Mandiri</option>
                    <option value="Dana">Dana</option>
                    <option value="OVO">OVO</option>
                    <option value="GoPay">GoPay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">No. Rekening</label>
                  <input
                    type="text"
                    value={withdrawForm.noRekening}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, noRekening: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Nama Pemilik</label>
                  <input
                    type="text"
                    value={withdrawForm.namaPemilik}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, namaPemilik: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Nominal</label>
                  <input
                    type="number"
                    value={withdrawForm.nominal}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, nominal: e.target.value })}
                    className="input"
                    min="50000"
                    required
                  />
                  <p className="text-xs text-text-secondary mt-1">Minimal Rp 50.000</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowWithdrawModal(false)}
                    className="btn-outline flex-1"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isWithdrawing}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    {isWithdrawing ? 'Memproses...' : 'Tarik Saldo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
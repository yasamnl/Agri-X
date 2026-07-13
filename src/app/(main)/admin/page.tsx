// src/app/(main)/admin/page.tsx
'use client';

import { useEffect, useState , useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminStatsCard } from '@/components/admin/AdminStatsCard';
import { AdminModal } from '@/components/admin/AdminModal';
import { getCookie } from '@/lib/auth';
import { 
  Users, Package, ShoppingCart, AlertTriangle, 
  TrendingUp, DollarSign, Menu, Bell, Loader2,
  Send, CheckCircle, XCircle, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalTransactions: number;
  totalRevenue: number;
  pendingReports: number;
  pendingProducts: number;
}

interface RecentActivity {
  id: number;
  type: 'user' | 'product' | 'transaction' | 'report';
  title: string;
  description: string;
  timestamp: string;
  status: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Broadcast modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    targetAudience: 'all' as 'all' | 'sellers' | 'buyers' | 'affiliates',
  });
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/admin');
      return;
    }

    if (user && user.role !== 'admin') {
      toast.error('Akses ditolak. Halaman ini hanya untuk admin.');
      router.push('/');
      return;
    }

    if (isAuthenticated && user?.role === 'admin') {
      fetchDashboardData();
    }
  }, [isAuthenticated, authLoading, user, router]);

  // ✅ Fetch dashboard data dengan direct fetch
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }

      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal memuat data dashboard');
      }

      setStats(result.data?.stats || null);
      setRecentActivities(result.data?.recentActivities || []);
    } catch (error: any) {
      console.error('Fetch dashboard error:', error);
      toast.error(error.message || 'Gagal memuat data dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Handle broadcast dengan direct fetch
  const handleBroadcast = async () => {
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      toast.error('Judul dan pesan wajib diisi');
      return;
    }

    try {
      setIsBroadcasting(true);
      const token = getCookie('accessToken');
      
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }

      const res = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(broadcastForm),
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal mengirim notifikasi');
      }

      toast.success(result.message || 'Notifikasi berhasil dikirim');
      setShowBroadcastModal(false);
      setBroadcastForm({ title: '', message: '', targetAudience: 'all' });
    } catch (error: any) {
      toast.error(error.message || 'Gagal mengirim notifikasi');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user': return Users;
      case 'product': return Package;
      case 'transaction': return ShoppingCart;
      case 'report': return AlertTriangle;
      default: return Bell;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: 'Pending' },
      approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: 'Disetujui' },
      rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: 'Ditolak' },
      completed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', label: 'Selesai' },
    };

    const config = statusMap[status] || statusMap.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-text-secondary">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <main className="flex-1 lg:ml-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-surface rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">Dashboard Admin</h1>
                <p className="text-sm text-text-secondary">
                  {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowBroadcastModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Kirim Pengumuman</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-8 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminStatsCard
              title="Total User"
              value={stats?.totalUsers || 0}
              icon={Users}
              color="blue"
              trend={{ value: 12, isPositive: true }}
            />
            <AdminStatsCard
              title="Total Produk"
              value={stats?.totalProducts || 0}
              icon={Package}
              color="green"
              trend={{ value: 8, isPositive: true }}
            />
            <AdminStatsCard
              title="Total Transaksi"
              value={stats?.totalTransactions || 0}
              icon={ShoppingCart}
              color="purple"
              trend={{ value: 15, isPositive: true }}
            />
            <AdminStatsCard
              title="Pendapatan"
              value={formatCurrency(stats?.totalRevenue || 0)}
              icon={DollarSign}
              color="orange"
              trend={{ value: 20, isPositive: true }}
            />
          </div>

          {/* Pending Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-yellow-500/20 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                    Laporan Pending
                  </p>
                  <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-200">
                    {stats?.pendingReports || 0}
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/reports')}
                className="mt-4 w-full btn-outline border-yellow-300 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
              >
                Tinjau Laporan
              </button>
            </div>

            <div className="card bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-orange-500/20 rounded-2xl flex items-center justify-center">
                  <Package className="w-7 h-7 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-orange-800 dark:text-orange-300 font-medium">
                    Produk Pending
                  </p>
                  <p className="text-3xl font-bold text-orange-900 dark:text-orange-200">
                    {stats?.pendingProducts || 0}
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/products')}
                className="mt-4 w-full btn-outline border-orange-300 text-orange-800 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/20"
              >
                Tinjau Produk
              </button>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-primary">Aktivitas Terbaru</h2>
              <button className="text-primary hover:underline text-sm font-medium">
                Lihat Semua
              </button>
            </div>

            <div className="space-y-3">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-4 bg-surface/50 rounded-xl hover:bg-surface transition-colors"
                    >
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-text-primary">
                            {activity.title}
                          </h4>
                          {getStatusBadge(activity.status)}
                        </div>
                        <p className="text-sm text-text-secondary mb-2">
                          {activity.description}
                        </p>
                        <p className="text-xs text-text-muted">
                          {format(new Date(activity.timestamp), 'dd MMM yyyy, HH:mm', { locale: id })}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10">
                  <Bell className="w-16 h-16 mx-auto text-text-muted mb-4" />
                  <p className="text-text-secondary">Belum ada aktivitas terbaru</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Broadcast Modal */}
      <AdminModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        title="Kirim Pengumuman"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Judul Pengumuman <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={broadcastForm.title}
              onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
              placeholder="Contoh: Maintenance Jadwal, Promo Spesial"
              className="input"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Target Penerima
            </label>
            <select
              value={broadcastForm.targetAudience}
              onChange={(e) => setBroadcastForm({ 
                ...broadcastForm, 
                targetAudience: e.target.value as any 
              })}
              className="input"
            >
              <option value="all">Semua User</option>
              <option value="sellers">Penjual</option>
              <option value="buyers">Pembeli</option>
              <option value="affiliates">Affiliate</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Pesan <span className="text-red-500">*</span>
            </label>
            <textarea
              value={broadcastForm.message}
              onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
              placeholder="Tulis pesan pengumuman..."
              className="input min-h-[150px]"
              maxLength={500}
            />
            <p className="text-xs text-text-secondary mt-1">
              {broadcastForm.message.length}/500 karakter
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowBroadcastModal(false)}
              className="btn-outline flex-1"
              disabled={isBroadcasting}
            >
              Batal
            </button>
            <button
              onClick={handleBroadcast}
              disabled={isBroadcasting}
              className="btn-primary flex-1"
            >
              {isBroadcasting ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengirim...</span>
                </div>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Kirim Pengumuman
                </>
              )}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
// src/app/(main)/admin/affiliates/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';

// ✅ Import Sidebar
import { AdminSidebar } from '@/components/admin/AdminSidebar';

// Lucide Icons
import {
  Users, Clock, CheckCircle, XCircle, Search, Eye,
  ChevronLeft, ChevronRight, Loader2, X, Award, AlertCircle,
  ExternalLink, Mail, Phone, BarChart3, RefreshCw, TrendingUp,
  DollarSign, ShoppingCart, Filter, Menu
} from 'lucide-react';

// React Icons
import {
  FaMoneyBillWave,
  FaChartLine,
  FaInstagram,
  FaTiktok,
  FaYoutube,
  FaTwitter,
  FaGlobe,
  FaPaperPlane,
  FaCheck,
  FaTimes,
  FaCopy
} from 'react-icons/fa';

// ============================================================================
// TYPES
// ============================================================================
interface SosmedAccount {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'website';
  username: string;
  url: string;
  followers?: number;
}

interface AffiliateApplication {
  id: number;
  userId: number;
  sosmedAccounts: SosmedAccount[];
  status: 'pending' | 'approved' | 'rejected';
  approvedAt: string | null;
  rejectedAt: string | null;
  referralCode: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone: string;
    avatar: string | null;
  };
  stats: {
    totalOrders: number;
    totalRevenue: number;
    totalCommission: number;
  };
}

interface AffiliateStats {
  totalApplications: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalRevenue: number;
  totalCommission: number;
  topAffiliates: Array<{
    userId: number;
    name: string;
    referralCode: string;
    totalOrders: number;
    totalRevenue: number;
    totalCommission: number;
  }>;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua', color: 'bg-gray-500' },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'approved', label: 'Disetujui', color: 'bg-green-500' },
  { value: 'rejected', label: 'Ditolak', color: 'bg-red-500' },
];

const SOCIAL_MEDIA_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  instagram: { icon: FaInstagram, color: 'text-pink-500', label: 'Instagram' },
  tiktok: { icon: FaTiktok, color: 'text-gray-800 dark:text-white', label: 'TikTok' },
  youtube: { icon: FaYoutube, color: 'text-red-600', label: 'YouTube' },
  twitter: { icon: FaTwitter, color: 'text-blue-400', label: 'Twitter' },
  website: { icon: FaGlobe, color: 'text-blue-500', label: 'Website' },
};

// ============================================================================
// HELPERS
// ============================================================================
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
};

const formatCompactNumber = (num: number): string => {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return num.toString();
};

const getStatusBadge = (status: string) => {
  const config: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    pending: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-300',
      icon: Clock,
      label: 'Pending',
    },
    approved: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-300',
      icon: CheckCircle,
      label: 'Disetujui',
    },
    rejected: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-300',
      icon: XCircle,
      label: 'Ditolak',
    },
  };

  const { bg, text, icon: Icon, label } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

const safeParseSosmed = (data: any): SosmedAccount[] => {
  try {
    if (!data) return [];
    if (typeof data === 'string') return JSON.parse(data);
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function AdminAffiliatesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // ✅ State untuk sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [applications, setApplications] = useState<AffiliateApplication[]>([]);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [selectedApp, setSelectedApp] = useState<AffiliateApplication | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ============================================================================
  // AUTH CHECK
  // ============================================================================
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast.error('Akses ditolak. Halaman ini hanya untuk admin.');
      router.push('/');
    }
  }, [isAuthenticated, authLoading, user, router]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchAffiliates();
      fetchStats();
    }
  }, [isAuthenticated, user, currentPage, statusFilter, searchQuery]);

  const fetchAffiliates = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        status: statusFilter,
      });

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await fetch(`/api/admin/affiliates?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Gagal memuat data');

      const parsedApps = (result.data?.applications || []).map((app: any) => ({
        ...app,
        sosmedAccounts: safeParseSosmed(app.sosmedAccounts),
      }));

      setApplications(parsedApps);
      setTotalPages(result.data?.pagination?.totalPages || 1);
    } catch (error: any) {
      console.error('Fetch affiliates error:', error);
      toast.error(error.message || 'Gagal memuat data affiliate');
      setApplications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = getCookie('accessToken');
      if (!token) return;

      const res = await fetch('/api/admin/affiliates/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error: any) {
      console.error('Fetch stats error:', error);
    }
  };

  const refreshData = () => {
    fetchAffiliates();
    fetchStats();
  };

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================
  const handleApprove = async () => {
    if (!selectedApp) return;

    setIsActionLoading(true);
    try {
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const res = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          action: 'approve',
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Gagal menyetujui aplikasi');

      toast.success(`Aplikasi affiliate ${selectedApp.user.name} berhasil disetujui!`);
      setShowActionModal(false);
      setShowDetailModal(false);
      refreshData();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyetujui aplikasi');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;

    if (!rejectionReason.trim()) {
      toast.error('Mohon isi alasan penolakan');
      return;
    }

    setIsActionLoading(true);
    try {
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const res = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          action: 'reject',
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Gagal menolak aplikasi');

      toast.success('Aplikasi affiliate berhasil ditolak');
      setShowActionModal(false);
      setShowDetailModal(false);
      setRejectionReason('');
      refreshData();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menolak aplikasi');
    } finally {
      setIsActionLoading(false);
    }
  };

  const openDetailModal = (app: AffiliateApplication) => {
    setSelectedApp(app);
    setShowDetailModal(true);
  };

  const openActionModal = (app: AffiliateApplication, type: 'approve' | 'reject') => {
    setSelectedApp(app);
    setActionType(type);
    setRejectionReason('');
    setShowActionModal(true);
    setShowDetailModal(false);
  };

  const copyReferralCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Kode referral disalin!');
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-background flex">
      {/* ✅ Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* ✅ Main Content */}
      <main className="flex-1 lg:ml-0">
        
        {/* ✅ Mobile Header */}
        <div className="lg:hidden sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-text-primary" />
          </button>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Manajemen Affiliate
          </h1>
          <button
            onClick={refreshData}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-text-primary" />
          </button>
        </div>

        <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
          
          {/* ✅ Desktop Header */}
          <div className="hidden lg:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
                <Award className="w-8 h-8 text-primary" />
                Manajemen Affiliate
              </h1>
              <p className="text-text-secondary mt-1">
                Kelola aplikasi dan performa affiliate
              </p>
            </div>
            <button
              onClick={refreshData}
              className="btn-outline flex items-center gap-2 self-start"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* ==================================================================
              STATISTICS CARDS
              ================================================================== */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm">Total Aplikasi</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalApplications}</p>
                  </div>
                  <Users className="w-10 h-10 text-white/30" />
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <span className="bg-white/20 px-2 py-0.5 rounded-full">
                    {stats.pendingCount} pending
                  </span>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm">Affiliate Aktif</p>
                    <p className="text-3xl font-bold mt-1">{stats.approvedCount}</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-white/30" />
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <span className="bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <FaChartLine className="w-3 h-3" /> Aktif
                  </span>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm">Total Revenue</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalRevenue)}</p>
                  </div>
                  <FaMoneyBillWave className="w-10 h-10 text-white/30" />
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <TrendingUp className="w-3 h-3" />
                  <span>Dari semua affiliate</span>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm">Total Komisi</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalCommission)}</p>
                  </div>
                  <DollarSign className="w-10 h-10 text-white/30" />
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <FaMoneyBillWave className="w-3 h-3" />
                  <span>Dibayarkan ke affiliate</span>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              TOP AFFILIATES
              ================================================================== */}
          {stats?.topAffiliates && stats.topAffiliates.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Top 5 Affiliate
                </h3>
                <FaChartLine className="w-5 h-5 text-text-secondary" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface">
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Rank</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Affiliate</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Kode</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Orders</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Revenue</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Komisi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.topAffiliates.map((affiliate, idx) => (
                      <tr key={affiliate.userId} className="hover:bg-surface/50">
                        <td className="py-2 px-3">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-yellow-400 text-white' :
                            idx === 1 ? 'bg-gray-400 text-white' :
                            idx === 2 ? 'bg-orange-400 text-white' :
                            'bg-surface text-text-secondary'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-medium text-text-primary text-sm">{affiliate.name}</p>
                        </td>
                        <td className="py-2 px-3">
                          <code className="px-2 py-0.5 bg-surface rounded text-xs font-mono">
                            {affiliate.referralCode}
                          </code>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-text-primary text-sm">
                            {formatCompactNumber(affiliate.totalOrders)}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-primary text-sm">
                            {formatCurrency(affiliate.totalRevenue)}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-green-500 text-sm">
                            {formatCurrency(affiliate.totalCommission)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================================================================
              FILTER & SEARCH
              ================================================================== */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-text-primary">Filter Aplikasi</h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Cari nama, email, atau kode referral..."
                  className="input pl-12"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto">
                {STATUS_OPTIONS.map((option) => {
                  const isActive = statusFilter === option.value;
                  const count =
                    option.value === 'all'
                      ? stats?.totalApplications || 0
                      : option.value === 'pending'
                      ? stats?.pendingCount || 0
                      : option.value === 'approved'
                      ? stats?.approvedCount || 0
                      : stats?.rejectedCount || 0;

                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setStatusFilter(option.value);
                        setCurrentPage(1);
                      }}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
                        isActive
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-surface text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${option.color}`} />
                      <span className="text-sm">{option.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        isActive ? 'bg-white/20' : 'bg-border'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ==================================================================
              APPLICATIONS TABLE
              ================================================================== */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : applications.length > 0 ? (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface border-b border-border">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">User</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Kode Referral</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Sosial Media</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Tanggal</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {applications.map((app) => (
                        <tr key={app.id} className="hover:bg-surface/50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold flex-shrink-0 overflow-hidden">
                                {app.user.avatar ? (
                                  <img src={app.user.avatar} alt={app.user.name} className="w-full h-full object-cover" />
                                ) : (
                                  app.user.name?.charAt(0).toUpperCase() || 'U'
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-text-primary truncate max-w-[150px]">
                                  {app.user.name}
                                </p>
                                <p className="text-xs text-text-secondary truncate max-w-[150px]">
                                  {app.user.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <code className="px-2 py-1 bg-surface rounded text-sm font-mono">
                                {app.referralCode}
                              </code>
                              <button
                                onClick={() => copyReferralCode(app.referralCode)}
                                className="p-1 hover:bg-surface-hover rounded transition-colors"
                                title="Copy"
                              >
                                <FaCopy className="w-3 h-3 text-text-secondary" />
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-1">
                              {app.sosmedAccounts.slice(0, 4).map((sosmed, idx) => {
                                const config = SOCIAL_MEDIA_CONFIG[sosmed.platform];
                                if (!config) return null;
                                const Icon = config.icon;
                                return (
                                  <div
                                    key={idx}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface hover:bg-surface-hover transition-colors"
                                    title={config.label}
                                  >
                                    <Icon className={`w-4 h-4 ${config.color}`} />
                                  </div>
                                );
                              })}
                              {app.sosmedAccounts.length > 4 && (
                                <span className="text-xs text-text-secondary ml-1">
                                  +{app.sosmedAccounts.length - 4}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">{getStatusBadge(app.status)}</td>
                          <td className="py-4 px-4">
                            <p className="text-sm text-text-primary">
                              {format(new Date(app.createdAt), 'dd MMM yyyy', { locale: id })}
                            </p>
                            <p className="text-xs text-text-secondary">
                              {format(new Date(app.createdAt), 'HH:mm', { locale: id })}
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openDetailModal(app)}
                                className="btn-outline px-3 py-1 text-sm"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Detail
                              </button>
                              {app.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => openActionModal(app, 'approve')}
                                    className="p-2 hover:bg-green-500/10 rounded-lg transition-colors text-green-500"
                                    title="Setujui"
                                  >
                                    <FaCheck className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openActionModal(app, 'reject')}
                                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-500"
                                    title="Tolak"
                                  >
                                    <FaTimes className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3 p-4">
                  {applications.map((app) => (
                    <div key={app.id} className="bg-surface rounded-xl p-4 border border-border">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold overflow-hidden flex-shrink-0">
                            {app.user.avatar ? (
                              <img src={app.user.avatar} alt={app.user.name} className="w-full h-full object-cover" />
                            ) : (
                              app.user.name?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-text-primary">{app.user.name}</p>
                            <p className="text-xs text-text-secondary">{app.user.email}</p>
                          </div>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>

                      <div className="mb-3">
                        <p className="text-xs text-text-secondary mb-1">Kode Referral:</p>
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-background rounded text-sm font-mono">
                            {app.referralCode}
                          </code>
                          <button onClick={() => copyReferralCode(app.referralCode)}>
                            <FaCopy className="w-3 h-3 text-text-secondary" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mb-3">
                        {app.sosmedAccounts.slice(0, 4).map((sosmed, idx) => {
                          const config = SOCIAL_MEDIA_CONFIG[sosmed.platform];
                          if (!config) return null;
                          const Icon = config.icon;
                          return (
                            <div key={idx} className="w-8 h-8 rounded-lg flex items-center justify-center bg-background">
                              <Icon className={`w-4 h-4 ${config.color}`} />
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => openDetailModal(app)}
                        className="btn-outline w-full py-2 text-sm"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Lihat Detail
                      </button>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-4 border-t border-border">
                    <p className="text-sm text-text-secondary">
                      Halaman {currentPage} dari {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="btn-outline px-3 py-1 disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="btn-outline px-3 py-1 disabled:opacity-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20">
                <Award className="w-16 h-16 mx-auto text-text-muted mb-4" />
                <p className="text-text-secondary font-medium">Tidak ada aplikasi affiliate</p>
                <p className="text-sm text-text-muted mt-1">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Coba ubah filter atau kata kunci pencarian'
                    : 'Belum ada affiliate yang mendaftar'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ====================================================================
          DETAIL MODAL
          ==================================================================== */}
      {showDetailModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Detail Aplikasi Affiliate
              </h2>
              <button
                onClick={() => { setShowDetailModal(false); setSelectedApp(null); }}
                className="p-2 hover:bg-surface rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="card bg-surface/50">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Informasi User
                </h3>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-semibold overflow-hidden flex-shrink-0">
                    {selectedApp.user.avatar ? (
                      <img src={selectedApp.user.avatar} alt={selectedApp.user.name} className="w-full h-full object-cover" />
                    ) : (
                      selectedApp.user.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="font-bold text-text-primary text-lg">{selectedApp.user.name}</p>
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Mail className="w-4 h-4" />
                      <span>{selectedApp.user.email}</span>
                    </div>
                    {selectedApp.user.phone && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Phone className="w-4 h-4" />
                        <span>{selectedApp.user.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-text-secondary mb-1">Kode Referral</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-background rounded-lg text-sm font-mono">
                      {selectedApp.referralCode}
                    </code>
                    <button onClick={() => copyReferralCode(selectedApp.referralCode)} className="btn-outline px-3 py-2">
                      <FaCopy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Social Media Accounts */}
              <div className="card bg-surface/50">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <FaGlobe className="w-5 h-5 text-primary" />
                  Akun Sosial Media ({selectedApp.sosmedAccounts.length})
                </h3>
                {selectedApp.sosmedAccounts.length > 0 ? (
                  <div className="space-y-3">
                    {selectedApp.sosmedAccounts.map((sosmed, idx) => {
                      const config = SOCIAL_MEDIA_CONFIG[sosmed.platform];
                      if (!config) return null;
                      const Icon = config.icon;
                      return (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-background rounded-xl">
                          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                            <Icon className={`w-5 h-5 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-text-primary capitalize text-sm">{config.label}</p>
                            <p className="text-xs text-text-secondary truncate">@{sosmed.username}</p>
                          </div>
                          {sosmed.followers !== undefined && (
                            <div className="text-right">
                              <p className="text-xs text-text-secondary">Followers</p>
                              <p className="font-semibold text-text-primary">{formatCompactNumber(sosmed.followers)}</p>
                            </div>
                          )}
                          {sosmed.url && (
                            <a href={sosmed.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-surface rounded-lg transition-colors text-primary">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary italic">Tidak ada akun sosmed</p>
                )}
              </div>

              {/* Stats */}
              {selectedApp.status === 'approved' && selectedApp.stats && (
                <div className="card bg-surface/50">
                  <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Statistik Performa
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-background rounded-xl">
                      <ShoppingCart className="w-6 h-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-text-primary">{selectedApp.stats.totalOrders}</p>
                      <p className="text-xs text-text-secondary mt-1">Pesanan</p>
                    </div>
                    <div className="text-center p-3 bg-background rounded-xl">
                      <FaMoneyBillWave className="w-6 h-6 text-purple-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-primary">{formatCurrency(selectedApp.stats.totalRevenue)}</p>
                      <p className="text-xs text-text-secondary mt-1">Revenue</p>
                    </div>
                    <div className="text-center p-3 bg-background rounded-xl">
                      <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-500">{formatCurrency(selectedApp.stats.totalCommission)}</p>
                      <p className="text-xs text-text-secondary mt-1">Komisi</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status & Dates */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <p className="text-sm text-text-secondary mb-1">Status</p>
                  {getStatusBadge(selectedApp.status)}
                </div>
                <div className="text-right">
                  <p className="text-sm text-text-secondary">Diajukan</p>
                  <p className="font-medium text-text-primary text-sm">
                    {format(new Date(selectedApp.createdAt), 'dd MMM yyyy, HH:mm', { locale: id })}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedApp.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-border">
                  <button onClick={() => openActionModal(selectedApp, 'approve')} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    <FaCheck className="w-4 h-4" /> Setujui Aplikasi
                  </button>
                  <button onClick={() => openActionModal(selectedApp, 'reject')} className="btn-outline flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2">
                    <FaTimes className="w-4 h-4" /> Tolak Aplikasi
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          ACTION MODAL (Approve/Reject)
          ==================================================================== */}
      {showActionModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-background rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                actionType === 'approve' ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                {actionType === 'approve' ? <FaCheck className="w-8 h-8 text-green-500" /> : <FaTimes className="w-8 h-8 text-red-500" />}
              </div>

              <h3 className="text-xl font-bold text-text-primary text-center mb-2">
                {actionType === 'approve' ? 'Setujui Aplikasi?' : 'Tolak Aplikasi?'}
              </h3>

              <p className="text-text-secondary text-center mb-4">
                {actionType === 'approve' ? (
                  <>Aplikasi affiliate dari <strong>{selectedApp.user.name}</strong> akan disetujui dan kode referral <code className="px-1 bg-surface rounded">{selectedApp.referralCode}</code> akan diaktifkan.</>
                ) : (
                  <>Aplikasi affiliate dari <strong>{selectedApp.user.name}</strong> akan ditolak.</>
                )}
              </p>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
                <div className="flex items-start gap-2">
                  <FaPaperPlane className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Notifikasi akan dikirim ke <strong>{selectedApp.user.email}</strong>
                  </p>
                </div>
              </div>

              {actionType === 'reject' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Alasan Penolakan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Jelaskan alasan penolakan..."
                    rows={4}
                    className="input"
                    required
                  />
                  <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Alasan ini akan dikirim ke user
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setShowActionModal(false); setRejectionReason(''); }} disabled={isActionLoading} className="btn-outline flex-1">Batal</button>
                <button
                  onClick={actionType === 'approve' ? handleApprove : handleReject}
                  disabled={isActionLoading || (actionType === 'reject' && !rejectionReason.trim())}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    actionType === 'approve' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (actionType === 'approve' ? <FaCheck className="w-4 h-4" /> : <FaTimes className="w-4 h-4" />)}
                  Konfirmasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
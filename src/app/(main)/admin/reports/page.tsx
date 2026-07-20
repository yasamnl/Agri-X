'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  AlertCircle, Search, Eye, CheckCircle, XCircle, Clock,
  ChevronLeft, ChevronRight, Loader2, FileText, User, MessageSquare,
  X, Menu, Flag,
  RotateCcw, Shield, Mail, Info,
  BarChart3, Package, ShoppingCart, Star, Check, AlertTriangle, TrendingUp, Printer
} from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminPriceChart } from '@/components/admin/AdminPriceChart';
import { FaPaperPlane } from 'react-icons/fa';

// ============================================================================
// TYPES
// ============================================================================
interface ReportUser {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
}

interface Report {
  id: number;
  reporter: ReportUser;
  reportedType: string;
  reportedId: number;
  reason: string;
  description: string;
  statusLaporan: string;
  adminNote?: string | null;
  resolvedBy?: {
    id: number;
    name: string;
    avatar: string | null;
  } | null;
  contextData?: any;
  tanggalLaporan: string;
  updatedAt: string;
}

interface StatusCounts {
  all: number;
  menunggu: number;
  ditinjau: number;
  selesai: number;
  ditolak: number;
}

interface TypeCounts {
  all: number;
  general: number;
  forum_post: number;
  comment: number;
  product: number;
  user: number;
  order: number;
  review: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua', color: 'bg-gray-500' },
  { value: 'menunggu', label: 'Menunggu', color: 'bg-yellow-500' },
  { value: 'ditinjau', label: 'Ditinjau', color: 'bg-blue-500' },
  { value: 'selesai', label: 'Selesai', color: 'bg-green-500' },
  { value: 'ditolak', label: 'Ditolak', color: 'bg-red-500' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'Semua Tipe', icon: AlertCircle, color: 'bg-gray-500', description: 'Semua jenis laporan' },
  { value: 'general', label: 'Umum', icon: MessageSquare, color: 'bg-slate-500', description: 'Laporan umum tanpa konteks spesifik' },
  { value: 'forum_post', label: 'Post Forum', icon: FileText, color: 'bg-blue-500', description: 'Postingan di forum diskusi' },
  { value: 'comment', label: 'Komentar', icon: MessageSquare, color: 'bg-cyan-500', description: 'Komentar di forum' },
  { value: 'product', label: 'Produk', icon: Package, color: 'bg-green-500', description: 'Produk di marketplace' },
  { value: 'user', label: 'Pengguna', icon: User, color: 'bg-purple-500', description: 'Akun pengguna' },
  { value: 'order', label: 'Pesanan', icon: ShoppingCart, color: 'bg-orange-500', description: 'Transaksi pesanan' },
  { value: 'review', label: 'Ulasan', icon: Star, color: 'bg-pink-500', description: 'Review produk/layanan' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const getStatusBadge = (status: string) => {
  const config: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    menunggu: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', icon: Clock, label: 'Menunggu' },
    ditinjau: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', icon: Eye, label: 'Ditinjau' },
    selesai: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', icon: CheckCircle, label: 'Selesai' },
    ditolak: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', icon: XCircle, label: 'Ditolak' },
  };
  const { bg, text, icon: Icon, label } = config[status] || config.menunggu;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

const getJenisBadge = (jenis: string) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    spam: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300', label: 'Spam' },
    fraud: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: 'Penipuan' },
    inappropriate: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', label: 'Tidak Pantas' },
    copyright: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', label: 'Hak Cipta' },
    others: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-300', label: 'Lainnya' },
  };
  const { bg, text, label } = config[jenis] || config.others;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      {label}
    </span>
  );
};

const getTypeLabel = (type: string): string => {
  const found = TYPE_OPTIONS.find(t => t.value === type);
  return found?.label || type;
};

const getTypeIcon = (type: string): any => {
  const found = TYPE_OPTIONS.find(t => t.value === type);
  return found?.icon || AlertCircle;
};

// ============================================================================
// CONTEXT DISPLAY COMPONENT
// ============================================================================
const ReportContextDisplay = ({ report }: { report: Report }) => {
  const { reportedType, contextData } = report;

  if (reportedType === 'general' || !contextData) {
    return (
      <div className="card bg-surface/50">
        <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Laporan Umum
        </h3>
        <p className="text-text-secondary text-sm italic">Tidak ada konteks spesifik. Silakan baca deskripsi laporan di bawah.</p>
      </div>
    );
  }

  if (reportedType === 'forum_post' && contextData) {
    return (
      <div className="card bg-surface/50">
        <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Post Forum yang Dilaporkan
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold overflow-hidden shrink-0">
              {contextData.author?.avatar ? (
                <img src={contextData.author.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                contextData.author?.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text-primary text-sm">{contextData.author?.name}</p>
              <p className="text-xs text-text-secondary">{contextData.category}</p>
            </div>
          </div>
          <div>
            <p className="font-bold text-text-primary mb-1">{contextData.title}</p>
            <p className="text-sm text-text-secondary line-clamp-3">{contextData.content}</p>
          </div>
        </div>
      </div>
    );
  }

  if (reportedType === 'comment' && contextData) {
    return (
      <div className="card bg-surface/50">
        <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Komentar yang Dilaporkan
        </h3>
        <div className="space-y-3">
          {contextData.parentPost && (
            <div className="bg-background rounded-lg p-3 border-l-4 border-primary">
              <p className="text-xs text-text-secondary mb-1">Dalam post:</p>
              <p className="font-medium text-text-primary text-sm line-clamp-2">{contextData.parentPost.title}</p>
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden shrink-0">
              {contextData.author?.avatar ? (
                <img src={contextData.author.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                contextData.author?.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text-primary text-sm">{contextData.author?.name}</p>
              <p className="text-sm text-text-secondary mt-1">{contextData.content}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (reportedType === 'product' && contextData) {
    return (
      <div className="card bg-surface/50">
        <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Produk yang Dilaporkan
        </h3>
        <div className="flex gap-4">
          <div className="w-20 h-20 bg-surface rounded-lg overflow-hidden shrink-0 border border-border">
            {contextData.image ? (
              <img src={contextData.image} alt={contextData.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-8 h-8 text-text-muted" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-text-primary mb-1">{contextData.name}</p>
            <p className="text-sm text-text-secondary mb-2 line-clamp-2">{contextData.description}</p>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-primary">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(contextData.price)}
                <span className="text-xs text-text-secondary font-normal">/{contextData.unit}</span>
              </p>
              <div className="text-right">
                <p className="text-xs text-text-secondary">Seller</p>
                <p className="text-sm font-medium text-text-primary">{contextData.seller?.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (reportedType === 'user' && contextData) {
    return (
      <div className="card bg-surface/50">
        <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          User yang Dilaporkan
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-semibold overflow-hidden shrink-0">
            {contextData.avatar ? (
              <img src={contextData.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              contextData.name?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div className="flex-1">
            <p className="font-bold text-text-primary text-lg">{contextData.name}</p>
            <p className="text-sm text-text-secondary">{contextData.email}</p>
            <p className="text-xs text-text-secondary mt-1">Role: {contextData.role}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function AdminReportsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [typeCounts, setTypeCounts] = useState<TypeCounts | null>(null);
  const [summaryStats, setSummaryStats] = useState<{ totalUsers: number; totalProducts: number; totalTransactions: number; totalRevenue: number; pendingReports: number; pendingProducts: number } | null>(null);
  const [marketSummary, setMarketSummary] = useState<{ totalCommodity: number; totalUpdates: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Auth check
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast.error('Akses ditolak. Halaman ini hanya untuk admin.');
      router.push('/');
    }
  }, [isAuthenticated, authLoading, user, router]);

  // Fetch data
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchSummaryMetrics();
      fetchReports();
    }
  }, [isAuthenticated, user, currentPage, statusFilter, typeFilter, searchQuery]);

  const fetchSummaryMetrics = async () => {
    try {
      const token = getCookie('accessToken');

      const [statsRes, pricesRes] = await Promise.all([
        fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/market-prices'),
      ]);

      const statsResult = await statsRes.json();
      const pricesResult = await pricesRes.json();

      if (statsResult.success) {
        setSummaryStats(statsResult.data?.stats || null);
      }

      if (pricesResult.success) {
        setMarketSummary({
          totalCommodity: Array.isArray(pricesResult.data) ? pricesResult.data.length : 0,
          totalUpdates: Array.isArray(pricesResult.data) ? pricesResult.data.length : 0,
        });
      }
    } catch (error) {
      console.error('Fetch summary metrics error:', error);
    }
  };

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        status: statusFilter,
        type: typeFilter,
      });

      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/admin/reports?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await res.json();

      if (!result.success) throw new Error(result.error || 'Gagal memuat data');

      setReports(result.data?.reports || []);
      setStatusCounts(result.data?.statusCounts || null);
      setTypeCounts(result.data?.typeCounts || null);
      setTotalPages(result.data?.pagination?.totalPages || 1);
      setTotalItems(result.data?.pagination?.total || 0);
    } catch (error: any) {
      console.error('Fetch reports error:', error);
      toast.error(error.message || 'Gagal memuat data laporan');
    } finally {
      setIsLoading(false);
    }
  };

  const openDetailModal = (report: Report) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  };

  const openActionModal = (report: Report, status: string) => {
    setSelectedReport(report);
    setActionStatus(status);
    setActionNote(report.adminNote || '');
    setShowActionModal(true);
    setShowDetailModal(false);
  };

  const handleUpdateReport = async () => {
    if (!selectedReport) return;

    setIsActionLoading(true);
    try {
      const token = getCookie('accessToken');

      const res = await fetch(`/api/admin/reports/${selectedReport.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: actionStatus,
          adminNote: actionNote.trim() || null,
        }),
      });

      const result = await res.json();

      if (!result.success) throw new Error(result.error || 'Gagal mengupdate laporan');

      toast.success(`Laporan berhasil ditandai sebagai ${actionStatus}`);
      setShowActionModal(false);
      setShowDetailModal(false);
      setActionNote('');
      fetchReports();
    } catch (error: any) {
      console.error('Update report error:', error);
      toast.error(error.message || 'Gagal mengupdate laporan');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
    toast.success('Filter direset');
  };

  const hasActiveFilters = () => {
    return searchQuery !== '' || statusFilter !== 'all' || typeFilter !== 'all';
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');

    if (!printWindow) {
      toast.error('Popup diblokir. Izinkan popup untuk mencetak laporan.');
      return;
    }

    const statusLabel = (status: string) => {
      const map: Record<string, string> = {
        menunggu: 'Menunggu',
        ditinjau: 'Ditinjau',
        selesai: 'Selesai',
        ditolak: 'Ditolak',
      };
      return map[status] || status;
    };

    const typeLabel = (type: string) => getTypeLabel(type);

    const rows = reports.length > 0
      ? reports.map((report) => `
          <tr>
            <td>#${report.id}</td>
            <td>${(report.reporter.name || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            <td>${typeLabel(report.reportedType)}</td>
            <td>${(report.reason || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            <td>${statusLabel(report.statusLaporan)}</td>
            <td>${format(new Date(report.tanggalLaporan), 'dd MMM yyyy HH:mm', { locale: id })}</td>
            <td>${(report.description || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="7" style="text-align:center;">Tidak ada data laporan</td></tr>';

    const html = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>Laporan Admin - Agri-X</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
          h1 { margin-bottom: 8px; font-size: 24px; }
          .meta { color: #6b7280; margin-bottom: 20px; }
          .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 24px; }
          .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #f9fafb; }
          .card strong { display: block; font-size: 20px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; }
          .footer { margin-top: 24px; color: #6b7280; font-size: 12px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>Laporan Admin Agri-X</h1>
        <div class="meta">Dicetak: ${format(new Date(), 'dd MMM yyyy, HH:mm', { locale: id })}</div>
        <div class="summary-grid">
          <div class="card"><strong>${totalItems}</strong>Total Laporan</div>
          <div class="card"><strong>${statusCounts?.menunggu || 0}</strong>Menunggu</div>
          <div class="card"><strong>${statusCounts?.ditinjau || 0}</strong>Ditinjau</div>
          <div class="card"><strong>${statusCounts?.selesai || 0}</strong>Selesai</div>
          <div class="card"><strong>${statusCounts?.ditolak || 0}</strong>Ditolak</div>
          <div class="card"><strong>${summaryStats?.totalUsers || 0}</strong>Pengguna</div>
        </div>

        <h2 style="font-size: 16px; margin-bottom: 8px;">Daftar Laporan</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Pelapor</th>
              <th>Tipe</th>
              <th>Kategori</th>
              <th>Status</th>
              <th>Tanggal</th>
              <th>Deskripsi</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="footer">
          <p>Filter aktif: ${statusFilter !== 'all' ? `status=${statusFilter}` : 'Semua status'}${typeFilter !== 'all' ? `, tipe=${typeFilter}` : ''}${searchQuery ? `, pencarian=${searchQuery}` : ''}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <main className="flex-1 lg:ml-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 hover:bg-surface rounded-lg transition-colors">
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                  <Flag className="w-6 h-6 text-primary" />
                  Laporan Pengguna
                </h1>
                <p className="text-sm text-text-secondary">{totalItems} laporan terdaftar</p>
              </div>
            </div>

            <button
              onClick={handlePrintReport}
              className="btn-primary flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Cetak Laporan
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-8 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Total Komoditas</p>
                  <p className="text-2xl font-bold text-text-primary">{marketSummary?.totalCommodity || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                  <Package className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Total Update Harga</p>
                  <p className="text-2xl font-bold text-text-primary">{marketSummary?.totalUpdates || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Total Pengguna</p>
                  <p className="text-2xl font-bold text-text-primary">{summaryStats?.totalUsers || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <User className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Laporan Menunggu</p>
                  <p className="text-2xl font-bold text-text-primary">{summaryStats?.pendingReports || statusCounts?.menunggu || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          <AdminPriceChart />

          {/* Status Counts */}
          {statusCounts && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {STATUS_OPTIONS.map((option) => {
                const count = statusCounts[option.value as keyof StatusCounts] || 0;
                const isActive = statusFilter === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => { setStatusFilter(option.value); setCurrentPage(1); }}
                    className={`card transition-all ${isActive ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-surface-hover'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${option.color}`} />
                      <div className="flex-1 text-left">
                        <p className="text-xs text-text-secondary">{option.label}</p>
                        <p className="text-xl font-bold text-text-primary">{count}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Type Counts Cards */}
          {typeCounts && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Distribusi Tipe Laporan
                </h3>
                <span className="text-xs text-text-secondary">Total: {typeCounts.all} laporan</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {TYPE_OPTIONS.filter(t => t.value !== 'all').map((option) => {
                  const count = typeCounts[option.value as keyof TypeCounts] || 0;
                  const Icon = option.icon;
                  const isActive = typeFilter === option.value;

                  return (
                    <button
                      key={option.value}
                      onClick={() => { setTypeFilter(isActive ? 'all' : option.value); setCurrentPage(1); }}
                      className={`relative p-3 rounded-xl border-2 transition-all text-left overflow-hidden group ${
                        isActive ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/50 hover:shadow-sm'
                      }`}
                      title={option.description}
                    >
                      <div className={`absolute top-0 right-0 w-16 h-16 ${option.color} opacity-10 rounded-full -mr-8 -mt-8 group-hover:opacity-20 transition-opacity`} />

                      <div className="relative flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg ${option.color}/10 flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${option.color.replace('bg-', 'text-')}`} />
                        </div>
                        <span className="text-xs font-medium text-text-secondary truncate">{option.label}</span>
                      </div>

                      <div className="relative flex items-baseline gap-1">
                        <p className="text-2xl font-bold text-text-primary">{count}</p>
                      </div>

                      {isActive && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-500" />Umum</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" />Post Forum</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500" />Komentar</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" />Produk</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500" />Pengguna</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" />Pesanan</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pink-500" />Ulasan</span>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">Filter</h3>
              {hasActiveFilters() && (
                <button onClick={handleResetFilters} className="btn-outline px-3 py-1 text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />Reset
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Cari laporan, nama..."
                  className="input pl-12"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="input"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                className="input"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reports Table */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : reports.length > 0 ? (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface border-b border-border">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">ID</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Pelapor</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Tipe</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Kategori</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Ditangani</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Tanggal</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reports.map((report) => {
                        const TypeIcon = getTypeIcon(report.reportedType);
                        return (
                          <tr key={report.id} className="hover:bg-surface/50 transition-colors">
                            <td className="py-4 px-4"><span className="font-semibold text-text-primary">#{report.id}</span></td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden">
                                  {report.reporter.avatar ? (
                                    <img src={report.reporter.avatar} alt={report.reporter.name} className="w-full h-full object-cover" />
                                  ) : (
                                    report.reporter.name?.charAt(0).toUpperCase() || 'U'
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-text-primary truncate max-w-37.5">{report.reporter.name}</p>
                                  <p className="text-xs text-text-secondary truncate max-w-37.5">{report.reporter.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <TypeIcon className="w-4 h-4 text-primary" />
                                <span className="text-sm text-text-primary">{getTypeLabel(report.reportedType)}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4">{getJenisBadge(report.reason)}</td>
                            <td className="py-4 px-4">{getStatusBadge(report.statusLaporan)}</td>
                            <td className="py-4 px-4">
                              {report.resolvedBy ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-semibold overflow-hidden shrink-0">
                                    {report.resolvedBy.avatar ? (
                                      <img src={report.resolvedBy.avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      report.resolvedBy.name?.charAt(0).toUpperCase() || 'A'
                                    )}
                                  </div>
                                  <span className="text-sm text-text-primary truncate max-w-25">{report.resolvedBy.name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-text-secondary italic">Belum ditangani</span>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              <p className="text-sm text-text-primary">{format(new Date(report.tanggalLaporan), 'dd MMM yyyy', { locale: id })}</p>
                              <p className="text-xs text-text-secondary">{format(new Date(report.tanggalLaporan), 'HH:mm', { locale: id })}</p>
                            </td>
                            <td className="py-4 px-4">
                              <button onClick={() => openDetailModal(report)} className="btn-outline px-3 py-1 text-sm">
                                <Eye className="w-4 h-4 mr-1" />Detail
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3 p-4">
                  {reports.map((report) => {
                    const TypeIcon = getTypeIcon(report.reportedType);
                    return (
                      <div key={report.id} className="bg-surface rounded-xl p-4 border border-border">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-text-primary">#{report.id}</p>
                            <p className="text-xs text-text-secondary">{format(new Date(report.tanggalLaporan), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                          </div>
                          {getStatusBadge(report.statusLaporan)}
                        </div>
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-text-secondary shrink-0" />
                            <span className="text-sm text-text-secondary">Pelapor:</span>
                            <span className="text-sm font-medium text-text-primary truncate">{report.reporter.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="w-4 h-4 text-text-secondary shrink-0" />
                            <span className="text-sm text-text-secondary">Tipe:</span>
                            <span className="text-sm font-medium text-text-primary truncate">{getTypeLabel(report.reportedType)}</span>
                          </div>
                        </div>
                        <button onClick={() => openDetailModal(report)} className="btn-outline w-full py-2 text-sm">
                          <Eye className="w-4 h-4 mr-1" />Lihat Detail
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-4 border-t border-border">
                    <p className="text-sm text-text-secondary">Halaman {currentPage} dari {totalPages}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="btn-outline px-3 py-1 disabled:opacity-50">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="btn-outline px-3 py-1 disabled:opacity-50">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 mx-auto text-text-muted mb-4" />
                <p className="text-text-secondary font-medium">Tidak ada laporan ditemukan</p>
                <p className="text-sm text-text-muted mt-1">
                  {hasActiveFilters() ? 'Coba ubah filter atau kata kunci pencarian' : 'Belum ada laporan dari pengguna'}
                </p>
                {hasActiveFilters() && (
                  <button onClick={handleResetFilters} className="btn-primary mt-4">
                    <RotateCcw className="w-4 h-4 mr-2" />Reset Filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* DETAIL MODAL */}
      {showDetailModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Flag className="w-5 h-5 text-primary" />
                Detail Laporan #{selectedReport.id}
              </h2>
              <button onClick={() => { setShowDetailModal(false); setSelectedReport(null); }} className="p-2 hover:bg-surface rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <ReportContextDisplay report={selectedReport} />

              {/* Reporter Info */}
              <div className="card bg-surface/50">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Pelapor
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold overflow-hidden shrink-0">
                    {selectedReport.reporter.avatar ? (
                      <img src={selectedReport.reporter.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedReport.reporter.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary">{selectedReport.reporter.name}</p>
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{selectedReport.reporter.email}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Report Details */}
              <div className="card bg-surface/50">
                <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  Detail Laporan
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-text-secondary mb-1">Tipe Laporan</p>
                      <div className="flex items-center gap-2">
                        {(() => { const TypeIcon = getTypeIcon(selectedReport.reportedType); return <TypeIcon className="w-4 h-4 text-primary" />; })()}
                        <span className="text-sm font-medium text-text-primary">{getTypeLabel(selectedReport.reportedType)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary mb-1">Kategori</p>
                      {getJenisBadge(selectedReport.reason)}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Deskripsi</p>
                    <div className="bg-background rounded-lg p-3 border border-border">
                      <p className="text-text-secondary whitespace-pre-line text-sm">{selectedReport.description}</p>
                    </div>
                  </div>
                  {selectedReport.adminNote && (
                    <div>
                      <p className="text-xs text-text-secondary mb-1">Catatan Admin</p>
                      <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                        <p className="text-text-secondary whitespace-pre-line text-sm">{selectedReport.adminNote}</p>
                        {selectedReport.resolvedBy && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/20">
                            <div className="w-6 h-6 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-semibold overflow-hidden shrink-0">
                              {selectedReport.resolvedBy.avatar ? (
                                <img src={selectedReport.resolvedBy.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                selectedReport.resolvedBy.name?.charAt(0).toUpperCase() || 'A'
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-text-primary">{selectedReport.resolvedBy.name}</p>
                              <p className="text-[10px] text-text-secondary">Admin yang menangani</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedReport.resolvedBy && !selectedReport.adminNote && (
                    <div>
                      <p className="text-xs text-text-secondary mb-1">Ditangani Oleh</p>
                      <div className="bg-surface rounded-lg p-3 border border-border flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-semibold overflow-hidden shrink-0">
                          {selectedReport.resolvedBy.avatar ? (
                            <img src={selectedReport.resolvedBy.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            selectedReport.resolvedBy.name?.charAt(0).toUpperCase() || 'A'
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{selectedReport.resolvedBy.name}</p>
                          <p className="text-xs text-text-secondary">Terakhir update: {format(new Date(selectedReport.updatedAt), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div>
                      <p className="text-xs text-text-secondary">Status</p>
                      {getStatusBadge(selectedReport.statusLaporan)}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-secondary">Dilaporkan</p>
                      <p className="text-sm font-medium text-text-primary">{format(new Date(selectedReport.tanggalLaporan), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="card bg-surface/50">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Aksi
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Ubah Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => openActionModal(selectedReport, 'menunggu')} disabled={selectedReport.statusLaporan === 'menunggu'} className="px-4 py-2 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30">
                        <Clock className="w-4 h-4 inline mr-2" />Menunggu
                      </button>
                      <button onClick={() => openActionModal(selectedReport, 'ditinjau')} disabled={selectedReport.statusLaporan === 'ditinjau'} className="px-4 py-2 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                        <Eye className="w-4 h-4 inline mr-2" />Ditinjau
                      </button>
                      <button onClick={() => openActionModal(selectedReport, 'selesai')} disabled={selectedReport.statusLaporan === 'selesai'} className="px-4 py-2 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30">
                        <CheckCircle className="w-4 h-4 inline mr-2" />Selesai
                      </button>
                      <button onClick={() => openActionModal(selectedReport, 'ditolak')} disabled={selectedReport.statusLaporan === 'ditolak'} className="px-4 py-2 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30">
                        <XCircle className="w-4 h-4 inline mr-2" />Ditolak
                      </button>
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Info:</strong> Setiap perubahan status akan mengirim notifikasi ke pelapor.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION MODAL */}
      {showActionModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-60 p-4">
          <div className="bg-background rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                actionStatus === 'menunggu' ? 'bg-yellow-500/10' : actionStatus === 'ditinjau' ? 'bg-blue-500/10' : actionStatus === 'selesai' ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                {actionStatus === 'menunggu' && <Clock className="w-8 h-8 text-yellow-500" />}
                {actionStatus === 'ditinjau' && <Eye className="w-8 h-8 text-blue-500" />}
                {actionStatus === 'selesai' && <CheckCircle className="w-8 h-8 text-green-500" />}
                {actionStatus === 'ditolak' && <XCircle className="w-8 h-8 text-red-500" />}
              </div>

              <h3 className="text-xl font-bold text-text-primary text-center mb-2">
                Ubah Status ke {actionStatus === 'menunggu' ? 'Menunggu' : actionStatus === 'ditinjau' ? 'Ditinjau' : actionStatus === 'selesai' ? 'Selesai' : 'Ditolak'}?
              </h3>

              <p className="text-text-secondary text-center mb-4">
                Laporan #{selectedReport.id} akan ditandai sebagai{' '}
                <strong>{actionStatus === 'menunggu' ? 'menunggu' : actionStatus === 'ditinjau' ? 'sedang ditinjau' : actionStatus === 'selesai' ? 'selesai diproses' : 'ditolak'}</strong>.
              </p>

              <div className="bg-surface rounded-xl p-3 mb-4">
                <p className="text-xs text-text-secondary mb-1">Status Saat Ini:</p>
                {getStatusBadge(selectedReport.statusLaporan)}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
                <div className="flex items-start gap-2">
                  <FaPaperPlane className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">Notifikasi akan dikirim ke <strong>{selectedReport.reporter.email}</strong></p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Catatan Admin {actionStatus === 'ditolak' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={actionStatus === 'menunggu' ? 'Alasan pengembalian ke status menunggu...' : actionStatus === 'ditinjau' ? 'Catatan internal untuk tim admin...' : actionStatus === 'selesai' ? 'Tindakan yang telah diambil...' : 'Alasan penolakan laporan (wajib)...'}
                  rows={4}
                  className="input"
                  required={actionStatus === 'ditolak'}
                />
                <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {actionStatus === 'menunggu' && 'Catatan ini akan dikirim ke pelapor'}
                  {actionStatus === 'ditinjau' && 'Catatan ini hanya terlihat oleh admin'}
                  {actionStatus === 'selesai' && 'Catatan ini akan dikirim ke pelapor'}
                  {actionStatus === 'ditolak' && 'Alasan penolakan akan dikirim ke pelapor (wajib)'}
                </p>
              </div>

              {actionStatus === 'ditolak' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 dark:text-red-300">Laporan yang ditolak akan ditandai sebagai tidak valid. Pastikan alasan penolakan jelas.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setShowActionModal(false); setActionNote(''); }} disabled={isActionLoading} className="btn-outline flex-1">Batal</button>
                <button
                  onClick={handleUpdateReport}
                  disabled={isActionLoading || (actionStatus === 'ditolak' && !actionNote.trim())}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    actionStatus === 'menunggu' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : actionStatus === 'ditinjau' ? 'bg-blue-500 hover:bg-blue-600 text-white' : actionStatus === 'selesai' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {isActionLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Memproses...</>) : (<><Shield className="w-4 h-4" />Konfirmasi</>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

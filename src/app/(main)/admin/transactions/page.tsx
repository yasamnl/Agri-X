// src/app/(main)/admin/transactions/page.tsx
'use client';

import { useEffect, useState , useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { getCookie } from '@/lib/auth';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { 
  Package, Search, Filter, Menu, Loader2,
  Eye, CheckCircle, XCircle, Clock, Truck,
  ChevronLeft, ChevronRight, Calendar, DollarSign,
  AlertCircle, RefreshCw, X
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
interface Transaction {
  id: number;
  invoiceNumber: string;
  buyer: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  items: {
    count: number;
    quantity: number;
  };
  pricing: {
    subtotal: number;
    shipping: number;
    total: number;
  };
  status: string;
  payment: {
    method: string;
    status: string;
  };
  shipping?: {
    address: string;
    courier?: string;
    trackingNumber?: string;
  };
  createdAt: string;
  updatedAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface StatusCounts {
  [key: string]: {
    count: number;
    amount: number;
  };
}

interface Summary {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  completedRevenue: number;
  pendingRevenue: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua', color: 'bg-gray-500', icon: Package },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500', icon: Clock },
  { value: 'processing', label: 'Dikemas', color: 'bg-blue-500', icon: Package },
  { value: 'shipped', label: 'Dikirim', color: 'bg-purple-500', icon: Truck },
  { value: 'completed', label: 'Selesai', color: 'bg-green-500', icon: CheckCircle },
  { value: 'cancelled', label: 'Dibatalkan', color: 'bg-red-500', icon: XCircle },
];

const ITEMS_PER_PAGE = 10;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  const config: Record<string, { className: string; icon: any; label: string }> = {
    pending: { 
      className: 'badge badge-pending',
      icon: Clock,
      label: 'Pending'
    },
    processing: { 
      className: 'badge badge-processing',
      icon: Package,
      label: 'Dikemas'
    },
    shipped: { 
      className: 'badge badge-shipped',
      icon: Truck,
      label: 'Dikirim'
    },
    completed: { 
      className: 'badge badge-completed',
      icon: CheckCircle,
      label: 'Selesai'
    },
    cancelled: { 
      className: 'badge badge-cancelled',
      icon: XCircle,
      label: 'Dibatalkan'
    },
  };

  const { className, icon: Icon, label } = config[status] || config.pending;
  
  return (
    <span className={`${className} inline-flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function AdminTransactionsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  // State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  
  // Filter State
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Detail Modal
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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
  // FETCH DATA
  // ============================================================================
  const fetchTransactions = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const token = getCookie('accessToken');
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        status: statusFilter,
      });

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      if (dateFrom) {
        params.append('dateFrom', dateFrom);
      }

      if (dateTo) {
        params.append('dateTo', dateTo);
      }

      const res = await fetch(`/api/admin/transactions?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal memuat data transaksi');
      }

      setTransactions(result.data.transactions || []);
      setStatusCounts(result.data.statusCounts || {});
      setSummary(result.data.summary || null);
      setPagination(result.data.pagination || null);
    } catch (error: any) {
      console.error('Fetch transactions error:', error);
      toast.error(error.message || 'Gagal memuat data transaksi');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchTransactions();
    }
  }, [isAuthenticated, user, currentPage, statusFilter, searchQuery, dateFrom, dateTo]);

  // ============================================================================
  // FILTER HANDLERS
  // ============================================================================
  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleDateFromChange = (date: string) => {
    setDateFrom(date);
    setCurrentPage(1);
  };

  const handleDateToChange = (date: string) => {
    setDateTo(date);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
    toast.success('Filter direset');
  };

  const hasActiveFilters = () => {
    return statusFilter !== 'all' || searchQuery !== '' || dateFrom !== '' || dateTo !== '';
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content */}
      <main className="flex-1 lg:ml-0">
        {/* Header */}
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
                <h1 className="text-2xl font-bold text-text-primary">Manajemen Transaksi</h1>
                <p className="text-sm text-text-secondary">
                  Kelola dan pantau semua transaksi pelanggan
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchTransactions(true)}
              disabled={isRefreshing}
              className="btn-outline flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-8 space-y-6">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card bg-gradient-to-br from-primary to-secondary text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm">Total Transaksi</p>
                    <p className="text-3xl font-bold mt-1">{summary.totalOrders}</p>
                  </div>
                  <Package className="w-12 h-12 text-white/30" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-secondary text-sm">Total Pendapatan</p>
                    <p className="text-2xl font-bold text-text-primary mt-1">
                      {formatCurrency(summary.totalRevenue)}
                    </p>
                  </div>
                  <DollarSign className="w-10 h-10 text-green-500" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-secondary text-sm">Rata-rata Order</p>
                    <p className="text-2xl font-bold text-text-primary mt-1">
                      {formatCurrency(summary.avgOrderValue)}
                    </p>
                  </div>
                  <Package className="w-10 h-10 text-blue-500" />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-secondary text-sm">Selesai</p>
                    <p className="text-2xl font-bold text-text-primary mt-1">
                      {formatCurrency(summary.completedRevenue)}
                    </p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
              </div>
            </div>
          )}

          {/* Status Filter Tabs */}
          <div className="card">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {STATUS_OPTIONS.map((option) => {
                const count = statusCounts[option.value]?.count || 0;
                const isActive = statusFilter === option.value;
                const Icon = option.icon;
                
                return (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'bg-surface text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{option.label}</span>
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

          {/* Filters */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary">Filter</h3>
              {hasActiveFilters() && (
                <button
                  onClick={handleResetFilters}
                  className="btn-outline px-3 py-1 text-sm flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Cari invoice, nama pembeli..."
                  className="input pl-12"
                />
              </div>

              {/* Date From */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                  <Calendar className="w-4 h-4" />
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="input"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                  <Calendar className="w-4 h-4" />
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : transactions.length > 0 ? (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface border-b border-border">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Invoice</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Pembeli</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Items</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Total</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Tanggal</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-surface/50 transition-colors">
                          <td className="py-4 px-4">
                            <p className="font-semibold text-text-primary">{transaction.invoiceNumber}</p>
                            <p className="text-xs text-text-secondary">{transaction.payment.method}</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-medium text-text-primary">{transaction.buyer.name}</p>
                            <p className="text-xs text-text-secondary">{transaction.buyer.email}</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-text-primary">{transaction.items.count} produk</p>
                            <p className="text-xs text-text-secondary">{transaction.items.quantity} item</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-semibold text-text-primary">{formatCurrency(transaction.pricing.total)}</p>
                            <p className="text-xs text-text-secondary">+ {formatCurrency(transaction.pricing.shipping)} ongkir</p>
                          </td>
                          <td className="py-4 px-4">
                            {getStatusBadge(transaction.status)}
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-sm text-text-primary">
                              {format(new Date(transaction.createdAt), 'dd MMM yyyy', { locale: id })}
                            </p>
                            <p className="text-xs text-text-secondary">
                              {format(new Date(transaction.createdAt), 'HH:mm', { locale: id })}
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => {
                                setSelectedTransaction(transaction);
                                setShowDetailModal(true);
                              }}
                              className="btn-outline px-3 py-1 text-sm flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3 p-4">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="bg-surface rounded-xl p-4 border border-border">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-text-primary">{transaction.invoiceNumber}</p>
                          <p className="text-sm text-text-secondary">{transaction.buyer.name}</p>
                        </div>
                        {getStatusBadge(transaction.status)}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-text-secondary">Total</p>
                          <p className="font-semibold text-text-primary">{formatCurrency(transaction.pricing.total)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary">Items</p>
                          <p className="font-semibold text-text-primary">{transaction.items.count} produk</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <p className="text-xs text-text-secondary">
                          {format(new Date(transaction.createdAt), 'dd MMM yyyy, HH:mm', { locale: id })}
                        </p>
                        <button
                          onClick={() => {
                            setSelectedTransaction(transaction);
                            setShowDetailModal(true);
                          }}
                          className="btn-outline px-3 py-1 text-sm flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Detail
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-border">
                    <p className="text-sm text-text-secondary">
                      Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                      {Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)} dari{' '}
                      {pagination.total} transaksi
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={!pagination.hasPrev}
                        className="btn-outline px-3 py-1 disabled:opacity-50"
                        title="Halaman Pertama"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <ChevronLeft className="w-4 h-4 -ml-2" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={!pagination.hasPrev}
                        className="btn-outline px-3 py-1 disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-4 py-2 text-sm font-medium text-text-primary">
                        {currentPage} / {pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                        disabled={!pagination.hasNext}
                        className="btn-outline px-3 py-1 disabled:opacity-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(pagination.totalPages)}
                        disabled={!pagination.hasNext}
                        className="btn-outline px-3 py-1 disabled:opacity-50"
                        title="Halaman Terakhir"
                      >
                        <ChevronRight className="w-4 h-4" />
                        <ChevronRight className="w-4 h-4 -ml-2" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20">
                <Package className="w-16 h-16 mx-auto text-text-muted mb-4" />
                <p className="text-text-secondary font-medium">Tidak ada transaksi ditemukan</p>
                <p className="text-sm text-text-muted mt-1">
                  {hasActiveFilters()
                    ? 'Coba ubah filter atau kata kunci pencarian'
                    : 'Transaksi akan muncul di sini'}
                </p>
                {hasActiveFilters() && (
                  <button
                    onClick={handleResetFilters}
                    className="btn-primary mt-4"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      {showDetailModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-text-primary">Detail Transaksi</h2>
                <p className="text-text-secondary">{selectedTransaction.invoiceNumber}</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedTransaction(null);
                }}
                className="p-2 hover:bg-surface rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status & Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface rounded-xl p-4">
                  <p className="text-sm text-text-secondary mb-2">Status</p>
                  {getStatusBadge(selectedTransaction.status)}
                </div>
                <div className="bg-surface rounded-xl p-4">
                  <p className="text-sm text-text-secondary mb-2">Tanggal</p>
                  <p className="font-medium text-text-primary">
                    {format(new Date(selectedTransaction.createdAt), 'dd MMMM yyyy, HH:mm', { locale: id })}
                  </p>
                </div>
              </div>

              {/* Buyer Info */}
              <div className="bg-surface rounded-xl p-4">
                <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Informasi Pembeli
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-text-secondary">Nama</p>
                    <p className="font-medium text-text-primary">{selectedTransaction.buyer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Email</p>
                    <p className="font-medium text-text-primary">{selectedTransaction.buyer.email}</p>
                  </div>
                  {selectedTransaction.buyer.phone && (
                    <div>
                      <p className="text-xs text-text-secondary">Telepon</p>
                      <p className="font-medium text-text-primary">{selectedTransaction.buyer.phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Info */}
              <div className="bg-surface rounded-xl p-4">
                <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Detail Pesanan
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-secondary">Jumlah Produk</p>
                    <p className="text-2xl font-bold text-text-primary">{selectedTransaction.items.count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Total Item</p>
                    <p className="text-2xl font-bold text-text-primary">{selectedTransaction.items.quantity}</p>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-surface rounded-xl p-4">
                <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Informasi Pembayaran
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Subtotal</span>
                    <span className="font-medium text-text-primary">
                      {formatCurrency(selectedTransaction.pricing.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Ongkos Kirim</span>
                    <span className="font-medium text-text-primary">
                      {formatCurrency(selectedTransaction.pricing.shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-lg font-semibold text-text-primary">Total</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(selectedTransaction.pricing.total)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-text-secondary">Metode Pembayaran</p>
                      <p className="font-medium text-text-primary">{selectedTransaction.payment.method}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">Status Pembayaran</p>
                      <p className="font-medium text-text-primary">{selectedTransaction.payment.status}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping Info */}
              {selectedTransaction.shipping && (
                <div className="bg-surface rounded-xl p-4">
                  <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    Informasi Pengiriman
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-text-secondary">Alamat</p>
                      <p className="font-medium text-text-primary">{selectedTransaction.shipping.address}</p>
                    </div>
                    {selectedTransaction.shipping.courier && (
                      <div>
                        <p className="text-xs text-text-secondary">Kurir</p>
                        <p className="font-medium text-text-primary">{selectedTransaction.shipping.courier}</p>
                      </div>
                    )}
                    {selectedTransaction.shipping.trackingNumber && (
                      <div>
                        <p className="text-xs text-text-secondary">No. Resi</p>
                        <p className="font-medium text-text-primary">{selectedTransaction.shipping.trackingNumber}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
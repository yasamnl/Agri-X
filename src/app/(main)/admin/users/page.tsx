// src/app/(main)/admin/users/page.tsx
'use client';

import { useEffect, useState, useCallback , useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminModal } from '@/components/admin/AdminModal';
import { getCookie } from '@/lib/auth';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  Users, Search, Menu, Loader2, Filter, XCircle, RefreshCw,
  Eye, Ban, CheckCircle, Trash2, AlertTriangle,
  Calendar, TrendingUp, Shield, ChevronLeft, ChevronRight,
  Mail, Phone, ShoppingBag, DollarSign,X, User as UserIcon
} from 'lucide-react';  

// ============================================================================
// TYPES
// ============================================================================
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  totalTransactions: number;
  totalSpent?: number;
  avatar?: string;
  phone?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Filters {
  search: string;
  role: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  minTransactions: string;
  maxTransactions: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const ROLE_OPTIONS = [
  { value: 'all', label: 'Semua Role' },
  { value: 'admin', label: 'Admin' },
  { value: 'seller', label: 'Penjual' },
  { value: 'buyer', label: 'Pembeli' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua Status' },
  { value: 'active', label: 'Aktif' },
  { value: 'suspended', label: 'Ditangguhkan' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Tidak Aktif' },
];

const ITEMS_PER_PAGE = 10;

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // UI States
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

  // Data States
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0
  });

  // Filter States
  const [filters, setFilters] = useState<Filters>({
    search: '',
    role: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    minTransactions: '',
    maxTransactions: '',
  });
  const [tempFilters, setTempFilters] = useState<Filters>(filters);

  // Action States
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'activate' | 'delete'>('suspend');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ============================================================================
  // AUTH CHECK
  // ============================================================================
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/admin/users');
      return;
    }

    if (user && user.role !== 'admin') {
      toast.error('Akses ditolak. Halaman ini hanya untuk admin.');
      router.push('/');
      return;
    }
  }, [isAuthenticated, authLoading, user, router]);

  // ============================================================================
  // FETCH USERS
  // ============================================================================
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });

      if (filters.search) params.append('search', filters.search);
      if (filters.role !== 'all') params.append('role', filters.role);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.minTransactions) params.append('minTransactions', filters.minTransactions);
      if (filters.maxTransactions) params.append('maxTransactions', filters.maxTransactions);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal memuat data user');
      }

      setUsers(result.data?.users || []);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (error: any) {
      console.error('Fetch users error:', error);
      toast.error(error.message || 'Gagal memuat data user');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, filters]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchUsers();
    }
  }, [isAuthenticated, user, fetchUsers]);

  // ============================================================================
  // SEARCH HANDLER (Debounced)
  // ============================================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page !== 1) {
        setPagination(prev => ({ ...prev, page: 1 }));
      } else {
        fetchUsers();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.search]);

  // ============================================================================
  // FILTER HANDLERS
  // ============================================================================
  const openFilterModal = () => {
    setTempFilters(filters);
    setShowFilterModal(true);
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    setShowFilterModal(false);
    toast.success('Filter diterapkan');
  };

  const resetFilters = () => {
    const emptyFilters: Filters = {
      search: '', role: 'all', status: 'all',
      dateFrom: '', dateTo: '', minTransactions: '', maxTransactions: '',
    };
    setFilters(emptyFilters);
    setTempFilters(emptyFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    setShowFilterModal(false);
    toast.success('Filter direset');
  };

  const hasActiveFilters = () => {
    return (
      filters.role !== 'all' ||
      filters.status !== 'all' ||
      filters.dateFrom !== '' ||
      filters.dateTo !== '' ||
      filters.minTransactions !== '' ||
      filters.maxTransactions !== ''
    );
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.role !== 'all') count++;
    if (filters.status !== 'all') count++;
    if (filters.dateFrom !== '') count++;
    if (filters.dateTo !== '') count++;
    if (filters.minTransactions !== '') count++;
    if (filters.maxTransactions !== '') count++;
    return count;
  };

  const removeFilter = (key: keyof Filters) => {
    const newFilters = { ...filters, [key]: key === 'role' || key === 'status' ? 'all' : '' };
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // ============================================================================
  // USER ACTION HANDLERS
  // ============================================================================
  const openDetailModal = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const openActionModal = (user: User, type: 'suspend' | 'activate' | 'delete') => {
    setSelectedUser(user);
    setActionType(type);
    setShowActionModal(true);
  };

  const handleUserAction = async () => {
    if (!selectedUser) return;

    setIsActionLoading(true);
    try {
      const token = getCookie('accessToken');
      let url = `/api/admin/users/${selectedUser.id}/status`;
      let method = 'PATCH';
      let body = {};

      if (actionType === 'suspend') {
        body = { status: 'suspended' };
      } else if (actionType === 'activate') {
        body = { status: 'active' };
      } else if (actionType === 'delete') {
        method = 'DELETE';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: method !== 'DELETE' ? JSON.stringify(body) : undefined,
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal memproses aksi');
      }

      const actionLabels = {
        suspend: 'ditangguhkan',
        activate: 'diaktifkan',
        delete: 'dihapus',
      };

      toast.success(`User berhasil ${actionLabels[actionType]}`);
      setShowActionModal(false);
      setShowDetailModal(false);
      fetchUsers();
    } catch (error: any) {
      console.error('User action error:', error);
      toast.error(error.message || 'Gagal memproses aksi');
    } finally {
      setIsActionLoading(false);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string; icon: any }> = {
       active: { 
      bg: 'bg-green-100 dark:bg-green-900/30', 
      text: 'text-green-800 dark:text-green-300', 
      label: 'Aktif', 
      icon: CheckCircle  // ✅ Sudah di-import
    },
    suspended: { 
      bg: 'bg-red-100 dark:bg-red-900/30', 
      text: 'text-red-800 dark:text-red-300', 
      label: 'Ditangguhkan', 
      icon: XCircle  // ❌ Belum di-import!
    },
    pending: { 
      bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
      text: 'text-yellow-800 dark:text-yellow-300', 
      label: 'Pending', 
      icon: Loader2  // ✅ Sudah di-import
    },
    };

    const { bg, text, label, icon: Icon } = config[status] || config.active;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      admin: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300' },
      seller: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300' },
      buyer: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-300' },
    };

    const { bg, text } = config[role] || config.buyer;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${bg} ${text}`}>
        {role}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
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
      <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

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
                <h1 className="text-2xl font-bold text-text-primary">Kelola User</h1>
                <p className="text-sm text-text-secondary">
                  Total {pagination.total} user terdaftar
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchUsers()}
              className="btn-outline px-4 py-2 flex items-center gap-2"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-8 space-y-6">
          {/* Search & Filter Bar */}
          <div className="card">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Cari nama atau email..."
                  className="input pl-12"
                />
              </div>

              {/* Quick Role Filter */}
              <select
                value={filters.role}
                onChange={(e) => {
                  setFilters({ ...filters, role: e.target.value });
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="input sm:w-48"
              >
                {ROLE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              {/* Filter Button */}
              <button
                onClick={openFilterModal}
                className="btn-outline flex items-center gap-2 px-6"
              >
                <Filter className="w-5 h-5" />
                <span>Filter</span>
                {getActiveFiltersCount() > 0 && (
                  <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                    {getActiveFiltersCount()}
                  </span>
                )}
              </button>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters() && (
              <div className="mt-4 flex flex-wrap gap-2">
                {filters.role !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    Role: {ROLE_OPTIONS.find(r => r.value === filters.role)?.label}
                    <button onClick={() => removeFilter('role')} className="hover:bg-primary/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.status !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    Status: {STATUS_OPTIONS.find(s => s.value === filters.status)?.label}
                    <button onClick={() => removeFilter('status')} className="hover:bg-primary/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.dateFrom && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    Dari: {format(new Date(filters.dateFrom), 'dd MMM yyyy', { locale: id })}
                    <button onClick={() => removeFilter('dateFrom')} className="hover:bg-primary/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.dateTo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    Sampai: {format(new Date(filters.dateTo), 'dd MMM yyyy', { locale: id })}
                    <button onClick={() => removeFilter('dateTo')} className="hover:bg-primary/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {(filters.minTransactions || filters.maxTransactions) && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    Transaksi: {filters.minTransactions || '0'} - {filters.maxTransactions || '∞'}
                    <button onClick={() => {
                      setFilters({ ...filters, minTransactions: '', maxTransactions: '' });
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }} className="hover:bg-primary/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Users Table */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : users.length > 0 ? (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface border-b border-border">
                      <tr>
                        <th className="text-left py-4 px-4 text-sm font-semibold text-text-secondary">User</th>
                        <th className="text-left py-4 px-4 text-sm font-semibold text-text-secondary">Role</th>
                        <th className="text-left py-4 px-4 text-sm font-semibold text-text-secondary">Status</th>
                        <th className="text-left py-4 px-4 text-sm font-semibold text-text-secondary">Transaksi</th>
                        <th className="text-left py-4 px-4 text-sm font-semibold text-text-secondary">Total Belanja</th>
                        <th className="text-left py-4 px-4 text-sm font-semibold text-text-secondary">Bergabung</th>
                        <th className="text-left py-4 px-4 text-sm font-semibold text-text-secondary">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map((userItem) => (
                        <tr key={userItem.id} className="hover:bg-surface/50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              {userItem.avatar ? (
                                <img
                                  src={userItem.avatar}
                                  alt={userItem.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                                  {userItem.name?.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-text-primary">{userItem.name}</p>
                                <p className="text-sm text-text-secondary">{userItem.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">{getRoleBadge(userItem.role)}</td>
                          <td className="py-4 px-4">{getStatusBadge(userItem.status)}</td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <ShoppingBag className="w-4 h-4 text-text-secondary" />
                              <span className="text-text-primary font-medium">{userItem.totalTransactions}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-text-secondary" />
                              <span className="text-text-primary font-medium">
                                {formatCurrency(userItem.totalSpent || 0)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-sm text-text-secondary">
                            {format(new Date(userItem.createdAt), 'dd MMM yyyy', { locale: id })}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openDetailModal(userItem)}
                                className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-text-secondary hover:text-primary"
                                title="Lihat Detail"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {userItem.status === 'active' && (
                                <button
                                  onClick={() => openActionModal(userItem, 'suspend')}
                                  className="p-2 hover:bg-yellow-500/10 rounded-lg transition-colors text-text-secondary hover:text-yellow-600"
                                  title="Tangguhkan"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                              {userItem.status !== 'active' && userItem.status !== 'pending' && (
                                <button
                                  onClick={() => openActionModal(userItem, 'activate')}
                                  className="p-2 hover:bg-green-500/10 rounded-lg transition-colors text-text-secondary hover:text-green-600"
                                  title="Aktifkan"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
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
                  {users.map((userItem) => (
                    <div key={userItem.id} className="bg-surface rounded-xl p-4 border border-border">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {userItem.avatar ? (
                            <img
                              src={userItem.avatar}
                              alt={userItem.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                              {userItem.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-text-primary">{userItem.name}</p>
                            <p className="text-sm text-text-secondary">{userItem.email}</p>
                          </div>
                        </div>
                        {getStatusBadge(userItem.status)}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-background rounded-lg p-2">
                          <p className="text-xs text-text-secondary">Role</p>
                          <p className="text-sm font-medium">{userItem.role}</p>
                        </div>
                        <div className="bg-background rounded-lg p-2">
                          <p className="text-xs text-text-secondary">Transaksi</p>
                          <p className="text-sm font-medium">{userItem.totalTransactions}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <p className="text-xs text-text-secondary">
                          Bergabung {format(new Date(userItem.createdAt), 'dd MMM yyyy', { locale: id })}
                        </p>
                        <button
                          onClick={() => openDetailModal(userItem)}
                          className="btn-outline px-3 py-1 text-sm"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Detail
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-4 border-t border-border">
                    <p className="text-sm text-text-secondary">
                      Menampilkan {(pagination.page - 1) * ITEMS_PER_PAGE + 1} -{' '}
                      {Math.min(pagination.page * ITEMS_PER_PAGE, pagination.total)} dari {pagination.total} user
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="btn-outline px-3 py-1 disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-4 py-1 text-sm font-medium">
                        {pagination.page} / {pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.totalPages}
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
                <Users className="w-16 h-16 mx-auto text-text-muted mb-4" />
                <p className="text-text-secondary font-medium">Tidak ada user ditemukan</p>
                <p className="text-sm text-text-muted mt-1">
                  {hasActiveFilters() ? 'Coba ubah filter atau kata kunci pencarian' : 'Belum ada user terdaftar'}
                </p>
                {hasActiveFilters() && (
                  <button onClick={resetFilters} className="btn-primary mt-4">
                    Reset Filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ========================================================================
          FILTER MODAL
          ========================================================================= */}
      <AdminModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter User"
        size="lg"
      >
        <div className="space-y-6">
          {/* Status Filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
              <Shield className="w-4 h-4" />
              Status
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STATUS_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setTempFilters({ ...tempFilters, status: option.value })}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    tempFilters.status === option.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-background text-text-primary border-border hover:border-primary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
              <Calendar className="w-4 h-4" />
              Tanggal Bergabung
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Dari</label>
                <input
                  type="date"
                  value={tempFilters.dateFrom}
                  onChange={(e) => setTempFilters({ ...tempFilters, dateFrom: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Sampai</label>
                <input
                  type="date"
                  value={tempFilters.dateTo}
                  onChange={(e) => setTempFilters({ ...tempFilters, dateTo: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Transaction Count Filter */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
              <TrendingUp className="w-4 h-4" />
              Jumlah Transaksi
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Minimum</label>
                <input
                  type="number"
                  value={tempFilters.minTransactions}
                  onChange={(e) => setTempFilters({ ...tempFilters, minTransactions: e.target.value })}
                  placeholder="0"
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Maksimum</label>
                <input
                  type="number"
                  value={tempFilters.maxTransactions}
                  onChange={(e) => setTempFilters({ ...tempFilters, maxTransactions: e.target.value })}
                  placeholder="∞"
                  className="input"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button onClick={resetFilters} className="flex-1 btn-outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </button>
            <button onClick={applyFilters} className="flex-1 btn-primary">
              <Filter className="w-4 h-4 mr-2" />
              Terapkan Filter
            </button>
          </div>
        </div>
      </AdminModal>

      {/* ========================================================================
          USER DETAIL MODAL
          ========================================================================= */}
      <AdminModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detail User"
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="flex items-center gap-4">
              {selectedUser.avatar ? (
                <img
                  src={selectedUser.avatar}
                  alt={selectedUser.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-2xl">
                  {selectedUser.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-text-primary">{selectedUser.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  {getRoleBadge(selectedUser.role)}
                  {getStatusBadge(selectedUser.status)}
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface rounded-xl p-4 flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-secondary">Email</p>
                  <p className="text-sm font-medium text-text-primary truncate">{selectedUser.email}</p>
                </div>
              </div>
              {selectedUser.phone && (
                <div className="bg-surface rounded-xl p-4 flex items-center gap-3">
                  <Phone className="w-5 h-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary">Telepon</p>
                    <p className="text-sm font-medium text-text-primary truncate">{selectedUser.phone}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  <p className="text-sm text-text-secondary">Total Transaksi</p>
                </div>
                <p className="text-2xl font-bold text-text-primary">{selectedUser.totalTransactions}</p>
              </div>
              <div className="bg-surface rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <p className="text-sm text-text-secondary">Total Belanja</p>
                </div>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(selectedUser.totalSpent || 0)}
                </p>
              </div>
            </div>

            {/* Join Date */}
            <div className="bg-surface rounded-xl p-4 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-text-secondary">Bergabung Sejak</p>
                <p className="text-sm font-medium text-text-primary">
                  {format(new Date(selectedUser.createdAt), 'dd MMMM yyyy', { locale: id })}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t border-border">
              <h4 className="font-semibold text-text-primary">Aksi Admin</h4>

              {selectedUser.status === 'active' && (
                <button
                  onClick={() => openActionModal(selectedUser, 'suspend')}
                  className="w-full btn-outline border-yellow-300 dark:border-yellow-700 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 flex items-center justify-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Tangguhkan User
                </button>
              )}

              {selectedUser.status !== 'active' && selectedUser.status !== 'pending' && (
                <button
                  onClick={() => openActionModal(selectedUser, 'activate')}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aktifkan User
                </button>
              )}

              <button
                onClick={() => openActionModal(selectedUser, 'delete')}
                className="w-full btn-outline border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Hapus User
              </button>
            </div>
          </div>
        )}
      </AdminModal>

      {/* ========================================================================
          ACTION CONFIRMATION MODAL
          ========================================================================= */}
      <AdminModal
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        title={
          actionType === 'suspend' ? 'Tangguhkan User' :
          actionType === 'activate' ? 'Aktifkan User' :
          'Hapus User'
        }
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                actionType === 'suspend' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                actionType === 'activate' ? 'bg-green-100 dark:bg-green-900/30' :
                'bg-red-100 dark:bg-red-900/30'
              }`}>
                {actionType === 'suspend' && <Ban className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />}
                {actionType === 'activate' && <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />}
                {actionType === 'delete' && <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />}
              </div>

              <h3 className="text-xl font-bold text-text-primary mb-2">
                {actionType === 'suspend' && 'Tangguhkan User?'}
                {actionType === 'activate' && 'Aktifkan User?'}
                {actionType === 'delete' && 'Hapus User?'}
              </h3>

              <p className="text-text-secondary">
                {actionType === 'suspend' && `User "${selectedUser.name}" akan ditangguhkan dan tidak dapat mengakses sistem.`}
                {actionType === 'activate' && `User "${selectedUser.name}" akan diaktifkan kembali.`}
                {actionType === 'delete' && `User "${selectedUser.name}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
              </p>
            </div>

            {actionType === 'delete' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-sm text-red-800 dark:text-red-300">
                  <strong>Peringatan:</strong> Menghapus user akan menghapus semua data terkait termasuk riwayat transaksi, ulasan, dan data lainnya.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowActionModal(false)}
                disabled={isActionLoading}
                className="flex-1 btn-outline"
              >
                Batal
              </button>
              <button
                onClick={handleUserAction}
                disabled={isActionLoading}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  actionType === 'suspend' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                  actionType === 'activate' ? 'bg-green-500 hover:bg-green-600 text-white' :
                  'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {isActionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    {actionType === 'suspend' && <><Ban className="w-4 h-4" /> Tangguhkan</>}
                    {actionType === 'activate' && <><CheckCircle className="w-4 h-4" /> Aktifkan</>}
                    {actionType === 'delete' && <><Trash2 className="w-4 h-4" /> Hapus</>}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
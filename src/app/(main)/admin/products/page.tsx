  // src/app/(main)/admin/products/page.tsx
  'use client';

  import { useEffect, useState, useCallback } from 'react';
  import { useRouter } from 'next/navigation';
  import { useAuth } from '@/context/AuthContext';
  import { AdminSidebar } from '@/components/admin/AdminSidebar';
  import { getCookie } from '@/lib/auth';
  import { format } from 'date-fns';
  import { id } from 'date-fns/locale';
  import toast from 'react-hot-toast';
  import { 
    Package, Search, Filter, Loader2, Eye, CheckCircle, 
    XCircle, Trash2, ChevronLeft, ChevronRight, RefreshCw,
    AlertCircle, X, ShoppingCart, TrendingUp, Calendar,
    Tag, User, Image as ImageIcon, Menu
  } from 'lucide-react';

  // ============================================================================
  // TYPES
  // ============================================================================
  interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    unit: string;
    stock: number;
    soldCount: number;
    minOrder: number;
    status: string;
    category: string;
    categoryId: number | null;
    categoryName: string;
    imagePath: string | null;
    harvestDate: string | null;
    seller: {
      id: number;
      name: string;
      email: string;
    };
    stats: {
      completedOrders: number;
      totalRevenue: number;
    };
    createdAt: string;
    updatedAt: string;
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
    all: number;
    pending: number;
    ready_stock: number;
    pre_order: number;
    sold_out: number;
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  const STATUS_OPTIONS = [
    { value: 'all', label: 'Semua', color: 'bg-gray-500' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
    { value: 'ready_stock', label: 'Ready Stock', color: 'bg-green-500' },
    { value: 'pre-order', label: 'Pre-Order', color: 'bg-blue-500' },
    { value: 'sold_out', label: 'Sold Out', color: 'bg-red-500' },
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
    const config: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: 'Pending' },
      ready_stock: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: 'Ready Stock' },
      'pre-order': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', label: 'Pre-Order' },
      sold_out: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: 'Sold Out' },
      deleted: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-300', label: 'Dihapus' },
    };
    const { bg, text, label } = config[status] || config.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  // ============================================================================
  // MAIN COMPONENT
  // ============================================================================
  export default function AdminProductsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    
    // ✅ State untuk sidebar
    const [sidebarOpen, setSidebarOpen] = useState(false);
    
    // ✅ State untuk data
    const [products, setProducts] = useState<Product[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionType, setActionType] = useState<'approve' | 'reject' | 'delete'>('approve');
    const [actionNote, setActionNote] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ✅ Redirect if not admin
    useEffect(() => {
      if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
        toast.error('Akses ditolak. Halaman ini hanya untuk admin.');
        router.push('/');
      }
    }, [isAuthenticated, authLoading, user, router]);

    // ✅ Fetch products
    const fetchProducts = useCallback(async (showRefreshIndicator = false) => {
      try {
        if (showRefreshIndicator) {
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

        const res = await fetch(`/api/admin/products?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || 'Gagal memuat produk');
        }

        setProducts(result.data?.products || []);
        setPagination(result.data?.pagination || null);
        setStatusCounts(result.data?.statusCounts || null);
      } catch (error: any) {
        console.error('Fetch products error:', error);
        toast.error(error.message || 'Gagal memuat data produk');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }, [currentPage, statusFilter, searchQuery]);

    useEffect(() => {
      if (isAuthenticated && user?.role === 'admin') {
        fetchProducts();
      }
    }, [isAuthenticated, user, fetchProducts]);

    // ✅ Debounced search
    useEffect(() => {
      const timer = setTimeout(() => {
        if (currentPage !== 1) setCurrentPage(1);
        else fetchProducts();
      }, 500);
      return () => clearTimeout(timer);
    }, [searchQuery]);

    // ✅ Handle status filter change
    const handleStatusFilterChange = (status: string) => {
      setStatusFilter(status);
      setCurrentPage(1);
    };

    // ✅ Handle product action
    const handleProductAction = async () => {
      if (!selectedProduct) return;

      setIsActionLoading(true);
      try {
        const token = getCookie('accessToken');
        if (!token) throw new Error('Token tidak ditemukan');

        let endpoint = `/api/admin/products/${selectedProduct.id}`;
        let method = 'PATCH';
        let body: any = {};

        if (actionType === 'approve') {
          body = { status: 'ready_stock', note: actionNote };
        } else if (actionType === 'reject') {
          body = { status: 'pending', note: actionNote };
        } else if (actionType === 'delete') {
          method = 'DELETE';
          body = { note: actionNote };
        }

        const res = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || 'Gagal memproses aksi');
        }

        const actionLabels = {
          approve: 'disetujui',
          reject: 'dikembalikan ke pending',
          delete: 'dihapus',
        };

        toast.success(`Produk berhasil ${actionLabels[actionType]}`);
        setShowActionModal(false);
        setShowDetailModal(false);
        setActionNote('');
        fetchProducts();
      } catch (error: any) {
        console.error('Product action error:', error);
        toast.error(error.message || 'Gagal memproses aksi');
      } finally {
        setIsActionLoading(false);
      }
    };

    // ✅ Open action modal
    const openActionModal = (type: 'approve' | 'reject' | 'delete') => {
      setActionType(type);
      setActionNote('');
      setShowActionModal(true);
    };

    // ✅ Close sidebar on mobile when clicking outside
    useEffect(() => {
      const handleOutsideClick = (e: MouseEvent) => {
        const sidebar = document.querySelector('[data-sidebar]');
        if (sidebarOpen && sidebar && !sidebar.contains(e.target as Node)) {
          setSidebarOpen(false);
        }
      };

      if (sidebarOpen) {
        document.addEventListener('mousedown', handleOutsideClick);
      }

      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
      };
    }, [sidebarOpen]);

    return (
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main Content */}
        <main className="flex-1 lg:ml-0 ">
          {/* Mobile Header */}
          <div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-surface rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-bold text-text-primary">Kelola Produk</h1>
            </div>
            <button
              onClick={() => fetchProducts(true)}
              disabled={isRefreshing}
              className="p-2 hover:bg-surface rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
                  <Package className="w-8 h-8 text-primary" />
                  Kelola Produk
                </h1>
                <p className="text-text-secondary mt-1">
                  {pagination?.total || 0} produk terdaftar
                </p>
              </div>
              <button
                onClick={() => fetchProducts(true)}
                disabled={isRefreshing}
                className="btn-outline flex items-center gap-2 self-start"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Status Counts Cards */}
            {statusCounts && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {STATUS_OPTIONS.map((option) => {
                  const count = statusCounts[option.value as keyof StatusCounts] || 0;
                  const isActive = statusFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleStatusFilterChange(option.value)}
                      className={`card transition-all ${
                        isActive 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : 'hover:bg-surface-hover'
                      }`}
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

            {/* Search & Filter Bar */}
            <div className="card mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari produk, seller, atau kategori..."
                    className="input pl-12"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                  className="input sm:w-48"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Products Table/List */}
            <div className="card overflow-hidden">
              {products.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="w-16 h-16 mx-auto text-text-muted mb-4" />
                  <p className="text-text-secondary font-medium mb-1">
                    Tidak ada produk ditemukan
                  </p>
                  <p className="text-sm text-text-muted">
                    {searchQuery 
                      ? 'Coba ubah kata kunci pencarian' 
                      : 'Belum ada produk dengan status ini'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-surface border-b border-border">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Produk</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Harga</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Stok</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Terjual</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Seller</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {products.map((product) => (
                          <tr key={product.id} className="hover:bg-surface/50 transition-colors">
                            {/* Product Info */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-surface rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 border border-border">
                                  {product.imagePath ? (
                                    <img 
                                      src={product.imagePath} 
                                      alt={product.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="w-6 h-6 text-text-muted" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-text-primary truncate max-w-[200px]">
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-text-secondary truncate">
                                    {product.categoryName || product.category || 'Tanpa kategori'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Price */}
                            <td className="py-3 px-4">
                              <p className="font-semibold text-text-primary">
                                {formatCurrency(product.price)}
                              </p>
                              <p className="text-xs text-text-secondary">/{product.unit}</p>
                            </td>

                            {/* Stock */}
                            <td className="py-3 px-4">
                              <p className={`font-semibold ${
                                product.stock === 0 
                                  ? 'text-red-500' 
                                  : product.stock < 10 
                                    ? 'text-yellow-500' 
                                    : 'text-text-primary'
                              }`}>
                                {product.stock}
                              </p>
                              <p className="text-xs text-text-secondary">Min: {product.minOrder}</p>
                            </td>

                            {/* Sold */}
                            <td className="py-3 px-4">
                              <p className="font-semibold text-text-primary">
                                {product.soldCount}
                              </p>
                              <p className="text-xs text-text-secondary">
                                {product.stats.completedOrders} order
                              </p>
                            </td>

                            {/* Seller */}
                            <td className="py-3 px-4">
                              <p className="font-medium text-text-primary truncate max-w-[150px]">
                                {product.seller.name || '-'}
                              </p>
                              <p className="text-xs text-text-secondary truncate max-w-[150px]">
                                {product.seller.email}
                              </p>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4">
                              {getStatusBadge(product.status)}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedProduct(product);
                                    setShowDetailModal(true);
                                  }}
                                  className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-text-secondary hover:text-primary"
                                  title="Lihat Detail"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {product.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedProduct(product);
                                        openActionModal('approve');
                                      }}
                                      className="p-2 hover:bg-green-500/10 rounded-lg transition-colors text-text-secondary hover:text-green-500"
                                      title="Setujui"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedProduct(product);
                                        openActionModal('reject');
                                      }}
                                      className="p-2 hover:bg-yellow-500/10 rounded-lg transition-colors text-text-secondary hover:text-yellow-500"
                                      title="Tolak"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedProduct(product);
                                    openActionModal('delete');
                                  }}
                                  className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-text-secondary hover:text-red-500"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3 p-4">
                    {products.map((product) => (
                      <div key={product.id} className="bg-surface rounded-xl p-4 border border-border">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-16 h-16 bg-background rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 border border-border">
                            {product.imagePath ? (
                              <img 
                                src={product.imagePath} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-text-muted" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-text-primary truncate">
                              {product.name}
                            </p>
                            <p className="text-xs text-text-secondary mb-1">
                              {product.categoryName || product.category}
                            </p>
                            <p className="font-bold text-primary">
                              {formatCurrency(product.price)}
                              <span className="text-xs text-text-secondary font-normal">/{product.unit}</span>
                            </p>
                          </div>
                          {getStatusBadge(product.status)}
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                          <div className="bg-background rounded-lg p-2">
                            <p className="text-xs text-text-secondary">Stok</p>
                            <p className="font-semibold text-text-primary">{product.stock}</p>
                          </div>
                          <div className="bg-background rounded-lg p-2">
                            <p className="text-xs text-text-secondary">Terjual</p>
                            <p className="font-semibold text-text-primary">{product.soldCount}</p>
                          </div>
                          <div className="bg-background rounded-lg p-2">
                            <p className="text-xs text-text-secondary">Seller</p>
                            <p className="font-semibold text-text-primary text-xs truncate">
                              {product.seller.name || '-'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowDetailModal(true);
                            }}
                            className="btn-outline flex-1 py-2 text-sm"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Detail
                          </button>
                          {product.status === 'pending' && (
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                openActionModal('approve');
                              }}
                              className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              <CheckCircle className="w-4 h-4 inline mr-1" />
                              Setujui
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              openActionModal('delete');
                            }}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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
                        {pagination.total} produk
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={!pagination.hasPrev}
                          className="p-2 rounded-lg border border-border hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-4 py-2 text-sm font-medium text-text-primary">
                          {currentPage} / {pagination.totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={!pagination.hasNext}
                          className="p-2 rounded-lg border border-border hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>

        {/* Detail Modal */}
        {showDetailModal && selectedProduct && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl w-full max-w-200 max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary">Detail Produk</h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-surface rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Product Image & Basic Info */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-48 h-48 bg-surface rounded-xl flex items-center justify-center overflow-hidden border border-border flex-shrink-0">
                    {selectedProduct.imagePath ? (
                      <img 
                        src={selectedProduct.imagePath} 
                        alt={selectedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-16 h-16 text-text-muted" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-text-primary mb-2">
                      {selectedProduct.name}
                    </h3>
                    <div className="flex items-center gap-2 mb-3">
                      {getStatusBadge(selectedProduct.status)}
                      <span className="text-sm text-text-secondary">
                        #{selectedProduct.id}
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-primary mb-1">
                      {formatCurrency(selectedProduct.price)}
                      <span className="text-base text-text-secondary font-normal">/{selectedProduct.unit}</span>
                    </p>
                    <p className="text-sm text-text-secondary">
                      Min. order: {selectedProduct.minOrder} {selectedProduct.unit}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {selectedProduct.description && (
                  <div>
                    <h4 className="font-semibold text-text-primary mb-2">Deskripsi</h4>
                    <p className="text-text-secondary text-sm whitespace-pre-line">
                      {selectedProduct.description}
                    </p>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-surface rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-primary" />
                      <p className="text-xs text-text-secondary">Stok</p>
                    </div>
                    <p className="text-2xl font-bold text-text-primary">{selectedProduct.stock}</p>
                  </div>
                  <div className="bg-surface rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                      <p className="text-xs text-text-secondary">Terjual</p>
                    </div>
                    <p className="text-2xl font-bold text-text-primary">{selectedProduct.soldCount}</p>
                  </div>
                  <div className="bg-surface rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <p className="text-xs text-text-secondary">Order Selesai</p>
                    </div>
                    <p className="text-2xl font-bold text-text-primary">{selectedProduct.stats.completedOrders}</p>
                  </div>
                  <div className="bg-surface rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-primary" />
                      <p className="text-xs text-text-secondary">Kategori</p>
                    </div>
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {selectedProduct.categoryName || selectedProduct.category || '-'}
                    </p>
                  </div>
                </div>

                {/* Seller Info */}
                <div className="bg-surface rounded-xl p-4">
                  <h4 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Informasi Seller
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-text-secondary">Nama</p>
                      <p className="font-medium text-text-primary">{selectedProduct.seller.name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">Email</p>
                      <p className="font-medium text-text-primary">{selectedProduct.seller.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">ID Seller</p>
                      <p className="font-medium text-text-primary">#{selectedProduct.seller.id}</p>
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Dibuat: {format(new Date(selectedProduct.createdAt), 'dd MMM yyyy, HH:mm', { locale: id })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Diperbarui: {format(new Date(selectedProduct.updatedAt), 'dd MMM yyyy, HH:mm', { locale: id })}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
                  {selectedProduct.status === 'pending' && (
                    <>
                      <button
                        onClick={() => openActionModal('approve')}
                        className="btn-primary flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Setujui Produk
                      </button>
                      <button
                        onClick={() => openActionModal('reject')}
                        className="btn-outline flex-1 border-yellow-300 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Kembalikan ke Pending
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => openActionModal('delete')}
                    className="btn-outline flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Hapus Produk
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Confirmation Modal */}
        {showActionModal && selectedProduct && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-background rounded-2xl w-full max-w-200">
              <div className="p-6">
                {/* Icon */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  actionType === 'approve' 
                    ? 'bg-green-500/10' 
                    : actionType === 'reject'
                      ? 'bg-yellow-500/10'
                      : 'bg-red-500/10'
                }`}>
                  {actionType === 'approve' && <CheckCircle className="w-8 h-8 text-green-500" />}
                  {actionType === 'reject' && <XCircle className="w-8 h-8 text-yellow-500" />}
                  {actionType === 'delete' && <Trash2 className="w-8 h-8 text-red-500" />}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-text-primary text-center mb-2">
                  {actionType === 'approve' && 'Setujui Produk?'}
                  {actionType === 'reject' && 'Kembalikan ke Pending?'}
                  {actionType === 'delete' && 'Hapus Produk?'}
                </h3>

                <p className="text-text-secondary text-center mb-4">
                  {actionType === 'approve' && `Produk "${selectedProduct.name}" akan diubah statusnya menjadi Ready Stock.`}
                  {actionType === 'reject' && `Produk "${selectedProduct.name}" akan dikembalikan ke status Pending.`}
                  {actionType === 'delete' && `Produk "${selectedProduct.name}" akan dihapus dan tidak dapat dikembalikan.`}
                </p>

                {/* Note Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Catatan untuk Seller (Opsional)
                  </label>
                  <textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Tulis alasan atau catatan..."
                    rows={3}
                    className="input"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowActionModal(false);
                      setActionNote('');
                    }}
                    disabled={isActionLoading}
                    className="btn-outline flex-1"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleProductAction}
                    disabled={isActionLoading}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                      actionType === 'approve'
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : actionType === 'reject'
                          ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                          : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {isActionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        {actionType === 'approve' && <CheckCircle className="w-4 h-4" />}
                        {actionType === 'reject' && <XCircle className="w-4 h-4" />}
                        {actionType === 'delete' && <Trash2 className="w-4 h-4" />}
                        Konfirmasi
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
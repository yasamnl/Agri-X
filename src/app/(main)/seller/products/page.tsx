'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import Image from 'next/image';
import {
  Package, Plus, Search, Filter, Edit, Trash2, Eye,
  Loader2, Star, AlertTriangle, TrendingUp, ArrowUpDown,
  LayoutGrid, List, ChevronLeft, ChevronRight, X,
  Store, DollarSign, ShoppingBag, BarChart3, ArrowLeft
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  stock: number;
  minOrder: number;
  soldCount: number;
  category: string | null;
  status: 'ready_stock' | 'pre_order' | 'sold_out' | 'deleted';
  harvestDate: string | null;
  imagePath: string | null;
  poQuota: number | null;
  poSold: number;
  avgRating: number;
  reviewCount: number;
  createdAt: string;
}

interface StatusCounts {
  all: number;
  ready_stock: number;
  pre_order: number;
  sold_out: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const STATUS_TABS = [
  { id: 'all', label: 'Semua', icon: Package, color: 'bg-gray-500' },
  { id: 'ready_stock', label: 'Ready Stock', icon: Package, color: 'bg-green-500' },
  { id: 'pre_order', label: 'Pre-Order', icon: Package, color: 'bg-yellow-500' },
  { id: 'sold_out', label: 'Habis', icon: Package, color: 'bg-red-500' },
];

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Terbaru' },
  { value: 'name', label: 'Nama (A-Z)' },
  { value: 'price', label: 'Harga Terendah' },
  { value: 'stock', label: 'Stok Terbanyak' },
  { value: 'sold_count', label: 'Paling Laku' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const getStatusBadge = (status: string) => {
  const config: Record<string, { className: string; label: string }> = {
    ready_stock: { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'Ready Stock' },
    pre_order: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', label: 'Pre-Order' },
    sold_out: { className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Habis' },
  };
  const { className, label } = config[status] || config.ready_stock;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
};

const getStockStatus = (stock: number, status: string) => {
  if (status === 'pre_order') return { label: 'PO', color: 'text-yellow-600', bg: 'bg-yellow-50' };
  if (stock === 0) return { label: 'Habis', color: 'text-red-600', bg: 'bg-red-50' };
  if (stock <= 10) return { label: 'Stok Rendah', color: 'text-orange-600', bg: 'bg-orange-50' };
  return { label: 'Tersedia', color: 'text-green-600', bg: 'bg-green-50' };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function SellerProductsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auth check
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'seller')) {
      toast.error('Akses ditolak. Halaman ini hanya untuk penjual.');
      router.push('/akun');
    }
  }, [isAuthenticated, authLoading, user, router]);

  // Fetch products
  useEffect(() => {
    if (isAuthenticated && user?.role === 'seller') {
      fetchProducts();
    }
  }, [isAuthenticated, user, currentPage, statusFilter, searchQuery, sortBy]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        status: statusFilter,
        sortBy,
      });

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await fetch(`/api/seller/products?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal memuat produk');
      }

      setProducts(result.data?.products || []);
      setStatusCounts(result.data?.statusCounts || null);
      setTotalPages(result.data?.pagination?.totalPages || 1);
      setTotalItems(result.data?.pagination?.total || 0);
    } catch (error: any) {
      console.error('Fetch products error:', error);
      toast.error(error.message || 'Gagal memuat produk');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    setIsDeleting(true);
    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/seller/products/${selectedProduct.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal menghapus produk');
      }

      toast.success('Produk berhasil dihapus');
      setShowDeleteModal(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus produk');
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'seller') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* ====================================================================
            HEADER
        ==================================================================== */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/akun')}
            className="flex items-center gap-2 text-text-secondary hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Kembali ke Akun</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary flex items-center gap-2">
                <Store className="w-7 h-7 text-primary" />
                Produk Saya
              </h1>
              <p className="text-text-secondary mt-1">
                Kelola {totalItems} produk di toko Anda
              </p>
            </div>
            <button
              onClick={() => router.push('/seller/products/new')}
              className="btn-primary flex items-center gap-2 self-start"
            >
              <Plus className="w-4 h-4" />
              Tambah Produk
            </button>
          </div>
        </div>

        {/* ====================================================================
            STATS CARDS
        ==================================================================== */}
        {statusCounts && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <Package className="w-6 h-6 mb-2 opacity-80" />
              <p className="text-2xl font-bold">{statusCounts.all}</p>
              <p className="text-xs opacity-90">Total Produk</p>
            </div>
            <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
              <Package className="w-6 h-6 mb-2 opacity-80" />
              <p className="text-2xl font-bold">{statusCounts.ready_stock}</p>
              <p className="text-xs opacity-90">Ready Stock</p>
            </div>
            <div className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
              <Package className="w-6 h-6 mb-2 opacity-80" />
              <p className="text-2xl font-bold">{statusCounts.pre_order}</p>
              <p className="text-xs opacity-90">Pre-Order</p>
            </div>
            <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
              <Package className="w-6 h-6 mb-2 opacity-80" />
              <p className="text-2xl font-bold">{statusCounts.sold_out}</p>
              <p className="text-xs opacity-90">Habis</p>
            </div>
          </div>
        )}

        {/* ====================================================================
            FILTERS
        ==================================================================== */}
        <div className="card mb-6">
          {/* Search & View Mode */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari produk..."
                className="input pl-12"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input sm:w-48"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              
              <div className="flex bg-surface rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {STATUS_TABS.map((tab) => {
              const Icon = tab.icon;
              const count = statusCounts?.[tab.id as keyof StatusCounts] || 0;
              const isActive = statusFilter === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-surface text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
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

        {/* ====================================================================
            PRODUCTS LIST
        ==================================================================== */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="card text-center py-16">
            <Package className="w-20 h-20 mx-auto text-text-muted mb-4" />
            <h3 className="text-lg font-bold text-text-primary mb-2">
              {searchQuery || statusFilter !== 'all' 
                ? 'Tidak ada produk ditemukan' 
                : 'Belum ada produk'}
            </h3>
            <p className="text-text-secondary mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Coba ubah filter atau kata kunci pencarian'
                : 'Mulai tambahkan produk pertama Anda'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={() => router.push('/seller/products/new')}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Tambah Produk Pertama
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => {
                  const stockStatus = getStockStatus(product.stock, product.status);
                  
                  return (
                    <div
                      key={product.id}
                      className="card overflow-hidden hover:shadow-lg transition-shadow group"
                    >
                      {/* Image */}
                      <div className="relative aspect-square bg-surface overflow-hidden">
                        {product.imagePath ? (
                          <Image
                            src={product.imagePath}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-16 h-16 text-text-muted" />
                          </div>
                        )}
                        
                        {/* Status Badge */}
                        <div className="absolute top-2 left-2">
                          {getStatusBadge(product.status)}
                        </div>

                        {/* Stock Badge */}
                        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                          {stockStatus.label}
                        </div>

                        {/* Quick Actions (hover) */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={() => router.push(`/produk/${product.id}`)}
                            className="p-2 bg-white rounded-full hover:bg-primary hover:text-white transition-colors"
                            title="Lihat"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => router.push(`/seller/products/${product.id}/edit`)}
                            className="p-2 bg-white rounded-full hover:bg-primary hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowDeleteModal(true);
                            }}
                            className="p-2 bg-white rounded-full hover:bg-red-500 hover:text-white transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <h3 className="font-semibold text-text-primary line-clamp-2 mb-1 min-h-[2.5rem]">
                          {product.name}
                        </h3>
                        
                        {product.category && (
                          <p className="text-xs text-text-secondary mb-2">
                            {product.category}
                          </p>
                        )}

                        <div className="flex items-center justify-between mb-2">
                          <p className="text-lg font-bold text-primary">
                            {formatCurrency(product.price)}
                          </p>
                          <span className="text-xs text-text-secondary">
                            /{product.unit}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-text-secondary pt-2 border-t border-border">
                          <div className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            <span>Stok: {product.stock}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" />
                            <span>Terjual: {product.soldCount}</span>
                          </div>
                        </div>

                        {product.reviewCount > 0 && (
                          <div className="flex items-center gap-1 mt-2 text-xs">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            <span className="font-medium text-text-primary">
                              {product.avgRating.toFixed(1)}
                            </span>
                            <span className="text-text-secondary">
                              ({product.reviewCount})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface border-b border-border">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Produk</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Harga</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Stok</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Terjual</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {products.map((product) => {
                        const stockStatus = getStockStatus(product.stock, product.status);
                        
                        return (
                          <tr key={product.id} className="hover:bg-surface/50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-surface rounded-lg overflow-hidden flex-shrink-0">
                                  {product.imagePath ? (
                                    <Image
                                      src={product.imagePath}
                                      alt={product.name}
                                      width={48}
                                      height={48}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="w-6 h-6 text-text-muted" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-text-primary truncate max-w-[200px]">
                                    {product.name}
                                  </p>
                                  {product.category && (
                                    <p className="text-xs text-text-secondary">{product.category}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-text-primary">
                                {formatCurrency(product.price)}
                              </p>
                              <p className="text-xs text-text-secondary">/{product.unit}</p>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                                {product.stock} {product.unit}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-text-primary">{product.soldCount}</p>
                            </td>
                            <td className="py-3 px-4">
                              {getStatusBadge(product.status)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => router.push(`/seller/products/${product.id}/edit`)}
                                  className="p-2 hover:bg-surface rounded-lg transition-colors text-text-secondary hover:text-primary"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedProduct(product);
                                    setShowDeleteModal(true);
                                  }}
                                  className="p-2 hover:bg-surface rounded-lg transition-colors text-text-secondary hover:text-red-500"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 px-4 py-4 card">
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
        )}
      </div>

      {/* ====================================================================
          DELETE CONFIRMATION MODAL
      ==================================================================== */}
      {showDeleteModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl w-full max-w-md p-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-xl font-bold text-text-primary text-center mb-2">
              Hapus Produk?
            </h3>
            
            <p className="text-text-secondary text-center mb-4">
              Apakah Anda yakin ingin menghapus produk{' '}
              <strong className="text-text-primary">"{selectedProduct.name}"</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedProduct(null);
                }}
                disabled={isDeleting}
                className="btn-outline flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Hapus
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
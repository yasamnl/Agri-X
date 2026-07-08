// src/components/account/SellerProductsTab.tsx
'use client';

import react from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import { normalizeImageUrl } from '@/lib/image-helpers';
import toast from 'react-hot-toast';
import Image from 'next/image';
import {
  Package, Plus, Search, Edit, Trash2, Eye,
  Loader2, Star, LayoutGrid, List, X,
  ShoppingBag, RefreshCw, CheckCircle,
} from 'lucide-react';
import { ProductFormModal } from '@/components/seller/ProductFormModal';
import { ProductDeleteModal } from '@/components/seller/ProductDeleteModal';
import {Product} from '@/types/product';

// ============================================================================
// TYPES
// ============================================================================

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
  { id: 'all', label: 'Semua', color: 'bg-gray-500' },
  { id: 'ready_stock', label: 'Ready Stock', color: 'bg-green-500' },
  { id: 'pre_order', label: 'Pre-Order', color: 'bg-yellow-500' },
  { id: 'sold_out', label: 'Habis', color: 'bg-red-500' },
];

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Terbaru' },
  { value: 'name', label: 'Nama (A-Z)' },
  { value: 'price', label: 'Harga Terendah' },
  { value: 'stock', label: 'Stok Terbanyak' },
  { value: 'sold_count', label: 'Paling Laku' },
];

const ITEMS_PER_PAGE = 12;

// ============================================================================
// HELPERS
// ============================================================================
const getStatusBadge = (status: string) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    ready_stock: {
      bg: 'bg-green-100 dark:bg-green-900',
      text: 'text-green-800 dark:text-green-300',
      label: 'Ready Stock',
    },
    pre_order: {
      bg: 'bg-yellow-100 dark:bg-yellow-900',
      text: 'text-yellow-800 dark:text-yellow-300',
      label: 'Pre-Order',
    },
    sold_out: {
      bg: 'bg-red-100 dark:bg-red-900',
      text: 'text-red-800 dark:text-red-300',
      label: 'Habis',
    },
  };
  const { bg, text, label } = config[status] || config.ready_stock;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
};

const getStockStatus = (stock: number, status: string) => {
  if (status === 'pre_order') {
    return {
      label: 'PO',
      color: 'text-yellow-700 dark:text-yellow-300',
      bg: 'bg-yellow-50 dark:bg-yellow-900',
    };
  }
  if (stock === 0) {
    return {
      label: 'Habis',
      color: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-50 dark:bg-red-900',
    };
  }
  if (stock <= 10) {
    return {
      label: 'Stok Rendah',
      color: 'text-orange-700 dark:text-orange-300',
      bg: 'bg-orange-50 dark:bg-orange-900',
    };
  }
  return {
    label: 'Tersedia',
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-900',
  };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function SellerProductsTab() {
  const router = useRouter();
  const { user } = useAuth();

  // ✅ State untuk infinite scroll
  const [products, setProducts] = react.useState<Product[]>([]);
  const [statusCounts, setStatusCounts] = react.useState<StatusCounts | null>(null);
  const [page, setPage] = react.useState(1);
  const [hasMore, setHasMore] = react.useState(true);
  const [isLoading, setIsLoading] = react.useState(true);
  const [isLoadingMore, setIsLoadingMore] = react.useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = react.useState('all');
  const [searchInput, setSearchInput] = react.useState('');
  const [searchQuery, setSearchQuery] = react.useState('');
  const [sortBy, setSortBy] = react.useState('created_at');
  const [viewMode, setViewMode] = react.useState<'grid' | 'list'>('grid');

  // Modals
  const [showFormModal, setShowFormModal] = react.useState(false);
  const [showDeleteModal, setShowDeleteModal] = react.useState(false);
  const [selectedProduct, setSelectedProduct] = react.useState<Product | null>(null);
  const [isCreateMode, setIsCreateMode] = react.useState(false);

  // ✅ ANTI-SPAM: Refs untuk cegah multiple fetch
  const hasFetchedRef = react.useRef(false);
  const isFetchingRef = react.useRef(false);
  const loadMoreRef = react.useRef<HTMLDivElement | null>(null);
  const observerRef = react.useRef<IntersectionObserver | null>(null);

  // ✅ DEBOUNCE: Search input dengan delay 500ms
  react.useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // ✅ RESET: Saat filter berubah, reset semua state
  react.useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    hasFetchedRef.current = false;
  }, [statusFilter, searchQuery, sortBy]);

  // ✅ FETCH: Load products dengan anti-spam
  const fetchProducts = react.useCallback(
    async (pageNum: number, append: boolean = false) => {
      // Guard 1: Already fetching
      if (isFetchingRef.current) {
        if (process.env.NODE_ENV === 'development') console.log('⏸️ [PRODUCTS] Skip - already fetching');
        return;
      }

      // Guard 2: No more data
      if (append && !hasMore) {
        if (process.env.NODE_ENV === 'development') console.log('⏸️ [PRODUCTS] Skip - no more data');
        return;
      }

      isFetchingRef.current = true;

      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const token = getCookie('accessToken');
        if (!token) throw new Error('Token tidak ditemukan');

        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: ITEMS_PER_PAGE.toString(),
          status: statusFilter,
          sortBy,
        });

        if (searchQuery.trim()) {
          params.append('search', searchQuery.trim());
        }

        const res = await fetch(`/api/seller/products?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await res.json();
        if (!result.success) {
          throw new Error(result.error || 'Gagal memuat produk');
        }

        const newProducts = result.data?.products || [];
        const totalCount = result.data?.pagination?.total || 0;

        if (append) {
          setProducts((prev) => [...prev, ...newProducts]);
        } else {
          setProducts(newProducts);
        }

        setStatusCounts(result.data?.statusCounts || null);

        // Check if there are more products
        const totalLoaded = append ? products.length + newProducts.length : newProducts.length;
        setHasMore(totalLoaded < totalCount);

        hasFetchedRef.current = true;
      } catch (error: any) {
        console.error('❌ Fetch products error:', error);
        toast.error(error.message || 'Gagal memuat produk');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [statusFilter, searchQuery, sortBy, products.length, hasMore]
  );

  // ✅ INITIAL FETCH: Saat component mount
  react.useEffect(() => {
    if (user?.role === 'seller' && !hasFetchedRef.current) {
      fetchProducts(1, false);
    }
  }, [user, fetchProducts]);

  // ✅ LOAD MORE: Saat page berubah
  react.useEffect(() => {
    if (page > 1 && hasFetchedRef.current) {
      fetchProducts(page, true);
    }
  }, [page, fetchProducts]);

  // ✅ INFINITE SCROLL: IntersectionObserver
  react.useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          if (process.env.NODE_ENV === 'development') console.log('📜 [INFINITE SCROLL] Load more triggered');
          setPage((prev) => prev + 1);
        }
      },
      {
        root: null,
        rootMargin: '200px', // Trigger 200px sebelum reach bottom
        threshold: 0.1,
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, isLoading]);

  // ✅ HANDLERS
  const handleCreate = () => {
    setSelectedProduct(null);
    setIsCreateMode(true);
    setShowFormModal(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsCreateMode(false);
    setShowFormModal(true);
  };

  const handleDelete = (product: Product) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  const handleSuccess = () => {
    // Reset dan reload dari awal
    setProducts([]);
    setPage(1);
    setHasMore(true);
    hasFetchedRef.current = false;
    fetchProducts(1, false);
  };

  const handleRefresh = () => {
    handleSuccess();
    toast.success('Data berhasil di-refresh');
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            Produk Saya
            {statusCounts && (
              <span className="text-sm font-normal text-text-secondary ml-2">
                ({statusCounts.all} produk)
              </span>
            )}
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Kelola produk di toko Anda
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="btn-outline flex items-center gap-2"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Tambah Produk
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {statusCounts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card bg-linear-to-br from-blue-500 to-blue-600 text-white">
            <Package className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{statusCounts.all}</p>
            <p className="text-xs opacity-90">Total Produk</p>
          </div>
          <div className="card bg-linear-to-br from-green-500 to-green-600 text-white">
            <Package className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{statusCounts.ready_stock}</p>
            <p className="text-xs opacity-90">Ready Stock</p>
          </div>
          <div className="card bg-linear-to-br from-yellow-500 to-yellow-600 text-white">
            <Package className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{statusCounts.pre_order}</p>
            <p className="text-xs opacity-90">Pre-Order</p>
          </div>
          <div className="card bg-linear-to-br from-red-500 to-red-600 text-white">
            <Package className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{statusCounts.sold_out}</p>
            <p className="text-xs opacity-90">Habis</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari produk..."
              className="input pl-12"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort & View Mode */}
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
                  viewMode === 'grid'
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-text-primary'
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
            const count = statusCounts?.[tab.id as keyof StatusCounts] || 0;
            const isActive = statusFilter === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-surface text-text-secondary hover:bg-surface-hover'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${tab.color}`} />
                <span className="text-sm">{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-white/20' : 'bg-border'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Products List */}
      {isLoading && products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-text-secondary mt-3">Memuat produk...</p>
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
            <button onClick={handleCreate} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Tambah Produk Pertama
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => {
                const stockStatus = getStockStatus(product.stock, product.status);
                const imageUrl = normalizeImageUrl(product.image_path);

                return (
                  <div
                    key={product.id}
                    className="card overflow-hidden hover:shadow-lg transition-shadow group"
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-surface overflow-hidden">
                      {product.image_path ? (
                        <Image
                          src={imageUrl}
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


                      {/* Stock Badge */}
                      <div
                        className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}
                      >
                        {stockStatus.label}
                      </div>

                      {/* Quick Actions */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => router.push(`/produk/${product.id}`)}
                          className="p-2 bg-white rounded-full hover:bg-primary hover:text-white transition-colors"
                          title="Lihat"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 bg-white rounded-full hover:bg-primary hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="p-2 bg-white rounded-full hover:bg-red-500 hover:text-white transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="font-semibold text-text-primary line-clamp-2 mb-1 min-h-10">
                        {product.name}
                      </h3>

                      {product.category && (
                        <p className="text-xs text-text-secondary mb-2">{product.category}</p>
                      )}

                      <div className="flex items-center justify-between mb-2">
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(product.price)}
                        </p>
                        <span className="text-xs text-text-secondary">/{product.unit}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-text-secondary pt-2 border-t border-border">
                        <div className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          <span>Stok: {product.stock}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3" />
                          <span>Terjual: {product.sold_count}</span>
                        </div>
                      </div>

                      {product.reviewCount > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium text-text-primary">
                            {product.rating?.toFixed(1) ?? '0.0'}
                          </span>
                          <span className="text-text-secondary">({product.reviewCount})</span>
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
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Produk
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Harga
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Stok
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Terjual
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {products.map((product) => {
                      const stockStatus = getStockStatus(product.stock, product.status);
                      const imageUrl = normalizeImageUrl(product.image_path);

                      return (
                        <tr key={product.id} className="hover:bg-surface/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-surface rounded-lg overflow-hidden shrink-0">
                                {product.image_path ? (
                                  <Image
                                    src={imageUrl}
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
                                <p className="font-medium text-text-primary truncate max-w-50">
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
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}
                            >
                              {product.stock} {product.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-text-primary">{product.sold_count}</p>
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(product.status)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEdit(product)}
                                className="p-2 hover:bg-surface rounded-lg transition-colors text-text-secondary hover:text-primary"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(product)}
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

          {/* ✅ INFINITE SCROLL: Load More Trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex flex-col items-center justify-center py-8">
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  <p className="text-sm text-text-secondary mt-2">Memuat lebih banyak produk...</p>
                </>
              ) : (
                <p className="text-sm text-text-muted">Scroll untuk memuat lebih banyak</p>
              )}
            </div>
          )}

          {/* End of List */}
          {!hasMore && products.length > 0 && (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface rounded-full">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <p className="text-sm text-text-secondary">
                  Semua produk sudah dimuat ({products.length} produk)
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <ProductFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSuccess={handleSuccess}
        product={isCreateMode ? null : (selectedProduct as React.ComponentProps<typeof ProductFormModal>['product'])}
      />

      <ProductDeleteModal
        isOpen={showDeleteModal}
        product={selectedProduct}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
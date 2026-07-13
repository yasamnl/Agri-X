'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Trash2, Minus, Plus, ShoppingCart, Loader2, AlertCircle } from 'lucide-react';
import { getCookie } from '@/lib/auth';
import { CartItem, useCart } from '@/context/CartContext';
import { formatCurrency } from '@/lib/utils';
import { normalizeImageUrl } from '@/lib/image-helpers';
import toast from 'react-hot-toast';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface CartItemExtended extends Omit<CartItem, 'product'> {
  product: {
    id: number;
    name: string;
    price: number;
    unit: string;
    stock: number;
    min_order: number;
    image_path: string | null;
    status: string;
  };
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function CartPage() {
  const router = useRouter(); // ✅ FIX: Import langsung, bukan namespace
  
  const [items, setItems] = useState<CartItemExtended[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { totalItems, totalPrice, refreshCart } = useCart();
  
  // ✅ ANTI-SPAM: Ref untuk cegah multiple fetch
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  // ============================================
  // FETCH CART (dengan anti-spam)
  // ============================================
  const fetchCart = async () => {
    // Guard 1: Already fetching
    if (isFetchingRef.current) {
      console.log('⏸️ [CART] Skip - already fetching');
      return;
    }

    // Guard 2: Already fetched
    if (hasFetchedRef.current) {
      console.log('⏸️ [CART] Skip - already fetched');
      return;
    }

    isFetchingRef.current = true;

    try {
      setIsLoading(true);
      setError(null);
      
      const token = getCookie('accessToken') || localStorage.getItem('accessToken');
      
      if (!token) {
        setError('Silakan login terlebih dahulu');
        router.push('/login?callbackUrl=/cart');
        return;
      }

      const res = await fetch('/api/cart', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError('Sesi expired. Silakan login kembali.');
          router.push('/login?callbackUrl=/cart');
          return;
        }
        
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal mengambil data keranjang');
      }

      const data = await res.json();
      setItems(data.formattedCartItems || []);
      
      // Mark as fetched
      hasFetchedRef.current = true;
      
    } catch (err: any) {
      console.error('❌ Fetch cart error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  // ✅ Initial fetch (hanya sekali)
  useEffect(() => {
    fetchCart();
  }, []);

  // ============================================
  // UPDATE QUANTITY (dengan debounce)
  // ============================================
  const handleUpdateQuantity = async (productId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    // Find item to check constraints
    const item = items.find(i => i.productId === productId);
    if (!item) return;

    // Check min_order
    if (newQuantity < item.product.min_order) {
      toast.error(`Minimum order: ${item.product.min_order} ${item.product.unit}`, {
        duration: 3000,
        position: 'bottom-right',
      });
      return;
    }

    // Check stock (skip for pre-order)
    if (item.product.status !== 'pre_order' && newQuantity > item.product.stock) {
      toast.error(`Stok tersedia: ${item.product.stock} ${item.product.unit}`, {
        duration: 3000,
        position: 'bottom-right',
      });
      return;
    }

    setIsUpdating(productId);
    setError(null);
    
    try {
      const token = getCookie('accessToken') || localStorage.getItem('accessToken');
      
      const res = await fetch(`/api/cart/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          quantity: newQuantity,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal update quantity');
      }

      // Update local state
      setItems(prevItems =>
        prevItems.map(item =>
          item.productId === productId
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
      
      // Refresh cart context
      refreshCart();
      
      toast.success('Quantity diperbarui', {
        duration: 2000,
        position: 'bottom-right',
      });
      
    } catch (err: any) {
      console.error('❌ Update quantity error:', err);
      setError(err.message);
      
      const errorMessage = err.message || 'Gagal memperbarui quantity';
      
      if (errorMessage.includes('Kuota') || errorMessage.includes('quota')) {
        toast.error('Kuota Pre-Order sudah habis', {
          duration: 4000,
          position: 'bottom-right',
        });
      } 
      else if (errorMessage.includes('stok') || errorMessage.includes('stock')) {
        toast.error('Stok tidak mencukupi', {
          duration: 4000,
          position: 'bottom-right',
        });
      }
      else {
        toast.error(errorMessage, {
          duration: 4000,
          position: 'bottom-right',
        });
      }
      
    } finally {
      setIsUpdating(null);
    }
  };

  // ============================================
  // REMOVE ITEM
  // ============================================
  const handleRemove = async (productId: number) => {
    const item = items.find(i => i.productId === productId);
    if (!item) return;

    // Confirmation toast with undo (optional)
    const toastId = toast.loading('Menghapus produk...');
    
    try {
      const token = getCookie('accessToken') || localStorage.getItem('accessToken');
      
      const res = await fetch(`/api/cart/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal menghapus produk');
      }

      // Update local state
      setItems(prevItems => prevItems.filter(item => item.productId !== productId));
      
      // Refresh cart context
      refreshCart();
      
      toast.success('Produk dihapus dari keranjang', {
        id: toastId,
        duration: 2500,
        position: 'bottom-right',
      });
      
    } catch (err: any) {
      console.error('❌ Remove item error:', err);
      setError(err.message);
      
      toast.error(err.message || 'Gagal menghapus produk', {
        id: toastId,
        duration: 4000,
        position: 'bottom-right',
      });
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-text-secondary">Memuat keranjang...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error && items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="card max-w-md text-center">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Error</h2>
          <p className="text-text-secondary mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => router.push('/login')} 
              className="btn-primary"
            >
              Login
            </button>
            <button 
              onClick={() => {
                hasFetchedRef.current = false;
                fetchCart();
              }} 
              className="btn-outline"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // EMPTY STATE
  // ============================================
  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="card max-w-md text-center">
          <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-12 h-12 text-text-muted" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Keranjang Kosong
          </h2>
          <p className="text-text-secondary mb-6">
            Mulai belanja produk pertanian terbaik
          </p>
          <button 
            onClick={() => router.push('/katalog')} 
            className="btn-primary"
          >
            Belanja Sekarang
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary">
            Keranjang Belanja
          </h1>
          <p className="text-text-secondary mt-1">
            {items.length} produk dalam keranjang
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Terjadi kesalahan</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* ============================================
              CART ITEMS
              ============================================ */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const imageUrl = normalizeImageUrl(item.product.image_path);
              const isPreOrder = item.product.status === 'pre_order';
              
              return (
                <div 
                  key={item.id} 
                  className="card flex gap-4 hover:shadow-md transition-shadow"
                >
                  {/* Product Image */}
                  <div className="w-24 h-24 bg-surface rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative">
                    {item.product.image_path ? (
                      <Image
                        src={imageUrl}
                        alt={item.product.name}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-3xl">🌾</span>
                    )}
                    
                    {/* Pre-Order Badge */}
                    {isPreOrder && (
                      <div className="absolute top-1 left-1 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full font-semibold">
                        PO
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text-primary mb-1 line-clamp-2">
                      {item.product.name}
                    </h3>
                    <p className="text-primary font-bold mb-2">
                      {formatCurrency(item.product.price)} / {item.product.unit}
                    </p>
                    
                    {/* Stock Info */}
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      {isPreOrder ? (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          Pre-Order
                        </span>
                      ) : (
                        <span className={`${
                          item.product.stock <= 10 
                            ? 'text-orange-600 dark:text-orange-400' 
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          Stok: {item.product.stock} {item.product.unit}
                        </span>
                      )}
                      {item.product.min_order > 1 && (
                        <span className="text-text-muted">
                          Min: {item.product.min_order}
                        </span>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                          disabled={
                            isUpdating === item.productId || 
                            item.quantity <= item.product.min_order
                          }
                          className="w-8 h-8 rounded-lg bg-surface hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          title="Kurangi"
                        >
                          {isUpdating === item.productId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Minus className="w-4 h-4" />
                          )}
                        </button>
                        
                        <span className="w-12 text-center font-semibold text-text-primary">
                          {item.quantity}
                        </span>
                        
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                          disabled={
                            isUpdating === item.productId || 
                            (!isPreOrder && item.quantity >= item.product.stock)
                          }
                          className="w-8 h-8 rounded-lg bg-surface hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          title="Tambah"
                        >
                          {isUpdating === item.productId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      
                      <button
                        onClick={() => handleRemove(item.productId)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Subtotal */}
                  <div className="text-right shrink-0">
                    <p className="text-xs text-text-secondary mb-1">Subtotal</p>
                    <p className="font-bold text-primary text-lg">
                      {formatCurrency(item.product.price * item.quantity)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ============================================
              ORDER SUMMARY
              ============================================ */}
          <div className="lg:col-span-1">
            <div className="card sticky top-20">
              <h2 className="text-xl font-bold text-text-primary mb-4">
                Ringkasan Pesanan
              </h2>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-text-secondary">
                  <span>Total Item</span>
                  <span className="font-medium">{totalItems} produk</span>
                </div>
                
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(totalPrice)}</span>
                </div>
                
                <div className="flex justify-between text-text-secondary">
                  <span>Ongkos Kirim</span>
                  <button 
                    onClick={() => router.push('/checkout')} 
                    className="text-primary hover:underline text-sm"
                  >
                    Hitung di Checkout
                  </button>
                </div>
                
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-text-primary">Total</span>
                    <span className="text-primary">{formatCurrency(totalPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  💡 Ongkos kirim akan dihitung setelah Anda memilih alamat pengiriman
                </p>
              </div>

              <button
                onClick={() => router.push('/checkout')}
                className="btn-primary w-full py-3 text-base font-semibold"
              >
                Lanjut ke Checkout
              </button>

              <button
                onClick={() => router.push('/katalog')}
                className="btn-outline w-full mt-2"
              >
                Lanjut Belanja
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
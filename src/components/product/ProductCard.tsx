'use client';

import { Star, CalendarDays, AlertTriangle, Plus, Share2 } from 'lucide-react';
import * as navigation from 'next/navigation';
import { useCart } from '@/context/CartContext';
import react from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { normalizeImageUrl } from '@/lib/image-helpers';
import Link from 'next/link';
import { Product } from '@/types/product';


interface ProductCardProps {
  product: Product;
  referralCode?: string | null; // Referral code dari halaman
}

// ✅ Tambahkan prop referralCode (opsional)
export function ProductCard({ product, referralCode }: { product: Product; referralCode?: string }) {
  const router = navigation.useRouter();
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = react.useState(false);
  const [imageError, setImageError] = react.useState(false);

  const isPreOrder = product.status === 'pre_order';
  
  const remainingQuota = isPreOrder 
    ? ((product.po_quota ?? 999999) - (product.po_sold || 0)) 
    : null;

  // ✅ Fungsi handle share (hanya jika referralCode ada)
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Bangun URL produk dengan referral
    const baseUrl = `${window.location.origin}/produk/${product.id}`;
    const shareUrl = referralCode ? `${baseUrl}?ref=${referralCode}` : baseUrl;

    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: product.description || `Lihat produk ${product.name}`,
          url: shareUrl,
        });
      } catch (_) {
        // User membatalkan share
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('🔗 Link produk berhasil disalin!', {
          position: 'bottom-right',
          duration: 3000,
        });
      } catch (_) {
        toast.error('Gagal menyalin link', {
          position: 'bottom-right',
          duration: 3000,
        });
      }
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isPreOrder && remainingQuota !== null && remainingQuota <= 0) {
      toast.error(
        <div className="flex items-center justify-between gap-2">
          <span>😔 Kuota Pre-Order sudah habis</span>
          <button
            className="text-xs font-semibold underline underline-offset-2"
            onClick={(event) => {
              event.stopPropagation();
              router.push('/katalog');
              toast.dismiss();
            }}
          >
            Lihat Produk Lain
          </button>
        </div>,
        {
          duration: 5000,
          position: 'bottom-right',
          style: { background: '#F59E0B', color: '#fff' },
        }
      );
      return;
    }
    
    if (isPreOrder && product.harvest_date) {
      const harvestDate = new Date(product.harvest_date);
      const today = new Date();
      harvestDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      if (today > harvestDate) {
        toast.error(
          <div className="flex items-center justify-between gap-2">
            <span>🍂 Masa panen sudah lewat</span>
            <button
              className="text-xs font-semibold underline underline-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                toast.success('✅ Kami akan beri tahu saat produk tersedia!', {
                  duration: 3000,
                  position: 'bottom-right',
                  style: { background: '#10B981', color: '#fff' },
                });
              }}
            >
              Notifikasi Saat Tersedia
            </button>
          </div>,
          {
            duration: 5000,
            position: 'bottom-right',
            style: { background: '#6B7280', color: '#fff' },
          }
        );
        return;
      }
    }

    setIsAdding(true);

    try {
      await addToCart(product.id, 1);
      
      toast.success(
        <div className="flex items-center justify-between gap-2">
          <span>✅ Ditambahkan ke keranjang!</span>
          <button
            className="text-xs font-semibold underline underline-offset-2"
            onClick={(event) => {
              event.stopPropagation();
              router.push('/keranjang');
              toast.dismiss();
            }}
          >
            Lihat Keranjang
          </button>
        </div>,
        {
          duration: 3000,
          position: 'bottom-right',
          style: { background: '#10B981', color: '#fff' },
        }
      );
      
    } catch (error: any) {
      console.error('Add to cart error:', error);
      
      const errorMessage = error?.message || 'Gagal menambahkan ke keranjang';
      
      if (errorMessage.includes('Kuota') || errorMessage.includes('quota')) {
        toast.error(
          <div className="flex items-center justify-between gap-2">
            <span>😔 Kuota Pre-Order sudah habis</span>
            <button
              className="text-xs font-semibold underline underline-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                router.push('/katalog');
                toast.dismiss();
              }}
            >
              Lihat Produk Lain
            </button>
          </div>,
          {
            duration: 5000,
            position: 'bottom-right',
            style: { background: '#F59E0B', color: '#fff' },
          }
        );
      } 
      else if (errorMessage.includes('panen') || errorMessage.includes('harvest')) {
        toast.error(
          <div className="flex items-center justify-between gap-2">
            <span>🍂 Produk sedang dalam proses panen</span>
            <button
              className="text-xs font-semibold underline underline-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                toast.success('✅ Anda akan kami beri tahu!', {
                  duration: 3000,
                  position: 'bottom-right',
                  style: { background: '#10B981', color: '#fff' },
                });
              }}
            >
              Notifikasi Saya
            </button>
          </div>,
          {
            duration: 5000,
            position: 'bottom-right',
            style: { background: '#6B7280', color: '#fff' },
          }
        );
      }
      else if (errorMessage.includes('stok') || errorMessage.includes('stock')) {
        toast.error(`❌ Stok tidak mencukupi`, {
          duration: 4000,
          position: 'bottom-right',
          style: { background: '#EF4444', color: '#fff' },
        });
      }
      else {
        toast.error('❌ Gagal menambahkan ke keranjang', {
          duration: 4000,
          position: 'bottom-right',
          style: { background: '#EF4444', color: '#fff' },
        });
      }
      
    } finally {
      setIsAdding(false);
    }
  };

  const statusRaw = product?.status ?? '';
  const status = String(statusRaw).replace('-', '_').toLowerCase();

  const getStatusColor = () => {
    switch (status) {
      case 'ready_stock': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pre_order': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'sold_out': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'ready_stock': return 'Ready';
      case 'pre_order': return 'Pre-Order';
      case 'sold_out': return 'Habis';
      default: return '';
    }
  };

  const imageUrl = (() => {
    if (imageError) return null;
    const rawUrl = product.image_path || product.image;
    if (!rawUrl) return null;
    return normalizeImageUrl(rawUrl, undefined);
  })();

  const displayRating = product.rating !== undefined && product.rating !== null 
    ? Number(product.rating).toFixed(1) 
    : '0.0';
  
  const displayReviews = product.total_reviews !== undefined && product.total_reviews !== null
    ? Number(product.total_reviews)
    : 0;

    const getProductLink = () => {
      let url = `/produk/${product.id}`;
      if (referralCode) {
        url += `?ref=${referralCode}`;
      }
      return url;
    };
    
  return (
    <div
      onClick={() => router.push(`/produk/${product.id}`)}
      className="card cursor-pointer group relative overflow-hidden hover:shadow-lg transition-all duration-300"
    >
      {/* Badge */}
      {product.badge && (
        <span className="absolute top-2 right-2 z-10 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-[10px] px-1.5 py-0.5 rounded-full font-medium shadow-sm">
          {product.badge}
        </span>
      )}
      
      {/* Product Image */}
      <div className="relative aspect-square bg-linear-to-br from-secondary/10 to-primary/10 rounded-xl mb-2 overflow-hidden group-hover:scale-105 transition-transform duration-300">
        {imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-surface/50">
            <span>🌾</span>
          </div>
        )}
        
        {/* Sold Out Overlay */}
        {product.status === 'sold_out' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
            <span className="text-white font-bold text-xs px-2 py-1 bg-red-500/90 rounded-full">
              Sold Out
            </span>
          </div>
        )}
        
        {/* Quick Add Button */}
        <button
          onClick={handleAddToCart}
          disabled={isAdding || product.status === 'sold_out' || (isPreOrder && remainingQuota !== null && remainingQuota <= 0)}
          className="absolute bottom-2 right-2 z-20 p-2 bg-primary text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Tambah ke keranjang"
        >
          {isAdding ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>

        {/* ✅ Tombol Share - Muncul hanya jika referralCode ada (artinya affiliate) */}
        {referralCode && (
          <button
            onClick={handleShare}
            className="absolute top-2 left-2 z-20 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"
            aria-label="Bagikan produk"
            title="Bagikan dengan referral Anda"
          >
            <Share2 className="w-4 h-4 text-primary" />
          </button>
        )}
      </div>

      {/* Product Info */}
      <div className="space-y-1 px-1">
        
        {/* Status Tags */}
        <div className="flex items-center gap-1 flex-wrap min-h-5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          {isPreOrder && product.harvest_date && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 flex items-center gap-0.5 whitespace-nowrap">
              <CalendarDays className="w-3 h-3 shrink-0" />
              {new Date(product.harvest_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        {/* Product Name */}
        <h3 className="font-semibold text-text-primary line-clamp-2 group-hover:text-primary transition-colors text-sm leading-tight">
          {product.name}
        </h3>

        {/* Category & Rating */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-text-secondary truncate flex-1">
            {product.category || 'Pertanian'}
          </p>
          
          <div className="flex items-center gap-0.5 shrink-0">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-[10px] font-medium text-text-primary">
              {displayRating}
            </span>
            <span className="text-[10px] text-text-secondary">
              ({displayReviews})
            </span>
          </div>
        </div>

        {/* Pre-Order Quota */}
        {isPreOrder && remainingQuota !== null && (
          <div className={`flex items-center gap-0.5 text-[10px] ${
            remainingQuota <= 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-text-secondary'
          }`}>
            <AlertTriangle className={`w-3 h-3 shrink-0 ${remainingQuota <= 10 ? 'text-orange-500' : ''}`} />
            <span className="truncate">
              {remainingQuota <= 0 ? 'Habis' : remainingQuota <= 10 ? `Sisa ${remainingQuota}` : `PO: ${remainingQuota}`} {product.unit}
            </span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-end justify-between pt-1 border-t border-border/50 dark:border-border-dark/50">
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-primary leading-none">
              Rp {product.price.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] text-text-secondary font-normal">
              /{product.unit || 'kg'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
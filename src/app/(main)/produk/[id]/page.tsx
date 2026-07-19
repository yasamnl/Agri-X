// app/(main)/produk/[id]/page.tsx

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { trackReferralClick, storeReferralCode } from '@/lib/referral';
import { 
  ArrowLeft, 
  Star, 
  ShoppingCart, 
  Heart, 
  Share2, 
  Check, 
  Truck, 
  Package, 
  Shield, 
  Clock,
  Loader2,
  Minus,
  Plus,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MessageCircle
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';

// ============================================
// TYPE DEFINITIONS - Lengkap sesuai produk
// ============================================

interface ProductDetail {
  id: number;
  name: string;
  price: number;
  description: string;
  image_url?: string;
  image_path?: string;
  category_id?: number;
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  seller_id?: number;
  seller_name?: string;
  stock?: number;
  unit?: string;
  min_order?: number;
  status?: 'active' | 'inactive' | 'sold_out' | 'pre_order' | 'ready_stock';
  rating?: number;
  total_reviews?: number;
  sold_count?: number;
  harvest_date?: string;
  po_quota?: number;
  po_sold?: number;
  is_featured?: boolean;
  rating_breakdown?: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  created_at?: string;
  updated_at?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ProductDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = params.id;
  
  // Ambil referral code dari URL
  const referralCode = searchParams.get('ref') || '';
  
  // State
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isWishlist, setIsWishlist] = useState(false);
  const [showDescription, setShowDescription] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  // ✅ Tracking referral saat halaman detail produk dibuka
  useEffect(() => {
    if (referralCode) {
      storeReferralCode(referralCode);
      trackReferralClick(referralCode);
    }
  }, [referralCode]);

  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(`/api/products/${productId}`, { headers });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Gagal mengambil produk');
        }
        
        const data = await res.json();
        
        if (data.success) {
          setProduct(data.product);
          
          // Fetch related products jika ada
          if (data.product.category_id) {
            fetchRelatedProducts(data.product.category_id, data.product.id);
          }
        } else {
          throw new Error(data.error || 'Gagal mengambil produk');
        }
      } catch (error: any) {
        console.error('Error fetching product:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  // Fetch related products
  const fetchRelatedProducts = async (categoryId: number, productId: number) => {
    try {
      const res = await fetch(`/api/products?category_id=${categoryId}&limit=4&exclude=${productId}`);
      const data = await res.json();
      if (data.success) {
        setRelatedProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching related products:', error);
    }
  };

  // Quantity handlers
  const increaseQuantity = () => {
    if (product?.stock && quantity < product.stock) {
      setQuantity(prev => prev + 1);
    } else if (!product?.stock) {
      setQuantity(prev => prev + 1);
    }
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  // Add to cart
  const addToCart = async () => {
    if (!product) return;
    
    // ✅ Perbaiki: cek status ready_stock juga
    if (product.status === 'inactive' || product.status === 'sold_out') {
      toast.error('Produk tidak tersedia');
      return;
    }

    try {
      setIsAddingToCart(true);
      
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Silakan login terlebih dahulu');
        router.push('/login');
        return;
      }

      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: product.id,
          quantity: quantity,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success(`${product.name} berhasil ditambahkan ke keranjang!`);
      } else {
        throw new Error(data.error || 'Gagal menambahkan ke keranjang');
      }
    } catch (error: any) {
      console.error('Add to cart error:', error);
      toast.error(error.message || 'Gagal menambahkan ke keranjang');
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Buy now
  const buyNow = async () => {
    if (!product) return;

    // Testing: catat komisi affiliate langsung saat tombol diklik. nanti di comment
    if (referralCode) {
      try {
        const token = localStorage.getItem('accessToken');
        await fetch('/api/affiliate/record-transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: product.id,
            quantity,
            referralCode,
          }),
        });
      } catch (error) {
        console.error('Gagal mencatat transaksi affiliate:', error);
        // Tetap lanjut ke checkout meskipun pencatatan komisi gagal
      }
    }

    router.push(`/checkout?product_id=${product.id}&quantity=${quantity}`);
  };

  // Toggle wishlist
  const toggleWishlist = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast.error('Silakan login terlebih dahulu');
        router.push('/login');
        return;
      }

      const res = await fetch('/api/wishlist', {
        method: isWishlist ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: product?.id }),
      });

      const data = await res.json();
      
      if (data.success) {
        setIsWishlist(!isWishlist);
        toast.success(isWishlist ? 'Dihapus dari wishlist' : 'Ditambahkan ke wishlist');
      }
    } catch (error) {
      console.error('Wishlist error:', error);
      toast.error('Gagal mengupdate wishlist');
    }
  };

  // Share product
  const shareProduct = async () => {
    if (!product) return;
    
    const shareData = {
      title: product.name,
      text: `Lihat produk ${product.name} di Agri-X!`,
      url: `${window.location.origin}/produk/${product.id}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast.success('Link produk disalin!');
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-text-secondary">Memuat produk...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-bold text-text-primary">Produk Tidak Ditemukan</h2>
        <p className="text-text-secondary text-center max-w-md">
          {error || 'Produk yang Anda cari tidak tersedia atau telah dihapus.'}
        </p>
        <Link href="/katalog" className="btn-primary">
          Kembali ke Katalog
        </Link>
      </div>
    );
  }

  // Product images
  const productImage = product.image_url || product.image_path || '/images/product-placeholder.jpg';
  
  // ✅ PERBAIKAN UTAMA: Tambahkan ready_stock ke daftar status aktif
  const isActive = ['active', 'pre_order', 'ready_stock'].includes(product.status || '');
  const isSoldOut = product.status === 'sold_out' || (product.stock !== undefined && product.stock <= 0);
  const stockText = isSoldOut ? 'Habis' : `${product.stock || 0} ${product.unit || 'unit'}`;

  // Referral link untuk share
  const shareLink = referralCode 
    ? `${window.location.origin}/produk/${product.id}?ref=${referralCode}`
    : `${window.location.origin}/produk/${product.id}`;

  return (
    <div className="animate-fade-in min-h-screen pb-20">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Kembali</span>
      </button>

      {/* ✅ Banner Referral */}
      {referralCode && (
        <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-primary">
            <span>🔗</span>
            <span>
              Anda membagikan link dengan kode referral: <strong>{referralCode}</strong>
            </span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareLink);
              toast.success('Link produk disalin!');
            }}
            className="text-sm text-primary hover:underline"
          >
            Salin Link
          </button>
        </div>
      )}

      {/* Product Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Section */}
        <div className="relative aspect-square bg-surface rounded-xl overflow-hidden border border-border">
          <Image
            src={productImage}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
          {product.is_featured && (
            <div className="absolute top-4 left-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              Featured
            </div>
          )}
          {!isActive && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">
                {isSoldOut ? 'HABIS' : 'TIDAK TERSEDIA'}
              </span>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="space-y-6">
          {/* Category */}
          {product.category && (
            <div className="text-sm text-text-secondary">
              <Link 
                href={`/katalog?category_id=${product.category.id}`}
                className="hover:text-primary transition-colors"
              >
                {product.category.name}
              </Link>
            </div>
          )}

          {/* Name */}
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
            {product.name}
          </h1>

          {/* Rating */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold">{product.rating?.toFixed(1) || '0.0'}</span>
            </div>
            <span className="text-text-secondary">•</span>
            <span className="text-text-secondary">
              {product.total_reviews || 0} ulasan
            </span>
            <span className="text-text-secondary">•</span>
            <span className="text-text-secondary">
              {product.sold_count || 0} terjual
            </span>
          </div>

          {/* Price */}
          <div className="text-3xl font-bold text-primary">
            Rp {product.price.toLocaleString('id-ID')}
          </div>

          {/* ✅ PERBAIKAN: Status & Stock dengan ready_stock */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className={`px-3 py-1 rounded-full font-medium ${
              product.status === 'active' || product.status === 'ready_stock' ? 'bg-green-100 text-green-700' :
              product.status === 'pre_order' ? 'bg-yellow-100 text-yellow-700' :
              product.status === 'sold_out' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {product.status === 'active' || product.status === 'ready_stock' ? 'Tersedia' :
               product.status === 'pre_order' ? 'Pre-Order' :
               product.status === 'sold_out' ? 'Habis' :
               'Tidak Tersedia'}
            </div>
            {product.stock !== undefined && (
              <div className="text-text-secondary">
                Stok: {stockText}
              </div>
            )}
          </div>

          {/* Min Order */}
          {product.min_order && product.min_order > 1 && (
            <div className="text-sm text-text-secondary">
              Minimal pemesanan: {product.min_order} {product.unit || 'unit'}
            </div>
          )}

          {/* Harvest Date */}
          {product.harvest_date && (
            <div className="text-sm text-text-secondary">
              🌱 Panen: {formatDate(product.harvest_date)}
            </div>
          )}

          {/* Quantity Selector */}
          {isActive && !isSoldOut && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-text-secondary">Jumlah:</span>
              <div className="flex items-center border border-border rounded-lg">
                <button
                  onClick={decreaseQuantity}
                  disabled={quantity <= 1}
                  className="px-3 py-2 hover:bg-surface transition-colors disabled:opacity-50"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 min-w-[40px] text-center font-medium">
                  {quantity}
                </span>
                <button
                  onClick={increaseQuantity}
                  disabled={product.stock !== undefined && quantity >= product.stock}
                  className="px-3 py-2 hover:bg-surface transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {product.stock !== undefined && (
                <span className="text-xs text-text-secondary">
                  Tersisa {product.stock} {product.unit || 'unit'}
                </span>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {isActive && !isSoldOut ? (
              <>
                <button
                  onClick={addToCart}
                  disabled={isAddingToCart}
                  className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 min-w-[120px]"
                >
                  {isAddingToCart ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Menambahkan...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      Tambah Keranjang
                    </>
                  )}
                </button>
                <button
                  onClick={buyNow}
                  className="flex-1 btn-secondary py-3 min-w-[120px]"
                >
                  Beli Sekarang
                </button>
              </>
            ) : (
              <button
                disabled
                className="flex-1 py-3 bg-gray-200 text-gray-500 rounded-xl cursor-not-allowed"
              >
                {isSoldOut ? 'Stok Habis' : 'Tidak Tersedia'}
              </button>
            )}

            <button
              onClick={toggleWishlist}
              className="w-12 h-12 rounded-xl border border-border flex items-center justify-center hover:bg-surface transition-colors"
            >
              <Heart className={`w-5 h-5 ${isWishlist ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
            <button
              onClick={shareProduct}
              className="w-12 h-12 rounded-xl border border-border flex items-center justify-center hover:bg-surface transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          {/* Delivery Info */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Truck className="w-4 h-4" />
              <span>Pengiriman cepat</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Package className="w-4 h-4" />
              <span>Dari petani langsung</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Shield className="w-4 h-4" />
              <span>Garansi kualitas</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Clock className="w-4 h-4" />
              <span>Panen segar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description & Details */}
      <div className="mt-12 space-y-4">
        {/* Description */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowDescription(!showDescription)}
            className="w-full px-6 py-4 flex items-center justify-between bg-surface/50 hover:bg-surface transition-colors"
          >
            <span className="font-semibold text-text-primary">Deskripsi Produk</span>
            {showDescription ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {showDescription && (
            <div className="px-6 py-4 text-text-secondary leading-relaxed whitespace-pre-wrap">
              {product.description || 'Tidak ada deskripsi untuk produk ini.'}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-6 py-4 flex items-center justify-between bg-surface/50 hover:bg-surface transition-colors"
          >
            <span className="font-semibold text-text-primary">Detail Produk</span>
            {showDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {showDetails && (
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-text-secondary">Kategori</dt>
                  <dd className="text-text-primary">{product.category?.name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-text-secondary">Satuan</dt>
                  <dd className="text-text-primary">{product.unit || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-text-secondary">Minimal Order</dt>
                  <dd className="text-text-primary">
                    {product.min_order ? `${product.min_order} ${product.unit || ''}` : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-text-secondary">Tanggal Panen</dt>
                  <dd className="text-text-primary">{formatDate(product.harvest_date)}</dd>
                </div>
                {product.po_quota && (
                  <div>
                    <dt className="text-sm text-text-secondary">Kuota Pre-Order</dt>
                    <dd className="text-text-primary">
                      {product.po_sold || 0} / {product.po_quota} terjual
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowReviews(!showReviews)}
            className="w-full px-6 py-4 flex items-center justify-between bg-surface/50 hover:bg-surface transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="font-semibold text-text-primary">Ulasan</span>
              <span className="text-sm text-text-secondary">
                ({product.total_reviews || 0} ulasan)
              </span>
              {product.rating && (
                <div className="flex items-center gap-1 text-sm">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{product.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            {showReviews ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {showReviews && (
            <div className="px-6 py-4">
              {product.total_reviews && product.total_reviews > 0 ? (
                <div className="space-y-4">
                  {/* Rating breakdown */}
                  {product.rating_breakdown && (
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = product.rating_breakdown?.[star as keyof typeof product.rating_breakdown] || 0;
                        const percentage = product.total_reviews ? (count / product.total_reviews) * 100 : 0;
                        return (
                          <div key={star} className="flex items-center gap-3">
                            <span className="text-sm text-text-secondary min-w-[20px]">{star}</span>
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-400 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-text-secondary min-w-[30px]">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="text-center text-text-secondary text-sm">
                    <Link href={`/produk/${product.id}/ulasan`} className="hover:text-primary">
                      Lihat semua ulasan →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center text-text-secondary py-4">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 text-text-muted" />
                  <p>Belum ada ulasan untuk produk ini</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold text-text-primary mb-4">Produk Serupa</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {relatedProducts.map((relatedProduct: any) => (
              <Link
                key={relatedProduct.id}
                href={`/produk/${relatedProduct.id}${referralCode ? `?ref=${referralCode}` : ''}`}
                className="group"
              >
                <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-border">
                  <div className="aspect-square relative bg-gray-100">
                    <Image
                      src={relatedProduct.image_url || '/images/product-placeholder.jpg'}
                      alt={relatedProduct.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-text-primary text-sm line-clamp-2">
                      {relatedProduct.name}
                    </h3>
                    <p className="text-sm font-bold text-primary mt-1">
                      Rp {relatedProduct.price.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
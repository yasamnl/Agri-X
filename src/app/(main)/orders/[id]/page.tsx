'use client';

import { useEffect, useState , useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCookie } from '@/lib/auth';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Image from 'next/image'; // ✅ IMPORT next/image
import { normalizeImageUrl } from '@/lib/image-helpers'; // ✅ IMPORT helper
import {
  ArrowLeft, Package, MapPin, Truck, CreditCard, Clock,
  CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw,
  ShoppingBag, Calendar, Phone, User, FileText, Copy
} from 'lucide-react';


// ============================================================================
// TYPES
// ============================================================================
interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productImage: string | null; // ✅ Sudah ada di backend
  price: number;
  quantity: number;
  subtotal: number;
  unit: string;
}

interface OrderAddress {
  recipientName?: string;
  recipientPhone?: string;
  detail?: string;
  province?: string;
  city?: string;
  district?: string;
  villageName?: string;
  village?: string; // ✅ Tambah fallback untuk field 'village'
  zipCode?: string;
}

interface Order {
  id: number;
  orderNumber?: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentGateway?: string | null;
  paymentUrl?: string | null;
  transactionId?: string | null;
  vaNumber?: string | null;
  paymentDeadline?: string | null;
  totalProductPrice: number;
  shippingCost: number;
  paymentFee?: number;
  grandTotal: number;
  isPreOrder?: boolean;
  estimatedShipDate?: string | null;
  trackingNumber?: string | null;
  courierCode?: string | null;
  courierName?: string | null;
  buyerNotes?: string | null;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  address?: OrderAddress | null;
  items: OrderItem[];
  shipments?: any[];
  payment?: any;
}

// ============================================================================
// STATUS CONFIG
// ============================================================================
const STATUS_CONFIG: Record<string, {
  icon: any;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  pending_payment: {
    icon: Clock,
    color: 'text-yellow-700',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    label: 'Menunggu Pembayaran',
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-700',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    label: 'Menunggu Pembayaran',
  },
  paid: {
    icon: CheckCircle,
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    label: 'Sudah Dibayar',
  },
  processing: {
    icon: Package,
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    label: 'Sedang Dikemas',
  },
  shipped: {
    icon: Truck,
    color: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-800',
    label: 'Dikirim',
  },
  delivered: {
    icon: Package,
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    label: 'Barang Telah Sampai',
},
  completed: {
    icon: CheckCircle,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    label: 'Selesai',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    label: 'Dibatalkan',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const formatCurrency = (amount: number | null | undefined): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy, HH:mm', { locale: id });
  } catch {
    return String(dateStr);
  }
};

const copyToClipboard = async (text: string, label: string = 'Teks') => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} disalin ke clipboard`);
  } catch {
    toast.error('Gagal menyalin');
  }
};

// ============================================================================
// ✅ PRODUCT IMAGE COMPONENT (Reusable dengan next/image)
// ============================================================================
function ProductImage({
  src,
  alt,
  size = 'md',
}: {
  src: string | null | undefined;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imgError, setImgError] = useState(false);
  
  // ✅ Normalize URL
  const imageUrl = src ? normalizeImageUrl(src) : null;
  
  // ✅ Size config
  const sizeConfig = {
    sm: { width: 48, height: 48, iconSize: 'w-5 h-5' },
    md: { width: 80, height: 80, iconSize: 'w-8 h-8' },
    lg: { width: 120, height: 120, iconSize: 'w-12 h-12' },
  };
  
  const config = sizeConfig[size];
  
  // ✅ Jika tidak ada gambar atau error, tampilkan placeholder
  if (!imageUrl || imgError) {
    return (
      <div 
        className="bg-surface rounded-lg flex items-center justify-center border border-border flex-shrink-0"
        style={{ width: config.width, height: config.height }}
      >
        <Package className={`${config.iconSize} text-text-muted`} />
      </div>
    );
  }
  
  return (
    <div 
      className="relative bg-surface rounded-lg overflow-hidden border border-border flex-shrink-0"
      style={{ width: config.width, height: config.height }}
    >
      <Image
        src={imageUrl}
        alt={alt}
        fill
        sizes={`${config.width}px`}
        className="object-cover"
        onError={() => setImgError(true)}
        loading="lazy"
      />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // FETCH ORDER
  // ============================================================================
  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getCookie('accessToken');
      if (!token) {
        setError('Sesi tidak ditemukan. Silakan login kembali.');
        router.push('/login');
        return;
      }

      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError('Pesanan tidak ditemukan');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal memuat data pesanan');
      }

      // ✅ NORMALIZE - pastikan array tidak undefined
      const rawData = result.data || {};
      const normalizedOrder: Order = {
        ...rawData,
        items: Array.isArray(rawData.items) ? rawData.items : [],
        shipments: Array.isArray(rawData.shipments) ? rawData.shipments : [],
        address: rawData.address || null,
        payment: rawData.payment || null,
      };

      setOrder(normalizedOrder);
    } catch (err: any) {
      console.error('❌ Fetch order error:', err);
      setError(err.message || 'Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  // ============================================================================
  // ACTIONS
  // ============================================================================
  const handleCancelOrder = async () => {
    if (!order) return;
    if (!confirm('Yakin ingin membatalkan pesanan ini?')) return;

    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal membatalkan pesanan');
      }

      toast.success('Pesanan berhasil dibatalkan');
      fetchOrder();
    } catch (err: any) {
      toast.error(err.message || 'Gagal membatalkan pesanan');
    }
  };

  const handleConfirmReceived = async () => {
    if (!order) return;
    if (!confirm('Konfirmasi bahwa Anda telah menerima pesanan?')) return;

    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengkonfirmasi pesanan');
      }

      toast.success('Pesanan berhasil dikonfirmasi');
      fetchOrder();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengkonfirmasi pesanan');
    }
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-text-primary font-medium">Memuat detail pesanan...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================
  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="card max-w-md text-center">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">
            {error || 'Pesanan tidak ditemukan'}
          </h2>
          <div className="flex gap-3 mt-6 justify-center">
            <button onClick={() => router.back()} className="btn-outline">
              Kembali
            </button>
            <button onClick={fetchOrder} className="btn-primary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // GET STATUS CONFIG
  // ============================================================================
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-primary mb-4 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Kembali</span>
        </button>

        {/* Header Card */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Detail Pesanan
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-text-secondary">
                  {order.orderNumber ? `#${order.orderNumber}` : `Order #${order.id}`}
                </p>
                {order.transactionId && (
                  <button
                    onClick={() => copyToClipboard(order.transactionId!, 'Transaction ID')}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    Salin ID Transaksi
                  </button>
                )}
              </div>
            </div>
            <div className={`${statusConfig.bg} ${statusConfig.border} border px-4 py-2 rounded-xl inline-flex items-center gap-2 self-start`}>
              <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
              <span className={`font-semibold ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* ================================================================
                SHIPPING ADDRESS
                ================================================================ */}
            <div className="card">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-primary" />
                Alamat Pengiriman
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-text-primary">
                      {order.address?.recipientName || 'Penerima'}
                    </p>
                    {order.address?.recipientPhone && (
                      <p className="text-text-secondary flex items-center gap-2 mt-1">
                        <Phone className="w-3 h-3" />
                        {order.address.recipientPhone}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="pl-13 pt-2 border-t border-border">
                  <p className="text-text-secondary leading-relaxed">
                    {[
                      order.address?.detail,
                      order.address?.villageName || order.address?.village, // ✅ Fallback
                      order.address?.district,
                      order.address?.city,
                      order.address?.province,
                      order.address?.zipCode,
                    ].filter(Boolean).join(', ') || 'Alamat tidak tersedia'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* ================================================================
                ORDER ITEMS - ✅ UPDATED dengan next/image
                ================================================================ */}
            <div className="card">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4">
                <ShoppingBag className="w-5 h-5 text-primary" />
                Produk yang Dipesan
                <span className="text-sm font-normal text-text-secondary">
                  ({order.items.length} item)
                </span>
              </h3>
              
              {order.items.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Tidak ada item dalam pesanan</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div 
                      key={item.id || Math.random()} 
                      className="flex gap-3 p-3 bg-surface rounded-xl hover:bg-surface-hover transition-colors"
                    >
                      {/* ✅ Product Image dengan next/image */}
                      <ProductImage
                        src={item.productImage}
                        alt={item.productName || 'Produk'}
                        size="md"
                      />

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-text-primary line-clamp-2 text-sm">
                          {item.productName || 'Produk'}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                          <span>{item.quantity || 0} {item.unit || 'pcs'}</span>
                          <span>×</span>
                          <span>{formatCurrency(item.price)}</span>
                        </div>
                        <p className="font-bold text-primary mt-1">
                          {formatCurrency(item.subtotal)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          
            

            {/* ================================================================
                BUYER NOTES
                ================================================================ */}
            {order.buyerNotes && (
              <div className="card">
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-primary" />
                  Catatan Pembeli
                </h3>
                <p className="text-text-secondary text-sm bg-surface p-3 rounded-lg">
                  {order.buyerNotes}
                </p>
              </div>
            )}

          </div>

          {/* ================================================================
              RIGHT COLUMN - Order Summary
              ================================================================ */}
          <div className="lg:col-span-1">
            <div className="card sticky top-4 space-y-4">
              <h3 className="text-lg font-bold text-text-primary">Ringkasan Pesanan</h3>

              {/* Price Breakdown */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Subtotal Produk</span>
                  <span className="font-medium text-text-primary">
                    {formatCurrency(order.totalProductPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Ongkos Kirim</span>
                  <span className="font-medium text-text-primary">
                    {formatCurrency(order.shippingCost)}
                  </span>
                </div>
                {(order.paymentFee ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Biaya Pembayaran</span>
                    <span className="font-medium text-text-primary">
                      {formatCurrency(order.paymentFee)}
                    </span>
                  </div>
                )}
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-text-primary">Total</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(order.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Metode Pembayaran</span>
                  <span className="font-medium text-text-primary capitalize">
                    {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 
                     order.paymentGateway || order.paymentMethod || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Status Pembayaran</span>
                  <span className={`font-medium ${
                    order.paymentStatus === 'paid' ? 'text-green-600 dark:text-green-400' :
                    order.paymentStatus === 'failed' ? 'text-red-600 dark:text-red-400' :
                    'text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {order.paymentStatus === 'paid' ? 'Lunas' :
                     order.paymentStatus === 'failed' ? 'Gagal' :
                     order.paymentStatus === 'pending' ? 'Menunggu' :
                     order.paymentStatus || '-'}
                  </span>
                </div>
                {order.transactionId && (
                  <div className="pt-2">
                    <p className="text-xs text-text-secondary mb-1">Transaction ID</p>
                    <div className="flex items-center gap-2 bg-surface p-2 rounded-lg">
                      <code className="text-xs text-text-primary font-mono flex-1 truncate">
                        {order.transactionId}
                      </code>
                      <button
                        onClick={() => copyToClipboard(order.transactionId!, 'Transaction ID')}
                        className="text-primary hover:text-primary-dark"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div className="border-t border-border pt-4 space-y-2 text-xs text-text-secondary">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  <span>Dibuat: {formatDate(order.createdAt)}</span>
                </div>
                {order.paidAt && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Dibayar: {formatDate(order.paidAt)}</span>
                  </div>
                )}
                {order.shippedAt && (
                  <div className="flex items-center gap-2">
                    <Truck className="w-3 h-3 text-indigo-600" />
                    <span>Dikirim: {formatDate(order.shippedAt)}</span>
                  </div>
                )}
                {order.deliveredAt && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span>Diterima: {formatDate(order.deliveredAt)}</span>
                  </div>
                )}
              </div>

              {/* ================================================================
                  ACTION BUTTONS
                  ================================================================ */}
              <div className="border-t border-border pt-4 space-y-2">
                
                {order.status === 'pending_payment' && (
                  <button
                    onClick={() => router.push(`/orders/${orderId}/pay`)}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Bayar Sekarang
                  </button>
                )}

                {order.status === 'delivered' && (
  <button
    onClick={handleConfirmReceived}
    className="btn-primary w-full flex items-center justify-center gap-2"
  >
    <CheckCircle className="w-4 h-4" />
    Konfirmasi Pesanan Diterima
  </button>
)}

                {['pending_payment', 'paid', 'processing'].includes(order.status) && (
                  <button
                    onClick={handleCancelOrder}
                    className="w-full py-3 rounded-xl font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors flex items-center justify-center gap-2 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30"
                  >
                    <XCircle className="w-4 h-4" />
                    Batalkan Pesanan
                  </button>
                )}

                
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
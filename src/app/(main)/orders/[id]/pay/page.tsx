'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Clock, ArrowLeft, CreditCard, AlertCircle, RefreshCw } from 'lucide-react';
import { getCookie } from '@/lib/auth';
import Script from 'next/script';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES
// ============================================================================
interface Order {
  id: number;
  orderId: number;
  transactionId: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentGateway: string | null;
  paymentUrl: string | null;
  vaNumber: string | null;
  paymentDeadline: string | null;
  totalProductPrice: number;
  shippingCost: number;
  paymentFee: number;
  grandTotal: number;
  isPreOrder: boolean;
  estimatedShipDate: string | null;
  poStatus: string | null;
  createdAt: string;
  items: Array<{
    id: number;
    productName: string;
    price: number;
    quantity: number;
    subtotal: number;
    productImage: string | null;
  }>;
  payment: {
    id: number;
    method: string;
    amount: number;
    status: string;
    transactionId: string | null;
    paymentType: string | null;
  } | null;
}

type UIStatus = 'loading' | 'success' | 'pending' | 'failed' | 'expired';

// ============================================================================
// HELPERS
// ============================================================================
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDeadline = (deadline: string | null) => {
  if (!deadline) return null;
  const date = new Date(deadline);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff <= 0) return 'Sudah kadaluarsa';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours} jam ${minutes} menit lagi`;
  }
  return `${minutes} menit lagi`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function PaymentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const orderId = params.id as string;
  const statusParam = searchParams.get('status'); // 'finish', 'unfinish', 'error'
  const transactionStatus = searchParams.get('transaction_status');

  const [uiStatus, setUiStatus] = useState<UIStatus>('loading');
  const [message, setMessage] = useState('Memeriksa status pembayaran...');
  const [order, setOrder] = useState<Order | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  const [snapLoaded, setSnapLoaded] = useState(false);
  
  // ✅ Polling ref untuk cleanup
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // FETCH ORDER DETAIL
  // ============================================================================
  const fetchOrderDetail = async () => {
    try {
      const token = getCookie('accessToken');
      if (!token) {
        toast.error('Sesi tidak ditemukan. Silakan login kembali.');
        router.push('/login');
        return null;
      }

      // ✅ Gunakan endpoint spesifik untuk single order
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setUiStatus('failed');
          setMessage('Pesanan tidak ditemukan.');
          return null;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Gagal memuat data pesanan');
      }

      setOrder(data.data);
      return data.data;
    } catch (error: any) {
      console.error('❌ Fetch order error:', error);
      setUiStatus('failed');
      setMessage(error.message || 'Terjadi kesalahan saat memuat data.');
      return null;
    }
  };

  // ============================================================================
  // CHECK PAYMENT STATUS
  // ============================================================================
  const checkPaymentStatus = async (isRedirect: boolean = false) => {
    const orderData = await fetchOrderDetail();
    if (!orderData) return;

    // ✅ Check deadline expired
    if (orderData.paymentDeadline) {
      const deadline = new Date(orderData.paymentDeadline);
      if (deadline < new Date()) {
        setUiStatus('expired');
        setMessage('Batas waktu pembayaran telah berakhir.');
        return;
      }
    }

    // ✅ Map status pembayaran
    const paymentStatus = orderData.paymentStatus;
    const orderStatus = orderData.status;

    // ✅ Redirect dari Midtrans
    if (isRedirect && statusParam === 'finish') {
      // Jika Midtrans redirect dengan status finish, cek lebih detail
      if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
        setUiStatus('success');
        setMessage('Pembayaran berhasil! Pesanan Anda sedang diproses.');
        toast.success('Pembayaran berhasil!');
        
        setTimeout(() => {
          router.push(`/orders/${orderId}`);
        }, 2500);
        return;
      } else if (transactionStatus === 'pending') {
        setUiStatus('pending');
        setMessage('Pembayaran sedang diproses. Silakan tunggu konfirmasi.');
      } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
        setUiStatus('failed');
        setMessage('Pembayaran ditolak atau dibatalkan.');
      }
    }
    // ✅ Status dari database
    else if (paymentStatus === 'paid' || orderStatus === 'paid' || orderStatus === 'processing') {
      setUiStatus('success');
      setMessage('Pembayaran berhasil! Pesanan Anda sedang diproses.');
      
      setTimeout(() => {
        router.push(`/orders/${orderId}`);
      }, 2500);
    }
    else if (paymentStatus === 'pending') {
      setUiStatus('pending');
      setMessage('Menunggu pembayaran. Silakan selesaikan transfer Anda.');
    }
    else if (paymentStatus === 'failed' || orderStatus === 'cancelled') {
      setUiStatus('failed');
      setMessage('Pembayaran gagal atau pesanan dibatalkan.');
    }
    else {
      setUiStatus('pending');
      setMessage('Menunggu konfirmasi pembayaran.');
    }
  };

  // ============================================================================
  // HANDLE PAY NOW (Midtrans Snap)
  // ============================================================================
  const handlePayNow = async () => {
    if (!order) {
      toast.error('Data pesanan tidak ditemukan');
      return;
    }

    // ✅ Jika ada payment_url, redirect ke sana (fallback)
    if (order.paymentUrl) {
      window.open(order.paymentUrl, '_blank');
      return;
    }

    // ✅ Jika snap belum loaded, tunggu
    if (!snapLoaded || !(window as any).snap) {
      toast.error('Midtrans Snap belum termuat. Silakan coba lagi.');
      return;
    }

    setIsPaying(true);

    try {
      const token = getCookie('accessToken');
      if (!token) {
        toast.error('Sesi tidak ditemukan');
        setIsPaying(false);
        return;
      }

      // ✅ Jika sudah ada transaction_id, langsung buka snap
      if (order.transactionId) {
        (window as any).snap.pay(order.transactionId, {
          onSuccess: function(result: any) {
            console.log('✅ Payment success:', result);
            toast.success('Pembayaran berhasil!');
            window.location.reload();
          },
          onPending: function(result: any) {
            console.log('⏳ Payment pending:', result);
            toast('Pembayaran sedang diproses', { icon: '⏳' });
            window.location.reload();
          },
          onError: function(result: any) {
            console.error('❌ Payment error:', result);
            toast.error('Pembayaran gagal. Silakan coba lagi.');
            setIsPaying(false);
          },
          onClose: function() {
            console.log('🚪 Popup closed');
            setIsPaying(false);
            toast('Anda menutup popup pembayaran', { icon: 'ℹ️' });
          },
        });
        return;
      }

      // ✅ Jika belum ada transaction_id, buat baru
      const amount = order.payment?.amount || order.grandTotal;
      
      const res = await fetch('/api/payment/midtrans', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: orderId,
          grossAmount: amount,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Gagal membuat pembayaran');
      }

      if (data.snapToken) {
        (window as any).snap.pay(data.snapToken, {
          onSuccess: function(result: any) {
            console.log('✅ Payment success:', result);
            toast.success('Pembayaran berhasil!');
            window.location.reload();
          },
          onPending: function(result: any) {
            console.log('⏳ Payment pending:', result);
            toast('Pembayaran sedang diproses', { icon: '⏳' });
            window.location.reload();
          },
          onError: function(result: any) {
            console.error('❌ Payment error:', result);
            toast.error('Pembayaran gagal. Silakan coba lagi.');
            setIsPaying(false);
          },
          onClose: function() {
            console.log('🚪 Popup closed');
            setIsPaying(false);
            toast('Anda menutup popup pembayaran', { icon: 'ℹ️' });
          },
        });
      } else if (data.paymentUrl) {
        // ✅ Fallback: redirect ke payment URL
        window.open(data.paymentUrl, '_blank');
      } else {
        throw new Error('Token pembayaran tidak ditemukan');
      }

    } catch (error: any) {
      console.error('❌ Payment error:', error);
      toast.error(error.message || 'Gagal memproses pembayaran');
      setIsPaying(false);
    }
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // ✅ Initial check
  useEffect(() => {
    if (!orderId) return;

    if (statusParam === 'finish') {
      checkPaymentStatus(true);
    } else if (statusParam === 'unfinish' || statusParam === 'error') {
      setUiStatus('failed');
      setMessage('Pembayaran belum selesai atau dibatalkan.');
      fetchOrderDetail();
    } else {
      checkPaymentStatus(false);
    }

    // ✅ Cleanup polling on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [orderId, statusParam]);

  // ✅ Polling untuk auto-refresh saat status pending
  useEffect(() => {
    if (uiStatus === 'pending' && order) {
      // ✅ Polling setiap 5 detik
      pollingRef.current = setInterval(() => {
        checkPaymentStatus(false);
      }, 5000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [uiStatus, order]);

  // ✅ Countdown timer untuk deadline
  useEffect(() => {
    if (order?.paymentDeadline && uiStatus === 'pending') {
      const updateCountdown = () => {
        const deadline = new Date(order.paymentDeadline!);
        const now = new Date();
        const diff = deadline.getTime() - now.getTime();

        if (diff <= 0) {
          setCountdown('Sudah kadaluarsa');
          setUiStatus('expired');
          return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setCountdown(`${hours}j ${minutes}m ${seconds}d`);
      };

      updateCountdown();
      countdownRef.current = setInterval(updateCountdown, 1000);

      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      };
    }
  }, [order?.paymentDeadline, uiStatus]);

  // ============================================================================
  // RENDER CONTENT
  // ============================================================================
  const renderContent = () => {
    switch (uiStatus) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center space-y-4 animate-pulse">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <p className="text-lg font-medium text-text-primary">{message}</p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-green-100 rounded-full animate-bounce-short">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-600">Pembayaran Berhasil!</h2>
            <p className="text-text-secondary text-center max-w-50">{message}</p>
            <p className="text-sm text-text-secondary">Mengalihkan ke detail pesanan...</p>
          </div>
        );

      case 'pending':
        return (
          <div className="flex flex-col items-center justify-center space-y-4 w-full">
            <div className="p-4 bg-yellow-100 rounded-full">
              <Clock className="w-16 h-16 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-yellow-600">Menunggu Pembayaran</h2>
            <p className="text-text-secondary text-center max-w-50">{message}</p>
            
            {/* Order Summary */}
            {order && (
              <div className="w-full mt-4 p-4 bg-surface border border-border rounded-xl space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-text-secondary">Transaction ID</span>
                  <span className="font-mono font-semibold text-text-primary text-sm break-all">
                    {order.transactionId || '-'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">Total Pembayaran</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(order.grandTotal)}</span>
                </div>

                {order.paymentMethod === 'midtrans' && (
                  <>
                    {order.vaNumber && (
                      <div className="flex justify-between items-center pt-3 border-t border-border">
                        <span className="text-sm text-text-secondary">Nomor VA</span>
                        <span className="font-mono font-semibold text-text-primary">{order.vaNumber}</span>
                      </div>
                    )}

                    {order.paymentDeadline && (
                      <div className="flex justify-between items-center pt-3 border-t border-border">
                        <span className="text-sm text-text-secondary">Batas Waktu</span>
                        <span className="font-semibold text-red-600">{countdown || formatDeadline(order.paymentDeadline)}</span>
                      </div>
                    )}
                  </>
                )}

                {order.paymentMethod === 'cod' && (
                  <div className="flex justify-between items-center pt-3 border-t border-border">
                    <span className="text-sm text-text-secondary">Metode</span>
                    <span className="font-semibold text-text-primary">Cash on Delivery (COD)</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full mt-4 space-y-2">
              {order?.paymentMethod === 'midtrans' && (
                <button
                  onClick={handlePayNow}
                  disabled={isPaying}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      <span>Bayar Sekarang</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => checkPaymentStatus(false)}
                className="btn-outline w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Cek Status Pembayaran</span>
              </button>

              <p className="text-xs text-text-secondary text-center mt-2">
                Halaman akan otomatis refresh setiap 5 detik
              </p>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <AlertCircle className="w-16 h-16 text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-600">Pembayaran Kadaluarsa</h2>
            <p className="text-text-secondary text-center max-w-50">{message}</p>
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => router.push('/katalog')}
                className="btn-outline"
              >
                Kembali ke Katalog
              </button>
              <button 
                onClick={() => router.push('/orders')}
                className="btn-primary"
              >
                Lihat Pesanan
              </button>
            </div>
          </div>
        );

      case 'failed':
        return (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-red-100 rounded-full">
              <XCircle className="w-16 h-16 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-red-600">Pembayaran Gagal</h2>
            <p className="text-text-secondary text-center max-w-xs">{message}</p>
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => router.push('/katalog')}
                className="btn-outline"
              >
                Kembali ke Katalog
              </button>
              <button 
                onClick={() => router.push(`/orders/${orderId}`)}
                className="btn-primary"
              >
                Cek Pesanan
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <>
      {/* Midtrans Snap Script */}
      <Script
        src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        strategy="afterInteractive"
        onReady={() => {
          console.log('✅ Midtrans Snap loaded');
          setSnapLoaded(true);
        }}
        onError={() => {
          console.error('❌ Failed to load Midtrans Snap');
          setSnapLoaded(false);
        }}
      />

      <div className="min-h-screen bg-background p-4">
        <div className="w-full max-w-150 mx-auto bg-surface p-8 rounded-2xl shadow-xl border border-border relative">
          
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 text-text-secondary hover:text-primary transition-colors"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Order Info Header */}
          {order && uiStatus !== 'loading' && (
            <div className="text-center mb-6 pt-4">
              <h1 className="text-xl font-bold text-text-primary mb-1">
                Pembayaran Pesanan #{order.orderId}
              </h1>
              <p className="text-sm text-text-secondary">
                {order.items.length} produk • {formatCurrency(order.grandTotal)}
              </p>
            </div>
          )}

          {/* Main Content */}
          {renderContent()}

        </div>
      </div>
    </>
  );
}
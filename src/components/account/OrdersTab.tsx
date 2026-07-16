// src/components/account/OrdersTab.tsx
`use client`;

import react from 'react';
import * as navigation from 'next/navigation';
import {
  Package, Clock, Loader2, Truck, CheckCircle, CreditCard, ArrowRight, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCookie } from '@/lib/auth';
import { formatDate, formatCurrency, safeNumber } from '@/lib/account-helpers';

interface OrdersTabProps {
  userId?: number;
  isSeller?: boolean;
}

const BUYER_TABS = [
  { id: 'all', label: 'Semua', icon: Package },
  { id: 'pending_payment', label: 'Belum Bayar', icon: Clock },
  { id: 'processing', label: 'Dikemas', icon: Loader2 },
  { id: 'shipped', label: 'Dikirim', icon: Truck },
  { id: 'delivered', label: 'Sampai', icon: Package },
  { id: 'completed', label: 'Selesai', icon: CheckCircle },
];

const SELLER_TABS = [
  { id: 'processing', label: 'Pesanan Baru', icon: Clock },
  { id: 'packing', label: 'Dikemas', icon: Loader2 },
  { id: 'shipped', label: 'Dikirim', icon: Truck },
  { id: 'completed', label: 'Selesai', icon: CheckCircle },
];

// ✅ Retry logic dengan exponential backoff
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // ✅ Handle 429 Too Many Requests
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
        const waitTime = Math.min(retryAfter * 1000, 5000); // Max 5 detik
        
        if (process.env.NODE_ENV === 'development') console.warn(`⚠️ Rate limited. Retry ${attempt}/${maxRetries} in ${waitTime}ms`);
        
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      // ✅ Handle server errors (5xx)
      if (response.status >= 500 && attempt < maxRetries) {
        const waitTime = 1000 * attempt;
        if (process.env.NODE_ENV === 'development') console.warn(`⚠️ Server error ${response.status}. Retry in ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      
      const isTransient =
        error.message?.includes('timeout') ||
        error.message?.includes('network') ||
        error.message?.includes('Failed to fetch');
      
      if (!isTransient || attempt === maxRetries) throw error;
      
      const waitTime = 1000 * attempt;
      if (process.env.NODE_ENV === 'development') console.warn(`⚠️ Network error. Retry in ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};

export function OrdersTab({ userId, isSeller = false }: OrdersTabProps) {
  const router = navigation.useRouter();
  const [orders, setOrders] = react.useState<any[]>([]);
  const [isLoading, setIsLoading] = react.useState(true);
  const [orderFilter, setOrderFilter] = react.useState('all');
  const [error, setError] = react.useState<string | null>(null);
  const tabs = isSeller ? SELLER_TABS : BUYER_TABS;

  react.useEffect(() => {
    if (userId) fetchOrders();
  }, [orderFilter, userId]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const endpoint = isSeller
        ? `/api/seller/orders?status=${orderFilter}`
        : `/api/orders?status=${orderFilter}`;

      const res = await fetchWithRetry(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 429) {
        throw new Error('Terlalu banyak request. Silakan coba lagi dalam beberapa saat.');
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Gagal memuat pesanan');
      }

      const orderList = data.orders || [];
      setOrders(
        orderList.map((order: any) => ({
          ...order,
          id: safeNumber(order.id),
          orderId: safeNumber(order.orderId || order.id),
          grandTotal: safeNumber(order.grandTotal),
          items: (order.items || []).map((item: any) => ({
            ...item,
            id: safeNumber(item.id),
            quantity: safeNumber(item.quantity),
            price: safeNumber(item.price),
          })),
        }))
      );
    } catch (error: any) {
      console.error('Fetch orders error:', error);
      setError(error.message || 'Gagal memuat pesanan');
      toast.error(error.message || 'Gagal memuat pesanan');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setOrderFilter(tab.id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                orderFilter === tab.id
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error State */}
      {error && (
        <div className="card bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-semibold text-red-800">Gagal memuat pesanan</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
            <button
              onClick={fetchOrders}
              className="btn-outline text-sm py-1 px-3 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Coba Lagi
            </button>
          </div>
        </div>
      )}

      {/* Orders List */}
      {orders.length === 0 && !error ? (
        <div className="card text-center py-16">
          <Package className="w-16 h-16 mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary font-medium">
            orderFilter === 'all' ? 'Belum ada pesanan': `Tidak ada pesanan ${tabs.find(t => t.id === orderFilter)?.label}`
          </p>
          <button onClick={() => router.push('/katalog')} className="btn-primary mt-4">
            Mulai Belanja
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="card cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/orders/${order.orderId || order.id}`)}
            >
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-border">
                <div>
                  <span className="font-semibold text-text-primary">
                    {order.orderNumber ? `#${order.orderNumber}` : `Order #${order.orderId || order.id}`}
                  </span>
                  <p className="text-sm text-text-secondary">{formatDate(order.createdAt)}</p>
                </div>
                <span className="badge badge-pending capitalize">{order.status}</span>
              </div>

              <div className="space-y-4 mb-4">
                {order.items?.slice(0, 3).map((item: any, index: number) => (
                  <div key={item.id || index} className="flex gap-4 items-start">
                    <div className="w-16 h-16 bg-surface rounded-lg flex items-center justify-center overflow-hidden shrink-0 border border-border">
                      {item.productImage ? (
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl grayscale opacity-50">📦</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-semibold text-text-primary truncate mb-1">
                        {item.productName}
                      </h4>
                      <div className="flex flex-wrap justify-between items-end gap-2">
                        <div className="text-xs text-text-secondary">
                          {safeNumber(item.quantity)} x {formatCurrency(safeNumber(item.price))}
                        </div>
                        <p className="text-sm font-bold text-primary">
                          {formatCurrency(safeNumber(item.quantity) * safeNumber(item.price))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border">
                <div>
                  <p className="text-sm text-text-secondary">Total Pembayaran</p>
                  <p className="font-bold text-lg text-primary">
                    {formatCurrency(safeNumber(order.grandTotal))}
                  </p>
                </div>
                <div className="flex gap-2">

  {isSeller ? (

  <>
    {order.status === "processing" && (
      <button
        className="btn-primary px-4 py-2"
        onClick={async (e) => {
          e.stopPropagation();

          try {
            const token = getCookie("accessToken");

            const res = await fetch(
              `/api/seller/orders/${order.id}/ship`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  courierCode: "jne",
                  courierName: "JNE",
                  trackingNumber: `AGRIX${Date.now()}`,
                }),
              }
            );

            const data = await res.json();

            if (!res.ok) {
              throw new Error(data.error || "Gagal mengirim pesanan");
            }

            toast.success("Pesanan berhasil dikirim");
            fetchOrders();

          } catch (err: any) {
            toast.error(err.message);
          }
        }}
      >
        Konfirmasi Pengiriman
      </button>
    )}

    {order.status === "shipped" && (
      <button
        className="btn-primary px-4 py-2"
        onClick={async (e) => {
          e.stopPropagation();

          try {
            const token = getCookie("accessToken");

            const res = await fetch(
              `/api/seller/orders/${order.id}/delivered`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            const data = await res.json();

            if (!res.ok) {
              throw new Error(data.error || "Gagal mengubah status");
            }

            toast.success("Barang berhasil dikonfirmasi sampai");
            fetchOrders();

          } catch (err: any) {
            toast.error(err.message);
          }
        }}
      >
        Konfirmasi Barang Sampai
      </button>
    )}
  </>

) : (

    <>
      {order.status === "pending_payment" &&
 order.paymentMethod !== "cod" && (

          <button
            className="btn-primary px-4 py-2"
            onClick={() =>
              router.push(`/orders/${order.orderId || order.id}/pay`)
            }
          >
            Bayar
          </button>
      )}

      {order.status === "delivered" && (
  <button
    className="btn-primary px-4 py-2"
    onClick={async (e) => {
      e.stopPropagation();

      try {
        const token = getCookie("accessToken");

        const res = await fetch(
          `/api/orders/${order.id}/complete`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Gagal mengonfirmasi pesanan");
        }

        toast.success("Pesanan berhasil diselesaikan");
        fetchOrders();

      } catch (err: any) {
        toast.error(err.message);
      }
    }}
  >
    Konfirmasi Pesanan Diterima
  </button>
)}

      <button
        className="btn-outline px-4 py-2"
        onClick={() =>
          router.push(`/orders/${order.orderId || order.id}`)
        }
      >
        Detail
      </button>

      
    </>

  )}

</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
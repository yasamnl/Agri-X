'use client';

import { useEffect, useState , useRef } from 'react';
import { 
  Package, Truck, MapPin, Clock, CheckCircle2, 
  AlertCircle, RefreshCw, Loader2 
} from 'lucide-react';
import { getCookie } from '@/lib/auth';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface TrackingEvent {
  date: string;
  description: string;
  location: string;
}

interface TrackingData {
  orderId: number;
  orderNumber?: string;
  hasTracking: boolean;
  trackingNumber?: string;
  courier?: { code: string; name: string };
  orderStatus?: string;
  trackingStatus?: string;
  shippedAt?: string;
  deliveredAt?: string;
  lastUpdate?: string | null;
  history: TrackingEvent[];
  source?: 'live' | 'cached';
  warning?: string | null;
  message?: string;
}

interface TrackingSectionProps {
  orderId: number;
  endpoint?: string;
}

const TRACKING_STATUS_CONFIG: Record<string, { 
  icon: any; 
  color: string; 
  bg: string; 
  label: string 
}> = {
  pending: { 
    icon: Clock, 
    color: 'text-yellow-700', 
    bg: 'bg-yellow-50', 
    label: 'Menunggu Pickup' 
  },
  picked_up: { 
    icon: Package, 
    color: 'text-blue-700', 
    bg: 'bg-blue-50', 
    label: 'Diambil Kurir' 
  },
  in_transit: { 
    icon: Truck, 
    color: 'text-primary', 
    bg: 'bg-primary/10', 
    label: 'Dalam Perjalanan' 
  },
  out_for_delivery: { 
    icon: Truck, 
    color: 'text-indigo-700', 
    bg: 'bg-indigo-50', 
    label: 'Sedang Diantar' 
  },
  delivered: { 
    icon: CheckCircle2, 
    color: 'text-green-700', 
    bg: 'bg-green-50', 
    label: 'Sudah Diterima' 
  },
  returned: { 
    icon: AlertCircle, 
    color: 'text-orange-700', 
    bg: 'bg-orange-50', 
    label: 'Dikembalikan' 
  },
  failed: { 
    icon: AlertCircle, 
    color: 'text-red-700', 
    bg: 'bg-red-50', 
    label: 'Gagal Kirim' 
  },
};

export function TrackingSection({ orderId, endpoint }: TrackingSectionProps) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiEndpoint = endpoint || `/api/orders/${orderId}/tracking`;

  const fetchTracking = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getCookie('accessToken');
      if (!token) {
        setError('Sesi tidak ditemukan');
        return;
      }

      const res = await fetch(apiEndpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal memuat tracking');
      }

      const normalizedData = {
        ...result.data,
        history: Array.isArray(result.data?.history) ? result.data.history : [],
      };

      setData(normalizedData);
    } catch (err: any) {
      console.error('Fetch tracking error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, [orderId]);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy, HH:mm', { locale: id });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="card" data-tracking-section>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="ml-2 text-text-secondary">Memuat tracking...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" data-tracking-section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Tracking Pengiriman
          </h3>
          <button
            onClick={fetchTracking}
            className="btn-outline text-sm py-1 px-3 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Coba Lagi
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!data?.hasTracking) {
    return (
      <div className="card" data-tracking-section>
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-primary" />
          Tracking Pengiriman
        </h3>
        <div className="text-center py-6 text-text-secondary">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{data?.message || 'Pesanan belum memiliki nomor resi'}</p>
        </div>
      </div>
    );
  }

  const trackingStatus = data.trackingStatus?.toLowerCase() || 'unknown';
  const statusConfig = TRACKING_STATUS_CONFIG[trackingStatus] || TRACKING_STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="card" data-tracking-section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          Tracking Pengiriman
        </h3>
        <button
          onClick={fetchTracking}
          className="btn-outline text-sm py-1 px-3 flex items-center gap-1"
          disabled={loading}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {data.warning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-yellow-700 text-xs">
          ⚠️ {data.warning}
        </div>
      )}

      <div className={`${statusConfig.bg} rounded-xl p-4 mb-4`}>
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-8 h-8 ${statusConfig.color}`} />
          <div>
            <p className="text-xs text-text-secondary">Status Pengiriman</p>
            <p className={`text-lg font-bold ${statusConfig.color}`}>
              {statusConfig.label}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl p-4 mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">No. Resi:</span>
          <span className="font-mono font-semibold text-text-primary">
            {data.trackingNumber || '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Kurir:</span>
          <span className="font-semibold text-text-primary">
            {data.courier?.name || data.courier?.code || '-'}
          </span>
        </div>
        {data.shippedAt && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Dikirim:</span>
            <span className="text-text-primary">{formatDate(data.shippedAt)}</span>
          </div>
        )}
        {data.deliveredAt && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Diterima:</span>
            <span className="text-green-600 font-semibold">{formatDate(data.deliveredAt)}</span>
          </div>
        )}
        {data.lastUpdate && (
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="text-text-secondary">Update terakhir:</span>
            <span className="text-text-primary">{formatDate(data.lastUpdate)}</span>
          </div>
        )}
        {data.source && (
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="text-text-secondary">Sumber data:</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              data.source === 'live' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {data.source === 'live' ? '🟢 Live' : '📦 Cached'}
            </span>
          </div>
        )}
      </div>

      {data.history && data.history.length > 0 ? (
        <div>
          <h4 className="font-semibold text-text-primary mb-3 text-sm">
            Riwayat Pengiriman ({data.history.length} event)
          </h4>
          <div className="relative pl-6 space-y-4 max-h-96 overflow-y-auto">
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-primary/30" />

            {data.history.map((event, idx) => (
              <div key={idx} className="relative">
                <div className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 ${
                  idx === 0 
                    ? 'bg-primary border-primary' 
                    : 'bg-background border-border'
                }`} />

                <div className="pb-4">
                  <p className="text-sm text-text-primary font-medium">
                    {event.description || '-'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                    {event.date && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(event.date)}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-text-secondary text-sm">
          Belum ada riwayat tracking
        </div>
      )}
    </div>
  );
}
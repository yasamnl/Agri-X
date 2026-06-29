'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { ReportModal } from '@/components/reports/ReportModal';
import {
  User, MapPin, MessageSquare, Star, Settings, LogOut,
  Package, Clock, CheckCircle, Camera, Loader2,
  Truck, CreditCard, ArrowRight, AlertCircle, Pencil, Trash2,
  X, ChevronRight, Bell, Shield, Palette, HelpCircle,
  FileText, Heart, UserCircle, Gift, TrendingUp, Award,
  ShoppingBag, Tag, Ticket, Bookmark, BarChart3, Calendar,
  Mail, Phone, Home, Plus, Edit, AlertTriangle, DollarSign,
  Store, Users, Eye
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  createdAt: string;
}

interface AccountStats {
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  activeOrdersDetail: Record<string, number>;
  totalSpent: number;
  reviewCount: number;
  voucherCount: number;
  unreadNotifications: number;
  memberSince: string;
}

interface SellerStats {
  totalProducts: number;
  totalSales: number;
  totalOrders: number;
  activeOrders: number;
  avgRating: number;
  totalReviews: number;
  monthlyRevenue: number;
  dailyRevenue: number;
}

interface ChartData {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  id: number;
  name: string;
  image: string | null;
  price: number;
  stock: number;
  totalSold: number;
  totalRevenue: number;
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  product: { id: number; name: string; image: string | null; };
}

interface Voucher {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  minPurchase: number;
  maxDiscount: number;
  description: string;
  expiresAt: string;
}

// ============================================================================
// TABS (berbeda untuk buyer dan seller)
// ============================================================================
const BUYER_TABS = [
  { id: 'overview', label: 'Ringkasan', icon: Home },
  { id: 'orders', label: 'Pesanan', icon: ShoppingBag },
  { id: 'reviews', label: 'Ulasan', icon: Star },
  { id: 'vouchers', label: 'Voucher', icon: Ticket },
  { id: 'address', label: 'Alamat', icon: MapPin },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

const SELLER_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'products', label: 'Produk Saya', icon: Package },
  { id: 'orders', label: 'Pesanan', icon: ShoppingBag },
  { id: 'reviews', label: 'Ulasan', icon: Star },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const safeNumber = (val: any, fallback: number = 0): number => {
  if (val === null || val === undefined) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

const getStatusBadge = (status: string) => {
  const badges: Record<string, { className: string; label: string }> = {
    pending: { className: 'badge badge-pending', label: 'Menunggu Pembayaran' },
    processing: { className: 'badge badge-processing', label: 'Diproses' },
    shipped: { className: 'badge badge-shipped', label: 'Dikirim' },
    delivered: { className: 'badge badge-completed', label: 'Selesai' },
    completed: { className: 'badge badge-completed', label: 'Selesai' },
    cancelled: { className: 'badge badge-cancelled', label: 'Dibatalkan' },
  };
  const badge = badges[status] || badges.pending;
  return <span className={badge.className}>{badge.label}</span>;
};

const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && (response.status === 503 || response.status >= 500)) {
        throw new Error(`Server error: ${response.status}`);
      }
      return response;
    } catch (error: any) {
      lastError = error;
      const isTransient = error.message?.includes('timeout') || error.message?.includes('network') || error.message?.includes('Failed to fetch');
      if (!isTransient || attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 200 * attempt));
    }
  }
  throw lastError;
};

// ============================================================================
// ✅ SVG LINE CHART COMPONENT (Custom, tanpa library)
// ============================================================================
function SalesLineChart({ data, height = 200 }: { data: ChartData[]; height?: number }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-text-secondary">
        <p>Belum ada data penjualan</p>
      </div>
    );
  }

  const width = 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const minRevenue = 0;

  // Generate points
  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.revenue - minRevenue) / (maxRevenue - minRevenue || 1)) * chartHeight;
    return { x, y, data: d };
  });

  // Generate path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  // Area path (untuk gradient fill)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    value: minRevenue + (maxRevenue - minRevenue) * pct,
    y: padding.top + chartHeight - pct * chartHeight,
  }));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[400px]">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" className="text-primary" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-primary" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels.map((label, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={label.y}
              x2={width - padding.right}
              y2={label.y}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeDasharray="4 4"
              className="text-text-primary"
            />
            <text
              x={padding.left - 10}
              y={label.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              className="text-text-secondary"
            >
              {label.value >= 1000000 ? `${(label.value / 1000000).toFixed(1)}M` :
               label.value >= 1000 ? `${(label.value / 1000).toFixed(0)}K` :
               label.value.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points & Labels */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Outer circle */}
            <circle cx={p.x} cy={p.y} r="6" fill="white" stroke="#10b981" strokeWidth="2" />
            {/* Inner circle */}
            <circle cx={p.x} cy={p.y} r="3" fill="#10b981" />
            
            {/* X-axis label */}
            <text
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
              className="text-text-secondary"
            >
              {p.data.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ============================================================================
// ✅ SELLER DASHBOARD COMPONENT
// ============================================================================
function SellerDashboard() {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'revenue' | 'orders'>('revenue');

  useEffect(() => {
    fetchSellerData();
  }, []);

  const fetchSellerData = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const headers = { 'Authorization': `Bearer ${token}` };

      const [statsRes, chartRes, productsRes] = await Promise.all([
        fetch('/api/seller/stats', { headers }),
        fetch('/api/seller/sales-chart', { headers }),
        fetch('/api/seller/top-products', { headers }),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.data);
      }

      if (chartRes.ok) {
        const data = await chartRes.json();
        setChartData(data.data.chart || []);
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        setTopProducts(data.data.products || []);
      }
    } catch (error: any) {
      console.error('Fetch seller data error:', error);
      toast.error('Gagal memuat data penjual');
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
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="card bg-gradient-to-br from-primary to-secondary text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-5 h-5" />
            <span className="text-sm opacity-90">Dashboard Penjual</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">Selamat Datang, Penjual! 🌾</h2>
          <p className="text-sm opacity-90">Pantau performa toko Anda di sini</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <DollarSign className="w-8 h-8 mb-2 opacity-80" />
          <p className="text-xs opacity-90">Pendapatan Hari Ini</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(stats?.dailyRevenue || 0)}</p>
        </div>
        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
          <p className="text-xs opacity-90">Pendapatan Bulan Ini</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(stats?.monthlyRevenue || 0)}</p>
        </div>
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <Package className="w-8 h-8 mb-2 opacity-80" />
          <p className="text-xs opacity-90">Total Produk</p>
          <p className="text-2xl font-bold mt-1">{stats?.totalProducts || 0}</p>
        </div>
        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <ShoppingBag className="w-8 h-8 mb-2 opacity-80" />
          <p className="text-xs opacity-90">Pesanan Aktif</p>
          <p className="text-2xl font-bold mt-1">{stats?.activeOrders || 0}</p>
        </div>
      </div>

      {/* Rating & Reviews Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Rating Toko
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-primary">
              {(stats?.avgRating || 0).toFixed(1)}
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(stats?.avgRating || 0)
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-text-secondary">
                {stats?.totalReviews || 0} ulasan
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Total Penjualan
            </h3>
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {formatCurrency(stats?.totalSales || 0)}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Dari {stats?.totalOrders || 0} pesanan
          </p>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Performa Penjualan
            </h3>
            <p className="text-xs text-text-secondary mt-1">7 hari terakhir</p>
          </div>
          <div className="flex gap-1 bg-surface rounded-lg p-1">
            <button
              onClick={() => setChartPeriod('revenue')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                chartPeriod === 'revenue'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Pendapatan
            </button>
            <button
              onClick={() => setChartPeriod('orders')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                chartPeriod === 'orders'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Pesanan
            </button>
          </div>
        </div>

        <SalesLineChart
          data={chartPeriod === 'revenue' 
            ? chartData 
            : chartData.map(d => ({ ...d, revenue: d.orders }))}
          height={250}
        />

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-text-secondary">Total 7 Hari</p>
            <p className="text-lg font-bold text-text-primary">
              {chartPeriod === 'revenue' 
                ? formatCurrency(chartData.reduce((sum, d) => sum + d.revenue, 0))
                : `${chartData.reduce((sum, d) => sum + d.orders, 0)} pesanan`}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Rata-rata per Hari</p>
            <p className="text-lg font-bold text-text-primary">
              {chartPeriod === 'revenue' 
                ? formatCurrency(chartData.reduce((sum, d) => sum + d.revenue, 0) / 7)
                : `${Math.round(chartData.reduce((sum, d) => sum + d.orders, 0) / 7)} pesanan`}
            </p>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="card">
        <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          Produk Terlaris
        </h3>
        {topProducts.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Belum ada produk terjual</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topProducts.map((product, idx) => (
              <div key={product.id} className="flex items-center gap-3 p-3 bg-surface rounded-xl hover:bg-surface-hover transition-colors">
                {/* Rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  idx === 0 ? 'bg-yellow-400 text-white' :
                  idx === 1 ? 'bg-gray-400 text-white' :
                  idx === 2 ? 'bg-orange-400 text-white' :
                  'bg-surface text-text-secondary'
                }`}>
                  #{idx + 1}
                </div>

                {/* Product Image */}
                <div className="w-14 h-14 bg-background rounded-lg overflow-hidden flex-shrink-0 border border-border">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-text-muted" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">{product.name}</p>
                  <p className="text-xs text-text-secondary">
                    {product.totalSold} terjual • Stok: {product.stock}
                  </p>
                </div>

                {/* Revenue */}
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-primary text-sm">
                    {formatCurrency(product.totalRevenue)}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {formatCurrency(product.price)}/{product.name.includes('kg') ? 'kg' : 'pcs'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function AccountPage() {
  const router = useRouter();
  const { user, logout, updateUser, isAuthenticated, isLoading } = useAuth();

  // ✅ NEW: User profile state (dari database)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // ✅ Determine if user is seller
  const isSeller = userProfile?.role === 'seller' || user?.role === 'seller';
  const tabs = isSeller ? SELLER_TABS : BUYER_TABS;

  // ============================================
  // ✅ Fetch User Profile dari Database
  // ============================================
  const fetchUserProfile = useCallback(async () => {
    try {
      setIsProfileLoading(true);
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const res = await fetch('/api/users/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUserProfile(data.data);
          
          // ✅ Sync ke AuthContext
          updateUser({
            id: data.data.id,
            name: data.data.name,
            email: data.data.email,
            role: data.data.role,
            avatar: data.data.avatar,
          });
        }
      }
    } catch (error: any) {
      console.error('Fetch profile error:', error);
    } finally {
      setIsProfileLoading(false);
    }
  }, [updateUser]);

  // ============================================
  // ✅ Handle Upload Avatar
  // ============================================
  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Hanya file JPG, PNG, atau WEBP yang diperbolehkan');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    const loadingToast = toast.loading('Mengupload foto profil...');

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const token = getCookie('accessToken');
      const res = await fetch('/api/users/upload-avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        const newAvatar = data.avatar;
        
        // ✅ Update local state
        setUserProfile(prev => prev ? { ...prev, avatar: newAvatar } : null);
        
        // ✅ Sync ke AuthContext
        updateUser({ avatar: newAvatar });
        
        toast.success('Foto profil berhasil diupdate!', { id: loadingToast });
      } else {
        throw new Error(data.error || 'Gagal upload avatar');
      }
    } catch (error: any) {
      toast.error(error.message || 'Gagal upload avatar', { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  // ✅ Get avatar URL dengan fallback
  const getAvatarUrl = () => {
    const avatar = userProfile?.avatar || user?.avatar;
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    return `${process.env.NEXT_PUBLIC_APP_URL || ''}${avatar}`;
  };

  const avatarUrl = getAvatarUrl();

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/akun');
    }
  }, [isAuthenticated, isLoading, router]);

  // ✅ Fetch user profile saat mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserProfile();
    }
  }, [isAuthenticated, fetchUserProfile]);

  // ✅ Set default tab berdasarkan role
  useEffect(() => {
    if (userProfile) {
      if (userProfile.role === 'seller' && activeTab === 'overview') {
        setActiveTab('dashboard');
      }
    }
  }, [userProfile]);

  useEffect(() => {
    const saved = localStorage.getItem('agri-x-theme');
    if (saved === 'dark') {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && userProfile) {
      fetchAccountData();
    }
  }, [isAuthenticated, activeTab, userProfile]);

  const fetchAccountData = async () => {
    try {
      setIsLoadingData(true);
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const headers = { 'Authorization': `Bearer ${token}` };

      if (activeTab === 'overview') {
        const res = await fetch('/api/users/stats', { headers });
        if (res.ok) {
          const data = await res.json();
          setStats(data.data);
        }
      } else if (activeTab === 'reviews') {
        const res = await fetch('/api/reviews/user', { headers });
        if (res.ok) {
          const data = await res.json();
          setReviews(data.data.reviews || []);
        }
      } else if (activeTab === 'vouchers') {
        const res = await fetch('/api/vouchers/user', { headers });
        if (res.ok) {
          const data = await res.json();
          setVouchers(data.data.vouchers || []);
        }
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      toast.error(error.message || 'Gagal memuat data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Yakin ingin logout?')) {
      await logout();
      toast.success('Berhasil logout!');
      router.push('/login');
    }
  };

  const handleSettingsAction = (item: any) => {
    setShowSettingsModal(false);
    if (item.isToggle) {
      const newMode = !darkMode;
      setDarkMode(newMode);
      document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
      localStorage.setItem('agri-x-theme', newMode ? 'dark' : 'light');
      toast.success(`Mode ${newMode ? 'gelap' : 'terang'} diaktifkan`);
    } else if (item.action === 'help') {
      setShowReportModal(true);
    } else if (item.href) {
      router.push(item.href);
    } else {
      toast(`${item.label} - Fitur akan datang!`, { icon: '🚧' });
    }
  };

  if (isLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const settingsItems = [
    { section: 'Akun', items: [
      { icon: UserCircle, label: 'Profil Saya', action: 'profile' },
      { icon: MapPin, label: 'Alamat Saya', action: 'address', href: '/akun?tab=address' },
      { icon: Star, label: 'Ulasan Saya', action: 'reviews', href: '/akun?tab=reviews' },
    ]},
    { section: 'Forum', items: [
      { icon: MessageSquare, label: 'Forum Diskusi', action: 'forum', href: '/forum' },
    ]},
    { section: 'Bantuan', items: [
      { icon: HelpCircle, label: 'Bantuan & Support', action: 'help' },
      { icon: Shield, label: 'Privasi & Keamanan', action: 'privacy' },
    ]},
    { section: 'Pengaturan', items: [
      { icon: Bell, label: 'Notifikasi', action: 'notifications' },
      { icon: Palette, label: 'Tampilan', action: 'theme', isToggle: true },
    ]},
  ];

  const displayName = userProfile?.name || user?.name || 'User';
  const displayEmail = userProfile?.email || user?.email || 'email@example.com';
  const displayRole = userProfile?.role || user?.role || 'buyer';

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* ====================================================================
            PROFILE HEADER
        ==================================================================== */}
        <div className="bg-gradient-to-br from-primary to-secondary rounded-3xl p-6 md:p-8 text-white mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* ✅ Avatar dengan Upload */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-white/30 overflow-hidden bg-white/20">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <label className="absolute bottom-0 right-0 w-8 h-8 bg-white text-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary hover:text-white transition-colors shadow-lg">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadAvatar}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>

              {isUploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold">{displayName}</h1>
                {isSeller && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs flex items-center gap-1">
                    <Store className="w-3 h-3" />
                    Penjual
                  </span>
                )}
              </div>
              <p className="text-white/80 mt-1">{displayEmail}</p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
                <span className="text-sm bg-white/20 px-3 py-1 rounded-full capitalize">
                  {displayRole}
                </span>
                {stats?.memberSince && (
                  <span className="text-sm bg-white/20 px-3 py-1 rounded-full flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Member sejak {format(new Date(stats.memberSince), 'MMM yyyy', { locale: id })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================================
            TABS NAVIGATION
        ==================================================================== */}
        <div className="mb-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badge = tab.id === 'notifications' ? stats?.unreadNotifications : undefined;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-surface text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                  {badge && badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      isActive ? 'bg-white/20' : 'bg-primary text-white'
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ====================================================================
            TAB CONTENT
        ==================================================================== */}
        {isLoadingData && activeTab !== 'dashboard' ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* ✅ SELLER DASHBOARD */}
            {isSeller && activeTab === 'dashboard' && <SellerDashboard />}

            {/* ✅ SELLER PRODUCTS TAB */}
            {isSeller && activeTab === 'products' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-text-primary">Produk Saya</h2>
                  <button 
                    onClick={() => router.push('/seller/products/new')}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Produk
                  </button>
                </div>
                <div className="card text-center py-16">
                  <Package className="w-16 h-16 mx-auto text-text-muted mb-4" />
                  <p className="text-text-secondary font-medium">Kelola produk Anda di sini</p>
                  <button 
                    onClick={() => router.push('/seller/products')}
                    className="btn-primary mt-4"
                  >
                    Kelola Produk
                  </button>
                </div>
              </div>
            )}

            {/* BUYER OVERVIEW TAB */}
            {!isSeller && activeTab === 'overview' && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <ShoppingBag className="w-8 h-8 mb-2 opacity-80" />
                    <p className="text-3xl font-bold">{stats.totalOrders}</p>
                    <p className="text-sm opacity-90">Total Pesanan</p>
                  </div>
                  <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <CheckCircle className="w-8 h-8 mb-2 opacity-80" />
                    <p className="text-3xl font-bold">{stats.completedOrders}</p>
                    <p className="text-sm opacity-90">Pesanan Selesai</p>
                  </div>
                  <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                    <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
                    <p className="text-2xl font-bold">{formatCurrency(stats.totalSpent)}</p>
                    <p className="text-sm opacity-90">Total Belanja</p>
                  </div>
                  <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                    <Award className="w-8 h-8 mb-2 opacity-80" />
                    <p className="text-3xl font-bold">{stats.reviewCount}</p>
                    <p className="text-sm opacity-90">Ulasan Diberikan</p>
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-bold text-text-primary mb-4">Aksi Cepat</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button onClick={() => setActiveTab('orders')} className="p-4 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-center">
                      <Package className="w-8 h-8 mx-auto mb-2 text-primary" />
                      <p className="text-sm font-medium text-text-primary">Pesanan Saya</p>
                      <p className="text-xs text-text-secondary">{stats.activeOrders} aktif</p>
                    </button>
                    <button onClick={() => setActiveTab('vouchers')} className="p-4 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-center">
                      <Ticket className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm font-medium text-text-primary">Voucher</p>
                      <p className="text-xs text-text-secondary">{stats.voucherCount} tersedia</p>
                    </button>
                    <button onClick={() => setShowReportModal(true)} className="p-4 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-center">
                      <HelpCircle className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-sm font-medium text-text-primary">Bantuan</p>
                      <p className="text-xs text-text-secondary">Laporkan masalah</p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'orders' && <OrdersTab userId={user?.id} />}

            {/* REVIEWS TAB */}
            {activeTab === 'reviews' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary">Ulasan Saya ({reviews.length})</h2>
                {reviews.length === 0 ? (
                  <div className="card text-center py-16">
                    <Star className="w-16 h-16 mx-auto text-text-muted mb-4" />
                    <p className="text-text-secondary font-medium">Belum ada ulasan</p>
                    <button onClick={() => setActiveTab('orders')} className="btn-primary mt-4">Lihat Pesanan</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <div key={review.id} className="card">
                        <div className="flex gap-4">
                          <div className="w-20 h-20 bg-surface rounded-lg overflow-hidden flex-shrink-0">
                            {review.product.image ? (
                              <img src={review.product.image} alt={review.product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-text-muted" /></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-text-primary mb-1">{review.product.name}</h3>
                            <div className="flex items-center gap-1 mb-2">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-text-muted'}`} />
                              ))}
                            </div>
                            <p className="text-sm text-text-secondary line-clamp-2">{review.comment}</p>
                            <p className="text-xs text-text-muted mt-2">{formatDate(review.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VOUCHERS TAB */}
            {activeTab === 'vouchers' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary">Voucher Saya ({vouchers.length})</h2>
                {vouchers.length === 0 ? (
                  <div className="card text-center py-16">
                    <Ticket className="w-16 h-16 mx-auto text-text-muted mb-4" />
                    <p className="text-text-secondary font-medium">Belum ada voucher</p>
                    <button onClick={() => router.push('/katalog')} className="btn-primary mt-4">Belanja Sekarang</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vouchers.map((voucher) => {
                      const daysLeft = differenceInDays(new Date(voucher.expiresAt), new Date());
                      const isExpired = daysLeft < 0;
                      return (
                        <div key={voucher.id} className={`card relative overflow-hidden ${isExpired ? 'opacity-50' : ''}`}>
                          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16" />
                          <div className="relative">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="text-xs text-text-secondary mb-1">Kode Voucher</p>
                                <p className="text-lg font-bold text-primary font-mono">{voucher.code}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-primary">
                                  {voucher.discountType === 'percentage' ? `${voucher.discountValue}%` : formatCurrency(voucher.discountValue)}
                                </p>
                                <p className="text-xs text-text-secondary">OFF</p>
                              </div>
                            </div>
                            <p className="text-sm text-text-secondary mb-3">{voucher.description}</p>
                            <div className="flex items-center justify-between text-xs text-text-secondary">
                              <div>
                                <p>Min. belanja:</p>
                                <p className="font-medium text-text-primary">{formatCurrency(voucher.minPurchase)}</p>
                              </div>
                              <div className="text-right">
                                <p>Berlaku hingga:</p>
                                <p className={`font-medium ${daysLeft <= 3 ? 'text-red-500' : 'text-text-primary'}`}>
                                  {format(new Date(voucher.expiresAt), 'dd MMM yyyy', { locale: id })}
                                  {!isExpired && <span className="ml-1">({daysLeft} hari)</span>}
                                </p>
                              </div>
                            </div>
                            {isExpired && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                                <span className="text-red-500 font-bold text-xl rotate-[-15deg]">EXPIRED</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ADDRESS TAB */}
            {activeTab === 'address' && <AddressTab />}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary">Pengaturan Akun</h2>
                <div className="card space-y-2">
                  {settingsItems.map((section, idx) => (
                    <div key={idx}>
                      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-2">{section.section}</h3>
                      <div className="space-y-1">
                        {section.items.map((item, itemIdx) => (
                          <button key={itemIdx} onClick={() => handleSettingsAction(item)} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-surface-hover transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                              <item.icon className="w-5 h-5" />
                            </div>
                            <span className="flex-1 text-left font-medium text-text-primary">{item.label}</span>
                            {item.isToggle ? (
                              <div className={`w-12 h-7 rounded-full transition-colors ${darkMode ? 'bg-primary' : 'bg-border'}`}>
                                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                              </div>
                            ) : (
                              <ChevronRight className="w-5 h-5 text-text-secondary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium">
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedType="general"
        onSuccess={() => {}}
      />
    </div>
  );
}

// ============================================================================
// ORDERS TAB COMPONENT (tetap sama seperti sebelumnya)
// ============================================================================
function OrdersTab({ userId }: { userId?: number }) {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState('all');

  const orderTabs = [
    { id: 'all', label: 'Semua', icon: Package },
    { id: 'pending', label: 'Belum Dibayar', icon: Clock },
    { id: 'processing', label: 'Diproses', icon: Loader2 },
    { id: 'shipped', label: 'Dikirim', icon: Truck },
    { id: 'completed', label: 'Selesai', icon: CheckCircle },
  ];

  useEffect(() => {
    if (userId) fetchOrders();
  }, [orderFilter, userId]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const res = await fetchWithRetry(
        `/api/orders/user?status=${orderFilter}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders?.map((order: any) => ({
          ...order,
          id: safeNumber(order.id),
          orderId: safeNumber(order.orderId),
          grandTotal: safeNumber(order.grandTotal),
          items: order.items?.map((item: any) => ({
            ...item,
            id: safeNumber(item.id),
            quantity: safeNumber(item.quantity),
            price: safeNumber(item.price),
          })) || [],
        })) || []);
      }
    } catch (error: any) {
      console.error('Fetch orders error:', error);
      toast.error(error.message || 'Gagal memuat pesanan');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
        {orderTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setOrderFilter(tab.id)} className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${orderFilter === tab.id ? 'bg-primary text-white shadow-md' : 'bg-surface text-text-secondary hover:bg-surface-hover'}`}>
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="card text-center py-16">
          <Package className="w-16 h-16 mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary font-medium">Belum ada pesanan</p>
          <button onClick={() => router.push('/katalog')} className="btn-primary mt-4">Mulai Belanja</button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/orders/${order.orderId || order.id}`)}>
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-border">
                <div>
                  <span className="font-semibold text-text-primary">Order #{order.orderId || order.id}</span>
                  <p className="text-sm text-text-secondary">{formatDate(order.createdAt)}</p>
                </div>
                {getStatusBadge(order.status)}
              </div>
              <div className="space-y-4 mb-4">
                {order.items?.slice(0, 3).map((item: any, index: number) => (
                  <div key={item.id || index} className="flex gap-4 items-start">
                    <div className="w-16 h-16 bg-surface rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 border border-border">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl grayscale opacity-50">📦</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-semibold text-text-primary truncate mb-1">{item.productName}</h4>
                      <div className="flex flex-wrap justify-between items-end gap-2">
                        <div className="text-xs text-text-secondary">{safeNumber(item.quantity)} x {formatCurrency(safeNumber(item.price))}</div>
                        <p className="text-sm font-bold text-primary">{formatCurrency(safeNumber(item.quantity) * safeNumber(item.price))}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-border">
                <div>
                  <p className="text-sm text-text-secondary">Total Pembayaran</p>
                  <p className="font-bold text-lg text-primary">{formatCurrency(safeNumber(order.grandTotal))}</p>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {order.status === 'pending' && order.paymentMethod !== 'cod' && (
                    <button className="btn-primary px-4 py-2 text-sm flex items-center gap-1" onClick={() => router.push(`/orders/${order.orderId || order.id}/pay`)}>
                      <CreditCard className="w-4 h-4" />Bayar
                    </button>
                  )}
                  <button className="btn-outline px-4 py-2 text-sm flex items-center gap-1" onClick={() => router.push(`/orders/${order.orderId || order.id}`)}>
                    Detail<ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADDRESS TAB COMPONENT
// ============================================================================
function AddressTab() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      const res = await fetch('/api/address', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.data?.addresses || []);
      }
    } catch (error) {
      console.error('Fetch addresses error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">Alamat Saya</h2>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />Tambah Alamat
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="card text-center py-16">
          <MapPin className="w-16 h-16 mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary font-medium">Belum ada alamat</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-text-primary">{addr.label}</p>
                      {addr.is_default && <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">Utama</span>}
                    </div>
                    <p className="text-sm text-text-secondary">{addr.receiver_name}</p>
                    <p className="text-sm text-text-secondary">{addr.phone}</p>
                    <p className="text-sm text-text-secondary mt-2">{addr.address}</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-surface rounded-lg transition-colors">
                  <Edit className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format, differenceInDays } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { ReportModal } from '@/components/reports/ReportModal';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/account-helpers';
import { OrdersTab } from '@/components/account/OrdersTab';
import { AddressTab } from '@/components/account/AddressTab';
import type { UserProfile, AccountStats, Review, Voucher } from '@/components/account/types';
import {
  Home, ShoppingBag, Star, Ticket, MapPin, Settings,
  Loader2, Camera, Calendar, CheckCircle, TrendingUp, Award,
  Package, HelpCircle, UserCircle, MessageSquare, Shield, Bell,
  ChevronRight, LogOut, RefreshCw, AlertCircle,
} from 'lucide-react';

const BUYER_TABS = [
  { id: 'overview', label: 'Ringkasan', icon: Home },
  { id: 'orders', label: 'Pesanan', icon: ShoppingBag },
  { id: 'reviews', label: 'Ulasan', icon: Star },
  { id: 'vouchers', label: 'Voucher', icon: Ticket },
  { id: 'address', label: 'Alamat', icon: MapPin },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

export default function BuyerAccountPage() {
  const router = useRouter();
  const { user, logout, updateUser, isAuthenticated, isLoading } = useAuth();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null); // ✅ NEW

  // ✅ Ref untuk cegah infinite loop
  const hasFetchedProfileRef = useRef(false);
  const fetchedTabsRef = useRef<Set<string>>(new Set());

  // ============================================
  // ✅ FIX 1: Fetch Profile
  // ============================================
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/akun');
      return;
    }

    if (!isAuthenticated || hasFetchedProfileRef.current) {
      return;
    }

    hasFetchedProfileRef.current = true;

    const fetchProfile = async () => {
      try {
        setIsProfileLoading(true);
        const token = getCookie('accessToken');
        if (!token) {
          console.warn('⚠️ [PROFILE] No token found');
          hasFetchedProfileRef.current = false;
          return;
        }

        console.log('🔄 [PROFILE] Fetching user profile...');
        const res = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          console.log('✅ [PROFILE] Data received:', data);
          if (data.success) {
            setUserProfile(data.data);
            updateUser({
              id: data.data.id,
              name: data.data.name,
              email: data.data.email,
              role: data.data.role,
              avatar: data.data.avatar,
            });
          } else {
            console.error('❌ [PROFILE] API error:', data.error);
            toast.error(data.error || 'Gagal memuat profil');
          }
        } else {
          console.error('❌ [PROFILE] HTTP error:', res.status);
          toast.error(`Gagal memuat profil (HTTP ${res.status})`);
        }
      } catch (error: any) {
        console.error('❌ [PROFILE] Fetch error:', error);
        toast.error(error.message || 'Gagal memuat profil');
        hasFetchedProfileRef.current = false;
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchProfile();
  }, [isAuthenticated, isLoading, router, updateUser]);

  // ============================================
  // ✅ FIX 2: Fetch Tab Data dengan Better Logging
  // ============================================
  const fetchTabData = async (tabId: string, forceRefresh = false) => {
    if (!isAuthenticated || !userProfile) {
      console.warn('⚠️ [TAB] Skip - not authenticated or no profile');
      return;
    }

    const tabKey = `${tabId}-${userProfile.id}`;
    
    // ✅ Skip jika sudah fetch (kecuali force refresh)
    if (!forceRefresh && fetchedTabsRef.current.has(tabKey)) {
      console.log(`⏸️ [TAB] Skip - already fetched: ${tabKey}`);
      return;
    }

    console.log(`🔄 [TAB] Fetching data for tab: ${tabId}`);
    fetchedTabsRef.current.add(tabKey);

    try {
      setIsLoadingData(true);
      setStatsError(null);
      
      const token = getCookie('accessToken');
      if (!token) {
        console.error('❌ [TAB] No token found');
        fetchedTabsRef.current.delete(tabKey);
        toast.error('Sesi berakhir. Silakan login kembali.');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      if (tabId === 'overview') {
        console.log('📊 [STATS] Fetching user stats...');
        const res = await fetch('/api/users/stats', { headers });
        
        console.log('📊 [STATS] Response status:', res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log('📊 [STATS] Data received:', data);
          
          if (data.success && data.data) {
            setStats(data.data);
            console.log('✅ [STATS] Stats set successfully');
          } else {
            console.error('❌ [STATS] Invalid data format:', data);
            setStatsError('Format data tidak valid');
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error('❌ [STATS] HTTP error:', res.status, errorData);
          setStatsError(errorData.error || `HTTP ${res.status}`);
          toast.error(errorData.error || 'Gagal memuat statistik');
        }
      } else if (tabId === 'reviews') {
        const res = await fetch('/api/reviews/user', { headers });
        if (res.ok) {
          const data = await res.json();
          setReviews(data.data?.reviews || []);
        }
      } else if (tabId === 'vouchers') {
        const res = await fetch('/api/vouchers/user', { headers });
        if (res.ok) {
          const data = await res.json();
          setVouchers(data.data?.vouchers || []);
        }
      }
    } catch (error: any) {
      console.error('❌ [TAB] Fetch error:', error);
      fetchedTabsRef.current.delete(tabKey);
      setStatsError(error.message || 'Gagal memuat data');
      toast.error(error.message || 'Gagal memuat data');
    } finally {
      setIsLoadingData(false);
    }
  };

  // ✅ Auto-fetch saat tab berubah
  useEffect(() => {
    if (isAuthenticated && userProfile) {
      fetchTabData(activeTab);
    }
  }, [isAuthenticated, userProfile, activeTab]);

  // ✅ Manual refresh handler
  const handleRefreshStats = () => {
    console.log('🔄 [REFRESH] Manual refresh stats');
    const tabKey = `overview-${userProfile?.id}`;
    fetchedTabsRef.current.delete(tabKey);
    fetchTabData('overview', true);
  };

  // ============================================
  // Avatar Upload Handler
  // ============================================
  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Hanya file JPG, PNG, atau WEBP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Maksimal 2MB');
      return;
    }

    const loadingToast = toast.loading('Mengupload...');
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const token = getCookie('accessToken');
      const res = await fetch('/api/users/upload-avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUserProfile((prev) => (prev ? { ...prev, avatar: data.avatar } : null));
        updateUser({ avatar: data.avatar });
        toast.success('Foto profil berhasil diupdate', { id: loadingToast });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error(error.message, { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  const getAvatarUrl = () => {
    const avatar = userProfile?.avatar || user?.avatar;
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    return `${process.env.NEXT_PUBLIC_APP_URL || ''}${avatar}`;
  };

  const handleLogout = async () => {
    if (confirm('Yakin ingin logout?')) {
      await logout();
      toast.success('Berhasil logout');
      router.push('/login');
    }
  };

  const handleSettingsAction = (item: any) => {
    if (item.action === 'help') {
      setShowReportModal(true);
    } else if (item.href) {
      router.push(item.href);
    } else if (item.action === 'address') {
      setActiveTab('address');
    } else if (item.action === 'reviews') {
      setActiveTab('reviews');
    } else {
      toast(`${item.label} - Fitur akan datang`, { icon: '🚧' });
    }
  };

  // ============================================
  // Loading State
  // ============================================
  if (isLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const settingsItems = [
    {
      section: 'Akun',
      items: [
        { icon: UserCircle, label: 'Profil Saya', action: 'profile' },
        { icon: MapPin, label: 'Alamat Saya', action: 'address' },
        { icon: Star, label: 'Ulasan Saya', action: 'reviews' },    
        { icon: Award, label: 'Affiliate Program', action: 'affiliate', href: '/affiliate/dashboard',},
      ],
    },
    {
      section: 'Forum',
      items: [{ icon: MessageSquare, label: 'Forum Diskusi', action: 'forum', href: '/forum' }],
    },
    {
      section: 'Bantuan',
      items: [
        { icon: HelpCircle, label: 'Bantuan & Support', action: 'help' },
        { icon: Shield, label: 'Privasi & Keamanan', action: 'privacy' },
      ],
    },
    {
      section: 'Pengaturan',
      items: [{ icon: Bell, label: 'Notifikasi', action: 'notifications' }],
    },
  ];

  const displayName = userProfile?.name || user?.name || 'User';
  const displayEmail = userProfile?.email || user?.email || 'email@example.com';
  const avatarUrl = getAvatarUrl();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Profile Header */}
        <div className="bg-linear-to-br from-primary to-secondary rounded-3xl p-6 md:p-8 text-white mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-white/30 overflow-hidden bg-white/20">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
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

            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-bold">{displayName}</h1>
              <p className="text-white/80 mt-1">{displayEmail}</p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
                <span className="text-sm bg-white/20 px-3 py-1 rounded-full capitalize">
                  Buyer
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

        {/* Tabs */}
        <div className="mb-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max pb-2">
            {BUYER_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
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
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <>
          {/* ✅ OVERVIEW TAB - DENGAN BETTER UI STATES */}
          {activeTab === 'overview' && (
            <>
              {/* Loading State */}
              {isLoadingData && !stats ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-text-secondary">Memuat statistik...</p>
                </div>
              ) : statsError ? (
                /* ✅ Error State */
                <div className="card">
                  <div className="flex items-start gap-4 p-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-text-primary mb-1">
                        Gagal Memuat Statistik
                      </h3>
                      <p className="text-sm text-text-secondary mb-3">{statsError}</p>
                      <button
                        onClick={handleRefreshStats}
                        className="btn-primary flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Coba Lagi
                      </button>
                    </div>
                  </div>
                </div>
              ) : stats ? (
                /* ✅ Success State - Stats Available */
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card bg-linear-to-br from-blue-500 to-blue-600 text-white">
                      <ShoppingBag className="w-8 h-8 mb-2 opacity-80" />
                      <p className="text-3xl font-bold">{stats.totalOrders}</p>
                      <p className="text-sm opacity-90">Total Pesanan</p>
                    </div>
                    <div className="card bg-linear-to-br from-green-500 to-green-600 text-white">
                      <CheckCircle className="w-8 h-8 mb-2 opacity-80" />
                      <p className="text-3xl font-bold">{stats.completedOrders}</p>
                      <p className="text-sm opacity-90">Pesanan Selesai</p>
                    </div>
                    <div className="card bg-linear-to-br from-purple-500 to-purple-600 text-white">
                      <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalSpent)}</p>
                      <p className="text-sm opacity-90">Total Belanja</p>
                    </div>
                    <div className="card bg-linear-to-br from-orange-500 to-orange-600 text-white">
                      <Award className="w-8 h-8 mb-2 opacity-80" />
                      <p className="text-3xl font-bold">{stats.reviewCount}</p>
                      <p className="text-sm opacity-90">Ulasan Diberikan</p>
                    </div>
                  </div>

                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-text-primary">Aksi Cepat</h3>
                      <button
                        onClick={handleRefreshStats}
                        className="p-2 hover:bg-surface rounded-lg transition-colors"
                        title="Refresh statistik"
                      >
                        <RefreshCw className="w-4 h-4 text-text-secondary" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="p-4 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-center"
                      >
                        <Package className="w-8 h-8 mx-auto mb-2 text-primary" />
                        <p className="text-sm font-medium text-text-primary">Pesanan Saya</p>
                        <p className="text-xs text-text-secondary">{stats.activeOrders} aktif</p>
                      </button>
                      <button
                        onClick={() => setActiveTab('vouchers')}
                        className="p-4 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-center"
                      >
                        <Ticket className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p className="text-sm font-medium text-text-primary">Voucher</p>
                        <p className="text-xs text-text-secondary">{stats.voucherCount} tersedia</p>
                      </button>
                      <button
                        onClick={() => setShowReportModal(true)}
                        className="p-4 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-center"
                      >
                        <HelpCircle className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                        <p className="text-sm font-medium text-text-primary">Bantuan</p>
                        <p className="text-xs text-text-secondary">Laporkan masalah</p>
                      </button>
                      <button
                        onClick={() => router.push('/katalog')}
                        className="p-4 rounded-xl bg-surface hover:bg-surface-hover transition-colors text-center"
                      >
                        <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-primary" />
                        <p className="text-sm font-medium text-text-primary">Belanja</p>
                        <p className="text-xs text-text-secondary">Lihat katalog</p>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ✅ Empty State - No Stats */
                <div className="card text-center py-16">
                  <Package className="w-16 h-16 mx-auto text-text-muted mb-4" />
                  <h3 className="text-lg font-bold text-text-primary mb-2">
                    Belum Ada Data Statistik
                  </h3>
                  <p className="text-text-secondary mb-4">
                    Mulai belanja untuk melihat statistik akun Anda
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleRefreshStats}
                      className="btn-outline flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </button>
                    <button
                      onClick={() => router.push('/katalog')}
                      className="btn-primary"
                    >
                      Mulai Belanja
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'orders' && <OrdersTab userId={user?.id ? Number(user.id) : undefined} />}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-text-primary">
                Ulasan Saya ({reviews.length})
              </h2>
              {reviews.length === 0 ? (
                <div className="card text-center py-16">
                  <Star className="w-16 h-16 mx-auto text-text-muted mb-4" />
                  <p className="text-text-secondary font-medium">Belum ada ulasan</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="card">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 bg-surface rounded-lg overflow-hidden shrink-0">
                          {review.product.image ? (
                            <img
                              src={review.product.image}
                              alt={review.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-8 h-8 text-text-muted" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-text-primary mb-1">
                            {review.product.name}
                          </h3>
                          <div className="flex items-center gap-1 mb-2">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < review.rating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-text-muted'
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-sm text-text-secondary line-clamp-2">
                            {review.comment}
                          </p>
                          <p className="text-xs text-text-muted mt-2">
                            {formatDate(review.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'vouchers' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-text-primary">
                Voucher Saya ({vouchers.length})
              </h2>
              {vouchers.length === 0 ? (
                <div className="card text-center py-16">
                  <Ticket className="w-16 h-16 mx-auto text-text-muted mb-4" />
                  <p className="text-text-secondary font-medium">Belum ada voucher</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vouchers.map((voucher) => {
                    const daysLeft = differenceInDays(new Date(voucher.expiresAt), new Date());
                    const isExpired = daysLeft < 0;
                    return (
                      <div
                        key={voucher.id}
                        className={`card relative overflow-hidden ${
                          isExpired ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="relative p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-xs text-text-secondary mb-1">Kode Voucher</p>
                              <p className="text-lg font-bold text-primary font-mono">
                                {voucher.code}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">
                                {voucher.discountType === 'percentage'
                                  ? `${voucher.discountValue}%`
                                  : formatCurrency(voucher.discountValue)}
                              </p>
                              <p className="text-xs text-text-secondary">OFF</p>
                            </div>
                          </div>
                          <p className="text-sm text-text-secondary mb-3">{voucher.description}</p>
                          <div className="flex items-center justify-between text-xs text-text-secondary">
                            <div>
                              <p>Min. belanja:</p>
                              <p className="font-medium text-text-primary">
                                {formatCurrency(voucher.minPurchase)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p>Berlaku hingga:</p>
                              <p
                                className={`font-medium ${
                                  daysLeft <= 3 ? 'text-red-500' : 'text-text-primary'
                                }`}
                              >
                                {format(new Date(voucher.expiresAt), 'dd MMM yyyy', {
                                  locale: id,
                                })}
                              </p>
                            </div>
                          </div>
                          {isExpired && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                              <span className="text-red-500 font-bold text-xl rotate-[-15deg]">
                                EXPIRED
                              </span>
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

          {activeTab === 'address' && <AddressTab />}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-text-primary">Pengaturan Akun</h2>
              <div className="card space-y-2">
                {settingsItems.map((section, idx) => (
                  <div key={idx}>
                    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-2">
                      {section.section}
                    </h3>
                    <div className="space-y-1">
                      {section.items.map((item, itemIdx) => (
                        <button
                          key={itemIdx}
                          onClick={() => handleSettingsAction(item)}
                          className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-surface-hover transition-colors"
                        >
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <item.icon className="w-5 h-5" />
                          </div>
                          <span className="flex-1 text-left font-medium text-text-primary">
                            {item.label}
                          </span>
                          <ChevronRight className="w-5 h-5 text-text-secondary" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </>
      </div>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedType="general"
        onSuccess={() => {}}
        reportedId={0}
      />
    </div>
  );
}
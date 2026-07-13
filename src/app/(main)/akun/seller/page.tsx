'use client';

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store, Settings, LogOut,
  Package, Camera, Loader2, ChevronRight, Bell, Shield,
  HelpCircle, BarChart3, ShoppingBag, Calendar, Award,
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { ReportModal } from '@/components/reports/ReportModal';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import { SellerDashboard } from '@/components/account/SellerDashboard';
import { OrdersTab } from '@/components/account/OrdersTab';
import { SellerProductsTab } from '@/components/account/SellerProductsTab';
import type { UserProfile } from '@/components/account/types';

// ============================================================================
// CONSTANTS
// ============================================================================
const SELLER_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'products', label: 'Produk Saya', icon: Package },
  { id: 'orders', label: 'Pesanan', icon: ShoppingBag },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function SellerAccountPage() {
  const router = useRouter();
  const { user, logout, updateUser, isAuthenticated, isLoading } = useAuth();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isUploading, setIsUploading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // ✅ Ref untuk cegah multiple fetch
  const hasFetchedProfileRef = useRef(false);

  // ============================================================================
  // FETCH USER PROFILE (dengan anti-spam)
  // ============================================================================
  const fetchUserProfile = useCallback(async () => {
    // Guard: sudah fetch
    if (hasFetchedProfileRef.current) {
      return;
    }

    // Mark IMMEDIATELY untuk cegah concurrent calls
    hasFetchedProfileRef.current = true;

    try {
      setIsProfileLoading(true);
      const token = getCookie('accessToken');
      
      if (!token) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ No token found');
        }
        return;
      }

      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success && data.data) {
        setUserProfile(data.data);
        updateUser({
          id: data.data.id,
          name: data.data.name,
          email: data.data.email,
          role: data.data.role,
          avatar: data.data.avatar,
        });
      }
    } catch (error: any) {
      console.error('❌ Fetch profile error:', error);
      toast.error('Gagal memuat profil');
      // Reset flag jika error supaya bisa retry
      hasFetchedProfileRef.current = false;
    } finally {
      setIsProfileLoading(false);
    }
  }, [updateUser]);

  // ============================================================================
  // AVATAR UPLOAD HANDLER
  // ============================================================================
  const handleUploadAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Hanya JPG/PNG/WEBP');
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
        throw new Error(data.error || 'Upload gagal');
      }
    } catch (error: any) {
      toast.error(error.message, { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  const getAvatarUrl = () => {
    const avatar = userProfile?.avatar || user?.avatar;
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    return `${process.env.NEXT_PUBLIC_APP_URL || ''}${avatar}`;
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // ✅ Auth check
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/akun');
    }
  }, [isAuthenticated, isLoading, router]);

  // ✅ Fetch profile hanya sekali
  useEffect(() => {
    if (isAuthenticated && !hasFetchedProfileRef.current) {
      fetchUserProfile();
    }
  }, [isAuthenticated, fetchUserProfile]);

  // ✅ Role check
  useEffect(() => {
    if (userProfile && userProfile.role !== 'seller' && user?.role !== 'seller') {
      toast.error('Akses ditolak. Halaman ini hanya untuk penjual.');
      router.push('/akun/buyer');
    }
  }, [userProfile, user?.role, router]);

  // ============================================================================
  // HANDLERS
  // ============================================================================
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
    } else if (item.action === 'products') {
      setActiveTab('products');
    } else if (item.href) {
      router.push(item.href);
    } else {
      toast(`${item.label} - Fitur akan datang`, { icon: '🚧' });
    }
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (isLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // ============================================================================
  // SETTINGS CONFIG
  // ============================================================================
  const settingsItems = [
    {
      section: 'Akun',
      items: [
        { icon: Award, label: 'Affiliate Program', action: 'affiliate', href: '/affiliate/dashboard',},
      ],
    },

    {
      section: 'Toko',
      items: [
        { icon: Store, label: 'Profil Toko', action: 'store' },
        { icon: Package, label: 'Produk Saya', action: 'products' },
        { icon: BarChart3, label: 'Laporan', action: 'reports' },
      ],
    },
    {
      section: 'Bantuan',
      items: [
        { icon: HelpCircle, label: 'Bantuan & Support', action: 'help' },
        { icon: Shield, label: 'Kebijakan Penjual', action: 'policy' },
      ],
    },
    {
      section: 'Pengaturan',
      items: [{ icon: Bell, label: 'Notifikasi', action: 'notifications' }],
    },
  ];

  // ============================================================================
  // DISPLAY VALUES
  // ============================================================================
  const displayName = userProfile?.name || user?.name || 'Seller';
  const displayEmail = userProfile?.email || user?.email || 'email@example.com';
  const avatarUrl = getAvatarUrl();

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* ==================================================================
            PROFILE HEADER
        ================================================================== */}
        <div className="bg-linear-to-br from-primary to-secondary rounded-3xl p-6 md:p-8 text-white mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            
            {/* Avatar */}
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
              
              {/* Upload Button */}
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
              
              {/* Loading Overlay */}
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
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs flex items-center gap-1">
                  <Store className="w-3 h-3" />
                  Penjual
                </span>
              </div>
              <p className="text-white/80 mt-1">{displayEmail}</p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
                <span className="text-sm bg-white/20 px-3 py-1 rounded-full capitalize">
                  Seller
                </span>
                {userProfile?.createdAt && (
                  <span className="text-sm bg-white/20 px-3 py-1 rounded-full flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Member sejak {format(new Date(userProfile.createdAt), 'MMM yyyy', { locale: id })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================================
            TABS NAVIGATION
        ================================================================== */}
        <div className="mb-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 min-w-max pb-2">
            {SELLER_TABS.map((tab) => {
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

        {/* ==================================================================
            TAB CONTENT
        ================================================================== */}
        <>
          {activeTab === 'dashboard' && <SellerDashboard />}

          {activeTab === 'products' && <SellerProductsTab />}

          {activeTab === 'orders' && (
            <OrdersTab 
              userId={user?.id != null ? Number(user.id) : undefined} 
              isSeller={true} 
            />
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-text-primary">Pengaturan Penjual</h2>
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
                className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium dark:bg-red-900/20 dark:hover:bg-red-900/30"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </>
      </div>

      {/* Report Modal */}
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
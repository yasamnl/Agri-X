'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import toast from 'react-hot-toast';

import { AdminSidebar } from '@/components/admin/AdminSidebar';

import {
  Users,
  FileText,
  ArrowRight,
  Menu,
  Loader2,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
interface HubStats {
  totalAfiliator: number;
  affiliateAktif: number;
  affiliateNonaktif: number;
  affiliateBlokir: number;
  totalPengajuan: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function KelolaAffiliatePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<HubStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasFetchedRef = useRef(false);

  // ============================================================================
  // AUTH CHECK
  // ============================================================================
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast.error('Akses ditolak. Halaman ini hanya untuk admin.');
      router.push('/');
    }
  }, [isAuthenticated, authLoading, user, router]);

  // ============================================================================
  // FETCH HUB STATS
  // NOTE: Endpoint di bawah ini gabungan asumsi dari dua sumber data:
  //  - /api/admin/affiliates/stats            -> sudah ada (pengajuan: pending/approved/rejected)
  //  - /api/admin/affiliate-users/stats       -> BARU, sesuaikan dgn route Laravel pengguna-affiliate
  // Silakan sesuaikan path-nya dengan controller AGRI-X kamu.
  // ============================================================================
  const fetchHubStats = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'admin') return;
  
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');
  
      const [penggunaRes, pengajuanRes] = await Promise.all([
        fetch('/api/admin/affiliate-users/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/affiliate-applications/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
  
      const penggunaData = penggunaRes.ok ? (await penggunaRes.json()).data : {};
      const pengajuanData = pengajuanRes.ok ? (await pengajuanRes.json()).data : {};
  
      setStats({
        totalAfiliator: penggunaData.totalAfiliator || 0,
        affiliateAktif: penggunaData.affiliateAktif || 0,
        affiliateNonaktif: penggunaData.affiliateNonaktif || 0,
        affiliateBlokir: penggunaData.affiliateBlokir || 0,
        totalPengajuan: pengajuanData.totalApplications || 0,
        pendingCount: pengajuanData.pendingCount || 0,
        approvedCount: pengajuanData.approvedCount || 0,
        rejectedCount: pengajuanData.rejectedCount || 0,
      });
    } catch (error: any) {
      console.error('Fetch hub stats error:', error);
      toast.error(error.message || 'Gagal memuat statistik');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);  

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin' && !hasFetchedRef.current) {
      fetchHubStats();
    }
  }, [isAuthenticated, user, fetchHubStats]);

  // ============================================================================
  // LOADING / GUARD
  // ============================================================================
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <main className="flex-1 lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-text-primary" />
          </button>
          <h1 className="text-lg font-bold text-text-primary">Program Affiliate</h1>
          <div className="w-9" />
        </div>

        <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Program Affiliate</h1>
            <p className="text-text-secondary mt-1">
              Kelola pengguna dan pengajuan program affiliate platform.
            </p>
          </div>

          {/* Hub Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* KARTU PENGGUNA AFFILIATE */}
            <Link
              href="/admin/affiliates/pengguna-affiliate"
              className="group card hover:border-purple-400/60 hover:shadow-lg transition-all relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-1">Pengguna Affiliate</h3>
              <p className="text-sm text-text-secondary mb-4">
                Daftar seluruh pengguna yang telah bergabung sebagai affiliator aktif di platform.
              </p>

              {isLoading ? (
                <div className="h-14 flex items-center">
                  <Loader2 className="w-5 h-5 text-text-secondary animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-bold text-text-primary">
                      {stats?.totalAfiliator ?? 0}
                    </span>
                    <span className="text-sm text-text-secondary">total affiliator</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {stats?.affiliateAktif ?? 0} Aktif
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                      {stats?.affiliateNonaktif ?? 0} Non-aktif
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {stats?.affiliateBlokir ?? 0} Diblokir
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end text-text-secondary group-hover:text-purple-400 group-hover:translate-x-1 transition-all">
                <ArrowRight className="w-5 h-5" />
              </div>
            </Link>

            {/* KARTU PENGAJUAN AFFILIATE */}
            <Link
              href="/admin/affiliates/pengajuan-affiliate"
              className="group card hover:border-green-400/60 hover:shadow-lg transition-all relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-1">Pengajuan Affiliate</h3>
              <p className="text-sm text-text-secondary mb-4">
                Tinjau dan proses pengajuan pendaftaran affiliator baru yang masuk dari pengguna.
              </p>

              {isLoading ? (
                <div className="h-14 flex items-center">
                  <Loader2 className="w-5 h-5 text-text-secondary animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-bold text-text-primary">
                      {stats?.totalPengajuan ?? 0}
                    </span>
                    <span className="text-sm text-text-secondary">pengajuan masuk</span>
                  </div>
                  {(stats?.pendingCount ?? 0) > 0 && (
                    <p className="text-xs font-semibold text-yellow-600 mb-2">
                      ● {stats?.pendingCount} pending
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-4 mt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                      {stats?.pendingCount ?? 0} Pending
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {stats?.approvedCount ?? 0} Diterima
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {stats?.rejectedCount ?? 0} Ditolak
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end text-text-secondary group-hover:text-green-500 group-hover:translate-x-1 transition-all">
                <ArrowRight className="w-5 h-5" />
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
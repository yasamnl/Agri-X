"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getCookie } from "@/lib/auth";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";

import { AdminSidebar } from "@/components/admin/AdminSidebar";

import {
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  AlertCircle,
  Menu,
} from "lucide-react";

import {
  FaInstagram,
  FaTiktok,
  FaYoutube,
  FaTwitter,
  FaGlobe,
  FaPaperPlane,
  FaCheck,
  FaTimes,
} from "react-icons/fa";

// ============================================================================
// TYPES
// ============================================================================
interface SosmedAccount {
  platform: string;
  username: string;
  url?: string;
}

interface AffiliateApplication {
  id: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  sosmedAccounts: SosmedAccount[];
  user: {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================
// NOTE: value 'active' dipetakan ke status backend 'approved' agar sesuai
// dengan filter Blade (Semua / Pending / Aktif / Ditolak).
const STATUS_FILTERS = [
  { value: "semua", label: "Semua" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Diterima" },
  { value: "rejected", label: "Ditolak" },
];

const PLATFORM_ICONS: Record<string, any> = {
  instagram: FaInstagram,
  tiktok: FaTiktok,
  youtube: FaYoutube,
  twitter: FaTwitter,
  facebook: FaGlobe,
  website: FaGlobe,
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "Twitter/X",
  facebook: "Facebook",
  website: "Website",
};

// ============================================================================
// HELPERS
// ============================================================================
const getSocialMediaUrl = (account: SosmedAccount): string => {
  if (account.url) return account.url; // Use explicit URL if available

  const platform = account.platform.toLowerCase();
  const username = account.username?.trim();
  if (!username) return "#";

  switch (platform) {
    case "instagram":
      return `https://instagram.com/${username}`;
    case "tiktok":
      return `https://tiktok.com/@${username}`;
    case "youtube":
      return `https://youtube.com/@${username}`;
    case "twitter":
      return `https://twitter.com/${username}`;
    case "facebook":
      return `https://facebook.com/${username}`;
    default:
      return "#";
  }
};

const getStatusBadge = (status: string) => {
  const config: Record<
    string,
    { bg: string; text: string; icon: any; label: string }
  > = {
    pending: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-600",
      icon: Clock,
      label: "Pending",
    },
    approved: {
      bg: "bg-green-500/10",
      text: "text-green-500",
      icon: CheckCircle,
      label: "Diterima",
    },
    rejected: {
      bg: "bg-red-500/10",
      text: "text-red-500",
      icon: XCircle,
      label: "Ditolak",
    },
  };
  const { bg, text, icon: Icon, label } = config[status] || config.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

const PAGE_SIZE = 10;

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function PengajuanAffiliatePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [applications, setApplications] = useState<AffiliateApplication[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Modal state
  const [selectedApp, setSelectedApp] = useState<AffiliateApplication | null>(
    null
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  // ============================================================================
  // AUTH CHECK
  // ============================================================================
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== "admin")) {
      toast.error("Akses ditolak. Halaman ini hanya untuk admin.");
      router.push("/");
    }
  }, [isAuthenticated, authLoading, user, router]);

  // ============================================================================
  // FETCH
  // ============================================================================
  const fetchApplications = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (!isAuthenticated || user?.role !== "admin") return;

    isFetchingRef.current = true;
    try {
      setIsLoading(true);
      const token = getCookie("accessToken");
      if (!token) throw new Error("Token tidak ditemukan");

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: PAGE_SIZE.toString(),
        status: statusFilter === "semua" ? "all" : statusFilter,
      });
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/admin/affiliates?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Gagal memuat data");

      setApplications(result.data?.applications || []);
      setTotalPages(result.data?.pagination?.totalPages || 1);
      setTotalCount(
        result.data?.pagination?.total ||
          (result.data?.applications || []).length
      );
      hasFetchedRef.current = true;
    } catch (error: any) {
      console.error("Fetch pengajuan error:", error);
      toast.error(error.message || "Gagal memuat data pengajuan affiliate");
      setApplications([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [currentPage, statusFilter, searchQuery, isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      fetchApplications();
    }
  }, [isAuthenticated, user, currentPage, statusFilter, searchQuery]);

  // ============================================================================
  // ACTIONS
  // ============================================================================
  const handleApprove = async () => {
    if (!selectedApp) return;
    setIsActionLoading(true);
    try {
      const token = getCookie("accessToken");
      const res = await fetch(
        `/api/admin/affiliates/${selectedApp.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const result = await res.json();
      if (!result.success)
        throw new Error(result.error || "Gagal menyetujui aplikasi");

      toast.success(`Aplikasi ${selectedApp.user.name} disetujui`);
      setShowActionModal(false);
      setShowDetailModal(false);
      fetchApplications();
    } catch (error: any) {
      toast.error(error.message || "Gagal menyetujui aplikasi");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    if (!rejectionReason.trim()) {
      toast.error("Mohon isi alasan penolakan");
      return;
    }
    setIsActionLoading(true);
    try {
      const token = getCookie("accessToken");
      const res = await fetch(
        `/api/admin/affiliates/${selectedApp.id}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: rejectionReason.trim() }),
        }
      );
      const result = await res.json();
      if (!result.success)
        throw new Error(result.error || "Gagal menolak aplikasi");

      toast.success("Aplikasi affiliate berhasil ditolak");
      setShowActionModal(false);
      setShowDetailModal(false);
      setRejectionReason("");
      fetchApplications();
    } catch (error: any) {
      toast.error(error.message || "Gagal menolak aplikasi");
    } finally {
      setIsActionLoading(false);
    }
  };

  const openDetailModal = (app: AffiliateApplication) => {
    setSelectedApp(app);
    setShowDetailModal(true);
  };

  const openActionModal = (
    app: AffiliateApplication,
    type: "approve" | "reject"
  ) => {
    setSelectedApp(app);
    setActionType(type);
    setRejectionReason("");
    setShowActionModal(true);
    setShowDetailModal(false);
  };

  // ============================================================================
  // GUARD
  // ============================================================================
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated || user?.role !== "admin") return null;

  const startIndex = (currentPage - 1) * PAGE_SIZE;

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <main className="flex-1 lg:ml-0">
        <div className="lg:hidden sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-text-primary" />
          </button>
          <h1 className="text-lg font-bold text-text-primary">
            Pengajuan Affiliate
          </h1>
          <div className="w-9" />
        </div>

        <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Link
              href="/admin/affiliates"
              className="hover:text-primary transition-colors"
            >
              Program Affiliate
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-text-primary font-medium">
              Pengajuan Affiliate
            </span>
          </div>

          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-text-primary">
              Pengajuan Affiliate
            </h1>
            <p className="text-text-secondary mt-1">
              Tinjau dan proses pengajuan pendaftaran affiliator baru.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-secondary absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari nama atau email..."
                className="input pl-11 w-full"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setFilterPanelOpen((v) => !v)}
                className="btn-outline flex items-center gap-2 h-full"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filter
              </button>
              {filterPanelOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-xl shadow-lg p-3 z-30">
                  <p className="text-xs font-semibold text-text-secondary mb-2">
                    Status
                  </p>
                  <div className="flex flex-col gap-1">
                    {STATUS_FILTERS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setStatusFilter(opt.value);
                          setCurrentPage(1);
                          setFilterPanelOpen(false);
                        }}
                        className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          statusFilter === opt.value
                            ? "bg-primary text-white"
                            : "text-text-primary hover:bg-surface"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <p className="text-sm text-text-secondary">
                Menampilkan{" "}
                <span className="font-medium text-text-primary">
                  {applications.length}
                </span>{" "}
                dari{" "}
                <span className="font-medium text-text-primary">
                  {totalCount}
                </span>{" "}
                pengajuan
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : applications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary w-12">
                        No
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Nama
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Tanggal Pengajuan
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {applications.map((app, idx) => (
                      <tr
                        key={app.id}
                        className="hover:bg-surface/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-text-secondary">
                          {startIndex + idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden">
                              {app.user.avatar ? (
                                <img
                                  src={app.user.avatar}
                                  alt={app.user.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                app.user.name?.charAt(0).toUpperCase() || "U"
                              )}
                            </div>
                            <span className="font-medium text-text-primary truncate max-w-[160px]">
                              {app.user.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-text-secondary truncate max-w-[180px]">
                          {app.user.email}
                        </td>
                        <td className="py-3 px-4 text-sm text-text-secondary">
                          {format(new Date(app.createdAt), "dd MMM yyyy", {
                            locale: id,
                          })}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(app.status)}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => openDetailModal(app)}
                            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-text-secondary hover:text-primary"
                            title="Lihat detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-20 text-center text-text-secondary text-sm">
                Tidak ada pengajuan ditemukan.
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <p className="text-sm text-text-secondary">
                Halaman {currentPage} dari {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-2 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-medium">
                  {currentPage}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage >= totalPages}
                  className="p-2 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ==================================================================
          DETAIL MODAL
          ================================================================== */}
      {showDetailModal && selectedApp && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDetailModal(false);
          }}
        >
          <div className="bg-background rounded-2xl w-full max-w-150 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-surface rounded-lg transition-colors text-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 overflow-hidden">
                  {selectedApp.user.avatar ? (
                    <img
                      src={selectedApp.user.avatar}
                      alt={selectedApp.user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    selectedApp.user.name?.charAt(0).toUpperCase() || "U"
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-text-primary">
                    {selectedApp.user.name}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {selectedApp.user.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-secondary mb-1">
                    Tanggal Pengajuan
                  </p>
                  <p className="text-sm font-medium text-text-primary">
                    {format(
                      new Date(selectedApp.createdAt),
                      "dd MMM yyyy, HH:mm",
                      { locale: id }
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1">Status</p>
                  {getStatusBadge(selectedApp.status)}
                </div>
              </div>

              <div>
                <p className="text-xs text-text-secondary mb-2">
                  Akun Sosial Media
                </p>
                {selectedApp.sosmedAccounts?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedApp.sosmedAccounts.map((s, i) => {
                      const Icon = PLATFORM_ICONS[s.platform] || FaGlobe;
                      const label = PLATFORM_LABELS[s.platform] || s.platform;
                      return (
                        <a
                          key={i}
                          href={getSocialMediaUrl(s)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface rounded-full text-xs font-medium text-text-primary hover:bg-surface-hover transition-colors"
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                          {s.username && (
                            <span className="text-text-secondary ml-0.5">
                              @{s.username}
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary italic">
                    Tidak ada akun sosmed
                  </p>
                )}
              </div>

              {selectedApp.status === "pending" && (
                <div className="flex gap-3 pt-4 border-t border-border">
                  <button
                    onClick={() => openActionModal(selectedApp, "approve")}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <FaCheck className="w-3.5 h-3.5" /> Setujui
                  </button>
                  <button
                    onClick={() => openActionModal(selectedApp, "reject")}
                    className="btn-outline flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2"
                  >
                    <FaTimes className="w-3.5 h-3.5" /> Tolak
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          ACTION MODAL (Approve / Reject)
          ================================================================== */}
      {showActionModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-background rounded-2xl w-full max-w-150">
            <div className="p-6">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  actionType === "approve" ? "bg-green-500/10" : "bg-red-500/10"
                }`}
              >
                {actionType === "approve" ? (
                  <FaCheck className="w-6 h-6 text-green-500" />
                ) : (
                  <FaTimes className="w-6 h-6 text-red-500" />
                )}
              </div>

              <h3 className="text-lg font-bold text-text-primary text-center mb-2">
                {actionType === "approve"
                  ? "Setujui Aplikasi?"
                  : "Tolak Aplikasi?"}
              </h3>
              <p className="text-sm text-text-secondary text-center mb-4">
                Aplikasi affiliate dari <strong>{selectedApp.user.name}</strong>{" "}
                akan {actionType === "approve" ? "disetujui" : "ditolak"}.
              </p>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
                <FaPaperPlane className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-600 dark:text-blue-300">
                  Notifikasi akan dikirim ke{" "}
                  <strong>{selectedApp.user.email}</strong>
                </p>
              </div>

              {actionType === "reject" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Alasan Penolakan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Jelaskan alasan penolakan..."
                    rows={3}
                    className="input"
                  />
                  <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Alasan ini akan dikirim
                    ke user
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setRejectionReason("");
                  }}
                  disabled={isActionLoading}
                  className="btn-outline flex-1"
                >
                  Batal
                </button>
                <button
                  onClick={
                    actionType === "approve" ? handleApprove : handleReject
                  }
                  disabled={
                    isActionLoading ||
                    (actionType === "reject" && !rejectionReason.trim())
                  }
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-white ${
                    actionType === "approve"
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {isActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FaCheck className="w-4 h-4" />
                  )}
                  Konfirmasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

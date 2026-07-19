"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getCookie } from "@/lib/auth";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";

import { AdminSidebar } from "@/components/admin/AdminSidebar";

import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Menu,
  Wallet,
  Banknote,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// TYPES
// NOTE: Bentuk data mengikuti response GET
// /api/admin/affiliate-users/[id]/commissions. Sesuaikan bila field di
// endpoint kamu berbeda.
// ============================================================================
type TransactionStatus = "pending" | "completed" | "cancelled";

interface CommissionTransaction {
  id: number;
  productName: string;
  nominalTransaksi: number;
  komisi: number;
  persenKomisi: number;
  status: TransactionStatus;
  catatan: string | null;
  createdAt: string;
}

interface AffiliateSummary {
  id: number;
  applicationId: number;
  name: string;
  email: string;
  avatar: string | null;
  status: string;
}

interface CommissionSummary {
  totalKomisi: number;
  totalCompleted: number;
  totalPending: number;
  totalCancelled: number;
  totalTransaksi: number;
}

type WithdrawalStatus = "PENDING" | "COMPLETED" | "FAILED";

interface AffiliateWithdrawal {
  id: number;
  bank: string;
  noRekening: string;
  namaPemilik: string;
  nominal: number;
  adminFee: number;
  nominalDiterima: number;
  status: WithdrawalStatus;
  invoiceNumber: string | null;
  catatan: string | null;
  processedAt: string | null;
  createdAt: string;
}

interface WithdrawalSummary {
  totalDicairkan: number;
  totalPending: number;
  totalGagal: number;
  totalAdminFee: number;
  totalWithdrawal: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const STATUS_FILTERS: { value: "all" | TransactionStatus; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "completed", label: "Selesai" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Dibatalkan" },
];

const WD_STATUS_FILTERS: { value: "all" | WithdrawalStatus; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Gagal" },
];

const PAGE_SIZE = 10;

// ============================================================================
// HELPERS
// ============================================================================
const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0);

const getTxStatusBadge = (status: TransactionStatus) => {
  const config: Record<
    TransactionStatus,
    { bg: string; text: string; icon: any; label: string }
  > = {
    completed: {
      bg: "bg-green-500/10",
      text: "text-green-500",
      icon: CheckCircle2,
      label: "Selesai",
    },
    pending: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-600",
      icon: Clock,
      label: "Pending",
    },
    cancelled: {
      bg: "bg-red-500/10",
      text: "text-red-500",
      icon: XCircle,
      label: "Dibatalkan",
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

const getWdStatusBadge = (status: WithdrawalStatus) => {
  const config: Record<
    WithdrawalStatus,
    { bg: string; text: string; icon: any; label: string }
  > = {
    COMPLETED: {
      bg: "bg-green-500/10",
      text: "text-green-500",
      icon: CheckCircle2,
      label: "Selesai",
    },
    PENDING: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-600",
      icon: Clock,
      label: "Pending",
    },
    FAILED: {
      bg: "bg-red-500/10",
      text: "text-red-500",
      icon: AlertCircle,
      label: "Gagal",
    },
  };
  const { bg, text, icon: Icon, label } = config[status] || config.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function AffiliateKomisiPage() {
  const router = useRouter();
  const params = useParams();
  const affiliateUserId = params?.id as string;

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [affiliate, setAffiliate] = useState<AffiliateSummary | null>(null);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | TransactionStatus>(
    "all"
  );

  const [withdrawals, setWithdrawals] = useState<AffiliateWithdrawal[]>([]);
  const [wdSummary, setWdSummary] = useState<WithdrawalSummary | null>(null);
  const [wdLoading, setWdLoading] = useState(true);
  const [wdCurrentPage, setWdCurrentPage] = useState(1);
  const [wdTotalPages, setWdTotalPages] = useState(1);
  const [wdTotalCount, setWdTotalCount] = useState(0);
  const [wdStatusFilter, setWdStatusFilter] = useState<"all" | WithdrawalStatus>(
    "all"
  );

  const isFetchingRef = useRef(false);
  const isFetchingWdRef = useRef(false);

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
  // Endpoint: GET /api/admin/affiliate-users/[id]/commissions
  // ============================================================================
  const fetchCommissions = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (!isAuthenticated || user?.role !== "admin") return;
    if (!affiliateUserId) return;

    isFetchingRef.current = true;
    try {
      setIsLoading(true);
      const token = getCookie("accessToken");
      if (!token) throw new Error("Token tidak ditemukan");

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: PAGE_SIZE.toString(),
        status: statusFilter,
      });

      const res = await fetch(
        `/api/admin/affiliate-users/${affiliateUserId}/commissions?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Gagal memuat data");

      setAffiliate(result.data?.affiliate || null);
      setSummary(result.data?.summary || null);
      setTransactions(result.data?.transactions || []);
      setTotalPages(result.data?.pagination?.totalPages || 1);
      setTotalCount(result.data?.pagination?.total || 0);
    } catch (error: any) {
      console.error("Fetch komisi affiliate error:", error);
      toast.error(error.message || "Gagal memuat data komisi affiliate");
      setTransactions([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [affiliateUserId, currentPage, statusFilter, isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      fetchCommissions();
    }
  }, [isAuthenticated, user, currentPage, statusFilter, affiliateUserId]);

  // ============================================================================
  // FETCH — WITHDRAWALS
  // Endpoint: GET /api/admin/affiliate-users/[id]/withdrawals
  // ============================================================================
  const fetchWithdrawals = useCallback(async () => {
    if (isFetchingWdRef.current) return;
    if (!isAuthenticated || user?.role !== "admin") return;
    if (!affiliateUserId) return;

    isFetchingWdRef.current = true;
    try {
      setWdLoading(true);
      const token = getCookie("accessToken");
      if (!token) throw new Error("Token tidak ditemukan");

      const params = new URLSearchParams({
        page: wdCurrentPage.toString(),
        limit: PAGE_SIZE.toString(),
        status: wdStatusFilter,
      });

      const res = await fetch(
        `/api/admin/affiliate-users/${affiliateUserId}/withdrawals?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Gagal memuat data");

      setWdSummary(result.data?.summary || null);
      setWithdrawals(result.data?.withdrawals || []);
      setWdTotalPages(result.data?.pagination?.totalPages || 1);
      setWdTotalCount(result.data?.pagination?.total || 0);
    } catch (error: any) {
      console.error("Fetch withdrawal affiliate error:", error);
      toast.error(error.message || "Gagal memuat data withdrawal affiliate");
      setWithdrawals([]);
    } finally {
      setWdLoading(false);
      isFetchingWdRef.current = false;
    }
  }, [affiliateUserId, wdCurrentPage, wdStatusFilter, isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      fetchWithdrawals();
    }
  }, [isAuthenticated, user, wdCurrentPage, wdStatusFilter, affiliateUserId]);

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
  const wdStartIndex = (wdCurrentPage - 1) * PAGE_SIZE;

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
            Report Komisi
          </h1>
          <div className="w-9" />
        </div>

        <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-text-secondary flex-wrap">
            <Link
              href="/admin/affiliates"
              className="hover:text-primary transition-colors"
            >
              Program Affiliate
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link
              href="/admin/affiliates/pengguna"
              className="hover:text-primary transition-colors"
            >
              Pengguna Affiliate
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-text-primary font-medium">
              Report Komisi
            </span>
          </div>

          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg border border-border hover:bg-surface transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden">
                {affiliate?.avatar ? (
                  <img
                    src={affiliate.avatar}
                    alt={affiliate.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  affiliate?.name?.charAt(0).toUpperCase() || "U"
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-text-primary truncate">
                  {affiliate?.name || "Report Komisi"}
                </h1>
                <p className="text-sm text-text-secondary truncate">
                  {affiliate?.email || "Memuat data affiliator..."}
                </p>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-text-secondary text-xs font-medium mb-2">
                <Wallet className="w-3.5 h-3.5" />
                Total Komisi
              </div>
              <p className="text-lg font-bold text-text-primary">
                {formatCurrency(summary?.totalKomisi || 0)}
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-green-500 text-xs font-medium mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Selesai
              </div>
              <p className="text-lg font-bold text-green-500">
                {formatCurrency(summary?.totalCompleted || 0)}
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-yellow-600 text-xs font-medium mb-2">
                <Clock className="w-3.5 h-3.5" />
                Pending
              </div>
              <p className="text-lg font-bold text-yellow-600">
                {formatCurrency(summary?.totalPending || 0)}
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-red-500 text-xs font-medium mb-2">
                <XCircle className="w-3.5 h-3.5" />
                Dibatalkan
              </div>
              <p className="text-lg font-bold text-red-500">
                {formatCurrency(summary?.totalCancelled || 0)}
              </p>
            </div>
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setStatusFilter(opt.value);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === opt.value
                    ? "bg-primary text-white"
                    : "bg-surface text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <p className="text-sm text-text-secondary">
                Menampilkan{" "}
                <span className="font-medium text-text-primary">
                  {transactions.length}
                </span>{" "}
                dari{" "}
                <span className="font-medium text-text-primary">
                  {totalCount}
                </span>{" "}
                transaksi
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary w-12">
                        No
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Tanggal
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Produk
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Nominal Transaksi
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Komisi
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((tx, idx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-surface/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-text-secondary">
                          {startIndex + idx + 1}
                        </td>
                        <td className="py-3 px-4 text-sm text-text-secondary whitespace-nowrap">
                          {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm", {
                            locale: id,
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-text-primary truncate max-w-[220px] block">
                            {tx.productName}
                          </span>
                          {tx.catatan && (
                            <span className="text-xs text-text-secondary">
                              {tx.catatan}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-text-secondary whitespace-nowrap">
                          {formatCurrency(tx.nominalTransaksi)}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-green-500 whitespace-nowrap">
                          {formatCurrency(tx.komisi)}
                          <span className="text-xs text-text-secondary font-normal ml-1">
                            ({tx.persenKomisi}%)
                          </span>
                        </td>
                        <td className="py-3 px-4">{getTxStatusBadge(tx.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-20 text-center text-text-secondary text-sm">
                Belum ada transaksi komisi untuk affiliator ini.
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

          {/* ================= REPORT WITHDRAWAL ================= */}
          <div className="pt-2">
            <h2 className="text-lg font-bold text-text-primary mb-4">
              Report Withdrawal
            </h2>

            {/* Withdrawal summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="card p-4">
                <div className="flex items-center gap-2 text-green-500 text-xs font-medium mb-2">
                  <Banknote className="w-3.5 h-3.5" />
                  Total Dicairkan
                </div>
                <p className="text-lg font-bold text-green-500">
                  {formatCurrency(wdSummary?.totalDicairkan || 0)}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  (setelah admin fee)
                </p>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 text-yellow-600 text-xs font-medium mb-2">
                  <Clock className="w-3.5 h-3.5" />
                  Pending
                </div>
                <p className="text-lg font-bold text-yellow-600">
                  {formatCurrency(wdSummary?.totalPending || 0)}
                </p>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 text-red-500 text-xs font-medium mb-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Gagal
                </div>
                <p className="text-lg font-bold text-red-500">
                  {formatCurrency(wdSummary?.totalGagal || 0)}
                </p>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 text-text-secondary text-xs font-medium mb-2">
                  <Wallet className="w-3.5 h-3.5" />
                  Total Admin Fee
                </div>
                <p className="text-lg font-bold text-text-primary">
                  {formatCurrency(wdSummary?.totalAdminFee || 0)}
                </p>
              </div>
            </div>

            {/* Withdrawal status filter tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4">
              {WD_STATUS_FILTERS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setWdStatusFilter(opt.value);
                    setWdCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    wdStatusFilter === opt.value
                      ? "bg-primary text-white"
                      : "bg-surface text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Withdrawal table */}
            <div className="card overflow-hidden p-0">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <p className="text-sm text-text-secondary">
                  Menampilkan{" "}
                  <span className="font-medium text-text-primary">
                    {withdrawals.length}
                  </span>{" "}
                  dari{" "}
                  <span className="font-medium text-text-primary">
                    {wdTotalCount}
                  </span>{" "}
                  pengajuan withdrawal
                </p>
              </div>

              {wdLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : withdrawals.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface border-b border-border">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary w-12">
                          No
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                          Tanggal Pengajuan
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                          Rekening Tujuan
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                          Nominal
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                          Admin Fee
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                          Diterima
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">
                          Diproses
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {withdrawals.map((wd, idx) => (
                        <tr
                          key={wd.id}
                          className="hover:bg-surface/50 transition-colors"
                        >
                          <td className="py-3 px-4 text-sm text-text-secondary">
                            {wdStartIndex + idx + 1}
                          </td>
                          <td className="py-3 px-4 text-sm text-text-secondary whitespace-nowrap">
                            {format(
                              new Date(wd.createdAt),
                              "dd MMM yyyy, HH:mm",
                              { locale: id }
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-text-primary block">
                              {wd.bank} — {wd.noRekening}
                            </span>
                            <span className="text-xs text-text-secondary">
                              a.n. {wd.namaPemilik}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-text-secondary whitespace-nowrap">
                            {formatCurrency(wd.nominal)}
                          </td>
                          <td className="py-3 px-4 text-sm text-text-secondary whitespace-nowrap">
                            {formatCurrency(wd.adminFee)}
                          </td>
                          <td className="py-3 px-4 text-sm font-semibold text-green-500 whitespace-nowrap">
                            {formatCurrency(wd.nominalDiterima)}
                          </td>
                          <td className="py-3 px-4">
                            {getWdStatusBadge(wd.status)}
                          </td>
                          <td className="py-3 px-4 text-sm text-text-secondary whitespace-nowrap">
                            {wd.processedAt
                              ? format(new Date(wd.processedAt), "dd MMM yyyy", {
                                  locale: id,
                                })
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-20 text-center text-text-secondary text-sm">
                  Belum ada pengajuan withdrawal untuk affiliator ini.
                </div>
              )}

              {/* Withdrawal pagination */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-sm text-text-secondary">
                  Halaman {wdCurrentPage} dari {wdTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setWdCurrentPage((p) => Math.max(1, p - 1))
                    }
                    disabled={wdCurrentPage <= 1}
                    className="p-2 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-medium">
                    {wdCurrentPage}
                  </span>
                  <button
                    onClick={() =>
                      setWdCurrentPage((p) => Math.min(wdTotalPages, p + 1))
                    }
                    disabled={wdCurrentPage >= wdTotalPages}
                    className="p-2 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
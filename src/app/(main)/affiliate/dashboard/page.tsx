"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getCookie } from "@/lib/auth";
import toast from "react-hot-toast";
import "./dashboard_affiliate.css";
import Link from "next/link";
import { Loader2 } from "lucide-react";

// Tipe data (sesuai dengan blade)
interface User {
  name: string;
  email: string;
}

interface Affiliate {
  id: number;
  status: "pending" | "approved" | "rejected";
  affiliateStatus?: "aktif" | "nonaktif" | "diblokir";
}

interface SosmedAccount {
  platform: string;
  link: string;
  verified: boolean;
  token_sent?: boolean;
}

interface PlatformStat {
  platform: string;
  total_clicks: number;
}

interface DashboardData {
  user: User;
  affiliate: Affiliate;
  totalKlik: number;
  totalTransaksi: number;
  totalKomisi: number;
  refBase: string;
  sosmedList: SosmedAccount[];
  platformStats: PlatformStat[];
}

// ─── HELPER: buat URL sosial media ──────────────────────────────────────
const getSocialMediaUrl = (platform: string, usernameOrUrl: string): string => {
  // Jika sudah berupa URL lengkap, langsung gunakan
  if (
    usernameOrUrl.startsWith("http://") ||
    usernameOrUrl.startsWith("https://")
  ) {
    return usernameOrUrl;
  }

  const platformLower = platform.toLowerCase();
  const username = usernameOrUrl.trim();

  switch (platformLower) {
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

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const { user: authUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // State untuk UI
  const [animatedKlik, setAnimatedKlik] = useState(0);
  const [animatedTransaksi, setAnimatedTransaksi] = useState(0);
  const [animatedKomisi, setAnimatedKomisi] = useState(0);

  // State untuk sosmed & traffic
  const [sosmedList, setSosmedList] = useState<SosmedAccount[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
  const [activeTab, setActiveTab] = useState<"sosmed" | "traffic">("sosmed");

  const dummyRekeningData = [
    { noRekening: "1234567890", nama: "Khotibin Fauzi" },
    { noRekening: "9876543210", nama: "Diana Rahayu" },
    { noRekening: "1122334455", nama: "Kevin Santoso" },
    { noRekening: "5544332211", nama: "Khanza Lestari" },
    { noRekening: "9988776655", nama: "Nabil Hermawan" },
    { noRekening: "6677889900", nama: "Liam Wijaya" },
    { noRekening: "5566778899", nama: "Eko Danendra" },
    { noRekening: "1122998877", nama: "Indah Permata" },
    { noRekening: "3344556677", nama: "Dian Alya" },
    { noRekening: "7788990011", nama: "Ishom Ramadhan" },
    { noRekening: "2233445566", nama: "Nurul Hidayah" },
    { noRekening: "0812345670", nama: "Andi Saputra" },
    { noRekening: "0876543098", nama: "Maya Sari" },
    { noRekening: "0856701234", nama: "Rizal Firmansyah" },
    { noRekening: "0896543210", nama: "Putri Anggraini" },
  ];
  // Modal tambah sosmed
  const [showModalTambah, setShowModalTambah] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [sosmedLink, setSosmedLink] = useState("");
  const [dupError, setDupError] = useState(false);

  // Modal hapus sosmed
  const [showModalHapus, setShowModalHapus] = useState(false);
  const [hapusIndex, setHapusIndex] = useState<number | null>(null);

  // Modal Verifikasi
  const [verifyingIndex, setVerifyingIndex] = useState<number | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Gunakan ref untuk menyimpan data terkini tanpa memicu re-render
  const sosmedListRef = useRef<SosmedAccount[]>([]);
  const dataRef = useRef<DashboardData | null>(null);

  // Modal tarik komisi
  const [showModalRekening, setShowModalRekening] = useState(false);
  const [stepWD, setStepWD] = useState(1);
  const [bank, setBank] = useState("");
  const [noRekening, setNoRekening] = useState("");
  const [nominal, setNominal] = useState<number | null>(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [rekeningValid, setRekeningValid] = useState<boolean | null>(null);
  const [rekeningNama, setRekeningNama] = useState("");

  // Modal OTP (tarik komisi)
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(60);
  const [otpError, setOtpError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const otpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    return () => {
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    };
  }, []);

  // Toast dan copy
  const [isCopying, setIsCopying] = useState(false);
  const [requestingReactivation, setRequestingReactivation] = useState(false);

  // Referral link
  const refLink = data ? data.refBase : "";

  // ─── FETCH DATA ──────────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const token = getCookie("accessToken");
      if (!token) throw new Error("Token tidak ditemukan");

      const res = await fetch("/api/affiliate/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const dashboardData = result.data;
      const newData = {
        user: dashboardData.user,
        affiliate: dashboardData.affiliate,
        totalKlik: dashboardData.totalClicks || 0,
        totalTransaksi: dashboardData.totalTransactions || 0,
        totalKomisi: dashboardData.availableBalance || 0,
        refBase:
          dashboardData.referralLink ||
          `${window.location.origin}?ref=${dashboardData.referralCode}`,
        sosmedList: dashboardData.sosmedList || [],
        platformStats: dashboardData.platformStats || [],
      };
      setData(newData);
      dataRef.current = newData;
      setSosmedList(newData.sosmedList);
      sosmedListRef.current = newData.sosmedList;
      setPlatformStats(dashboardData.platformStats || []);
    } catch (error: any) {
      console.error("Fetch dashboard error:", error);
      toast.error(error.message || "Gagal memuat dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboard();
    }
  }, [isAuthenticated, fetchDashboard]);

  // ─── ANIMASI ANGKA ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!data) return;
    const targetKlik = data.totalKlik;
    const targetTrans = data.totalTransaksi;
    const targetKomisi = data.totalKomisi;

    const duration = 800;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedKlik(Math.round(targetKlik * ease));
      setAnimatedTransaksi(Math.round(targetTrans * ease));
      setAnimatedKomisi(Math.round(targetKomisi * ease));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [data]);

  // ─── COPY LINK ──────────────────────────────────────────────────────────
  const copyReferralLink = async () => {
    if (!refLink) return;
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(refLink);
      toast.success("Link referral berhasil disalin!");
    } catch {
      toast.error("Gagal menyalin link");
    } finally {
      setIsCopying(false);
    }
  };

  // app/affiliate/dashboard/page.tsx - Tambahan di bagian referral link

  // State untuk platform yang dipilih
  const [selectedSharePlatform, setSelectedSharePlatform] = useState("direct");

  // Fungsi untuk generate link dengan platform
  const getShareLink = (platform: string) => {
    if (!data?.affiliate?.id) return "";
    return `${window.location.origin}/katalog?ref=${data.affiliate.id}&platform=${platform}`;
  };

  // Tambahkan UI untuk share link per platform
  <div className="ref-card" style={{ marginTop: 16 }}>
    <div className="ref-card-label">Share Link Katalog dengan Platform</div>
    <div
      className="platform-share-grid"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 12,
      }}
    >
      {[
        { id: "direct", icon: "🔗", label: "Direct" },
        { id: "instagram", icon: "📸", label: "Instagram" },
        { id: "tiktok", icon: "🎵", label: "TikTok" },
        { id: "youtube", icon: "▶️", label: "YouTube" },
        { id: "twitter", icon: "🐦", label: "Twitter" },
        { id: "facebook", icon: "👍", label: "Facebook" },
      ].map((platform) => (
        <button
          key={platform.id}
          onClick={() => {
            const link = getShareLink(platform.id);
            navigator.clipboard.writeText(link);
            toast.success(`Link untuk ${platform.label} disalin!`);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border:
              selectedSharePlatform === platform.id
                ? "2px solid var(--accent-gold)"
                : "1px solid #e2e8f0",
            background:
              selectedSharePlatform === platform.id
                ? "rgba(255,215,0,0.1)"
                : "transparent",
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>{platform.icon}</span>
          {platform.label}
        </button>
      ))}
    </div>
    <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
      💡 Pilih platform untuk melacak performa dari setiap sumber traffic
    </div>
  </div>;
  // ─── SESSION KEY ──────────────────────────────────────────────────────────
  const getSessionKey = (): string => {
    const key = localStorage.getItem("affiliate_session_key");
    if (key) return key;
    const newKey =
      "session_" +
      Math.random().toString(36).substring(2, 15) +
      Date.now().toString(36);
    localStorage.setItem("affiliate_session_key", newKey);
    return newKey;
  };

  // ─── VERIFIKASI SOSMED ──────────────────────────────────────────────────
  const sendVerification = async (index: number) => {
    try {
      const token = getCookie("accessToken");
      if (!token) {
        toast.error("Token tidak ditemukan. Silakan login ulang.");
        return;
      }

      const account = sosmedList[index];
      if (!account.link.trim()) {
        toast.error("Username tidak valid");
        return;
      }

      const currentEmail = data?.user?.email || "";
      if (!currentEmail) {
        toast.error("Email tidak ditemukan.");
        return;
      }

      const sessionKey = getSessionKey();

      setVerifyingIndex(index);

      const res = await fetch("/api/affiliate/apply/request-verification", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: currentEmail,
          platform: account.platform,
          username: account.link,
          session_key: sessionKey,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || `HTTP ${res.status}`);
      }

      // Update token_sent
      setSosmedList((prev) => {
        const newList = [...prev];
        newList[index].token_sent = true;
        return newList;
      });

      toast.success(result.message || "Link verifikasi telah dikirim ke email");

      // Mulai polling (jika belum berjalan)
      if (!pollingIntervalRef.current) {
        startPolling();
      }
    } catch (error: any) {
      console.error("❌ Verification error:", error);
      toast.error(error.message || "Gagal mengirim link verifikasi");
    } finally {
      setVerifyingIndex(null);
    }
  };

  // Fungsi polling yang stabil menggunakan ref
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    console.log("🔄 Starting polling...");

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const token = getCookie("accessToken");
        if (!token) return;

        const res = await fetch("/api/affiliate/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json();
        if (!result.success) return;

        const freshSosmedList: SosmedAccount[] = result.data.sosmedList || [];

        // Bandingkan dengan data lama (pakai ref, bukan state, biar tidak stale)
        const oldList = sosmedListRef.current;
        const nowVerified = freshSosmedList.find((freshItem) => {
          const oldItem = oldList.find((o) => o.platform === freshItem.platform);
          return oldItem && !oldItem.verified && freshItem.verified;
        });
        if (nowVerified) {
          toast.success(`Akun ${nowVerified.platform} berhasil diverifikasi!`);
        }

        // Selalu sinkronkan list terbaru (termasuk token_sent dari server jika ada)
        setSosmedList(freshSosmedList);
        sosmedListRef.current = freshSosmedList;

        // Kalau sudah tidak ada yang pending, hentikan polling
        const stillPending = freshSosmedList.some((a) => a.token_sent && !a.verified);
        if (!stillPending && pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000); // cek tiap 5 detik
  }, []);

  // ─── EFEK UNTUK MEMULAI POLLING SAAT ADA PENDING ──────────────────
  useEffect(() => {
    // Sinkronkan ref dengan state setiap kali sosmedList berubah
    sosmedListRef.current = sosmedList;
    dataRef.current = data;

    const hasPending = sosmedList.some((a) => a.token_sent && !a.verified);
    if (hasPending) {
      if (!pollingIntervalRef.current) {
        startPolling();
      }
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [sosmedList, data, startPolling]);

  // ─── SOSMED ─────────────────────────────────────────────────────────────
  const handleTambahSosmed = () => {
    if (sosmedList.length >= 10) {
      toast.error("Maksimal 10 akun sosmed");
      return;
    }
    setSelectedPlatform("");
    setSosmedLink("");
    setDupError(false);
    setShowModalTambah(true);
  };

  const selectPlatform = (platform: string) => {
    setSelectedPlatform(platform);
    setDupError(false);
    const isDup = sosmedList.some(
      (s) =>
        s.platform === platform &&
        s.link.toLowerCase() === sosmedLink.toLowerCase()
    );
    setDupError(isDup);
  };

  const handleSosmedLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSosmedLink(val);
    if (selectedPlatform) {
      const isDup = sosmedList.some(
        (s) =>
          s.platform === selectedPlatform &&
          s.link.toLowerCase() === val.toLowerCase()
      );
      setDupError(isDup);
    }
  };

  const simpanSosmed = async () => {
    if (!selectedPlatform || !sosmedLink) {
      toast.error("Pilih platform dan masukkan link");
      return;
    }
    if (dupError) {
      toast.error("Akun ini sudah terdaftar");
      return;
    }
    try {
      const token = getCookie("accessToken");
      const res = await fetch("/api/affiliate/sosmed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ platform: selectedPlatform, link: sosmedLink }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      toast.success("Akun sosmed berhasil ditambahkan");
      const newSosmed = {
        platform: selectedPlatform,
        link: sosmedLink,
        verified: false,
        token_sent: false,
      };
      setSosmedList((prev) => [...prev, newSosmed]);
      setShowModalTambah(false);
      fetchDashboard();
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan akun");
    }
  };

  const hapusSosmed = (index: number) => {
    setHapusIndex(index);
    setShowModalHapus(true);
  };

  const confirmHapus = async () => {
    if (hapusIndex === null) return;
    const item = sosmedList[hapusIndex];
    try {
      const token = getCookie("accessToken");
      const res = await fetch(`/api/affiliate/sosmed/${item.platform}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      toast.success("Akun sosmed dihapus");
      setSosmedList((prev) => prev.filter((_, i) => i !== hapusIndex));
      setShowModalHapus(false);
      fetchDashboard();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus akun");
    }
  };

  // ─── TABS ──────────────────────────────────────────────────────────────
  const showTab = (tab: "sosmed" | "traffic") => {
    setActiveTab(tab);
  };

  // ─── TARIK KOMISI ──────────────────────────────────────────────────────
  const openModalRekening = () => {
    if (!data || data.totalKomisi <= 0) {
      toast.error("Saldo komisi kosong");
      return;
    }
    setStepWD(1);
    setBank("");
    setNoRekening("");
    setNominal(null);
    setRekeningValid(null);
    setRekeningNama("");
    setShowModalRekening(true);
  };

  const cekRekening = async () => {
    if (!bank || !noRekening) {
      toast.error("Lengkapi bank dan nomor rekening");
      return;
    }

    // Cari data dummy berdasarkan nomor rekening saja (abaikan bank)
    const foundAccount = dummyRekeningData.find(
      (acc) => acc.noRekening === noRekening.trim()
    );

    if (foundAccount) {
      setRekeningValid(true);
      setRekeningNama(foundAccount.nama);
      toast.success(`✓ Rekening ditemukan: ${foundAccount.nama}`);
    } else {
      setRekeningValid(false);
      setRekeningNama("");
      toast.error("❌ Nomor rekening tidak ditemukan");
    }
  };

  const lanjutNominal = () => {
    if (!rekeningValid) {
      toast.error("Rekening belum diverifikasi");
      return;
    }
    setStepWD(2);
  };

  const pilihNominal = (val: number) => {
    setNominal(val);
  };

  // ─── OTP TIMER ───────────────────────────────────────────────────────────
  const startOtpTimer = () => {
    if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    setOtpSecondsLeft(60);
    otpTimerRef.current = setInterval(() => {
      setOtpSecondsLeft((prev) => {
        if (prev <= 1) {
          if (otpTimerRef.current) clearInterval(otpTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ─── NOMINAL → MINTA OTP ─────────────────────────────────────────────────
  const lanjutKonfirmasi = async () => {
    if (!nominal || nominal < 10000) {
      toast.error("Nominal minimal Rp 10.000");
      return;
    }
    if (nominal > (data?.totalKomisi || 0)) {
      toast.error("Nominal melebihi saldo");
      return;
    }

    setSendingOtp(true);
    try {
      const token = getCookie("accessToken");
      const res = await fetch("/api/affiliate/withdraw/request-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (!result.success)
        throw new Error(result.error || "Gagal mengirim OTP");

      if (result.demo_otp) {
        console.log(
          `%c[OTP DEMO] Kode OTP: ${result.demo_otp}`,
          "background:#1a2a1a;color:#43e97b;font-size:14px;font-weight:bold;padding:4px 8px;border-radius:4px"
        );
      }

      setOtp(["", "", "", "", "", ""]);
      setOtpError("");
      startOtpTimer();
      setStepWD(3);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 300);
    } catch (error: any) {
      toast.error(error.message || "Gagal mengirim OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const resendOtp = async () => {
    setSendingOtp(true);
    try {
      const token = getCookie("accessToken");
      const res = await fetch("/api/affiliate/withdraw/request-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (!result.success)
        throw new Error(result.error || "Gagal mengirim ulang OTP");

      if (result.demo_otp) {
        console.log(
          `%c[OTP DEMO] Kode OTP baru: ${result.demo_otp}`,
          "background:#1a2a1a;color:#43e97b;font-size:14px;font-weight:bold;padding:4px 8px;border-radius:4px"
        );
      }

      setOtp(["", "", "", "", "", ""]);
      setOtpError("");
      startOtpTimer();
      toast.success("OTP baru telah dikirim.");
    } catch (error: any) {
      toast.error(error.message || "Gagal mengirim ulang OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, "").slice(0, 1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      toast.error("Masukkan 6 digit kode OTP.");
      return;
    }

    setVerifyingOtp(true);
    setOtpError("");
    try {
      const token = getCookie("accessToken");
      const res = await fetch("/api/affiliate/withdraw/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp: code }),
      });
      const result = await res.json();

      if (!result.success) {
        setOtpError(result.error || "Kode OTP tidak valid.");
        return;
      }

      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
      setStepWD(4);
    } catch (error: any) {
      toast.error(error.message || "Gagal menghubungi server.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const submitPenarikan = async () => {
    try {
      const token = getCookie("accessToken");
      const res = await fetch("/api/affiliate/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bank,
          noRekening,
          namaPemilik: rekeningNama,
          nominal,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      toast.success("Penarikan berhasil diajukan");
      setStepWD(5);
      fetchDashboard();
    } catch (error: any) {
      toast.error(error.message || "Gagal mengajukan penarikan");
    }
  };

  // ─── LOGOUT ─────────────────────────────────────────────────────────────
  const handleLogout = () => {
    document.cookie =
      "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  // ─── REQUEST REAKTIVASI (akun affiliate nonaktif) ─────────────────────────
  const requestReactivation = async () => {
    setRequestingReactivation(true);
    try {
      const token = getCookie("accessToken");
      const res = await fetch("/api/affiliate/request-reactivation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (!result.success)
        throw new Error(result.error || "Gagal mengirim permintaan");
      toast.success(result.message || "Permintaan reaktivasi telah dikirim.");
    } catch (error: any) {
      toast.error(error.message || "Gagal mengirim permintaan reaktivasi");
    } finally {
      setRequestingReactivation(false);
    }
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/login?callbackUrl=/affiliate/dashboard");
    return null;
  }

  if (!data || !data.affiliate) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center max-w-200">
          <div className="text-6xl mb-4">🌱</div>
          <h2 className="text-xl font-bold text-text-primary mb-2">
            Belum Terdaftar Affiliate
          </h2>
          <p className="text-text-secondary mb-4">
            Anda belum terdaftar sebagai affiliate. Daftar sekarang untuk mulai
            mendapatkan komisi!
          </p>
          <button
            onClick={() => router.push("/affiliate/apply")}
            className="btn-primary"
          >
            Daftar Affiliate
          </button>
        </div>
      </div>
    );
  }

  if (data.affiliate.affiliateStatus === "nonaktif") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center max-w-200">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-text-primary mb-2">
            Akun Affiliate Dinonaktifkan
          </h2>
          <p className="text-text-secondary mb-4">
            Akun affiliate Anda dinonaktifkan karena terdeteksi adanya aktivitas
            mencurigakan. Anda dapat mengajukan permintaan reaktivasi ke tim
            kami untuk ditinjau kembali.
          </p>
          <button
            onClick={requestReactivation}
            disabled={requestingReactivation}
            className="btn-primary disabled:opacity-50"
          >
            {requestingReactivation ? "Mengirim..." : "Ajukan Reaktivasi Akun"}
          </button>
        </div>
      </div>
    );
  }

  if (data.affiliate.affiliateStatus === "diblokir") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center max-w-200">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-text-primary mb-2">
            Akun Affiliate Diblokir
          </h2>
          <p className="text-text-secondary mb-4">
            Akun affiliate Anda diblokir karena terdeteksi adanya aktivitas yang
            melanggar ketentuan program affiliate kami.
          </p>
          <button
            onClick={() => router.push("/affiliate/apply")}
            className="btn-primary"
          >
            Daftar Affiliate
          </button>
        </div>
      </div>
    );
  }

  const { user, affiliate, totalKlik, totalTransaksi, totalKomisi } = data;
  const initials = user.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isApproved = affiliate.status === "approved";

  return (
    <>
      <div className="page-wrap">
        {/* ─── GREETING ─── */}
        <div className="greeting-wrap">
          <div className="greeting-name">Halo, {user.name} !!!</div>
          <div className="greeting-sub">{user.email}</div>
        </div>

        <div className="page-title">Dashboard Affiliate</div>
        <div className="page-sub">
          Pantau performa dan komisi kamu secara real-time
        </div>

        {/* ─── STATS ─── */}
        <div className="stats-row stats-row-3">
          <div className="stat-card stat-klik">
            <div className="stat-card-header">
              <div className="stat-icon-wrap icon-klik">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </div>
              <div className="stat-label">Total Klik Link</div>
            </div>
            <div className="stat-value-wrap">
              <div className="stat-value">{animatedKlik}</div>
              <div className="stat-unit">klik</div>
            </div>
            <div className="stat-trend stat-trend-neutral">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Klik tanpa beli tidak dihitung komisi</span>
            </div>
          </div>

          <div className="stat-card stat-transaksi">
            <div className="stat-card-header">
              <div className="stat-icon-wrap icon-transaksi">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
              </div>
              <div className="stat-label">Jumlah Transaksi dari Link</div>
            </div>
            <div className="stat-value-wrap">
              <div className="stat-value">{animatedTransaksi}</div>
              <div className="stat-unit">transaksi</div>
            </div>
            <div className="stat-trend">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span>Total keseluruhan</span>
            </div>
            <div className="stat-chart-bar">
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${
                      totalTransaksi > 0 ? Math.min(100, totalTransaksi) : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div
            className="stat-card stat-komisi"
            onClick={openModalRekening}
            style={{ cursor: "pointer" }}
            title="Klik untuk tarik komisi"
          >
            <div className="stat-card-header">
              <div className="stat-icon-wrap icon-komisi">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              </div>
              <div className="stat-label">Total Komisi</div>
            </div>
            <div className="stat-value-wrap">
              <div className="stat-currency">Rp</div>
              <div className="stat-value">
                {animatedKomisi.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="stat-trend">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span>Komisi terkumpul</span>
            </div>
            <div className="xendit-badge" style={{ display: "none" }}>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Saldo via Xendit · Live
            </div>
            <div className="stat-withdraw-hint">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="17 11 12 6 7 11" />
                <line x1="12" y1="6" x2="12" y2="18" />
              </svg>
              Klik untuk tarik komisi
            </div>
          </div>
        </div>

        {/* ─── REFERRAL LINK ─── */}
        <div className="ref-card">
          <div className="ref-card-label">Link Referral Kamu</div>
          <div className="ref-link-row">
            <div className="ref-link-text">{refLink}</div>
            <button
              className="btn-copy"
              onClick={copyReferralLink}
              disabled={isCopying}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Salin
            </button>
          </div>
          <div className="ref-hint">
            Tempelkan di belakang URL produk. Contoh:
            <code>/produk/1/ref/{affiliate.id}</code>— atau gunakan tombol{" "}
            <strong>Share</strong> di halaman produk.
          </div>
          {isApproved && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <Link
                href={`/katalog?ref=${affiliate.id}&internal=1`}
                className="btn-primary"
                style={{ textDecoration: "none" }}
              >
                Buka Katalog Produk
              </Link>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>
                Setiap link produk akan otomatis menyertakan kode referral Anda.
              </span>
            </div>
          )}
        </div>

        {/* ─── SOSMED & TRAFFIC ─── */}
        <div className="section-title">
          <span>
            Akun Sosmed Terhubung
            <span className="sosmed-badge">{sosmedList.length}</span>
          </span>
          <div className="section-title-line"></div>
        </div>

        <div className="sosmed-tabs">
          <button
            className={activeTab === "sosmed" ? "active" : ""}
            onClick={() => showTab("sosmed")}
          >
            Sosmed
          </button>
          <button
            className={activeTab === "traffic" ? "active" : ""}
            onClick={() => showTab("traffic")}
          >
            Traffic
          </button>
        </div>

        {/* Tab Sosmed */}
        <div
          id="tab-sosmed"
          style={{ display: activeTab === "sosmed" ? "block" : "none" }}
        >
          <div className="sosmed-grid">
            {sosmedList.map((s, i) => {
              const iconMap: Record<string, string> = {
                Instagram: "icon-instagram",
                TikTok: "icon-tiktok",
                YouTube: "icon-youtube",
                Twitter: "icon-twitter",
                Facebook: "icon-facebook",
                Lainnya: "icon-lainnya",
              };
              const shortMap: Record<string, string> = {
                Instagram: "IG",
                TikTok: "TT",
                YouTube: "YT",
                Twitter: "TW",
                Facebook: "FB",
                Lainnya: "?",
              };
              const iconClass = iconMap[s.platform] || "icon-lainnya";
              const short = shortMap[s.platform] || "?";

              return (
                <div
                  key={i}
                  className={`sosmed-card ${
                    s.verified ? "verified" : "unverified"
                  }`}
                >
                  <div className={`sosmed-platform-icon ${iconClass}`}>
                    {short}
                  </div>
                  <div className="sosmed-info" style={{ flex: 1 }}>
                    <div className="sosmed-platform">
                      {s.platform}
                      {s.verified ? (
                        <span className="verified-badge">✓ Terverifikasi</span>
                      ) : s.token_sent ? (
                        <span className="badge-pending-verify">
                          ⏳ Menunggu verifikasi
                        </span>
                      ) : (
                        <span className="unverified-badge">
                          Belum diverifikasi
                        </span>
                      )}
                    </div>
                    <a
                      href={getSocialMediaUrl(s.platform, s.link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sosmed-link"
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      {s.link
                        .replace(/^https?:\/\/(www\.)?[^\/]+\//, "")
                        .replace(/^@/, "")}
                    </a>

                    {!s.verified && !s.token_sent && (
                      <div className="sosmed-verify-action">
                        <button
                          className="btn-verify-now"
                          onClick={() => sendVerification(i)}
                          disabled={verifyingIndex === i}
                        >
                          {verifyingIndex === i ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />{" "}
                              Mengirim...
                            </>
                          ) : (
                            <>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 13.5a19.79 19.79 0 01-3.07-8.67A2 2 0 012 2.84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 10.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17.92z" />
                              </svg>
                              Kirim link verifikasi ke email
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {!s.verified && s.token_sent && (
                      <div className="sosmed-verify-hint">
                        📧 Cek email kamu dan klik link verifikasi.
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-hapus-sosmed"
                    onClick={() => hapusSosmed(i)}
                    title="Hapus akun ini"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
          <button className="btn-tambah-sosmed" onClick={handleTambahSosmed}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tambah Akun Sosmed
          </button>
        </div>

        {/* Tab Traffic */}
        <div
          id="tab-traffic"
          style={{ display: activeTab === "traffic" ? "block" : "none" }}
        >
          {platformStats.length === 0 ? (
            <div className="traffic-empty">Belum ada data traffic</div>
          ) : (
            platformStats.map((item, idx) => {
              const platformName: Record<string, string> = {
                instagram: "Instagram",
                tiktok: "TikTok",
                facebook: "Facebook",
                youtube: "YouTube",
                twitter: "Twitter",
                direct: "Direct / Organic",
              };
              const label =
                platformName[item.platform.toLowerCase()] || item.platform;
              const maxClicks = Math.max(
                ...platformStats.map((p) => p.total_clicks),
                1
              );
              const width = Math.min(
                (item.total_clicks / maxClicks) * 100,
                100
              );
              return (
                <div key={idx} className="traffic-item">
                  <div className="traffic-platform">{label}</div>
                  <div className="traffic-count">{item.total_clicks} klik</div>
                  <div className="traffic-bar">
                    <div
                      className="traffic-fill"
                      style={{ width: `${width}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── RIWAYAT SHORTCUT ─── */}
        <div className="section-title" style={{ marginTop: 40 }}>
          <span>Riwayat</span>
          <div className="section-title-line"></div>
        </div>

        <div className="riwayat-shortcut-row">
          <a
            href="/affiliate/riwayat?tab=transaksi"
            className="riwayat-shortcut-card"
          >
            <div className="riwayat-shortcut-icon icon-transaksi">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
            </div>
            <div className="riwayat-shortcut-text">
              <div className="riwayat-shortcut-title">Riwayat Transaksi</div>
              <div className="riwayat-shortcut-sub">
                {totalTransaksi} transaksi dari link referral kamu
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>

          <a
            href="/affiliate/riwayat?tab=penarikan"
            className="riwayat-shortcut-card"
          >
            <div className="riwayat-shortcut-icon icon-komisi">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <div className="riwayat-shortcut-text">
              <div className="riwayat-shortcut-title">
                Riwayat Penarikan Komisi
              </div>
              <div className="riwayat-shortcut-sub">
                Lihat status penarikan dana kamu
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        </div>
      </div>

      {/* ─── MODAL TAMBAH SOSMED ─── */}
      {showModalTambah && (
        <div
          className="modal-overlay open"
          onClick={(e) =>
            e.target === e.currentTarget && setShowModalTambah(false)
          }
        >
          <div className="modal">
            <div className="modal-title">Tambah Akun Sosmed</div>
            <div className="modal-subtitle">
              Pilih platform dan masukkan link profil kamu.
            </div>
            <div className="platform-grid">
              {[
                "Instagram",
                "TikTok",
                "YouTube",
                "Twitter",
                "Facebook",
                "Lainnya",
              ].map((plat) => {
                const iconClass = {
                  Instagram: "icon-instagram",
                  TikTok: "icon-tiktok",
                  YouTube: "icon-youtube",
                  Twitter: "icon-twitter",
                  Facebook: "icon-facebook",
                  Lainnya: "icon-lainnya",
                }[plat];
                const short = {
                  Instagram: "IG",
                  TikTok: "TT",
                  YouTube: "YT",
                  Twitter: "TW",
                  Facebook: "FB",
                  Lainnya: "+",
                }[plat];
                const isSelected = selectedPlatform === plat;
                const isUsed = sosmedList.some((s) => s.platform === plat);
                return (
                  <div
                    key={plat}
                    className={`platform-opt ${isSelected ? "selected" : ""} ${
                      isUsed ? "used" : ""
                    }`}
                    onClick={() => !isUsed && selectPlatform(plat)}
                    style={{
                      cursor: isUsed ? "not-allowed" : "pointer",
                      opacity: isUsed ? 0.5 : 1,
                    }}
                  >
                    <div className={`platform-opt-icon ${iconClass}`}>
                      {short}
                    </div>
                    <div className="platform-opt-label">{plat}</div>
                    {isUsed && (
                      <div style={{ fontSize: 10, color: "#ef4444" }}>
                        Terdaftar
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="modal-field">
              <div className="modal-field-label">Link / Username Akun</div>
              <input
                className="input"
                type="text"
                placeholder="https://instagram.com/username"
                value={sosmedLink}
                onChange={handleSosmedLinkChange}
              />
              {dupError && (
                <div className="error-msg show">Akun ini sudah terdaftar.</div>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="btn-batal"
                onClick={() => setShowModalTambah(false)}
              >
                Batal
              </button>
              <button
                className="btn-konfirmasi"
                disabled={!selectedPlatform || !sosmedLink || dupError}
                onClick={simpanSosmed}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL HAPUS SOSMED ─── */}
      {showModalHapus && (
        <div
          className="modal-overlay open"
          onClick={(e) =>
            e.target === e.currentTarget && setShowModalHapus(false)
          }
        >
          <div className="modal modal-hapus">
            <div className="hapus-icon-wrap">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
            </div>
            <div className="modal-title">Hapus Akun Sosmed?</div>
            <div className="hapus-desc">
              Akun ini akan dihapus dari daftar sosmed kamu.
            </div>
            <div className="modal-actions">
              <button
                className="btn-batal"
                onClick={() => setShowModalHapus(false)}
              >
                Batal
              </button>
              <button className="btn-konfirmasi" onClick={confirmHapus}>
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL TARIK KOMISI ─── */}
      {showModalRekening && (
        <>
          {stepWD === 1 && (
            <div
              className="modal-overlay open"
              onClick={(e) =>
                e.target === e.currentTarget && setShowModalRekening(false)
              }
            >
              <div className="modal modal-rekening">
                <div className="modal-step-indicator">
                  <div className="step-dot active"></div>
                  <div className="step-line"></div>
                  <div className="step-dot"></div>
                  <div className="step-line"></div>
                  <div className="step-dot"></div>
                </div>
                <div className="modal-title">Tarik Komisi</div>
                <div className="modal-subtitle">
                  Masukkan informasi rekening tujuan penarikan.
                </div>
                <div className="modal-field">
                  <div className="modal-field-label">Nama Bank</div>
                  <select
                    className="input"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                  >
                    <option value="">-- Pilih Bank --</option>
                    <option>BCA</option>
                    <option>BRI</option>
                    <option>BNI</option>
                    <option>Mandiri</option>
                    <option>CIMB Niaga</option>
                    <option>Danamon</option>
                    <option>BSI</option>
                    <option>GoPay</option>
                    <option>OVO</option>
                    <option>DANA</option>
                    <option>ShopeePay</option>
                  </select>
                </div>
                <div className="modal-field">
                  <div className="modal-field-label">Nomor Rekening / Akun</div>
                  <input
                    className="input"
                    type="text"
                    placeholder="Contoh: 1234567890"
                    value={noRekening}
                    onChange={(e) => setNoRekening(e.target.value)}
                  />
                  {rekeningValid === true && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "10px 14px",
                        background: "rgba(67,233,123,0.08)",
                        border: "1px solid rgba(67,233,123,0.2)",
                        borderRadius: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          marginBottom: 2,
                        }}
                      >
                        Nama Pemilik Rekening
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#43e97b",
                        }}
                      >
                        {rekeningNama}
                      </div>
                    </div>
                  )}
                  {rekeningValid === false && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      Nomor rekening tidak ditemukan.
                    </div>
                  )}
                </div>
                <div className="modal-actions">
                  <button
                    className="btn-batal"
                    onClick={() => setShowModalRekening(false)}
                  >
                    Batal
                  </button>
                  <button
                    className="btn-konfirmasi"
                    onClick={cekRekening}
                    disabled={!bank || !noRekening}
                  >
                    Cek Rekening
                  </button>
                  <button
                    className="btn-konfirmasi"
                    onClick={lanjutNominal}
                    disabled={!rekeningValid}
                    style={{ marginLeft: 8 }}
                  >
                    Lanjut →
                  </button>
                </div>
              </div>
            </div>
          )}

          {stepWD === 2 && (
            <div
              className="modal-overlay open"
              onClick={(e) =>
                e.target === e.currentTarget && setShowModalRekening(false)
              }
            >
              <div className="modal modal-rekening">
                <div className="modal-step-indicator">
                  <div className="step-dot done"></div>
                  <div className="step-line done"></div>
                  <div className="step-dot active"></div>
                  <div className="step-line"></div>
                  <div className="step-dot"></div>
                </div>
                <div className="modal-title">Pilih Nominal</div>
                <div className="modal-subtitle">
                  Saldo tersedia:{" "}
                  <strong style={{ color: "var(--accent-gold)" }}>
                    Rp {totalKomisi.toLocaleString("id-ID")}
                  </strong>
                </div>
                <div className="nominal-chips">
                  {[10000, 25000, 50000, 100000, 250000, 500000].map((val) => (
                    <button
                      key={val}
                      className={`nominal-chip ${
                        nominal === val ? "active" : ""
                      }`}
                      onClick={() => pilihNominal(val)}
                      disabled={val > totalKomisi}
                      style={{
                        opacity: val > totalKomisi ? 0.4 : 1,
                        cursor: val > totalKomisi ? "not-allowed" : "pointer",
                      }}
                    >
                      Rp {val.toLocaleString("id-ID")}
                    </button>
                  ))}
                </div>
                <div className="modal-field" style={{ marginTop: 16 }}>
                  <div className="modal-field-label">
                    Atau Masukkan Nominal Lain
                  </div>
                  <div className="input-prefix-wrap">
                    <span className="input-prefix">Rp</span>
                    <input
                      className="input input-with-prefix"
                      type="number"
                      placeholder="Minimum Rp 10.000"
                      value={nominal || ""}
                      onChange={(e) => setNominal(Number(e.target.value))}
                      min={10000}
                      max={totalKomisi}
                    />
                  </div>
                  {nominal !== null && nominal < 10000 && (
                    <div className="error-msg show">Minimum Rp 10.000</div>
                  )}
                  {nominal !== null && nominal > totalKomisi && (
                    <div className="error-msg show">Melebihi saldo</div>
                  )}
                </div>
                <div className="modal-actions">
                  <button className="btn-batal" onClick={() => setStepWD(1)}>
                    ← Kembali
                  </button>
                  <button
                    className="btn-konfirmasi"
                    onClick={lanjutKonfirmasi}
                    disabled={
                      !nominal || nominal < 10000 || nominal > totalKomisi
                    }
                  >
                    Lanjut →
                  </button>
                </div>
              </div>
            </div>
          )}

          {stepWD === 3 && (
            <div
              className="modal-overlay open"
              onClick={(e) =>
                e.target === e.currentTarget && setShowModalRekening(false)
              }
            >
              <div className="modal modal-otp">
                <div className="modal-step-indicator">
                  <div className="step-dot done"></div>
                  <div className="step-line done"></div>
                  <div className="step-dot done"></div>
                  <div className="step-line"></div>
                  <div className="step-dot active"></div>
                </div>
                <div className="modal-title">Verifikasi OTP</div>
                <div className="modal-subtitle">
                  Kode OTP telah dikirim ke nomor telepon terdaftar Anda.
                </div>
                <div
                  className="otp-wrap"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    margin: "20px 0",
                  }}
                >
                  {otp.map((digit, i) => (
                    <>
                      {i === 2 && <span className="otp-sep">—</span>}
                      <input
                        key={i}
                        ref={(el) => {
                          otpInputRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        className="otp-input"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        style={{
                          width: 40,
                          height: 48,
                          textAlign: "center",
                          fontSize: 20,
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                        }}
                      />
                    </>
                  ))}
                </div>
                {otpError && (
                  <div
                    className="error-msg show"
                    style={{ textAlign: "center", marginBottom: 12 }}
                  >
                    {otpError}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                    color: "#94a3b8",
                    marginBottom: 8,
                  }}
                >
                  <span>
                    {otpSecondsLeft > 0
                      ? `Kirim ulang dalam ${otpSecondsLeft}s`
                      : "Kode kedaluwarsa."}
                  </span>
                  <button
                    className="btn-resend"
                    onClick={resendOtp}
                    disabled={otpSecondsLeft > 0 || sendingOtp}
                    style={{
                      background: "none",
                      border: "none",
                      color:
                        otpSecondsLeft > 0 ? "#cbd5e1" : "var(--accent-gold)",
                      cursor: otpSecondsLeft > 0 ? "not-allowed" : "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Kirim Ulang
                  </button>
                </div>
                <div className="modal-actions">
                  <button
                    className="btn-batal"
                    onClick={() => {
                      if (otpTimerRef.current)
                        clearInterval(otpTimerRef.current);
                      setStepWD(2);
                    }}
                  >
                    ← Kembali
                  </button>
                  <button
                    className="btn-konfirmasi"
                    onClick={verifyOtp}
                    disabled={verifyingOtp || otp.join("").length < 6}
                  >
                    {verifyingOtp ? "Memverifikasi..." : "Verifikasi →"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {stepWD === 4 && (
            <div
              className="modal-overlay open"
              onClick={(e) =>
                e.target === e.currentTarget && setShowModalRekening(false)
              }
            >
              <div className="modal modal-rekening">
                <div className="modal-step-indicator">
                  <div className="step-dot done"></div>
                  <div className="step-line done"></div>
                  <div className="step-dot done"></div>
                  <div className="step-line done"></div>
                  <div className="step-dot active"></div>
                </div>
                <div className="modal-title">Konfirmasi Penarikan</div>
                <div className="modal-subtitle">
                  Pastikan detail penarikan sudah benar.
                </div>
                <div className="konfirm-detail">
                  <div className="konfirm-row">
                    <span className="konfirm-label">Bank</span>
                    <span className="konfirm-val">{bank}</span>
                  </div>
                  <div className="konfirm-row">
                    <span className="konfirm-label">No. Rekening</span>
                    <span className="konfirm-val">{noRekening}</span>
                  </div>
                  <div className="konfirm-row">
                    <span className="konfirm-label">Nama Pemilik</span>
                    <span className="konfirm-val">{rekeningNama}</span>
                  </div>
                  <div className="konfirm-divider"></div>
                  <div className="konfirm-row konfirm-row-total">
                    <span className="konfirm-label">Jumlah Tarik</span>
                    <span className="konfirm-val konfirm-nominal">
                      Rp {nominal?.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
                <div className="konfirm-note">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Dana akan diproses dalam <strong>1–3 hari kerja</strong>.
                </div>
                <div className="modal-actions">
                  <button className="btn-batal" onClick={() => setStepWD(3)}>
                    ← Kembali
                  </button>
                  <button
                    className="btn-konfirmasi btn-tarik"
                    onClick={submitPenarikan}
                  >
                    Konfirmasi Penarikan
                  </button>
                </div>
              </div>
            </div>
          )}

          {stepWD === 5 && (
            <div
              className="modal-overlay open"
              onClick={(e) =>
                e.target === e.currentTarget && setShowModalRekening(false)
              }
            >
              <div className="modal modal-sukses-wd">
                <div className="sukses-wd-icon">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#43e97b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="modal-title">Penarikan Diajukan!</div>
                <div className="modal-subtitle">
                  Permintaan penarikan{" "}
                  <strong style={{ color: "var(--accent-gold)" }}>
                    Rp {nominal?.toLocaleString("id-ID")}
                  </strong>
                  ke <strong>{bank}</strong> sedang diproses.
                </div>
                <div className="sukses-wd-note">
                  Dana akan masuk dalam 1–3 hari kerja.
                </div>
                <button
                  className="btn-konfirmasi"
                  style={{ marginTop: 20, width: "100%" }}
                  onClick={() => setShowModalRekening(false)}
                >
                  Oke, Mengerti
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
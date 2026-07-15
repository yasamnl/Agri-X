"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getCookie } from "@/lib/auth";
import toast from "react-hot-toast";
import "@/styles/affiliate.css";
import { Loader2 } from "lucide-react";
import {
  FaInstagram,
  FaTiktok,
  FaYoutube,
  FaTwitter,
  FaFacebook,
  FaGlobe,
} from "react-icons/fa";
import {
  SOCIAL_MEDIA_CONFIGS,
  validateSocialMediaUsername,
  type SocialMediaPlatform,
} from "@/lib/social-media";

interface SosmedAccount {
  platform: SocialMediaPlatform;
  username: string;
  verified: boolean;
  tokenSent?: boolean;
}

const PLATFORM_OPTIONS: SocialMediaPlatform[] = [
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "facebook",
  "website",
];

const PLATFORM_ICONS: Record<SocialMediaPlatform, any> = {
  instagram: FaInstagram,
  tiktok: FaTiktok,
  youtube: FaYoutube,
  twitter: FaTwitter,
  facebook: FaFacebook,
  website: FaGlobe,
};

export default function AffiliateApplyPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [accounts, setAccounts] = useState<SosmedAccount[]>([]);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateError, setDuplicateError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] =
    useState<SocialMediaPlatform>("instagram");
  const [modalUsername, setModalUsername] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [verifyingIndex, setVerifyingIndex] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // State untuk modal S&K dan Kebijakan Privasi
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sinkron email dari user
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  // Redirect jika belum login
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login?callbackUrl=/affiliate/apply");
    }
  }, [authLoading, isAuthenticated, router]);

  // Bersihkan polling saat unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // ============================================
  // SESSION KEY
  // ============================================
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

  const getAccountsStorageKey = (): string => {
    return `affiliate_accounts_${getSessionKey()}`;
  };

  // ============================================
  // FUNGSI MANAJEMEN AKUN
  // ============================================
  const checkDuplicateAccount = (
    platform: SocialMediaPlatform,
    username: string
  ) => {
    const cleanUsername = username.trim().toLowerCase();
    return accounts.some((account) => {
      return (
        account.platform === platform &&
        account.username.trim().toLowerCase() === cleanUsername
      );
    });
  };

  const addAccount = () => {
    if (!modalUsername.trim()) {
      toast.error("Username wajib diisi");
      return;
    }

    if (accounts.length >= 5) {
      toast.error("Maksimal 5 akun sosial media");
      return;
    }

    if (checkDuplicateAccount(selectedPlatform, modalUsername)) {
      setDuplicateError(true);
      return;
    }

    const validation = validateSocialMediaUsername(
      selectedPlatform,
      modalUsername.trim()
    );
    if (!validation.valid) {
      toast.error(validation.error || "Username tidak valid");
      return;
    }

    setAccounts([
      ...accounts,
      {
        platform: selectedPlatform,
        username: modalUsername.trim(),
        verified: false,
        tokenSent: false,
      },
    ]);

    setModalUsername("");
    setSelectedPlatform("instagram");
    setDuplicateError(false);
    setShowAddModal(false);
  };

  const removeAccount = (index: number) => {
    if (accounts.length === 1) {
      toast.error("Minimal 1 akun sosial media");
      return;
    }
    setAccounts(accounts.filter((_, i) => i !== index));
  };

  // ============================================
  // VERIFIKASI EMAIL
  // ============================================
  const sendVerification = async (index: number) => {
    try {
      const token = getCookie("accessToken");
      if (!token) {
        toast.error("Token tidak ditemukan. Silakan login ulang.");
        return;
      }
  
      const account = accounts[index];
      if (!account.username.trim()) {
        toast.error("Isi username terlebih dahulu");
        return;
      }
  
      const currentEmail = email || user?.email || "";
      if (!currentEmail) {
        toast.error("Email tidak ditemukan. Silakan isi email.");
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
          username: account.username,
          session_key: sessionKey,
        }),
      });
  
      const result = await res.json();
  
      if (!res.ok || !result.success) {
        throw new Error(result.error || `HTTP ${res.status}`);
      }
  
      setAccounts((prev) => {
        const newAcc = [...prev];
        newAcc[index].tokenSent = true;
        return newAcc;
      });
  
      // ✅ KEMBALI KE PESAN NORMAL (tanpa link)
      toast.success(result.message || "Link verifikasi telah dikirim ke email");
  
      // Mulai polling
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
  // ============================================
  // POLLING VERIFIKASI
  // ============================================
  const checkVerificationNow = async (accountsToCheck: SosmedAccount[]) => {
    try {
      const token = getCookie("accessToken");
      if (!token) return;

      const currentEmail = email || user?.email || "";
      if (!currentEmail) return;

      const res = await fetch("/api/affiliate/apply/check-verification", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: currentEmail,
          session_key: getSessionKey(),
          accounts: accountsToCheck.map((a) => ({
            platform: a.platform,
            username: a.username,
          })),
        }),
      });

      const data = await res.json();
      if (data.success && data.verified_accounts) {
        setAccounts((prev) => {
          let updated = false;
          const newAcc = prev.map((a) => {
            const found = data.verified_accounts.find(
              (v: any) =>
                v.platform === a.platform && v.username === a.username
            );
            if (found && !a.verified) {
              updated = true;
              return { ...a, verified: true, tokenSent: false };
            }
            return a;
          });
          if (updated) {
            toast.success("✅ Akun berhasil diverifikasi!");
          }
          return newAcc;
        });
      }
    } catch (err) {
      console.error("Check verification error:", err);
    }
  };

  const startPolling = () => {
    if (pollingIntervalRef.current) return;

    console.log("🔄 Starting polling...");

    pollingIntervalRef.current = setInterval(async () => {
      const hasPending = accounts.some((a) => a.tokenSent && !a.verified);
      if (!hasPending) {
        console.log("⏹️ Stopping polling (no pending accounts)");
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      await checkVerificationNow(accounts);
    }, 5000);
  };

  // ============================================
  // RESTORE AKUN DARI LOCAL STORAGE (mis. setelah
  // user kembali dari link verifikasi email)
  // ============================================
  useEffect(() => {
    try {
      const saved = localStorage.getItem(getAccountsStorageKey());
      if (saved) {
        const parsed: SosmedAccount[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAccounts(parsed);
        }
      }
    } catch (err) {
      console.error("Gagal memuat akun sosmed tersimpan:", err);
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simpan akun ke local storage setiap kali berubah (setelah hydrate)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        getAccountsStorageKey(),
        JSON.stringify(accounts)
      );
    } catch (err) {
      console.error("Gagal menyimpan akun sosmed:", err);
    }
  }, [accounts, hydrated]);

  // Begitu selesai hydrate, langsung cek status verifikasi ke server
  // (bukan menunggu 5 detik polling) supaya badge langsung update
  // kalau user baru saja verifikasi lalu klik "kembali ke pendaftaran"
  useEffect(() => {
    if (!hydrated) return;
    const hasPending = accounts.some((a) => a.tokenSent && !a.verified);
    if (hasPending) {
      checkVerificationNow(accounts);
      if (!pollingIntervalRef.current) {
        startPolling();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // ============================================
  // SUBMIT FINAL
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    for (const account of accounts) {
      const validation = validateSocialMediaUsername(
        account.platform,
        account.username
      );
      if (!validation.valid) {
        toast.error(validation.error || "Username tidak valid");
        return;
      }
    }

    const hasVerifiedAccount = accounts.some((account) => account.verified);
    if (!hasVerifiedAccount) {
      toast.error(
        "Minimal 1 akun sosial media harus diverifikasi terlebih dahulu"
      );
      return;
    }

    if (!agreeTerms) {
      toast.error("Kamu harus menyetujui Syarat & Ketentuan terlebih dahulu");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = getCookie("accessToken");
      if (!token) throw new Error("Token tidak ditemukan");

      const res = await fetch("/api/affiliate/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sosmedAccounts: accounts }),
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Gagal mengajukan aplikasi");
      }

      toast.success(result.message);
      try {
        localStorage.removeItem(getAccountsStorageKey());
      } catch (err) {
        console.error("Gagal membersihkan akun sosmed tersimpan:", err);
      }
      router.push("/akun");
    } catch (error: any) {
      toast.error(error.message || "Gagal mengajukan aplikasi");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // RENDER LOADING / REDIRECT
  // ============================================
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // ============================================
  // RENDER UTAMA
  // ============================================
  return (
    <div className="page-wrap">
      {/* PAGE TITLE */}
      <div className="page-title">Daftar Affiliate</div>

      {/* ========================================= */}
      {/* EMAIL */}
      {/* ========================================= */}
      <div className="section">
        <div className="field-label">Alamat Email</div>
        <input
          className="input"
          type="email"
          placeholder="contoh@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="error-msg">Masukkan alamat email yang valid.</div>
      </div>

      {/* ========================================= */}
      {/* INFO CARD + DAFTAR SOSMED */}
      {/* ========================================= */}
      <div className="info-card">
        <h2>Kaitkan Akun Sosial Media</h2>
        <p>
          Untuk bergabung sebagai affiliator, kamu perlu menghubungkan minimal
          satu akun media sosial aktif yang sudah{" "}
          <strong>diverifikasi kepemilikannya</strong>. Setelah menambahkan
          akun, klik tombol
          <em>"Kirim link verifikasi ke email"</em> — kami akan mengirim link
          konfirmasi ke emailmu.
        </p>

        {/* COUNTER */}
        {accounts.length > 0 && (
          <div className="sosmed-counter">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{accounts.length} akun ditambahkan</span>
          </div>
        )}

        {/* DAFTAR AKUN */}
        {accounts.length > 0 && (
          <div className="sosmed-list">
            {accounts.map((account, index) => {
              const Icon = PLATFORM_ICONS[account.platform];
              const platformLabel =
                SOCIAL_MEDIA_CONFIGS[account.platform].label;
              return (
                <div
                  key={index}
                  className={`sosmed-item ${
                    account.verified ? "sosmed-verified" : "sosmed-unverified"
                  }`}
                >
                  <div
                    className={`sosmed-platform-icon icon-${account.platform}`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="sosmed-info">
                    <div className="sosmed-platform">
                      {platformLabel.toUpperCase()}
                      {account.verified ? (
                        <span className="badge-verified">✓ Terverifikasi</span>
                      ) : account.tokenSent ? (
                        <span className="badge-pending-verify">
                          ⏳ Menunggu verifikasi
                        </span>
                      ) : (
                        <span className="badge-unverified">
                          Belum diverifikasi
                        </span>
                      )}
                    </div>
                    <div className="sosmed-link">{account.username}</div>

                    {!account.verified && !account.tokenSent && (
                      <div className="sosmed-verify-action">
                        <button
                          className="btn-verify-now"
                          onClick={() => sendVerification(index)}
                          disabled={verifyingIndex === index}
                        >
                          {verifyingIndex === index ? (
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

                    {!account.verified && account.tokenSent && (
                      <div className="sosmed-verify-hint">
                        📧 Cek email kamu dan klik link verifikasi.
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-hapus"
                    onClick={() => removeAccount(index)}
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
        )}

        {/* TOMBOL TAMBAH */}
        <button
          className="btn-tambah"
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setShowAddModal(true);
          }}
        >
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
          Tambahkan akun sosmed
        </button>
      </div>

      {/* ========================================= */}
      {/* CHECKBOX SYARAT */}
      {/* ========================================= */}
      <div className="syarat-wrap" onClick={() => setAgreeTerms(!agreeTerms)}>
        <input
          type="checkbox"
          id="agreeCheckbox"
          checked={agreeTerms}
          onChange={() => setAgreeTerms(!agreeTerms)}
          style={{ display: "none" }}
        />
        <label
          htmlFor="agreeCheckbox"
          className={`checkbox-box ${agreeTerms ? "active" : ""}`}
        >
          {agreeTerms && (
            <svg
              className="checkbox-check"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </label>
        <div className="syarat-text">
          Saya menyetujui{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowTermsModal(true);
            }}
          >
            Syarat & Ketentuan
          </a>{" "}
          serta{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPrivacyModal(true);
            }}
          >
            Kebijakan Privasi
          </a>{" "}
          program affiliate dan menyatakan bahwa data yang saya berikan benar.
        </div>
      </div>

      {/* SUBMIT */}
      <button
        className="btn-submit"
        disabled={!agreeTerms || isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Memproses...
          </>
        ) : (
          "Daftar Sekarang"
        )}
      </button>

      {/* ========================================= */}
      {/* MODAL TAMBAH AKUN */}
      {/* ========================================= */}
      {showAddModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              setModalUsername("");
              setSelectedPlatform("instagram");
              setDuplicateError(false);
            }
          }}
        >
          <div
            className="modal"
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div className="modal-title">Tambah Akun Sosmed</div>
            <div className="modal-subtitle">
              Pilih platform dan masukkan link profil kamu.
            </div>
            <div className="platform-grid">
              {PLATFORM_OPTIONS.map((platform) => {
                const Icon = PLATFORM_ICONS[platform];
                return (
                  <div
                    key={platform}
                    className={`platform-opt ${
                      selectedPlatform === platform ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedPlatform(platform);
                      setDuplicateError(
                        checkDuplicateAccount(platform, modalUsername)
                      );
                    }}
                  >
                    <div className={`platform-opt-icon icon-${platform}`}>
                      <Icon size={18} />
                    </div>
                    <div className="platform-opt-label">
                      {SOCIAL_MEDIA_CONFIGS[platform].label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-field">
              <div className="modal-field-label">Link / Username Akun</div>
              <input
                className="input"
                type="text"
                value={modalUsername}
                placeholder={SOCIAL_MEDIA_CONFIGS[selectedPlatform].placeholder}
                onChange={(e) => {
                  const value = e.target.value;
                  setModalUsername(value);
                  setDuplicateError(
                    checkDuplicateAccount(selectedPlatform, value)
                  );
                }}
              />
              {duplicateError && (
                <div className="error-msg" style={{ display: "block" }}>
                  Akun ini sudah kamu tambahkan sebelumnya.
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-batal"
                onClick={() => {
                  setModalUsername("");
                  setSelectedPlatform("instagram");
                  setDuplicateError(false);
                  setShowAddModal(false);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-konfirmasi"
                disabled={!modalUsername.trim() || duplicateError}
                onClick={addAccount}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODAL SYARAT & KETENTUAN */}
      {/* ========================================= */}
      {showTermsModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTermsModal(false);
          }}
        >
          <div
            className="modal"
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Syarat & Ketentuan</h2>
            <p>
              Ini adalah contoh teks Syarat & Ketentuan program affiliate.
              Silakan sesuaikan dengan kebijakan resmi Anda.
            </p>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
            <button
              className="btn-konfirmasi"
              onClick={() => setShowTermsModal(false)}
              style={{ marginTop: "16px" }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODAL KEBIJAKAN PRIVASI */}
      {/* ========================================= */}
      {showPrivacyModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPrivacyModal(false);
          }}
        >
          <div
            className="modal"
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Kebijakan Privasi</h2>
            <p>
              Ini adalah contoh teks Kebijakan Privasi program affiliate.
              Silakan sesuaikan dengan kebijakan resmi Anda.
            </p>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
            <button
              className="btn-konfirmasi"
              onClick={() => setShowPrivacyModal(false)}
              style={{ marginTop: "16px" }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
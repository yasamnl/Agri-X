// src/app/(main)/affiliate/apply/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import toast from 'react-hot-toast';

// ✅ SEMUA ICON DARI react-icons/fa
import {
  FaInstagram,
  FaYoutube,
  FaTwitter,
  FaGlobe,
  FaPlus,
  FaTrash,
  FaSpinner,
  FaCheckCircle,
  FaExclamationCircle,
  FaArrowRight,
  FaTiktok,
  FaFacebook,
  FaUser,
  FaMoneyBillWave,
  FaClock,
  FaWallet,
  FaPaperPlane
} from 'react-icons/fa';

// ============================================================================
// CONSTANTS
// ============================================================================
const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: FaInstagram, color: 'text-pink-500' },
  { value: 'tiktok', label: 'TikTok', icon: FaTiktok, color: 'text-gray-800 dark:text-white' },
  { value: 'youtube', label: 'YouTube', icon: FaYoutube, color: 'text-red-600' },
  { value: 'twitter', label: 'Twitter', icon: FaTwitter, color: 'text-blue-400' },
  { value: 'facebook', label: 'Facebook', icon: FaFacebook, color: 'text-blue-600' },
  { value: 'website', label: 'Website', icon: FaGlobe, color: 'text-blue-500' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function AffiliateApplyPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [sosmedAccounts, setSosmedAccounts] = useState([
    { platform: 'instagram', link: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<any>(null);

  // ============================================================================
  // AUTH CHECK
  // ============================================================================
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/affiliate');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      checkExistingApplication();
    }
  }, [isAuthenticated]);

  // ============================================================================
  // CHECK EXISTING APPLICATION
  // ============================================================================
  const checkExistingApplication = async () => {
    try {
      const token = getCookie('accessToken');
      const res = await fetch('/api/affiliate/my-application', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success && result.data?.application) {
        setExistingApplication(result.data.application);
      }
    } catch (error) {
      console.error('Check application error:', error);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const addSosmed = () => {
    if (sosmedAccounts.length >= 5) {
      toast.error('Maksimal 5 akun sosial media');
      return;
    }
    setSosmedAccounts([...sosmedAccounts, { platform: 'instagram', link: '' }]);
  };

  const removeSosmed = (index: number) => {
    if (sosmedAccounts.length === 1) {
      toast.error('Minimal 1 akun sosial media');
      return;
    }
    setSosmedAccounts(sosmedAccounts.filter((_, i) => i !== index));
  };

  const updateSosmed = (index: number, field: string, value: string) => {
    const updated = [...sosmedAccounts];
    updated[index] = { ...updated[index], [field]: value };
    setSosmedAccounts(updated);
  };

  // ✅ VALIDASI YANG LEBIH FLEKSIBEL
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ Filter hanya akun yang memiliki link (tidak kosong)
    const validAccounts = sosmedAccounts.filter(s => s.link.trim());

    // ✅ Validasi: minimal 1 akun yang valid
    if (validAccounts.length === 0) {
      toast.error('Minimal 1 akun sosial media harus diisi');
      return;
    }

    // ✅ Validasi: link minimal 3 karakter
    const invalidLinks = validAccounts.filter(s => s.link.trim().length < 3);
    if (invalidLinks.length > 0) {
      toast.error('Link sosial media minimal 3 karakter');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = getCookie('accessToken');
      
      // ✅ Debug log untuk tracking
      console.log('📤 Mengirim aplikasi:', {
        totalAccounts: sosmedAccounts.length,
        validAccounts: validAccounts.length,
        data: validAccounts
      });

      const res = await fetch('/api/affiliate/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // ✅ Hanya kirim akun yang valid (yang memiliki link)
        body: JSON.stringify({ sosmedAccounts: validAccounts }),
      });

      const result = await res.json();
      
      // ✅ Debug log response
      console.log('📥 Response:', result);

      if (!result.success) throw new Error(result.error);

      toast.success(
        `Aplikasi berhasil dikirim! (${validAccounts.length} akun sosial media)`
      );
      checkExistingApplication();
    } catch (error: any) {
      console.error('❌ Submit error:', error);
      toast.error(error.message || 'Gagal mengirim aplikasi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Hitung berapa akun yang sudah diisi
  const validAccountsCount = sosmedAccounts.filter(s => s.link.trim()).length;

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <FaSpinner className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // ============================================================================
  // EXISTING APPLICATION STATES
  // ============================================================================
  if (existingApplication) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-full mx-auto">
          <div className="card text-center py-16">
            {existingApplication.status === 'approved' ? (
              <>
                <FaCheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-text-primary mb-2">
                  Anda Sudah Menjadi Affiliate!
                </h2>
                <p className="text-text-secondary mb-2">
                  Kode referral Anda:
                </p>
                <code className="inline-block px-4 py-2 bg-surface rounded-lg font-mono text-lg text-primary mb-6">
                  {existingApplication.referralCode}
                </code>
                <div>
                  <button
                    onClick={() => router.push('/affiliate/dashboard')}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    Lihat Dashboard Affiliate
                    <FaArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : existingApplication.status === 'pending' ? (
              <>
                <FaSpinner className="w-20 h-20 text-yellow-500 mx-auto mb-4 animate-spin" />
                <h2 className="text-2xl font-bold text-text-primary mb-2">
                  Aplikasi Sedang Diproses
                </h2>
                <p className="text-text-secondary">
                  Tim kami akan meninjau aplikasi Anda dalam 1-3 hari kerja.
                </p>
              </>
            ) : (
              <>
                <FaExclamationCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-text-primary mb-2">
                  Aplikasi Ditolak
                </h2>
                <p className="text-text-secondary mb-6">
                  Silakan coba lagi dengan informasi yang lebih lengkap.
                </p>
                <button
                  onClick={() => setExistingApplication(null)}
                  className="btn-primary"
                >
                  Ajukan Ulang
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // APPLY FORM
  // ============================================================================
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <FaMoneyBillWave className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Daftar Program Affiliate
          </h1>
          <p className="text-text-secondary">
            Dapatkan komisi hingga 10% untuk setiap transaksi yang berhasil
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-6">
          {/* Benefits */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-surface rounded-xl">
              <FaMoneyBillWave className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-primary">10%</p>
              <p className="text-xs text-text-secondary">Komisi</p>
            </div>
            <div className="text-center p-4 bg-surface rounded-xl">
              <FaClock className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-primary">30</p>
              <p className="text-xs text-text-secondary">Hari Cookie</p>
            </div>
            <div className="text-center p-4 bg-surface rounded-xl">
              <FaWallet className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-primary">50K</p>
              <p className="text-xs text-text-secondary">Min. Withdrawal</p>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <FaPaperPlane className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text-secondary">
                <p className="font-medium text-text-primary mb-1">Cara Kerja Affiliate</p>
                <p>
                  Bagikan link referral Anda. Setiap pembelian melalui link Anda akan
                  memberikan komisi otomatis ke saldo affiliate Anda.
                </p>
              </div>
            </div>
          </div>

          {/* Social Media Accounts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-text-primary">
                Akun Sosial Media <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addSosmed}
                className="btn-outline text-sm flex items-center gap-1"
              >
                <FaPlus className="w-3 h-3" />
                Tambah Akun
              </button>
            </div>

            <p className="text-xs text-text-secondary mb-3">
              Tambahkan akun sosial media yang akan Anda gunakan untuk promosi
            </p>

            <div className="space-y-3">
              {sosmedAccounts.map((sosmed, index) => {
                const platform = PLATFORMS.find(p => p.value === sosmed.platform);
                const Icon = platform?.icon || FaGlobe;
                const hasLink = sosmed.link.trim().length > 0;
                
                return (
                  <div key={index} className="flex gap-2">
                    {/* Platform Select */}
                    <div className="relative w-40">
                      <select
                        value={sosmed.platform}
                        onChange={(e) => updateSosmed(index, 'platform', e.target.value)}
                        className="input w-full appearance-none"
                      >
                        {PLATFORMS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Icon className={`w-4 h-4 ${platform?.color}`} />
                      </div>
                    </div>

                    {/* Link Input */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={sosmed.link}
                        onChange={(e) => updateSosmed(index, 'link', e.target.value)}
                        placeholder="Username atau URL..."
                        className={`input pl-10 ${
                          hasLink 
                            ? 'border-green-500/30 focus:border-green-500' 
                            : ''
                        }`}
                      />
                      {hasLink && (
                        <FaCheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                      )}
                    </div>

                    {/* Remove Button */}
                    {sosmedAccounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSosmed(index)}
                        className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ✅ Info: Berapa akun yang akan dikirim */}
            <div className="mt-3 flex items-center gap-2 text-xs">
              {validAccountsCount > 0 ? (
                <>
                  <FaCheckCircle className="w-3 h-3 text-green-500" />
                  <span className="text-text-secondary">
                    <span className="font-semibold text-green-600">{validAccountsCount}</span> akun akan dikirim
                  </span>
                </>
              ) : (
                <>
                  <FaExclamationCircle className="w-3 h-3 text-yellow-500" />
                  <span className="text-text-secondary">
                    Isi minimal 1 akun sosial media
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Terms */}
          <div className="text-xs text-text-secondary space-y-1">
            <p>
              Dengan mengajukan aplikasi, Anda menyetujui{' '}
              <a href="/syarat-ketentuan-affiliate" className="text-primary hover:underline">
                Syarat & Ketentuan Program Affiliate
              </a>
            </p>
            <p>
              • Komisi akan dibayarkan setelah masa tunggu 14 hari<br />
              • Minimal penarikan Rp 50.000<br />
              • Komisi berlaku untuk pembelian pertama melalui link referral
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || validAccountsCount === 0}
            className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2 py-3"
          >
            {isSubmitting ? (
              <>
                <FaSpinner className="w-4 h-4 animate-spin" />
                <span>Mengirim Aplikasi...</span>
              </>
            ) : (
              <>
                <FaPaperPlane className="w-4 h-4" />
                <span>
                  Kirim Aplikasi{validAccountsCount > 0 && ` (${validAccountsCount} akun)`}
                </span>
              </>
            )}
          </button>
        </form>

        {/* Footer Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-text-secondary">
            Sudah menjadi affiliator?{' '}
            <button
              onClick={() => router.push('/affiliate/dashboard')}
              className="text-primary hover:underline font-medium"
            >
              Masuk ke Dashboard
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
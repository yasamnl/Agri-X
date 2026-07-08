'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import toast from 'react-hot-toast';
import { 
  Award, Plus, Trash2, Loader2, AlertCircle, CheckCircle, 
  ExternalLink, Link as LinkIcon 
} from 'lucide-react';
import { 
  FaInstagram, FaTiktok, FaYoutube, FaTwitter, FaFacebook, FaGlobe 
} from 'react-icons/fa';
import { 
  SOCIAL_MEDIA_CONFIGS, 
  generateSocialMediaUrl, 
  validateSocialMediaUsername,
  type SocialMediaPlatform 
} from '@/lib/social-media';

interface SosmedAccount {
  platform: SocialMediaPlatform;
  username: string;
}

const PLATFORM_OPTIONS: SocialMediaPlatform[] = [
  'instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'website'
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

  const [accounts, setAccounts] = useState<SosmedAccount[]>([
    { platform: 'instagram', username: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addAccount = () => {
    if (accounts.length >= 5) {
      toast.error('Maksimal 5 akun sosial media');
      return;
    }
    setAccounts([...accounts, { platform: 'instagram', username: '' }]);
  };

  const removeAccount = (index: number) => {
    if (accounts.length === 1) {
      toast.error('Minimal 1 akun sosial media');
      return;
    }
    setAccounts(accounts.filter((_, i) => i !== index));
  };

  const updateAccount = (index: number, field: keyof SosmedAccount, value: string) => {
    const newAccounts = [...accounts];
    newAccounts[index] = { ...newAccounts[index], [field]: value };
    setAccounts(newAccounts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all accounts
    for (const account of accounts) {
      const validation = validateSocialMediaUsername(account.platform, account.username);
      if (!validation.valid) {
        toast.error(validation.error || 'Username tidak valid');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const res = await fetch('/api/affiliate/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sosmedAccounts: accounts }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Gagal mengajukan aplikasi');

      toast.success(result.message);
      router.push('/akun');
    } catch (error: any) {
      toast.error(error.message || 'Gagal mengajukan aplikasi');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/login?callbackUrl=/affiliate/apply');
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Daftar Affiliate</h1>
          <p className="text-text-secondary mt-2">
            Bergabunglah dengan program affiliate kami dan dapatkan komisi dari setiap penjualan
          </p>
        </div>

        {/* Info Box */}
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Syarat & Ketentuan:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Minimal memiliki 1 akun sosial media aktif</li>
                <li>Akun harus asli dan bukan akun palsu</li>
                <li>Tim kami akan mereview aplikasi dalam 1-3 hari kerja</li>
                <li>Kode referral akan diberikan setelah disetujui</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card space-y-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-primary" />
              Akun Sosial Media
            </h2>
            <p className="text-sm text-text-secondary mb-4">
              Tambahkan akun sosial media yang akan Anda gunakan untuk promosi
            </p>

            <div className="space-y-4">
              {accounts.map((account, index) => {
                const Icon = PLATFORM_ICONS[account.platform];
                const config = SOCIAL_MEDIA_CONFIGS[account.platform];
                const validation = account.username 
                  ? validateSocialMediaUsername(account.platform, account.username)
                  : null;
                const previewUrl = account.username 
                  ? generateSocialMediaUrl(account.platform, account.username)
                  : null;

                return (
                  <div key={index} className="bg-surface rounded-xl p-4 border border-border">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        {/* Platform Select */}
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-2">
                            Platform
                          </label>
                          <select
                            value={account.platform}
                            onChange={(e) => updateAccount(index, 'platform', e.target.value)}
                            className="input"
                          >
                            {PLATFORM_OPTIONS.map((platform) => (
                              <option key={platform} value={platform}>
                                {SOCIAL_MEDIA_CONFIGS[platform].label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Username Input */}
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-2">
                            Username / URL
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={account.username}
                              onChange={(e) => updateAccount(index, 'username', e.target.value)}
                              placeholder={config.placeholder}
                              className="input pr-10"
                            />
                            {validation && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {validation.valid ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                  <AlertCircle className="w-5 h-5 text-red-500" />
                                )}
                              </div>
                            )}
                          </div>
                          {validation && !validation.valid && (
                            <p className="text-xs text-red-500 mt-1">{validation.error}</p>
                          )}
                        </div>

                        {/* ✅ LIVE PREVIEW LINK */}
                        {previewUrl && validation?.valid && (
                          <div className="bg-background rounded-lg p-3 border border-border">
                            <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              Preview Link:
                            </p>
                            <a
                              href={previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline font-mono break-all flex items-center gap-1"
                            >
                              {previewUrl}
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Remove Button */}
                      {accounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAccount(index)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Hapus akun"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Button */}
            {accounts.length < 5 && (
              <button
                type="button"
                onClick={addAccount}
                className="btn-outline w-full mt-4 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Tambah Akun Sosial Media
              </button>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Mengajukan...
              </>
            ) : (
              <>
                <Award className="w-5 h-5" />
                Ajukan Aplikasi Affiliate
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
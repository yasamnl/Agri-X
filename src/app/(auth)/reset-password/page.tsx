// src/app/(auth)/reset-password/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Lock,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error('Semua field wajib diisi');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Password dan konfirmasi tidak cocok');
      return;
    }
    if (password.length < 8) {
      toast.error('Password minimal 8 karakter');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengubah password');
      }

      setIsSuccess(true);
      toast.success(data.message);

      // Redirect ke login setelah 2 detik — sama seperti forpass.js
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Token tidak ada di URL sama sekali
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-150">
          <div className="bg-surface rounded-3xl p-8 shadow-lg border border-border text-center">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <h1 className="text-xl font-bold text-text-primary mb-2">
              Link Tidak Valid
            </h1>
            <p className="text-text-secondary text-sm mb-6">
              Link reset password tidak lengkap atau sudah tidak berlaku.
              Silakan minta link baru.
            </p>
            <Link href="/forgot-password" className="btn-primary py-3 px-6 inline-block">
              Minta Link Reset Baru
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-150">
        {/* Back Button */}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Kembali ke Login</span>
        </Link>

        {/* Card */}
        <div className="bg-surface rounded-3xl p-8 shadow-lg border border-border">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Image
                src="/Agri-X.png"
                alt="Agri X"
                width={48}
                height={48}
                className="w-12 h-12 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">
              Reset Password
            </h1>
            <p className="text-text-secondary text-sm mt-2">
              {!isSuccess
                ? 'Masukkan password baru Anda'
                : 'Password berhasil diubah'}
            </p>
          </div>

          {isSuccess ? (
            <div className="space-y-4">
              <div className="bg-success/10 border border-success/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-success text-sm">
                      Password Berhasil Diubah!
                    </p>
                    <p className="text-success/80 text-xs mt-1">
                      Anda akan diarahkan ke halaman login dalam beberapa
                      detik...
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href="/login"
                className="w-full btn-primary py-3 flex items-center justify-center"
              >
                Login Sekarang
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Password Baru
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="w-full input pl-12 pr-12 py-3 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-text-secondary mt-1.5">
                  Minimal 8 karakter, kombinasi huruf besar, huruf kecil, dan
                  angka
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="w-full input pl-12 pr-12 py-3 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    <span>Simpan Password Baru</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-text-secondary mt-6">
          Ingat password?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Login di sini
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
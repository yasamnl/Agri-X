// src/app/(auth)/reset-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password strength checker
  const getPasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthLabels = ['Sangat Lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'];
  const strengthColors = ['bg-danger', 'bg-warning', 'bg-info', 'bg-success', 'bg-primary'];

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setError('Token tidak ditemukan di URL');
      setIsValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch('/api/auth/validate-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!data.valid) {
          setError(data.error || 'Token tidak valid');
          setIsTokenValid(false);
        } else {
          setIsTokenValid(true);
          setUserName(data.data.userName);
        }
      } catch (err: any) {
        setError('Gagal memvalidasi token');
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Token tidak valid');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Password dan konfirmasi tidak cocok');
      return;
    }

    if (passwordStrength < 3) {
      toast.error('Password terlalu lemah. Minimal harus "Cukup"');
      return;
    }

    setIsSubmitting(true);

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

      toast.success(data.message);
      
      setTimeout(() => {
        router.push('/login?reset=success');
      }, 2000);

    } catch (err: any) {
      console.error('Reset password error:', err);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-text-secondary">Memvalidasi token...</p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!isTokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-150">
          <div className="bg-surface rounded-3xl p-8 shadow-lg border border-border text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger/10 mb-4">
              <AlertCircle className="w-8 h-8 text-danger" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              Link Tidak Valid
            </h1>
            <p className="text-text-secondary text-sm mb-6">
              {error || 'Link reset password tidak valid atau sudah kedaluwarsa.'}
            </p>
            <Link href="/forgot-password" className="btn-primary inline-flex items-center gap-2">
              Minta Link Baru
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-150">
        <div className="bg-surface rounded-3xl p-8 shadow-lg border border-border">
          {/* Header */}
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
              Buat Password Baru
            </h1>
            <p className="text-text-secondary text-sm mt-2">
              Halo <strong>{userName}</strong>, masukkan password baru Anda
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password Input */}
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
                  placeholder="Minimal 8 karakter"
                  required
                  disabled={isSubmitting}
                  className="w-full input pl-12 pr-12 py-3 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full ${
                          level <= passwordStrength
                            ? strengthColors[passwordStrength - 1]
                            : 'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    passwordStrength >= 3 ? 'text-success' :
                    passwordStrength >= 2 ? 'text-warning' : 'text-danger'
                  }`}>
                    Kekuatan: {strengthLabels[passwordStrength - 1] || 'Sangat Lemah'}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
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
                  placeholder="Ulangi password"
                  required
                  disabled={isSubmitting}
                  className="w-full input pl-12 pr-12 py-3 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Match indicator */}
              {confirmPassword && (
                <div className="mt-2 flex items-center gap-1">
                  {password === confirmPassword ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-success" />
                      <span className="text-xs text-success">Password cocok</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-danger" />
                      <span className="text-xs text-danger">Password tidak cocok</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Requirements */}
            <div className="bg-surface-hover rounded-xl p-3 text-xs text-text-secondary space-y-1">
              <p className="font-semibold mb-2">Password harus:</p>
              <div className={`flex items-center gap-2 ${password.length >= 8 ? 'text-success' : ''}`}>
                {password.length >= 8 ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                <span>Minimal 8 karakter</span>
              </div>
              <div className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-success' : ''}`}>
                {/[A-Z]/.test(password) ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                <span>Huruf besar (A-Z)</span>
              </div>
              <div className={`flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-success' : ''}`}>
                {/[a-z]/.test(password) ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                <span>Huruf kecil (a-z)</span>
              </div>
              <div className={`flex items-center gap-2 ${/\d/.test(password) ? 'text-success' : ''}`}>
                {/\d/.test(password) ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                <span>Angka (0-9)</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || passwordStrength < 3 || password !== confirmPassword}
              className="w-full btn-primary py-3 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  <span>Ubah Password</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-secondary mt-6">
          <Link href="/login" className="text-primary hover:underline">
            Kembali ke Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
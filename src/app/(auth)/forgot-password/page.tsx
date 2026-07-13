// src/app/(auth)/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [, setPreviewUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Email wajib diisi');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengirim link reset');
      }

      setIsSuccess(true);
      
      // Preview URL hanya di development (Ethereal)
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }

      toast.success(data.message);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

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
              Lupa Password?
            </h1>
            <p className="text-text-secondary text-sm mt-2">
              {!isSuccess
                ? 'Masukkan email Anda untuk menerima link reset password'
                : 'Link reset password telah dikirim'}
            </p>
          </div>

          {/* Success State */}
          {isSuccess ? (
            <div className="space-y-4">
              <div className="bg-success/10 border border-success/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-success text-sm">
                      Email Terkirim!
                    </p>
                    <p className="text-success/80 text-xs mt-1">
                      Cek inbox email <strong>{email}</strong>. Link akan kedaluwarsa dalam 1 jam.
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview URL untuk Development
              {previewUrl && (
                <div className="bg-info/10 border border-info/20 rounded-xl p-4">
                  <p className="text-xs text-info mb-2 font-semibold">
                    🔧 Development Mode - Preview Email:
                  </p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-info hover:underline break-all"
                  >
                    {previewUrl}
                  </a>
                </div>
              )}*/}

              <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-warning">
                    <p className="font-semibold mb-1">Tidak menerima email?</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Cek folder spam/junk</li>
                      <li>Pastikan email yang dimasukkan benar</li>
                      <li>Tunggu beberapa menit</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsSuccess(false);
                  setEmail('');
                }}
                className="w-full btn-outline py-3"
              >
                Kirim Ulang
              </button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    required
                    autoComplete="email"
                    disabled={isLoading}
                    className="w-full input pl-12 py-3 disabled:opacity-50"
                  />
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
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    <span>Kirim Link Reset</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
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
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function VerifySosmedPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token tidak ditemukan.');
      return;
    }

    fetch('/api/affiliate/apply/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus('success');
          setMessage('✅ Akun sosial media berhasil diverifikasi!');
        } else {
          setStatus('error');
          setMessage(data.error || '❌ Gagal verifikasi token.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Terjadi kesalahan. Coba lagi nanti.');
      });
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Memverifikasi akun Anda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">
          {status === 'success' ? '✅ Verifikasi Berhasil' : '❌ Verifikasi Gagal'}
        </h1>
        <p className="text-gray-600 mb-6">{message}</p>
        {status === 'success' && (
          <Link
            href="/affiliate/apply"
            className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
          >
            Kembali ke Pendaftaran
          </Link>
        )}
        {status === 'error' && (
          <button
            onClick={() => window.close()}
            className="inline-block bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition"
          >
            Tutup
          </button>
        )}
      </div>
    </div>
  );
}
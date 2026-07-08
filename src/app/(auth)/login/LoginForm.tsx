// src/app/(auth)/login/LoginForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Leaf, Mail, Lock, Eye, EyeOff, AlertCircle, Sprout } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { setCookie } from '@/lib/auth';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  
  // ✅ Ambil callbackUrl dari query parameter
  const callbackUrlRaw = searchParams.get('callbackUrl');
  const callbackUrl = callbackUrlRaw 
    ? decodeURIComponent(callbackUrlRaw) 
    : '/';
  
  // ✅ Validasi callbackUrl untuk security
  useEffect(() => {
    if (callbackUrl && (!callbackUrl.startsWith('/') || callbackUrl.startsWith('//'))) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Invalid callbackUrl, resetting to home');
      }
      router.replace('/login');
    }
  }, [callbackUrl, router]);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [isFocused, setIsFocused] = useState<{
    email: boolean;
    password: boolean;
  }>({ email: false, password: false });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const rawResponse = await res.text();
      let data;
      try {
        data = JSON.parse(rawResponse);
      } catch (parseError) {
        throw new Error('Response bukan JSON valid.');
      }

      if (!res.ok) {
        if (data.code === 'RATE_LIMITED') {
          throw new Error(`Terlalu banyak percobaan. Tunggu ${data.resetIn || 60} detik.`);
        }
        throw new Error(data.error || 'Login gagal');
      }

      const token = data.token || data.user?.token;
      
      if (!token) {
        console.error('Token missing in response:', data);
        throw new Error('Token tidak ditemukan. Cek backend endpoint.');
      }

      const userData = {
        id: data.user?.id || '1',
        name: data.user?.name || 'User',
        email: data.user?.email || formData.email,
        role: data.user?.role || 'buyer',
        avatar: data.user?.avatar || null,
        phone: data.user?.phone || null,
      };

      // Simpan Token & Data User
      setCookie('accessToken', token, 7);
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(userData));

      // Update Context Auth
      login(token, userData); 
      
      // ✅ REDIRECT KE CALLBACK URL
      if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
        setTimeout(() => {
          router.push(callbackUrl);
        }, 100);
      } else {
        router.push('/');
      }

    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-linear-to-br from-primary/5 via-background to-secondary/5">
      
            {/* KIRI: FORM LOGIN */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-150">
          
          {/* ✅ LOGO SECTION - UPDATED */}
          <div className="text-center mb-8 lg:text-left">
            <div className="inline-flex items-center gap-3 mb-4">
              {/* Logo dari public folder */}
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg bg-white flex items-center justify-center">
                <Image
                  src="/Agri-X.png"
                  alt="Agri X"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">Agri X</h1>
                <p className="text-xs text-text-secondary">Platform Pertanian Digital</p>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-text-primary mb-2">Selamat Datang Kembali</h2>
            <p className="text-text-secondary text-sm">
              {callbackUrl !== '/' 
                ? 'Silakan login untuk melanjutkan ke halaman Anda' 
                : 'Masuk ke akun Anda untuk mulai berbelanja'}
            </p>
            
            {/* ✅ Info Banner jika ada callbackUrl */}
            {callbackUrl !== '/' && callbackUrl && (
              <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300 text-left">
                  Anda akan diarahkan ke halaman yang sebelumnya Anda kunjungi setelah login
                </p>
              </div>
            )}
          </div>

          {/* Login Form Card */}
          <div className="bg-surface rounded-3xl p-6 sm:p-8 shadow-xl border border-border/50">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail 
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary transition-all duration-200 ${
                      formData.email || isFocused.email 
                        ? 'opacity-0 pointer-events-none -translate-x-2' 
                        : 'opacity-100 translate-x-0'
                    }`} 
                  />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onFocus={() => setIsFocused(prev => ({ ...prev, email: true }))}
                    onBlur={() => setIsFocused(prev => ({ ...prev, email: false }))}
                    placeholder="      nama@email.com"
                    required
                    autoComplete="email"
                    className={`w-full input py-3 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 ${
                      formData.email || isFocused.email ? 'pl-4 pr-4' : 'pl-12 pr-4'
                    }`}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock 
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary transition-all duration-200 ${
                      formData.password || isFocused.password 
                        ? 'opacity-0 pointer-events-none -translate-x-2' 
                        : 'opacity-100 translate-x-0'
                    }`} 
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    onFocus={() => setIsFocused(prev => ({ ...prev, password: true }))}
                    onBlur={() => setIsFocused(prev => ({ ...prev, password: false }))}
                    placeholder="      ••••••••"
                    required
                    autoComplete="current-password"
                    className={`w-full input py-3 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 ${
                      formData.password || isFocused.password ? 'pl-4 pr-12' : 'pl-12 pr-12'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors p-1"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-sm text-primary hover:underline transition-colors"
                >
                  Lupa password?
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm animate-fade-in dark:bg-red-900/20 dark:border-red-800 dark:text-red-800">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-4 text-base font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memuat...</span>
                  </div>
                ) : (
                  'Masuk'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-surface text-text-secondary">atau</span>
              </div>
            </div>

            {/* Register Link - ✅ Pass callbackUrl */}
            <div className="text-center">
              <p className="text-text-secondary text-sm">
                Belum punya akun?{' '}
                <Link
                  href={`/register${callbackUrl !== '/' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
                  className="text-primary font-semibold hover:underline transition-colors"
                >
                  Daftar sekarang
                </Link>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-text-secondary/70">
              © 2025 Agri X. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================
          KANAN: ILUSTRASI ANIMASI (HANYA DI DESKTOP)
      ============================================ */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-linear-to-br from-primary/10 via-secondary/5 to-primary/20 dark:from-primary/20 dark:via-secondary/10 dark:to-primary/30">
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-10 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Floating Leaves */}
          <div className="absolute top-20 left-20 animate-float-slow">
            <Leaf className="w-8 h-8 text-primary/40 rotate-45" />
          </div>
          <div className="absolute top-40 right-32 animate-float-medium">
            <Leaf className="w-6 h-6 text-secondary/40 -rotate-12" />
          </div>
          <div className="absolute bottom-32 left-32 animate-float-fast">
            <Sprout className="w-10 h-10 text-primary/40" />
          </div>
          <div className="absolute top-60 left-1/2 animate-float-slow" style={{ animationDelay: '2s' }}>
            <Leaf className="w-5 h-5 text-primary/30 rotate-90" />
          </div>
        </div>

        {/* Main Illustration Container */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-12">
          
          {/* Sun/Moon Indicator */}
          <div className="absolute top-8 right-8">
            <div className="relative">
              {/* Sun (Light Mode) */}
              <div className="dark:hidden">
                <div className="w-16 h-16 relative animate-spin-slow">
                  <div className="absolute inset-0 bg-linear-to-br from-yellow-300 to-orange-400 rounded-full shadow-lg shadow-yellow-400/50" />
                  <div className="absolute inset-2 bg-linear-to-br from-yellow-200 to-yellow-400 rounded-full" />
                  {/* Sun Rays */}
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 left-1/2 w-1 h-4 bg-yellow-400 rounded-full origin-bottom"
                      style={{
                        transform: `translate(-50%, -100%) rotate(${i * 45}deg) translateY(-24px)`,
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* Moon (Dark Mode) */}
              <div className="hidden dark:block">
                <div className="w-16 h-16 relative">
                  <div className="absolute inset-0 bg-linear-to-br from-slate-200 to-slate-400 rounded-full shadow-lg shadow-slate-300/30" />
                  <div className="absolute top-2 right-2 w-4 h-4 bg-slate-300/50 rounded-full" />
                  <div className="absolute bottom-3 left-3 w-2 h-2 bg-slate-300/50 rounded-full" />
                  <div className="absolute top-1/2 left-4 w-1.5 h-1.5 bg-slate-300/50 rounded-full" />
                </div>
                {/* Stars */}
                <div className="hidden dark:block absolute inset-0">
                  {/* ✅ Array posisi bintang yang FIXED (tidak random) */}
                  {[
                    { top: '15%', left: '20%', delay: '0s' },
                    { top: '25%', left: '75%', delay: '0.5s' },
                    { top: '40%', left: '10%', delay: '1s' },
                    { top: '55%', left: '85%', delay: '1.5s' },
                    { top: '70%', left: '30%', delay: '2s' },
                    { top: '20%', left: '50%', delay: '0.3s' },
                    { top: '60%', left: '60%', delay: '0.8s' },
                    { top: '80%', left: '15%', delay: '1.3s' },
                    { top: '35%', left: '40%', delay: '1.8s' },
                    { top: '45%', left: '90%', delay: '2.3s' },
                  ].map((star, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
                      style={{
                        top: star.top,
                        left: star.left,
                        animationDelay: star.delay,
                      }}
                    />
                  ))}
                  
                  {/* Bintang yang lebih besar (jarang) */}
                  {[
                    { top: '30%', left: '25%', delay: '0.7s', size: 'w-1.5 h-1.5' },
                    { top: '65%', left: '70%', delay: '1.4s', size: 'w-1.5 h-1.5' },
                    { top: '50%', left: '45%', delay: '2.1s', size: 'w-2 h-2' },
                  ].map((star, i) => (
                    <div
                      key={`big-${i}`}
                      className={`absolute ${star.size} bg-white rounded-full animate-twinkle shadow-lg shadow-white/50`}
                      style={{
                        top: star.top,
                        left: star.left,
                        animationDelay: star.delay,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main SVG Illustration */}
          <div className="relative w-full max-w-80 animate-fade-in-up">
            <svg
              viewBox="0 0 400 400"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto drop-shadow-2xl"
            >
              {/* Background Hills */}
              <ellipse cx="200" cy="380" rx="220" ry="40" fill="currentColor" className="text-primary/20" />
              <ellipse cx="120" cy="370" rx="140" ry="30" fill="currentColor" className="text-primary/30" />
              <ellipse cx="300" cy="375" rx="160" ry="35" fill="currentColor" className="text-secondary/20" />

              {/* Ground */}
              <rect x="0" y="340" width="400" height="60" fill="currentColor" className="text-primary/40" />

              {/* Plants/Crops - Animated Growing */}
              <g className="animate-grow">
                {/* Plant 1 */}
                <g transform="translate(60, 340)">
                  <rect x="-2" y="-40" width="4" height="40" fill="currentColor" className="text-green-700 dark:text-green-500" />
                  <ellipse cx="-8" cy="-30" rx="8" ry="4" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(-30 -8 -30)" />
                  <ellipse cx="8" cy="-25" rx="8" ry="4" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(30 8 -25)" />
                  <ellipse cx="-6" cy="-15" rx="7" ry="3.5" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(-30 -6 -15)" />
                  <circle cx="0" cy="-45" r="6" fill="currentColor" className="text-red-500" />
                  <circle cx="-2" cy="-47" r="2" fill="currentColor" className="text-red-300" />
                </g>

                {/* Plant 2 */}
                <g transform="translate(140, 340)">
                  <rect x="-2" y="-50" width="4" height="50" fill="currentColor" className="text-green-700 dark:text-green-500" />
                  <ellipse cx="-10" cy="-40" rx="10" ry="5" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(-30 -10 -40)" />
                  <ellipse cx="10" cy="-35" rx="10" ry="5" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(30 10 -35)" />
                  <ellipse cx="-8" cy="-20" rx="8" ry="4" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(-30 -8 -20)" />
                  <ellipse cx="8" cy="-15" rx="8" ry="4" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(30 8 -15)" />
                  {/* Fruits */}
                  <circle cx="-5" cy="-55" r="5" fill="currentColor" className="text-orange-500" />
                  <circle cx="5" cy="-52" r="4" fill="currentColor" className="text-orange-400" />
                  <circle cx="0" cy="-58" r="4" fill="currentColor" className="text-orange-500" />
                </g>

                {/* Plant 3 (Corn-like) */}
                <g transform="translate(280, 340)">
                  <rect x="-2" y="-60" width="4" height="60" fill="currentColor" className="text-green-700 dark:text-green-500" />
                  <path d="M -15 -45 Q 0 -50 15 -45 L 10 -25 Q 0 -20 -10 -25 Z" fill="currentColor" className="text-yellow-500 dark:text-yellow-400" />
                  <path d="M -12 -40 Q 0 -45 12 -40 L 8 -28 Q 0 -25 -8 -28 Z" fill="currentColor" className="text-yellow-600 dark:text-yellow-500" />
                  <ellipse cx="-12" cy="-30" rx="12" ry="4" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(-20 -12 -30)" />
                  <ellipse cx="12" cy="-25" rx="12" ry="4" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(20 12 -25)" />
                </g>

                {/* Plant 4 */}
                <g transform="translate(340, 340)">
                  <rect x="-2" y="-35" width="4" height="35" fill="currentColor" className="text-green-700 dark:text-green-500" />
                  <ellipse cx="-7" cy="-25" rx="7" ry="3.5" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(-30 -7 -25)" />
                  <ellipse cx="7" cy="-20" rx="7" ry="3.5" fill="currentColor" className="text-green-600 dark:text-green-400" transform="rotate(30 7 -20)" />
                  <circle cx="0" cy="-40" r="7" fill="currentColor" className="text-red-600" />
                  <circle cx="-2" cy="-42" r="2" fill="currentColor" className="text-red-400" />
                </g>
              </g>

              {/* Farmer Character */}
              <g transform="translate(200, 260)" className="animate-float-gentle">
                {/* Shadow */}
                <ellipse cx="0" cy="85" rx="35" ry="5" fill="currentColor" className="text-black/10" />
                
                {/* Legs */}
                <rect x="-12" y="50" width="10" height="30" rx="3" fill="currentColor" className="text-blue-700 dark:text-blue-600" />
                <rect x="2" y="50" width="10" height="30" rx="3" fill="currentColor" className="text-blue-700 dark:text-blue-600" />
                
                {/* Shoes */}
                <ellipse cx="-7" cy="82" rx="8" ry="4" fill="currentColor" className="text-amber-900 dark:text-amber-800" />
                <ellipse cx="7" cy="82" rx="8" ry="4" fill="currentColor" className="text-amber-900 dark:text-amber-800" />
                
                {/* Body (Shirt) */}
                <path d="M -20 20 Q -25 35 -20 55 L 20 55 Q 25 35 20 20 Q 15 15 0 15 Q -15 15 -20 20 Z" fill="currentColor" className="text-primary dark:text-primary" />
                
                {/* Arms */}
                <rect x="-28" y="22" width="10" height="28" rx="5" fill="currentColor" className="text-primary dark:text-primary" />
                <rect x="18" y="22" width="10" height="28" rx="5" fill="currentColor" className="text-primary dark:text-primary" />
                
                {/* Hands */}
                <circle cx="-23" cy="52" r="5" fill="currentColor" className="text-amber-200 dark:text-amber-300" />
                <circle cx="23" cy="52" r="5" fill="currentColor" className="text-amber-200 dark:text-amber-300" />
                
                {/* Basket (held by farmer) */}
                <g transform="translate(0, 55)">
                  <path d="M -18 0 L -15 15 L 15 15 L 18 0 Z" fill="currentColor" className="text-amber-700 dark:text-amber-600" />
                  <path d="M -18 0 Q 0 -5 18 0" stroke="currentColor" strokeWidth="2" fill="none" className="text-amber-800 dark:text-amber-700" />
                  {/* Fruits in basket */}
                  <circle cx="-8" cy="-3" r="4" fill="currentColor" className="text-red-500" />
                  <circle cx="0" cy="-5" r="4" fill="currentColor" className="text-orange-500" />
                  <circle cx="8" cy="-3" r="4" fill="currentColor" className="text-green-500" />
                  <circle cx="-4" cy="-7" r="3" fill="currentColor" className="text-yellow-500" />
                  <circle cx="4" cy="-7" r="3" fill="currentColor" className="text-red-400" />
                </g>
                
                {/* Head */}
                <circle cx="0" cy="0" r="18" fill="currentColor" className="text-amber-200 dark:text-amber-300" />
                
                {/* Hat */}
                <ellipse cx="0" cy="-12" rx="22" ry="4" fill="currentColor" className="text-amber-700 dark:text-amber-600" />
                <path d="M -15 -12 Q -15 -28 0 -28 Q 15 -28 15 -12 Z" fill="currentColor" className="text-amber-600 dark:text-amber-500" />
                <rect x="-15" y="-14" width="30" height="3" fill="currentColor" className="text-primary" />
                
                {/* Face */}
                <circle cx="-6" cy="-2" r="1.5" fill="currentColor" className="text-gray-800 dark:text-gray-900" />
                <circle cx="6" cy="-2" r="1.5" fill="currentColor" className="text-gray-800 dark:text-gray-900" />
                <path d="M -5 6 Q 0 9 5 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" className="text-gray-800 dark:text-gray-900" />
                
                {/* Cheeks */}
                <circle cx="-10" cy="4" r="2" fill="currentColor" className="text-pink-300/50" />
                <circle cx="10" cy="4" r="2" fill="currentColor" className="text-pink-300/50" />
              </g>

              {/* Floating Butterflies */}
              <g className="animate-float-butterfly">
                <g transform="translate(100, 150)">
                  <ellipse cx="-5" cy="0" rx="5" ry="3" fill="currentColor" className="text-pink-400" />
                  <ellipse cx="5" cy="0" rx="5" ry="3" fill="currentColor" className="text-pink-400" />
                  <rect x="-0.5" y="-2" width="1" height="4" fill="currentColor" className="text-gray-700" />
                </g>
              </g>
              <g className="animate-float-butterfly-2">
                <g transform="translate(320, 180)">
                  <ellipse cx="-4" cy="0" rx="4" ry="2.5" fill="currentColor" className="text-purple-400" />
                  <ellipse cx="4" cy="0" rx="4" ry="2.5" fill="currentColor" className="text-purple-400" />
                  <rect x="-0.5" y="-1.5" width="1" height="3" fill="currentColor" className="text-gray-700" />
                </g>
              </g>

              {/* Clouds (Light mode only) */}
              <g className="dark:hidden animate-cloud-drift">
                <g transform="translate(80, 80)">
                  <ellipse cx="0" cy="0" rx="20" ry="10" fill="currentColor" className="text-white" />
                  <ellipse cx="15" cy="-3" rx="15" ry="8" fill="currentColor" className="text-white" />
                  <ellipse cx="-12" cy="-2" rx="12" ry="7" fill="currentColor" className="text-white" />
                </g>
              </g>
              <g className="dark:hidden animate-cloud-drift-2">
                <g transform="translate(300, 60)">
                  <ellipse cx="0" cy="0" rx="18" ry="9" fill="currentColor" className="text-white/80" />
                  <ellipse cx="12" cy="-2" rx="12" ry="7" fill="currentColor" className="text-white/80" />
                </g>
              </g>
            </svg>
          </div>

          {/* Caption Text */}
          <div className="mt-8 text-center max-w-100">
            <h3 className="text-2xl font-bold text-text-primary mb-2">
              Dari Ladang ke Rumah Anda 🌾
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Bergabunglah dengan ribuan petani lokal dan nikmati hasil panen segar 
              berkualitas tinggi langsung dari sumbernya.
            </p>
            
            {/* Stats */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">500+</p>
                <p className="text-xs text-text-secondary">Petani Lokal</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">10K+</p>
                <p className="text-xs text-text-secondary">Produk Segar</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">50K+</p>
                <p className="text-xs text-text-secondary">Pelanggan Puas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { 
  Mail, Lock, User, Eye, EyeOff, CheckCircle, XCircle, 
  AlertCircle, Sprout, Shield, Sprout as Seedling
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const callbackUrlRaw = searchParams.get('callbackUrl');
  const callbackUrl = callbackUrlRaw 
    ? decodeURIComponent(callbackUrlRaw) 
    : '/';
  
  useEffect(() => {
    if (callbackUrl && (!callbackUrl.startsWith('/') || callbackUrl.startsWith('//'))) {
      router.replace('/register');
    }
  }, [callbackUrl, router]);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'buyer',
  });

  const [isFocused, setIsFocused] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // ✅ Password strength calculation
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthLabels = ['', 'Lemah', 'Cukup', 'Sedang', 'Kuat', 'Sangat Kuat'];
  const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    if (!formData.role) {
      setError('Silakan pilih peran Anda');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'RATE_LIMITED') {
          throw new Error(`Terlalu banyak percobaan. Tunggu ${data.resetIn || 60} detik.`);
        }
        throw new Error(data.error || 'Register gagal');
      }

      // ✅ Ganti alert dengan toast
      toast.success('✅ Registrasi berhasil! Silakan login.', {
        duration: 4000,
        icon: '🎉',
      });

      // ✅ Redirect ke login dengan callback URL
      setTimeout(() => {
        const loginUrl = callbackUrl !== '/' 
          ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
          : '/login';
        router.push(loginUrl);
      }, 1000);

    } catch (err: any) {
      console.error('Register error:', err);
      setError(err.message);
      toast.error(err.message || 'Registrasi gagal');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      
      {/* ============================================
          Kiri: ILUSTRASI PETANI MENANAM (REGISTER THEME)
      ============================================ */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/10 via-secondary/5 to-primary/20 dark:from-primary/20 dark:via-secondary/10 dark:to-primary/30">
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-10 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Floating Leaves */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-20 animate-float-slow">
            <Sprout className="w-8 h-8 text-primary/40 rotate-45" />
          </div>
          <div className="absolute top-40 right-32 animate-float-medium">
            <Sprout className="w-6 h-6 text-secondary/40 -rotate-12" />
          </div>
          <div className="absolute bottom-32 left-32 animate-float-fast">
            <Sprout className="w-10 h-10 text-primary/40" />
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
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full shadow-lg shadow-yellow-400/50" />
                  <div className="absolute inset-2 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-full" />
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
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-400 rounded-full shadow-lg shadow-slate-300/30" />
                  <div className="absolute top-2 right-2 w-4 h-4 bg-slate-300/50 rounded-full" />
                  <div className="absolute bottom-3 left-3 w-2 h-2 bg-slate-300/50 rounded-full" />
                </div>
                
                {/* ✅ Stars dengan posisi FIXED (bukan random) */}
                {[
                  { top: '15%', left: '20%', delay: '0s' },
                  { top: '25%', left: '75%', delay: '0.5s' },
                  { top: '40%', left: '10%', delay: '1s' },
                  { top: '55%', left: '85%', delay: '1.5s' },
                  { top: '70%', left: '30%', delay: '2s' },
                  { top: '20%', left: '50%', delay: '0.3s' },
                  { top: '60%', left: '60%', delay: '0.8s' },
                  { top: '80%', left: '15%', delay: '1.3s' },
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
              </div>
            </div>
          </div>

          {/* Main SVG Illustration - Petani Menanam */}
          <div className="relative w-full max-w-100 animate-fade-in-up">
            <svg
              viewBox="0 0 400 400"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto drop-shadow-2xl"
            >
              {/* Background Hills */}
              <ellipse cx="200" cy="380" rx="220" ry="40" fill="currentColor" className="text-primary/20" />
              <ellipse cx="120" cy="370" rx="140" ry="30" fill="currentColor" className="text-primary/30" />

              {/* Ground with soil pattern */}
              <rect x="0" y="340" width="400" height="60" fill="currentColor" className="text-amber-900/40 dark:text-amber-950/60" />
              <rect x="0" y="340" width="400" height="10" fill="currentColor" className="text-amber-800/30 dark:text-amber-900/50" />

              {/* Small Sprouts Growing - Symbol of New Beginnings */}
              <g className="animate-grow">
                {/* Sprout 1 */}
                <g transform="translate(80, 340)">
                  <rect x="-1" y="-20" width="2" height="20" fill="currentColor" className="text-green-600 dark:text-green-400" />
                  <ellipse cx="-4" cy="-15" rx="5" ry="2.5" fill="currentColor" className="text-green-500 dark:text-green-300" transform="rotate(-30 -4 -15)" />
                  <ellipse cx="4" cy="-12" rx="5" ry="2.5" fill="currentColor" className="text-green-500 dark:text-green-300" transform="rotate(30 4 -12)" />
                </g>

                {/* Sprout 2 (bigger) */}
                <g transform="translate(320, 340)">
                  <rect x="-1.5" y="-30" width="3" height="30" fill="currentColor" className="text-green-600 dark:text-green-400" />
                  <ellipse cx="-6" cy="-22" rx="7" ry="3.5" fill="currentColor" className="text-green-500 dark:text-green-300" transform="rotate(-30 -6 -22)" />
                  <ellipse cx="6" cy="-18" rx="7" ry="3.5" fill="currentColor" className="text-green-500 dark:text-green-300" transform="rotate(30 6 -18)" />
                  <ellipse cx="-5" cy="-10" rx="6" ry="3" fill="currentColor" className="text-green-500 dark:text-green-300" transform="rotate(-30 -5 -10)" />
                </g>

                {/* Sprout 3 */}
                <g transform="translate(150, 340)">
                  <rect x="-1" y="-15" width="2" height="15" fill="currentColor" className="text-green-600 dark:text-green-400" />
                  <ellipse cx="-3" cy="-10" rx="4" ry="2" fill="currentColor" className="text-green-500 dark:text-green-300" transform="rotate(-30 -3 -10)" />
                  <ellipse cx="3" cy="-8" rx="4" ry="2" fill="currentColor" className="text-green-500 dark:text-green-300" transform="rotate(30 3 -8)" />
                </g>
              </g>

              {/* Farmer Planting - Main Character */}
              <g transform="translate(200, 260)" className="animate-float-gentle">
                {/* Shadow */}
                <ellipse cx="0" cy="85" rx="40" ry="5" fill="currentColor" className="text-black/10" />
                
                {/* Legs (bending - planting pose) */}
                <rect x="-15" y="50" width="11" height="28" rx="3" fill="currentColor" className="text-blue-700 dark:text-blue-600" transform="rotate(-10 -10 50)" />
                <rect x="4" y="50" width="11" height="28" rx="3" fill="currentColor" className="text-blue-700 dark:text-blue-600" transform="rotate(10 10 50)" />
                
                {/* Shoes */}
                <ellipse cx="-10" cy="82" rx="8" ry="4" fill="currentColor" className="text-amber-900 dark:text-amber-800" />
                <ellipse cx="10" cy="82" rx="8" ry="4" fill="currentColor" className="text-amber-900 dark:text-amber-800" />
                
                {/* Body (Shirt) - bending forward */}
                <path d="M -22 15 Q -25 30 -20 55 L 20 55 Q 25 30 22 15 Q 15 10 0 10 Q -15 10 -22 15 Z" fill="currentColor" className="text-primary dark:text-primary" />
                
                {/* Arms - reaching down to plant */}
                <rect x="-30" y="20" width="10" height="35" rx="5" fill="currentColor" className="text-primary dark:text-primary" transform="rotate(20 -25 20)" />
                <rect x="20" y="20" width="10" height="35" rx="5" fill="currentColor" className="text-primary dark:text-primary" transform="rotate(-20 25 20)" />
                
                {/* Hands holding seedling */}
                <circle cx="-20" cy="58" r="5" fill="currentColor" className="text-amber-200 dark:text-amber-300" />
                <circle cx="20" cy="58" r="5" fill="currentColor" className="text-amber-200 dark:text-amber-300" />
                
                {/* Seedling being planted */}
                <g transform="translate(0, 65)">
                  <rect x="-1" y="-10" width="2" height="10" fill="currentColor" className="text-green-600 dark:text-green-400" />
                  <ellipse cx="-4" cy="-8" rx="5" ry="2.5" fill="currentColor" className="text-green-500 dark:text-green-300" transform="rotate(-30 -4 -8)" />
                  <ellipse cx="4" cy="-6" rx="5" ry="2.5" fill="currentColor" className="text-green-500 dark:text-green-300" transform="rotate(30 4 -6)" />
                  {/* Small soil mound */}
                  <ellipse cx="0" cy="2" rx="12" ry="3" fill="currentColor" className="text-amber-800 dark:text-amber-900" />
                </g>
                
                {/* Head */}
                <circle cx="0" cy="-5" r="18" fill="currentColor" className="text-amber-200 dark:text-amber-300" />
                
                {/* Hat */}
                <ellipse cx="0" cy="-17" rx="22" ry="4" fill="currentColor" className="text-amber-700 dark:text-amber-600" />
                <path d="M -15 -17 Q -15 -33 0 -33 Q 15 -33 15 -17 Z" fill="currentColor" className="text-amber-600 dark:text-amber-500" />
                <rect x="-15" y="-19" width="30" height="3" fill="currentColor" className="text-primary" />
                
                {/* Face - smiling */}
                <circle cx="-6" cy="-7" r="1.5" fill="currentColor" className="text-gray-800 dark:text-gray-900" />
                <circle cx="6" cy="-7" r="1.5" fill="currentColor" className="text-gray-800 dark:text-gray-900" />
                <path d="M -5 1 Q 0 4 5 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" className="text-gray-800 dark:text-gray-900" />
                
                {/* Cheeks */}
                <circle cx="-10" cy="-1" r="2" fill="currentColor" className="text-pink-300/50" />
                <circle cx="10" cy="-1" r="2" fill="currentColor" className="text-pink-300/50" />
              </g>

              {/* Watering Can (near farmer) */}
              <g transform="translate(280, 310)" className="animate-float-gentle" style={{ animationDelay: '0.5s' }}>
                <path d="M -15 0 L -10 20 L 15 20 L 20 0 Z" fill="currentColor" className="text-blue-400 dark:text-blue-500" />
                <rect x="15" y="-5" width="15" height="5" rx="2" fill="currentColor" className="text-blue-400 dark:text-blue-500" />
                <circle cx="30" cy="-2" r="3" fill="currentColor" className="text-blue-300 dark:text-blue-400" />
                {/* Water drops */}
                <circle cx="32" cy="5" r="1" fill="currentColor" className="text-blue-300 dark:text-blue-400 animate-pulse" />
                <circle cx="28" cy="8" r="1" fill="currentColor" className="text-blue-300 dark:text-blue-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
              </g>

              {/* Floating Seeds/Sparkles - symbol of growth */}
              <g className="animate-float-slow">
                <circle cx="100" cy="150" r="2" fill="currentColor" className="text-yellow-400" />
                <circle cx="300" cy="180" r="2" fill="currentColor" className="text-yellow-400" />
                <circle cx="150" cy="100" r="1.5" fill="currentColor" className="text-yellow-300" />
              </g>

              {/* Clouds (Light mode only) */}
              <g className="dark:hidden animate-cloud-drift">
                <g transform="translate(80, 80)">
                  <ellipse cx="0" cy="0" rx="20" ry="10" fill="currentColor" className="text-white" />
                  <ellipse cx="15" cy="-3" rx="15" ry="8" fill="currentColor" className="text-white" />
                  <ellipse cx="-12" cy="-2" rx="12" ry="7" fill="currentColor" className="text-white" />
                </g>
              </g>
            </svg>
          </div>

          {/* Caption Text */}
          <div className="mt-8 text-center max-w-100">
            <h3 className="text-2xl font-bold text-text-primary mb-2">
              Mulai Perjalanan Anda 🌱
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Setiap benih yang ditanam adalah awal dari pertumbuhan. 
              Bergabunglah dan kembangkan bisnis pertanian Anda bersama kami.
            </p>
            
            {/* Features */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-text-secondary">Aman & Terpercaya</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Sprout className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-text-secondary">Tumbuh Bersama</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-text-secondary">Support 24/7</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================
          Kanan: FORM REGISTER
      ============================================ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-150">
          
          {/* Logo Section */}
          <div className="text-center mb-6 lg:text-left">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg bg-white">
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
            <h2 className="text-3xl font-bold text-text-primary mb-2">Buat Akun Baru </h2>
            <p className="text-text-secondary text-sm">
              Bergabunglah dengan komunitas petani dan pembeli terbesar
            </p>
          </div>

          {/* Register Form */}
          <div className="bg-surface rounded-3xl p-6 sm:p-8 shadow-xl border border-border/50">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User 
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary transition-all duration-200 ${
                      formData.name || isFocused.name 
                        ? 'opacity-0 pointer-events-none -translate-x-2' 
                        : 'opacity-100 translate-x-0'
                    }`} 
                  />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    onFocus={() => setIsFocused(prev => ({ ...prev, name: true }))}
                    onBlur={() => setIsFocused(prev => ({ ...prev, name: false }))}
                    placeholder="      Nama lengkap"
                    required
                    autoComplete="name"
                    className={`w-full input py-3 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 ${
                      formData.name || isFocused.name ? 'pl-4 pr-4' : 'pl-12 pr-4'
                    }`}
                  />
                </div>
              </div>

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

              {/* Role Select */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Saya adalah
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'buyer' })}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      formData.role === 'buyer'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">🛒</div>
                    <p className="text-sm font-semibold text-text-primary">Pembeli</p>
                    <p className="text-xs text-text-secondary">Belanja hasil tani</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'seller' })}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      formData.role === 'seller'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">🌾</div>
                    <p className="text-sm font-semibold text-text-primary">Penjual</p>
                    <p className="text-xs text-text-secondary">Jual hasil panen</p>
                  </button>
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
                    minLength={6}
                    autoComplete="new-password"
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
                
                {/* ✅ Password Strength Indicator */}
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            level <= passwordStrength 
                              ? strengthColors[passwordStrength] 
                              : 'bg-border'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${
                      passwordStrength <= 2 ? 'text-red-500' :
                      passwordStrength <= 3 ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      Kekuatan: {strengthLabels[passwordStrength]}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Lock 
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary transition-all duration-200 ${
                      formData.confirmPassword || isFocused.confirmPassword 
                        ? 'opacity-0 pointer-events-none -translate-x-2' 
                        : 'opacity-100 translate-x-0'
                    }`} 
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    onFocus={() => setIsFocused(prev => ({ ...prev, confirmPassword: true }))}
                    onBlur={() => setIsFocused(prev => ({ ...prev, confirmPassword: false }))}
                    placeholder="      ••••••••"
                    required
                    autoComplete="new-password"
                    className={`w-full input py-3 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 ${
                      formData.confirmPassword || isFocused.confirmPassword ? 'pl-4 pr-4' : 'pl-12 pr-4'
                    }`}
                  />
                </div>
                {/* Password match validation */}
                {formData.confirmPassword && formData.password && (
                  <p className={`text-xs mt-1 ml-1 flex items-center gap-1 ${
                    formData.password === formData.confirmPassword 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    {formData.password === formData.confirmPassword ? (
                      <>
                        <CheckCircle className="w-3 h-3" /> Password cocok
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" /> Password tidak cocok
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-200 text-sm flex items-start gap-2 animate-fade-in">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-4 text-base rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Membuat akun...</span>
                  </>
                ) : (
                  <>
                    <Sprout className="w-5 h-5" />
                    Daftar Sekarang
                  </>
                )}
              </button>

              {/* Terms */}
              <p className="text-xs text-center text-text-secondary mt-2">
                Dengan mendaftar, Anda menyetujui{' '}
                <Link href="/terms" className="text-primary hover:underline">Syarat & Ketentuan</Link>
                {' '}kami
              </p>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-surface text-text-secondary">sudah punya akun?</span>
              </div>
            </div>

            {/* Login Link */}
            <div className="text-center">
              <Link
                href={`/login${callbackUrl !== '/' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
                className="btn-outline w-full py-3 font-semibold inline-flex items-center justify-center gap-2"
              >
                Masuk ke Akun
              </Link>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-text-secondary/70">© 2025 Agri X. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>   
  );
}
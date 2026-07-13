// next.config.ts
import type { NextConfig } from 'next';

// const LARAVEL_URL = process.env.LARAVEL_URL || 'http://localhost:8000';

const nextConfig: NextConfig = {
  // ✅ IZINKAN AKSES DARI JARINGAN LOKAL (Development Only)
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.0.150',
    '192.168.1.*',
    '*.local',
'alongside-pauper-playlist.ngrok-free.dev',

  ],

  // ✅ Konfigurasi Image Optimization
  images: {
    remotePatterns: [
      // Local development
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/products/**',
      },
      {
        protocol: 'http',
        hostname: '192.168.0.150',
        port: '3000',
        pathname: '/**',
      },
      
      // ✅ API.CO.ID
      {
        protocol: 'https',
        hostname: 'api.co.id',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.api.co.id',
        pathname: '/**',
      },
      
      // ✅ Image hosting umum
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.pixabay.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        pathname: '/**',
      },
      
      // ✅ TAMBAHKAN INI: cdn.ralali.id (untuk gambar produk)
      {
        protocol: 'https',
        hostname: 'cdn.ralali.id',
        pathname: '/**',
      },
      
      // ✅ Opsional: Tambah domain lain yang mungkin dipakai
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.prb.co.id',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'garudaseed.co.id',
        pathname: '/**',
      },
    ],
    // ✅ Optimasi tambahan
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
  },

  // ✅ Environment Variables untuk Client
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
    NEXT_PUBLIC_API_CO_ID_KEY: process.env.NEXT_PUBLIC_API_CO_ID_KEY || '',
  },

  // ✅ Opsional: Konfigurasi tambahan
  reactStrictMode: true,
  trailingSlash: false,
  compress: true,

  // ✅ PROXY KE LARAVEL — fitur Affiliate Program (masih dilayani Laravel)
  // Browser tetap lihat domain Node, tapi konten/AJAX-nya ditembusin ke Laravel.
  // async rewrites() {
  //   return [
  //     // Halaman pendaftaran affiliate
  //     { source: '/daftar-affiliate', destination: `${LARAVEL_URL}/daftar-affiliate` },

  //     // Semua AJAX yang dipanggil daftar-affiliate.js:
  //     //   POST /affiliate/daftar
  //     //   POST /affiliate/sosmed/request-verification
  //     //   POST /affiliate/check-verification-status
  //     //   GET  /affiliate/verify-sosmed
  //     //   GET  /affiliate/sosmed/verify/result
  //     { source: '/affiliate/:path*', destination: `${LARAVEL_URL}/affiliate/:path*` },

  //     // Asset yang dipakai halaman ini
  //     { source: '/css/daftar-affiliate.css', destination: `${LARAVEL_URL}/css/daftar-affiliate.css` },
  //     { source: '/js/daftar-affiliate.js', destination: `${LARAVEL_URL}/js/daftar-affiliate.js` },
  //     { source: '/images/Agri-XLogo.png', destination: `${LARAVEL_URL}/images/Agri-XLogo.png` },
  //   ];
  // },
};

export default nextConfig;
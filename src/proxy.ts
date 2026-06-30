// src/proxy.ts - Hapus semua console.log yang tidak perlu
import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_CONFIGS = {
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10, message: 'Terlalu banyak percobaan login.' },
  register: { windowMs: 60 * 60 * 1000, maxRequests: 5, message: 'Terlalu banyak registrasi.' },
  seller: { windowMs: 60 * 1000, maxRequests: 1000, message: 'Terlalu banyak request.' },
  catalog: { windowMs: 60 * 1000, maxRequests: 500, message: 'Terlalu banyak akses katalog.' },
  productDetail: { windowMs: 60 * 1000, maxRequests: 300, message: 'Terlalu banyak melihat detail.' },
  cart: { windowMs: 60 * 1000, maxRequests: 100, message: 'Terlalu cepat menambah ke keranjang.' },
  checkout: { windowMs: 60 * 1000, maxRequests: 30, message: 'Terlalu banyak checkout.' },
  forum: { windowMs: 60 * 1000, maxRequests: 300, message: 'Terlalu banyak akses forum.' },
  userAction: { windowMs: 60 * 1000, maxRequests: 200, message: 'Terlalu banyak request.' },
  apiDefault: { windowMs: 60 * 1000, maxRequests: 500, message: 'Terlalu banyak request API.' },
};

const requestCounts = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (value.resetTime < now) requestCounts.delete(key);
  }
}, 5 * 60 * 1000);

function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

function getEndpointCategory(pathname: string, method: string): keyof typeof RATE_LIMIT_CONFIGS {
  if (pathname.startsWith('/api/auth/login') || 
      pathname.startsWith('/api/auth/forgot-password') ||
      pathname.startsWith('/api/auth/reset-password')) return 'auth';
  if (pathname.startsWith('/api/auth/register')) return 'register';
  if (pathname.startsWith('/api/seller/')) return 'seller';
  if (pathname.startsWith('/api/cart')) return 'cart';
  if (pathname.startsWith('/api/orders') || pathname.startsWith('/api/checkout')) return 'checkout';
  if (pathname.startsWith('/api/forum')) return 'forum';
  if (method === 'GET' && /\/api\/products\/\d+$/.test(pathname)) return 'productDetail';
  if (method === 'GET' && pathname.startsWith('/api/products')) return 'catalog';
  if (
    pathname.startsWith('/api/address') ||
    pathname.startsWith('/api/reviews') ||
    pathname.startsWith('/api/users') ||
    pathname.startsWith('/api/rajaongkir') ||
    pathname.startsWith('/api/locations') ||
    pathname.startsWith('/api/payment') ||
    pathname.startsWith('/api/vouchers')
  ) return 'userAction';
  return 'apiDefault';
}

function rateLimit(identifier: string, category: keyof typeof RATE_LIMIT_CONFIGS, skipForLocalhost = false) {
  const config = RATE_LIMIT_CONFIGS[category];
  const now = Date.now();
  const key = `${category}:${identifier}`;

  if (skipForLocalhost && isLocalhost(identifier)) {
    return { allowed: true, remaining: config.maxRequests, resetTime: now + config.windowMs, limit: config.maxRequests, skipped: true };
  }

  let record = requestCounts.get(key);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + config.windowMs };
  }

  record.count++;
  requestCounts.set(key, record);

  const remaining = Math.max(0, config.maxRequests - record.count);

  if (record.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime, limit: config.maxRequests, skipped: false };
  }

  return { allowed: true, remaining, resetTime: record.resetTime, limit: config.maxRequests, skipped: false };
}

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const allowedOrigins = [
  'http://localhost:3000',
  'http://192.168.0.150:3000',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean);

function getCorsHeaders(origin: string | null) {
  if (origin && allowedOrigins.includes(origin)) {
    return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' };
  }
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'false' };
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method || 'GET';
  
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             req.headers.get('x-real-ip') || 
             '127.0.0.1';

  const isLocal = isLocalhost(ip);
  let rateLimitResult: ReturnType<typeof rateLimit> | null = null;
  let category: keyof typeof RATE_LIMIT_CONFIGS | null = null;

  if (pathname.startsWith('/api/')) {
    category = getEndpointCategory(pathname, method);
    rateLimitResult = rateLimit(ip, category, true);
    const config = RATE_LIMIT_CONFIGS[category];

    // ✅ HAPUS semua console.log kecuali error
    if (!rateLimitResult.allowed && !rateLimitResult.skipped) {
      const resetIn = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);

      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'RATE_LIMITED',
          message: config.message,
          retryAfter: resetIn,
          category,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': resetIn.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            'X-RateLimit-Category': category,
          },
        }
      );
    }
  }

  const response = NextResponse.next();

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  if (pathname.startsWith('/api/') && rateLimitResult && category) {
    const config = RATE_LIMIT_CONFIGS[category];
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
    response.headers.set('X-RateLimit-Category', category);
    if (rateLimitResult.skipped) {
      response.headers.set('X-RateLimit-Skipped', 'true');
    }
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
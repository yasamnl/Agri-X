// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server';

// ============================================
// ✅ CONFIG PER ENDPOINT CATEGORY (GRANULAR)
// ============================================
const RATE_LIMIT_CONFIGS = {
  // 🟢 KATALOG & PRODUCTS (Longgar - user sering browse)
  catalog: {
    windowMs: 60 * 1000,      // 1 menit
    maxRequests: 200,         // 200 request/menit
    message: 'Terlalu banyak akses katalog. Coba lagi sebentar.',
  },
  
  productDetail: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Terlalu banyak melihat detail produk.',
  },
  
  // 🟡 CART & CHECKOUT (Moderate)
  cart: {
    windowMs: 60 * 1000,
    maxRequests: 60,          // ✅ 60 add-to-cart per menit (cukup longgar)
    message: 'Terlalu cepat menambah ke keranjang. Tunggu sebentar.',
  },
  
  checkout: {
    windowMs: 60 * 1000,
    maxRequests: 15,
    message: 'Terlalu banyak checkout. Silakan coba lagi.',
  },
  
  // 🔴 AUTH ENDPOINTS (Ketat - cegah brute force)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 menit
    maxRequests: 10,
    message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
  },
  
  register: {
    windowMs: 60 * 60 * 1000, // 1 jam
    maxRequests: 5,
    message: 'Terlalu banyak registrasi. Coba lagi nanti.',
  },
  
  // 🟠 FORUM (Moderate)
  forum: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Terlalu banyak akses forum.',
  },
  
  // 🔵 API DEFAULT (untuk endpoint lain)
  apiDefault: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Terlalu banyak request API.',
  },
};

// ============================================
// RATE LIMITER STORAGE
// ============================================
// Key format: `${category}:${ip}`
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// ✅ Auto cleanup setiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (value.resetTime < now) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================
// ✅ HELPER: Tentukan kategori endpoint
// ============================================
function getEndpointCategory(pathname: string, method: string): keyof typeof RATE_LIMIT_CONFIGS {
  // Auth endpoints (paling ketat)
  if (pathname.startsWith('/api/auth/login') || 
      pathname.startsWith('/api/auth/forgot-password') ||
      pathname.startsWith('/api/auth/reset-password')) {
    return 'auth';
  }
  
  if (pathname.startsWith('/api/auth/register')) {
    return 'register';
  }
  
  // Cart endpoints
  if (pathname.startsWith('/api/cart')) {
    return 'cart';
  }
  
  // Checkout/Orders
  if (pathname.startsWith('/api/orders') || pathname.startsWith('/api/checkout')) {
    return 'checkout';
  }
  
  // Forum
  if (pathname.startsWith('/api/forum')) {
    return 'forum';
  }
  
  // Product detail (GET /api/products/[id])
  if (method === 'GET' && /\/api\/products\/\d+$/.test(pathname)) {
    return 'productDetail';
  }
  
  // Catalog (GET /api/products)
  if (method === 'GET' && pathname.startsWith('/api/products')) {
    return 'catalog';
  }
  
  // Default untuk API lain
  if (pathname.startsWith('/api/')) {
    return 'apiDefault';
  }
  
  return 'apiDefault';
}

// ============================================
// ✅ RATE LIMIT FUNCTION (Updated)
// ============================================
function rateLimit(
  identifier: string, 
  category: keyof typeof RATE_LIMIT_CONFIGS
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
} {
  const config = RATE_LIMIT_CONFIGS[category];
  const now = Date.now();
  const key = `${category}:${identifier}`; // ✅ Unique key per category
  
  let record = requestCounts.get(key);
  
  // Reset window if expired atau belum ada
  if (!record || now > record.resetTime) {
    record = { 
      count: 0, 
      resetTime: now + config.windowMs 
    };
  }
  
  const remaining = Math.max(0, config.maxRequests - record.count);
  
  if (record.count >= config.maxRequests) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetTime: record.resetTime,
      limit: config.maxRequests 
    };
  }
  
  record.count++;
  requestCounts.set(key, record);
  
  return { 
    allowed: true, 
    remaining: config.maxRequests - record.count, 
    resetTime: record.resetTime,
    limit: config.maxRequests 
  };
}

// ============================================
// SECURITY HEADERS
// ============================================
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ============================================
// CORS CONFIG
// ============================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://192.168.0.150:3000',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean);

function getCorsHeaders(origin: string | null) {
  if (origin && allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'false',
  };
}

// ============================================
// PROXY MIDDLEWARE
// ============================================
export function proxy(req: NextRequest) {
  const { pathname, method } = req.nextUrl;
  
  // Get client IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             req.headers.get('x-real-ip') || 
             '127.0.0.1';

  // ============================================
  // ✅ 1. GRANULAR RATE LIMITING PER ENDPOINT
  // ============================================
  
  if (pathname.startsWith('/api/')) {
    const category = getEndpointCategory(pathname, method);
    const rateLimitResult = rateLimit(ip, category);
    const config = RATE_LIMIT_CONFIGS[category];
    
    if (!rateLimitResult.allowed) {
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
          } 
        }
      );
    }
  }

  // ============================================
  // 2. CREATE RESPONSE
  // ============================================
  
  const response = NextResponse.next();

  // ============================================
  // 3. ADD SECURITY HEADERS
  // ============================================
  
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // ============================================
  // 4. ADD CORS HEADERS
  // ============================================
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // ============================================
  // 5. ALLOWED METHODS
  // ============================================
  
  response.headers.set(
    'Access-Control-Allow-Methods', 
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers', 
    'Content-Type, Authorization, X-Requested-With'
  );

  // ============================================
  // 6. HANDLE PREFLIGHT
  // ============================================
  
  if (method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  // ============================================
  // ✅ 7. ADD RATE LIMIT HEADERS (untuk debugging)
  // ============================================
  
  if (pathname.startsWith('/api/')) {
    const category = getEndpointCategory(pathname, method);
    const rateLimitResult = rateLimit(ip, category);
    const config = RATE_LIMIT_CONFIGS[category];
    
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
    response.headers.set('X-RateLimit-Category', category);
  }

  return response;
}

// ============================================
// CONFIG
// ============================================
export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
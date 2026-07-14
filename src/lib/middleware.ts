// src/app/middleware.ts
import { NextResponse, NextRequest } from "next/server";
import { verifyAccessTokenServer } from "@/lib/auth";

// Middleware utama untuk Next.js
// Menangani autentikasi, authorization, dan tracking referral
// Fitur:
// 1. Tracking referral code dari URL parameter (?ref=XXX)
// 2. Proteksi route berdasarkan role (user, admin, seller)
// 3. Redirect otomatis untuk auth routes
// 4. Helper functions untuk API error handling
export function middleware(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  const { pathname, search } = request.nextUrl;

  // TRACK REFERRAL CODE (?ref=XXX)
  const refCode = request.nextUrl.searchParams.get("ref");

  if (refCode) {
    if (process.env.NODE_ENV === "development")
      console.log(`🔗 [REFERRAL] Detected: ${refCode} on ${pathname}`);

    // Track click via API (fire & forget, tidak block request)
    fetch(`${request.nextUrl.origin}/api/affiliate/track?code=${refCode}`, {
      method: "GET",
      headers: {
        "x-forwarded-for": request.headers.get("x-forwarded-for") || "unknown",
        "user-agent": request.headers.get("user-agent") || "unknown",
      },
    }).catch((err) => console.error("Track click error:", err));

    // Set cookie untuk tracking (30 hari)
    const response = NextResponse.next();
    response.cookies.set("referral_code", refCode, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  }

  // HELPER: Build callback URL yang aman
  //  Membuat callback URL yang aman untuk redirect setelah login
  //  Mencegah URL injection dan path traversal
  function buildCallbackUrl(): string {
    const fullPath = pathname + search;

    // Sanitasi: pastikan path dimulai dengan '/' dan tidak double slash
    if (!fullPath.startsWith("/") || fullPath.startsWith("//")) {
      return "/";
    }

    return encodeURIComponent(fullPath);
  }

  // PROTECTED ROUTES (WAJIB LOGIN)
  //  * Route yang memerlukan autentikasi (user harus login)
  //  * Jika tidak login, redirect ke /login dengan callbackUrl
  const protectedRoutes = [
    "/cart",
    "/checkout",
    "/akun",
    "/orders",
    "/forum",
    "/affiliate",
  ];

  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!token) {
      const callbackUrl = buildCallbackUrl();
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    const decoded = verifyAccessTokenServer(token);
    if (!decoded) {
      const callbackUrl = buildCallbackUrl();
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", callbackUrl);

      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("accessToken");
      response.cookies.delete("refreshToken");
      return response;
    }
  }

  //AUTH ROUTES (REDIRECT JIKA SUDAH LOGIN)
  //   Route autentikasi (login/register)
  //   Jika user sudah login, redirect ke halaman sebelumnya atau home
  const authRoutes = ["/login", "/register"];

  if (authRoutes.some((route) => pathname === route)) {
    if (token) {
      const decoded = verifyAccessTokenServer(token);
      if (decoded) {
        const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
        const redirectTo = callbackUrl ? decodeURIComponent(callbackUrl) : "/";

        // Sanitasi: cegah redirect ke external URL
        if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
          return NextResponse.redirect(new URL(redirectTo, request.url));
        }
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }
  // ADMIN ROUTES (HANYA ADMIN)
  //  Route khusus admin
  //  Memerlukan autentikasi dan role 'admin'
  //  Jika tidak admin, redirect ke home
  const adminRoutes = ["/admin", "/dashboard"];

  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    if (!token) {
      const callbackUrl = buildCallbackUrl();
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    const decoded = verifyAccessTokenServer(token);
    if (!decoded || decoded.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ✅ 6. SELLER ROUTES (HANYA SELLER)
  // Route khusus seller
  // Memerlukan autentikasi dan role 'seller'
  // Jika tidak seller, redirect ke /akun
  if (pathname.startsWith("/seller")) {
    if (!token) {
      const callbackUrl = buildCallbackUrl();
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    const decoded = verifyAccessTokenServer(token);
    if (!decoded || decoded.role !== "seller") {
      return NextResponse.redirect(new URL("/akun", request.url));
    }
  }

  return NextResponse.next();
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

// ERROR HANDLER

// /Handler untuk menangani error di API routes
// Memetakan error message ke response JSON yang sesuai
export const handleAPIError = (error: any, context: string = "API") => {
  console.error(`[${context}] Error:`, error);

  //   Mapping error message ke response yang sesuai
  const errorResponses: Record<
    string,
    { message: string; status: number; code: string }
  > = {
    "Invalid JSON": {
      message: "Invalid JSON in request body",
      status: 400,
      code: "INVALID_JSON",
    },
    "Insufficient stock": {
      message: error.message,
      status: 400,
      code: "INSUFFICIENT_STOCK",
    },
    "not found": {
      message: "Resource not found",
      status: 404,
      code: "NOT_FOUND",
    },
    "Product not found or deleted": {
      message: error.message,
      status: 404,
      code: "PRODUCT_NOT_FOUND",
    },
    "Product is currently sold out": {
      message: error.message,
      status: 400,
      code: "PRODUCT_SOLD_OUT",
    },
    "Quantity must be at least": {
      message: error.message,
      status: 400,
      code: "QUANTITY_BELOW_MIN",
    },
    "Product not found in cart": {
      message: error.message,
      status: 404,
      code: "CART_ITEM_NOT_FOUND",
    },
    "Product is currently unavailable": {
      message: error.message,
      status: 400,
      code: "PRODUCT_UNAVAILABLE",
    },
    Unauthorized: {
      message: "Unauthorized",
      status: 401,
      code: "UNAUTHORIZED",
    },
    "Invalid token": {
      message: "Invalid token",
      status: 401,
      code: "INVALID_TOKEN",
    },
  };

  for (const [key, config] of Object.entries(errorResponses)) {
    if (error.message?.includes(key)) {
      return NextResponse.json(
        { success: false, error: config.message, code: config.code },
        { status: config.status }
      );
    }
  }

  // Default error response untuk unknown error
  return NextResponse.json(
    { success: false, error: "Internal Server Error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
};

// API RESPONSE FORMATTER
//  * Helper untuk membuat response API yang konsisten
export const apiResponse = {
  //  * Response sukses
  success: (data: any, message?: string, status: number = 200) => {
    return NextResponse.json({ success: true, data, message }, { status });
  },

  //  * Response error
  error: (error: string, code?: string, status: number = 400) => {
    return NextResponse.json({ success: false, error, code }, { status });
  },
};

// WRAPPER FOR AUTH + RATE LIMIT

//  * Higher-order function untuk membungkus API handler
export const withAuthAndRateLimit = (handler: Function) => {
  return async (req: NextRequest, { params }: { params?: any }) => {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    const user = requireAuth(token);

    if (!user) {
      return apiResponse.error("Unauthorized", "UNAUTHORIZED", 401);
    }

    try {
      return await handler(req, { params, user });
    } catch (error) {
      return handleAPIError(error, "API_WRAPPER");
    }
  };
};

// REQUEST VALIDATOR
//  * Validasi request body untuk memastikan semua field wajib terisi
export const validateRequest = (body: any, requiredFields: string[]) => {
  const missing = requiredFields.filter((field) => !body[field]);

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Field wajib diisi: ${missing.join(", ")}`,
      code: "MISSING_FIELDS",
    };
  }

  return { valid: true };
};

//  * Memverifikasi token dan mengembalikan user data
//  * Digunakan oleh withAuthAndRateLimit wrapper
function requireAuth(token: string | undefined) {
  if (!token) return null;

  const user = verifyAccessTokenServer(token);
  return user || null;
}

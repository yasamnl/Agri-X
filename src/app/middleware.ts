import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname, searchParams } = url;

  // Track referral clicks for catalog pages
  if (pathname.startsWith('/produk/') || pathname === '/katalog') {
    const ref = searchParams.get('ref');
    const platform = searchParams.get('platform') || 'direct';

    if (ref) {
      // Track the click asynchronously
      const trackUrl = new URL('/api/affiliate/track-click', request.url);
      trackUrl.searchParams.set('ref', ref);
      trackUrl.searchParams.set('platform', platform);

      // Store the referer for tracking
      const headers = new Headers(request.headers);
      headers.set('x-original-url', request.url);
      
      // Don't wait for the tracking to complete
      // We'll call it asynchronously
      fetch(trackUrl.toString(), {
        headers: {
          'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
          'user-agent': request.headers.get('user-agent') || '',
          'referer': request.headers.get('referer') || ''
        }
      }).catch(error => console.error('Tracking error:', error));

      // Remove ref from URL before serving the page to avoid duplicate tracking
      // but keep it for the user experience
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/produk/:path*', '/katalog']
};
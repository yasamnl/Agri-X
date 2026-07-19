// app/api/affiliate/track-click/route.ts

import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USERNAME || process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ============================================
// DETECT PLATFORM
// Porting dari ReferralController@detectPlatform (Laravel)
// Deteksi otomatis dari referer, user-agent, dan utm_source
// ============================================
function detectPlatform(request: NextRequest): string {
  const referer = (request.headers.get('referer') || '').toLowerCase();
  const userAgent = (request.headers.get('user-agent') || '').toLowerCase();
  const utmSource = (request.nextUrl.searchParams.get('utm_source') || '').toLowerCase();

  const checks: Record<string, string[]> = {
    'Instagram': ['instagram'],
    'TikTok': ['tiktok'],
    'Facebook': ['facebook', 'fb'],
    'WhatsApp': ['whatsapp'],
    'Twitter/X': ['twitter', 't.co', 'x.com'],
    'YouTube': ['youtube', 'youtu.be'],
    'Telegram': ['telegram', 't.me'],
    'LINE': ['line.me', 'line/'],
    'Pinterest': ['pinterest'],
    'Snapchat': ['snapchat'],
    'LinkedIn': ['linkedin'],
  };

  for (const [platform, keywords] of Object.entries(checks)) {
    for (const kw of keywords) {
      if (utmSource.includes(kw) || referer.includes(kw) || userAgent.includes(kw)) {
        return platform;
      }
    }
  }

  // Ada referer tapi bukan sosmed yang dikenal
  if (referer !== '') {
    try {
      const host = new URL(referer).host;
      return `Other (${host})`;
    } catch {
      return 'Other';
    }
  }

  return 'Direct / Unknown';
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ref = searchParams.get('ref');
    const platform = detectPlatform(request);
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    if (!ref) {
      return NextResponse.json(
        { success: false, error: 'Referral code required' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    
    try {
      // Verifikasi affiliate
      const [affiliates] = await connection.execute(
        'SELECT id FROM affiliate_applications WHERE id = ? AND status = "approved"',
        [parseInt(ref)]
      );

      const affiliateRows = affiliates as any[];
      
      if (!affiliateRows || affiliateRows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid referral code' },
          { status: 404 }
        );
      }

      const affiliateId = affiliateRows[0].id;

      // Insert dengan platform (auto-detect) dan user agent
      await connection.execute(
        `INSERT INTO referral_clicks 
         (affiliate_application_id, ip_address, user_agent, platform, referer, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [affiliateId, ipAddress, userAgent, platform, referer]
      );

      console.log(`✅ Click tracked: affiliate=${affiliateId}, platform=${platform}`);

      return NextResponse.json({
        success: true,
        message: 'Click tracked successfully',
        data: { platform, affiliateId }
      });

    } catch (error) {
      console.error('Error tracking referral click:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to track click' },
        { status: 500 }
      );
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error in track-click API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
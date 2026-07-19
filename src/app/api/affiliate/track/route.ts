// src/app/api/affiliate/track/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateByCode, trackReferralClick } from '@/lib/affiliate';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Referral code required' },
        { status: 400 }
      );
    }

    // 1. Get affiliate by code
    const affiliate = await getAffiliateByCode(code);
    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    // 2. Get IP & user agent
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // 3. Track click
    const result = await trackReferralClick(affiliate.id, ip, userAgent);

    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      message: 'Click tracked successfully',
    });

  } catch (error: any) {
    console.error('❌ Track click error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
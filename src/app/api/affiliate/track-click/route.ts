// src/app/api/affiliate/track-click/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referralCode, ipAddress, userAgent } = body;

    if (!referralCode) {
      return NextResponse.json(
        { success: false, error: 'Referral code required' },
        { status: 400 }
      );
    }

    // Find affiliate application
    const [applications] = await pool.query(
      'SELECT id FROM affiliate_applications WHERE referral_code = ? AND status = \'approved\'',
      [referralCode]
    );

    if (!applications[0]) {
      return NextResponse.json(
        { success: false, error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    const affiliateId = applications[0].id;

    // Track click
    await pool.query(
      `INSERT INTO referral_clicks 
       (affiliate_application_id, ip_address, user_agent, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [affiliateId, ipAddress || 'unknown', userAgent || 'unknown']
    );

    return NextResponse.json({
      success: true,
      message: 'Click tracked',
    });

  } catch (error: any) {
    console.error('Track click error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
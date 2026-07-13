// File: src/app/api/affiliate/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;

    // Get affiliate application status
    const [applications] = (await pool.query(
      `SELECT id, status, referral_code, approved_at, rejected_at, rejection_reason, created_at
       FROM affiliate_applications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    )) as any;

    const application = applications[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        status: application ? application.status : 'not_registered',
        application: application ? {
          id: application.id,
          referralCode: application.referral_code,
          approvedAt: application.approved_at,
          rejectedAt: application.rejected_at,
          rejectionReason: application.rejection_reason,
          createdAt: application.created_at
        } : null
      }
    });

  } catch (error: any) {
    console.error('Error fetching affiliate status:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch affiliate status' },
      { status: 500 }
    );
  }
}
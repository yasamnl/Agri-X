// src/app/api/admin/affiliates/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const [rows] = await pool.query(
      `SELECT
        COUNT(*) as total_applications,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
      FROM affiliate_applications`
    );

    const row = (rows as any[])[0] || {};

    return NextResponse.json({
      success: true,
      data: {
        totalApplications: Number(row.total_applications || 0),
        pendingCount: Number(row.pending_count || 0),
        approvedCount: Number(row.approved_count || 0),
        rejectedCount: Number(row.rejected_count || 0),
      },
    });
  } catch (error: any) {
    console.error('❌ Get affiliates stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
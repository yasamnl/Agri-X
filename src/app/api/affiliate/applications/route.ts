// File: src/app/api/admin/affiliate/applications/route.ts

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

    // Check if user is admin
    const [users] = await pool.query(
      `SELECT role FROM users WHERE id = ?`,
      [decoded.sub]
    );

    if (!users[0] || users[0].role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        aa.id, aa.user_id, aa.status, aa.referral_code, aa.created_at, aa.approved_at, aa.rejected_at,
        u.nama_lengkap, u.email,
        GROUP_CONCAT(CONCAT(asm.platform, ':', asm.link) SEPARATOR '|') as social_media
      FROM affiliate_applications aa
      JOIN users u ON aa.user_id = u.id
      LEFT JOIN affiliate_social_media asm ON aa.id = asm.affiliate_application_id
    `;

    const params: any[] = [];

    if (status && status !== 'all') {
      query += ` WHERE aa.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY aa.id ORDER BY aa.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [applications] = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM affiliate_applications aa`;
    const countParams: any[] = [];

    if (status && status !== 'all') {
      countQuery += ` WHERE aa.status = ?`;
      countParams.push(status);
    }

    const [countResult] = await pool.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      success: true,
      data: {
        applications: applications.map((app: any) => ({
          id: app.id,
          userId: app.user_id,
          namaLengkap: app.nama_lengkap,
          email: app.email,
          status: app.status,
          referralCode: app.referral_code,
          socialMedia: app.social_media ? app.social_media.split('|').map((sm: string) => {
            const [platform, link] = sm.split(':');
            return { platform, link };
          }) : [],
          createdAt: app.created_at,
          approvedAt: app.approved_at,
          rejectedAt: app.rejected_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error: any) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}
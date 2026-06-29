// src/app/api/admin/affiliates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
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
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 100);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      conditions.push('aa.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ? OR aa.referral_code LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch applications
    const [applications] = await pool.query(
      `SELECT 
        aa.id,
        aa.user_id,
        aa.sosmed_accounts,
        aa.status,
        aa.approved_at,
        aa.rejected_at,
        aa.referral_code,
        aa.created_at,
        aa.updated_at,
        u.name,
        u.email,
        u.no_telp,
        u.avatar,
        (SELECT COUNT(*) FROM referral_clicks rc WHERE rc.affiliate_application_id = aa.id) as total_clicks,
        (SELECT COUNT(*) FROM referral_transactions rt WHERE rt.affiliate_application_id = aa.id AND rt.status = 'completed') as total_transactions,
        (SELECT COALESCE(SUM(rt.nominal_transaksi), 0) FROM referral_transactions rt WHERE rt.affiliate_application_id = aa.id AND rt.status = 'completed') as total_revenue,
        (SELECT COALESCE(SUM(rt.komisi), 0) FROM referral_transactions rt WHERE rt.affiliate_application_id = aa.id AND rt.status = 'completed') as total_commission
      FROM affiliate_applications aa
      JOIN users u ON aa.user_id = u.id
      ${whereClause}
      ORDER BY aa.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM affiliate_applications aa
       JOIN users u ON aa.user_id = u.id
       ${whereClause}`,
      params
    );

    const total = countResult[0]?.total || 0;

    // Get status counts
    const [statusCounts] = await pool.query(
      `SELECT status, COUNT(*) as count FROM affiliate_applications GROUP BY status`
    );

    const statusCountMap: Record<string, number> = {};
    statusCounts.forEach((row: any) => {
      statusCountMap[row.status] = Number(row.count);
    });

    // Format response
    const formattedApplications = applications.map((app: any) => ({
      id: Number(app.id),
      userId: Number(app.user_id),
      sosmedAccounts: app.sosmed_accounts ? JSON.parse(app.sosmed_accounts) : [],
      status: app.status,
      approvedAt: app.approved_at,
      rejectedAt: app.rejected_at,
      referralCode: app.referral_code,
      createdAt: app.created_at,
      updatedAt: app.updated_at,
      user: {
        id: Number(app.user_id),
        name: app.name,
        email: app.email,
        phone: app.no_telp,
        avatar: app.avatar,
      },
      stats: {
        totalClicks: Number(app.total_clicks),
        totalTransactions: Number(app.total_transactions),
        totalRevenue: Number(app.total_revenue),
        totalCommission: Number(app.total_commission),
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        applications: formattedApplications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        statusCounts: {
          all: total,
          pending: statusCountMap['pending'] || 0,
          approved: statusCountMap['approved'] || 0,
          rejected: statusCountMap['rejected'] || 0,
        },
      },
    });

  } catch (error: any) {
    console.error('Get affiliates error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
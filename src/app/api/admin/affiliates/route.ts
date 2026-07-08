// src/app/api/admin/affiliates/route.ts
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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 50);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status !== 'all') {
      whereClause += ' AND aa.status = ?';
      params.push(status);
    }

    if (search.trim()) {
      whereClause += ' AND (u.name LIKE ? OR u.email LIKE ? OR aa.referral_code LIKE ?)';
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    const [applications] = await pool.query(
      `SELECT 
        aa.id,
        aa.user_id,
        aa.sosmed_accounts,
        aa.status,
        aa.referral_code,
        aa.approved_at,
        aa.rejected_at,
        aa.created_at,
        aa.updated_at,
        u.name as user_name,
        u.email as user_email,
        u.no_telp as user_phone,
        u.avatar as user_avatar,
        (SELECT COUNT(*) FROM referral_transactions rt 
         WHERE rt.affiliate_application_id = aa.id) as total_orders,
        (SELECT COALESCE(SUM(rt.nominal_transaksi), 0) FROM referral_transactions rt 
         WHERE rt.affiliate_application_id = aa.id AND rt.status = 'completed') as total_revenue,
        (SELECT COALESCE(SUM(rt.komisi), 0) FROM referral_transactions rt 
         WHERE rt.affiliate_application_id = aa.id AND rt.status = 'completed') as total_commission,
        (SELECT COUNT(*) FROM referral_clicks rc 
         WHERE rc.affiliate_application_id = aa.id) as total_clicks
      FROM affiliate_applications aa
      INNER JOIN users u ON aa.user_id = u.id
      ${whereClause}
      ORDER BY aa.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM affiliate_applications aa
       INNER JOIN users u ON aa.user_id = u.id
       ${whereClause}`,
      params
    );

    const total = Number((countResult as any[])[0]?.total || 0);

    // ✅ PARSE JSON sosmed_accounts
    const formattedApps = (applications as any[]).map((app) => {
      let sosmedAccounts = [];
      
      try {
        // ✅ Parse JSON string menjadi array
        if (app.sosmed_accounts) {
          if (typeof app.sosmed_accounts === 'string') {
            sosmedAccounts = JSON.parse(app.sosmed_accounts);
          } else if (Array.isArray(app.sosmed_accounts)) {
            sosmedAccounts = app.sosmed_accounts;
          }
        }
      } catch (error) {
        console.error('Error parsing sosmed_accounts:', error);
        sosmedAccounts = [];
      }

      return {
        id: Number(app.id),
        userId: Number(app.user_id),
        sosmedAccounts: sosmedAccounts, // ✅ Array yang sudah di-parse
        status: app.status,
        referralCode: app.referral_code || '',
        approvedAt: app.approved_at,
        rejectedAt: app.rejected_at,
        createdAt: app.created_at,
        updatedAt: app.updated_at,
        user: {
          id: Number(app.user_id),
          name: app.user_name,
          email: app.user_email,
          phone: app.user_phone,
          avatar: app.user_avatar,
        },
        stats: {
          totalOrders: Number(app.total_orders || 0),
          totalRevenue: Number(app.total_revenue || 0),
          totalCommission: Number(app.total_commission || 0),
          totalClicks: Number(app.total_clicks || 0),
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        applications: formattedApps,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });

  } catch (error: any) {
    console.error('❌ Get affiliates error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
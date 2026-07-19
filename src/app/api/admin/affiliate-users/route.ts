import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status') || 'all';
    const search = url.searchParams.get('search') || '';

    const offset = (page - 1) * limit;

    let whereClause = 'aa.approved_at IS NOT NULL';
    const params: any[] = [];

    if (status !== 'all') {
      whereClause += ' AND aa.affiliate_status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Total count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total
       FROM affiliate_applications aa
       JOIN users u ON aa.user_id = u.id
       WHERE ${whereClause}`,
      params
    );
    const total = (countRows as any[])[0]?.total || 0;

    // Data with total commission
    const [rows] = await pool.query(
      `SELECT 
         aa.id as application_id,
         aa.user_id,
         aa.affiliate_status as status,
         aa.approved_at as joinedAt,
         aa.sosmed_accounts as sosmedAccounts,
         u.name,
         u.email,
         u.avatar,
         COALESCE(SUM(rt.komisi), 0) as totalCommission
       FROM affiliate_applications aa
       JOIN users u ON aa.user_id = u.id
       LEFT JOIN referral_transactions rt ON rt.affiliate_application_id = aa.id
       WHERE ${whereClause}
       GROUP BY aa.id, aa.user_id, aa.affiliate_status, aa.approved_at, aa.sosmed_accounts, u.name, u.email, u.avatar
       ORDER BY aa.approved_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Parse sosmedAccounts
    const users = (rows as any[]).map((row) => {
      let rawSosmed = [];
      try {
        rawSosmed = row.sosmedAccounts ? JSON.parse(row.sosmedAccounts) : [];
      } catch (_) {
        rawSosmed = [];
      }
      const sosmedAccounts = rawSosmed.map((acc: any) => ({
        platform: acc.platform || '',
        username: acc.username || '',
        url: acc.link || acc.url || '',
      }));

      return {
        id: row.user_id,
        name: row.name,
        email: row.email,
        avatar: row.avatar,
        joinedAt: row.joinedAt,
        totalCommission: parseFloat(row.totalCommission) || 0,
        status: row.status,
        sosmedAccounts,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          totalPages,
          currentPage: page,
          limit,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Error GET /api/admin/affiliate-users:', error.message);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat data pengguna affiliate' },
      { status: 500 }
    );
  }
}
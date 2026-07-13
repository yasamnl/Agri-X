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

    let whereClause = '1=1';
    const params: any[] = [];

    if (status !== 'all') {
      whereClause += ' AND aa.status = ?';
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

    // Data
    const [rows] = await pool.query(
      `SELECT 
         aa.id,
         aa.status,
         aa.created_at as createdAt,
         aa.sosmed_accounts as sosmedAccounts,
         u.id as userId,
         u.name,
         u.email,
         u.avatar
       FROM affiliate_applications aa
       JOIN users u ON aa.user_id = u.id
       WHERE ${whereClause}
       ORDER BY aa.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Parse JSON sosmedAccounts dan ubah 'link' menjadi 'url' agar sesuai dengan tipe frontend
    const applications = (rows as any[]).map((row) => {
      let rawSosmed = [];
      try {
        rawSosmed = row.sosmedAccounts ? JSON.parse(row.sosmedAccounts) : [];
      } catch (_) {
        rawSosmed = [];
      }
      const sosmedAccounts = rawSosmed.map((acc: any) => ({
        platform: acc.platform || '',
        username: acc.username || '',
        url: acc.link || acc.url || '', // prioritaskan 'link' jika ada
      }));

      return {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
        sosmedAccounts,
        user: {
          id: row.userId,
          name: row.name,
          email: row.email,
          avatar: row.avatar,
        },
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        applications,
        pagination: {
          total,
          totalPages,
          currentPage: page,
          limit,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Error GET /api/admin/affiliates:', error.message);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat data pengajuan' },
      { status: 500 }
    );
  }
}
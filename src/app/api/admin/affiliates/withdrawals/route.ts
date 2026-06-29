// src/app/api/admin/affiliates/withdrawals/route.ts
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
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      conditions.push('aw.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [withdrawals] = await pool.query(
      `SELECT 
        aw.*,
        aa.referral_code,
        u.nama_lengkap,
        u.email
      FROM affiliate_withdrawals aw
      JOIN affiliate_applications aa ON aw.affiliate_application_id = aa.id
      JOIN users u ON aa.user_id = u.id
      ${whereClause}
      ORDER BY aw.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM affiliate_withdrawals aw ${whereClause}`,
      params
    );

    const total = countResult[0]?.total || 0;

    const [statusCounts] = await pool.query(
      `SELECT status, COUNT(*) as count, SUM(nominal) as total_nominal 
       FROM affiliate_withdrawals GROUP BY status`
    );

    const statusCountMap: Record<string, { count: number; total: number }> = {};
    statusCounts.forEach((row: any) => {
      statusCountMap[row.status] = {
        count: Number(row.count),
        total: Number(row.total_nominal),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        withdrawals: withdrawals.map((w: any) => ({
          id: Number(w.id),
          affiliateId: Number(w.affiliate_application_id),
          referralCode: w.referral_code,
          user: {
            name: w.nama_lengkap,
            email: w.email,
          },
          bank: w.bank,
          noRekening: w.no_rekening,
          namaPemilik: w.nama_pemilik,
          nominal: Number(w.nominal),
          status: w.status,
          xenditExternalId: w.xendit_external_id,
          catatan: w.catatan,
          processedAt: w.processed_at,
          createdAt: w.created_at,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        statusCounts: {
          all: total,
          PENDING: statusCountMap['PENDING'] || { count: 0, total: 0 },
          COMPLETED: statusCountMap['COMPLETED'] || { count: 0, total: 0 },
          FAILED: statusCountMap['FAILED'] || { count: 0, total: 0 },
        },
      },
    });

  } catch (error: any) {
    console.error('Get withdrawals error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
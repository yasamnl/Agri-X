import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

type DashboardStats = RowDataPacket & {
  total_users: number;
  total_products: number;
  total_transactions: number;
  total_revenue: number;
  pending_reports: number;
  active_affiliates: number;
};

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Get dashboard stats
    const [statsResult] = await pool.query<DashboardStats[]>(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM products WHERE status != 'deleted') as total_products,
        (SELECT COUNT(*) FROM orders) as total_transactions,
        (SELECT COALESCE(SUM(grand_total), 0) FROM orders WHERE status = 'completed') as total_revenue,
        (SELECT COUNT(*) FROM user_reports WHERE status_laporan = 'menunggu') as pending_reports,
        (SELECT COUNT(*) FROM affiliate_applications WHERE status = 'approved') as active_affiliates
    `);

    // Get recent reports
    const [reports] = await pool.query<RowDataPacket[]>(`
      SELECT 
        ur.id,
        ur.jenis_laporan,
        ur.deskripsi,
        ur.status_laporan,
        ur.tanggal_laporan,
        ur.bukti_url,
        ur.admin_note,
        up.name as pelapor_name,
        up.email as pelapor_email,
        ut.name as terlapor_name,
        ut.email as terlapor_email
      FROM user_reports ur
      JOIN users up ON ur.pelapor_id = up.id
      JOIN users ut ON ur.terlapor_id = ut.id
      ORDER BY ur.tanggal_laporan DESC
      LIMIT 10
    `, []);

    return NextResponse.json({
      success: true,
      stats: statsResult[0],
      recentReports: reports,
    });

  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingCount,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedCount,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedCount
      FROM affiliate_applications
    `);
    connection.release();

    const data = (rows as any[])[0] || { total: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0 };

    return NextResponse.json({
      success: true,
      data: {
        totalApplications: data.total || 0,
        pendingCount: data.pendingCount || 0,
        approvedCount: data.approvedCount || 0,
        rejectedCount: data.rejectedCount || 0,
      },
    });
  } catch (error: any) {
    console.error('Error stats pengajuan:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat statistik pengajuan' },
      { status: 500 }
    );
  }
}
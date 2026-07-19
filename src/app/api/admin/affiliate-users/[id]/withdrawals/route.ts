import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/admin/affiliate-users/[id]/withdrawals
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);
    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: 'ID pengguna tidak valid' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status') || 'all'; // PENDING | COMPLETED | FAILED | all
    const offset = (page - 1) * limit;

    const [appRows] = await pool.query(
      `SELECT aa.id as application_id
       FROM affiliate_applications aa
       WHERE aa.user_id = ? AND aa.approved_at IS NOT NULL
       ORDER BY aa.approved_at DESC
       LIMIT 1`,
      [userId]
    );
    const application = (appRows as any[])[0];
    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Affiliator tidak ditemukan' },
        { status: 404 }
      );
    }
    const applicationId = application.application_id;

    let whereClause = 'aw.affiliate_application_id = ?';
    const queryParams: any[] = [applicationId];

    if (status !== 'all') {
      whereClause += ' AND aw.status = ?';
      queryParams.push(status.toUpperCase());
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM affiliate_withdrawals aw WHERE ${whereClause}`,
      queryParams
    );
    const total = (countRows as any[])[0]?.total || 0;

    const [wdRows] = await pool.query(
      `SELECT aw.id, aw.bank, aw.no_rekening, aw.nama_pemilik, aw.nominal,
              aw.admin_fee, aw.status, aw.invoice_number, aw.catatan,
              aw.processed_at, aw.created_at
       FROM affiliate_withdrawals aw
       WHERE ${whereClause}
       ORDER BY aw.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    const [summaryRows] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN nominal - admin_fee ELSE 0 END), 0) as totalDicairkan,
         COALESCE(SUM(CASE WHEN status = 'PENDING' THEN nominal ELSE 0 END), 0) as totalPending,
         COALESCE(SUM(CASE WHEN status = 'FAILED' THEN nominal ELSE 0 END), 0) as totalGagal,
         COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN admin_fee ELSE 0 END), 0) as totalAdminFee,
         COUNT(*) as totalWithdrawal
       FROM affiliate_withdrawals
       WHERE affiliate_application_id = ?`,
      [applicationId]
    );
    const summary = (summaryRows as any[])[0] || {};

    const withdrawals = (wdRows as any[]).map((row) => ({
      id: row.id,
      bank: row.bank,
      noRekening: row.no_rekening,
      namaPemilik: row.nama_pemilik,
      nominal: parseFloat(row.nominal) || 0,
      adminFee: parseFloat(row.admin_fee) || 0,
      nominalDiterima: (parseFloat(row.nominal) || 0) - (parseFloat(row.admin_fee) || 0),
      status: row.status as 'PENDING' | 'COMPLETED' | 'FAILED',
      invoiceNumber: row.invoice_number,
      catatan: row.catatan,
      processedAt: row.processed_at,
      createdAt: row.created_at,
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalDicairkan: parseFloat(summary.totalDicairkan) || 0,
          totalPending: parseFloat(summary.totalPending) || 0,
          totalGagal: parseFloat(summary.totalGagal) || 0,
          totalAdminFee: parseFloat(summary.totalAdminFee) || 0,
          totalWithdrawal: summary.totalWithdrawal || 0,
        },
        withdrawals,
        pagination: {
          total,
          totalPages,
          currentPage: page,
          limit,
        },
      },
    });
  } catch (error: any) {
    console.error(
      '❌ Error GET /api/admin/affiliate-users/[id]/withdrawals:',
      error.message
    );
    return NextResponse.json(
      { success: false, error: 'Gagal memuat data withdrawal affiliate' },
      { status: 500 }
    );
  }
}
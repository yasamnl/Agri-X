import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/admin/affiliate-users/[id]/commissions
// [id] = user_id (sama seperti field `id` pada AffiliateUser di halaman list)
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
    const status = url.searchParams.get('status') || 'all'; // pending | completed | cancelled | all
    const offset = (page - 1) * limit;

    // Resolve affiliate_application_id + profil dari user_id
    const [appRows] = await pool.query(
      `SELECT aa.id as application_id, aa.affiliate_status, aa.approved_at,
              u.name, u.email, u.avatar
       FROM affiliate_applications aa
       JOIN users u ON aa.user_id = u.id
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

    let whereClause = 'rt.affiliate_application_id = ?';
    const queryParams: any[] = [applicationId];

    if (status !== 'all') {
      whereClause += ' AND rt.status = ?';
      queryParams.push(status);
    }

    // Total baris (untuk pagination, mengikuti filter status)
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM referral_transactions rt WHERE ${whereClause}`,
      queryParams
    );
    const total = (countRows as any[])[0]?.total || 0;

    // Data transaksi (halaman berjalan)
    const [txRows] = await pool.query(
      `SELECT rt.id, rt.product_name, rt.nominal_transaksi, rt.komisi,
              rt.persen_komisi, rt.status, rt.catatan, rt.created_at
       FROM referral_transactions rt
       WHERE ${whereClause}
       ORDER BY rt.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    // Ringkasan total (selalu dihitung dari SELURUH transaksi affiliate ini,
    // tidak terpengaruh filter status/pagination)
    const [summaryRows] = await pool.query(
      `SELECT
         COALESCE(SUM(komisi), 0) as totalKomisi,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN komisi ELSE 0 END), 0) as totalCompleted,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN komisi ELSE 0 END), 0) as totalPending,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN komisi ELSE 0 END), 0) as totalCancelled,
         COUNT(*) as totalTransaksi
       FROM referral_transactions
       WHERE affiliate_application_id = ?`,
      [applicationId]
    );
    const summary = (summaryRows as any[])[0] || {};

    const transactions = (txRows as any[]).map((row) => ({
      id: row.id,
      productName: row.product_name,
      nominalTransaksi: parseFloat(row.nominal_transaksi) || 0,
      komisi: parseFloat(row.komisi) || 0,
      persenKomisi: row.persen_komisi,
      status: row.status as 'pending' | 'completed' | 'cancelled',
      catatan: row.catatan,
      createdAt: row.created_at,
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        affiliate: {
          id: userId,
          applicationId,
          name: application.name,
          email: application.email,
          avatar: application.avatar,
          status: application.affiliate_status,
        },
        summary: {
          totalKomisi: parseFloat(summary.totalKomisi) || 0,
          totalCompleted: parseFloat(summary.totalCompleted) || 0,
          totalPending: parseFloat(summary.totalPending) || 0,
          totalCancelled: parseFloat(summary.totalCancelled) || 0,
          totalTransaksi: summary.totalTransaksi || 0,
        },
        transactions,
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
      '❌ Error GET /api/admin/affiliate-users/[id]/commissions:',
      error.message
    );
    return NextResponse.json(
      { success: false, error: 'Gagal memuat data komisi affiliate' },
      { status: 500 }
    );
  }
}
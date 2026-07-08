// src/app/api/affiliate/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Get affiliate application
    const [applications] = await pool.query<RowDataPacket[]>(
      `SELECT id, referral_code, status 
       FROM affiliate_applications 
       WHERE user_id = ? AND status = 'approved'`,
      [decoded.sub]
    );

    if (!applications[0]) {
      return NextResponse.json({
        success: false,
        error: 'Anda belum menjadi affiliate',
      }, { status: 403 });
    }

    const affiliateId = applications[0].id;
    const referralCode = applications[0].referral_code;

    // Get stats
    const [clickCountRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM referral_clicks WHERE affiliate_application_id = ?',
      [affiliateId]
    );

    const [transactionStatsRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN status = 'completed' THEN nominal_transaksi ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'completed' THEN komisi ELSE 0 END) as total_commission
      FROM referral_transactions 
      WHERE affiliate_application_id = ?`,
      [affiliateId]
    );

    const [earningsStatsRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        SUM(CASE WHEN status = 'completed' THEN komisi ELSE 0 END) as available_balance,
        SUM(CASE WHEN status = 'pending' THEN komisi ELSE 0 END) as pending_commission
      FROM referral_transactions 
      WHERE affiliate_application_id = ?`,
      [affiliateId]
    );

    const [withdrawalStatsRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total_withdrawals,
        SUM(CASE WHEN status = 'COMPLETED' THEN nominal ELSE 0 END) as total_withdrawn
      FROM affiliate_withdrawals 
      WHERE affiliate_application_id = ?`,
      [affiliateId]
    );

    const [recentTransactions] = await pool.query<RowDataPacket[]>(
      `SELECT 
        rt.*,
        p.name as product_name
      FROM referral_transactions rt
      LEFT JOIN products p ON rt.product_id = p.id
      WHERE rt.affiliate_application_id = ?
      ORDER BY rt.created_at DESC
      LIMIT 5`,
      [affiliateId]
    );

    // Get recent withdrawals
    const [recentWithdrawals] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM affiliate_withdrawals 
       WHERE affiliate_application_id = ? 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [affiliateId]
    );

    return NextResponse.json({
      success: true,
      data: {
        referralCode,
        referralLink: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?ref=${referralCode}`,
        stats: {
          totalClicks: Number(clickCountRows[0]?.count || 0),
          totalTransactions: Number(transactionStatsRows[0]?.total_transactions || 0),
          totalRevenue: Number(transactionStatsRows[0]?.total_revenue || 0),
          totalCommission: Number(transactionStatsRows[0]?.total_commission || 0),
          availableBalance: Number(earningsStatsRows[0]?.available_balance || 0),
          pendingCommission: Number(earningsStatsRows[0]?.pending_commission || 0),
          totalWithdrawals: Number(withdrawalStatsRows[0]?.total_withdrawals || 0),
          totalWithdrawn: Number(withdrawalStatsRows[0]?.total_withdrawn || 0),
        },
        recentTransactions: (recentTransactions as RowDataPacket[]).map((t: any) => ({
          id: Number(t.id),
          productName: t.product_name || 'Unknown Product',
          nominalTransaksi: Number(t.nominal_transaksi),
          komisi: Number(t.komisi),
          persenKomisi: Number(t.persen_komisi),
          status: t.status,
          createdAt: t.created_at,
        })),
        recentWithdrawals: (recentWithdrawals as RowDataPacket[]).map((w: any) => ({
          id: Number(w.id),
          bank: w.bank,
          noRekening: w.no_rekening,
          namaPemilik: w.nama_pemilik,
          nominal: Number(w.nominal),
          status: w.status,
          catatan: w.catatan,
          processedAt: w.processed_at,
          createdAt: w.created_at,
        })),
      },
    });

  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
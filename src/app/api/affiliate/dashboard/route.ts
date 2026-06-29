// File: src/app/api/affiliate/dashboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;

    // Get approved affiliate application
    const [applications] = await pool.query(
      `SELECT id, referral_code 
       FROM affiliate_applications 
       WHERE user_id = ? AND status = 'approved' 
       LIMIT 1`,
      [userId]
    );

    if (!applications[0]) {
      return NextResponse.json(
        { success: false, error: 'Affiliate application not approved' },
        { status: 404 }
      );
    }

    const applicationId = applications[0].id;
    const referralCode = applications[0].referral_code;

    // Get statistics
    const [clicks] = await pool.query(
      `SELECT COUNT(*) as total FROM referral_clicks WHERE affiliate_application_id = ?`,
      [applicationId]
    );

    const [transactions] = await pool.query(
      `SELECT COUNT(*) as total, COALESCE(SUM(komisi), 0) as total_commission
       FROM referral_transactions 
       WHERE affiliate_application_id = ? AND status = 'completed'`,
      [applicationId]
    );

    const [withdrawals] = await pool.query(
      `SELECT COALESCE(SUM(nominal), 0) as total_withdrawn
       FROM affiliate_withdrawals 
       WHERE affiliate_application_id = ? AND status = 'COMPLETED'`,
      [applicationId]
    );

    const totalClicks = clicks[0]?.total || 0;
    const totalTransactions = transactions[0]?.total || 0;
    const totalCommission = Number(transactions[0]?.total_commission || 0);
    const totalWithdrawn = Number(withdrawals[0]?.total_withdrawn || 0);
    const balance = totalCommission - totalWithdrawn;

    // Get recent transactions
    const [recentTransactions] = await pool.query(
      `SELECT id, product_name, nominal_transaksi, komisi, status, created_at
       FROM referral_transactions 
       WHERE affiliate_application_id = ? 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [applicationId]
    );

    return NextResponse.json({
      success: true,
      data: {
        referralCode,
        balance,
        totalClicks,
        totalTransactions,
        totalCommission,
        totalWithdrawn,
        recentTransactions: recentTransactions.map((t: any) => ({
          id: t.id,
          productName: t.product_name,
          nominalTransaksi: Number(t.nominal_transaksi),
          komisi: Number(t.komisi),
          status: t.status,
          createdAt: t.created_at
        }))
      }
    });

  } catch (error: any) {
    console.error('Error fetching affiliate dashboard:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}
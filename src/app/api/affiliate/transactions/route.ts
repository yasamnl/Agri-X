// File: src/app/api/affiliate/transactions/route.ts

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
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Get affiliate application
    const [applications] = await pool.query(
      `SELECT id FROM affiliate_applications WHERE user_id = ? AND status = 'approved' LIMIT 1`,
      [userId]
    );

    if (!applications[0]) {
      return NextResponse.json(
        { success: false, error: 'Affiliate application not approved' },
        { status: 404 }
      );
    }

    const applicationId = applications[0].id;

    // Get transactions with pagination
    const [transactions] = await pool.query(
      `SELECT id, product_name, nominal_transaksi, komisi, persen_komisi, status, created_at
       FROM referral_transactions 
       WHERE affiliate_application_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [applicationId, limit, offset]
    );

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM referral_transactions WHERE affiliate_application_id = ?`,
      [applicationId]
    );

    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions.map((t: any) => ({
          id: t.id,
          productName: t.product_name,
          nominalTransaksi: Number(t.nominal_transaksi),
          komisi: Number(t.komisi),
          persenKomisi: t.persen_komisi,
          status: t.status,
          createdAt: t.created_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
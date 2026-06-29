// src/app/api/affiliate/withdraw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { bank, noRekening, namaPemilik, nominal } = body;

    if (!bank || !noRekening || !namaPemilik || !nominal) {
      return NextResponse.json(
        { success: false, error: 'Semua field diperlukan' },
        { status: 400 }
      );
    }

    if (nominal < 50000) {
      return NextResponse.json(
        { success: false, error: 'Minimal penarikan Rp 50.000' },
        { status: 400 }
      );
    }

    // Get affiliate application
    const [applications] = await pool.query(
      `SELECT id, referral_code 
       FROM affiliate_applications 
       WHERE user_id = ? AND status = 'approved'`,
      [decoded.sub]
    );

    if (!applications[0]) {
      return NextResponse.json(
        { success: false, error: 'Anda belum menjadi affiliate' },
        { status: 403 }
      );
    }

    const affiliateId = applications[0].id;

    // Check available balance
    const [balance] = await pool.query(
      `SELECT 
        SUM(CASE WHEN status = 'completed' THEN komisi ELSE 0 END) as available_balance
      FROM referral_transactions 
      WHERE affiliate_application_id = ?`,
      [affiliateId]
    );

    const availableBalance = Number(balance[0]?.available_balance || 0);

    // Check total withdrawn (pending withdrawals)
    const [pendingWithdrawals] = await pool.query(
      `SELECT SUM(nominal) as total 
       FROM affiliate_withdrawals 
       WHERE affiliate_application_id = ? AND status = 'PENDING'`,
      [affiliateId]
    );

    const pendingAmount = Number(pendingWithdrawals[0]?.total || 0);
    const actualBalance = availableBalance - pendingAmount;

    if (nominal > actualBalance) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Saldo tidak mencukupi. Saldo tersedia: Rp ${actualBalance.toLocaleString('id-ID')}` 
        },
        { status: 400 }
      );
    }

    // Generate external ID for Midtrans
    const externalId = `WD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create withdrawal request
    const [result] = await pool.query(
      `INSERT INTO affiliate_withdrawals 
       (affiliate_application_id, bank, no_rekening, nama_pemilik, nominal, status, xendit_external_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NOW(), NOW())`,
      [affiliateId, bank, noRekening, namaPemilik, nominal, externalId]
    );

    return NextResponse.json({
      success: true,
      message: 'Permintaan penarikan berhasil dikirim',
      data: {
        withdrawalId: result.insertId,
        nominal,
        externalId,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('Withdrawal error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
// src/app/api/affiliate/withdraw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { getAffiliateByUserId } from '@/lib/affiliate';

export async function POST(req: NextRequest) {
  let connection;

  try {
    // 1. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const { bank, noRekening, namaPemilik, nominal } = body;

    // 3. Validate
    if (!bank || !noRekening || !namaPemilik || !nominal) {
      return NextResponse.json(
        { success: false, error: 'Semua field wajib diisi' },
        { status: 400 }
      );
    }

    if (nominal < 50000) {
      return NextResponse.json(
        { success: false, error: 'Minimal penarikan Rp 50.000' },
        { status: 400 }
      );
    }

    // 4. Get affiliate
    const affiliate = await getAffiliateByUserId(decoded.sub);
    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Anda belum terdaftar sebagai affiliate' },
        { status: 404 }
      );
    }

    // 5. Check balance
    if (affiliate.available_balance < nominal) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Saldo tidak mencukupi. Saldo tersedia: Rp ${affiliate.available_balance.toLocaleString('id-ID')}` 
        },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 6. Insert withdrawal request
      const [result] = await connection.query(
        `INSERT INTO affiliate_withdrawals 
         (affiliate_application_id, bank, no_rekening, nama_pemilik, nominal, 
          status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
        [affiliate.id, bank, noRekening, namaPemilik, nominal]
      );

      // 7. Update available balance
      await connection.query(
        `UPDATE affiliate_applications 
         SET available_balance = available_balance - ?,
             withdrawn_amount = withdrawn_amount + ?,
             updated_at = NOW()
         WHERE id = ?`,
        [nominal, nominal, affiliate.id]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Permintaan penarikan berhasil diajukan. Akan diproses dalam 1-3 hari kerja.',
        data: {
          withdrawalId: (result as any).insertId,
          nominal,
          status: 'PENDING',
        },
      });

    } catch (error: any) {
      await connection.rollback();
      throw error;
    }

  } catch (error: any) {
    console.error('❌ Withdraw error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
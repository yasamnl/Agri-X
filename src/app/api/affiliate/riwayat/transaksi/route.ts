import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

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
    const userId = decoded.sub;

    const [appRows] = await pool.query<any[]>(
      `SELECT id FROM affiliate_applications WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    const application = appRows[0];
    if (!application) {
      return NextResponse.json({ success: true, data: [] });
    }

    const [rows] = await pool.query<any[]>(
      `SELECT id, product_name, nominal_transaksi, komisi, persen_komisi, status, created_at
       FROM referral_transactions
       WHERE affiliate_application_id = ?
       ORDER BY created_at DESC`,
      [application.id]
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('❌ Error GET riwayat transaksi:', error.message);
    return NextResponse.json({ success: false, error: 'Gagal memuat riwayat transaksi' }, { status: 500 });
  }
}
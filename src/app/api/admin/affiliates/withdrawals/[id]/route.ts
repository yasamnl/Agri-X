// src/app/api/admin/affiliates/withdrawals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const withdrawalId = parseInt(id);
    const body = await req.json();
    const { action, catatan } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const [withdrawals] = await pool.query(
      `SELECT aw.*, aa.user_id 
       FROM affiliate_withdrawals aw
       JOIN affiliate_applications aa ON aw.affiliate_application_id = aa.id
       WHERE aw.id = ?`,
      [withdrawalId]
    );

    if (!withdrawals[0]) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    const withdrawal = withdrawals[0];

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Withdrawal already processed' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newStatus = action === 'approve' ? 'COMPLETED' : 'FAILED';

    await pool.query(
      `UPDATE affiliate_withdrawals 
       SET status = ?, catatan = ?, processed_at = ?, updated_at = ?
       WHERE id = ?`,
      [newStatus, catatan || null, now, now, withdrawalId]
    );

    // Send notification
    const message = action === 'approve'
      ? `Penarikan Anda sebesar Rp ${Number(withdrawal.nominal).toLocaleString('id-ID')} telah diproses.`
      : `Penarikan Anda ditolak. ${catatan ? `Alasan: ${catatan}` : ''}`;

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, 'withdrawal_${action}', FALSE, NOW())`,
      [withdrawal.user_id, action === 'approve' ? 'Penarikan Berhasil' : 'Penarikan Ditolak', message]
    );

    return NextResponse.json({
      success: true,
      message: `Withdrawal ${newStatus}`,
    });

  } catch (error: any) {
    console.error('Process withdrawal error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Params (kompatibel Next.js 14 & 15)
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'ID tidak valid' }, { status: 400 });
    }

    // Body — sesuai frontend: { reason: string }
    const body = await req.json();
    const rejectionReason = body?.reason || '';

    // Cek aplikasi
    const [applications] = await pool.query<any[]>(
      'SELECT id, user_id, status FROM affiliate_applications WHERE id = ?',
      [id]
    );

    if (!applications[0]) {
      return NextResponse.json({ success: false, error: 'Aplikasi tidak ditemukan' }, { status: 404 });
    }

    const app = applications[0];
    if (app.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Aplikasi sudah diproses (status: ${app.status})` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update status
    await pool.query(
      `UPDATE affiliate_applications 
       SET status = 'rejected', rejected_at = ?, updated_at = ?
       WHERE id = ?`,
      [now, now, id]
    );

    // Catat activation request
    await pool.query(
      `INSERT INTO activation_requests 
       (user_id, status, pesan, catatan, created_at, updated_at)
       VALUES (?, 'ditolak', 'Aplikasi affiliate Anda ditolak', ?, NOW(), NOW())`,
      [app.user_id, rejectionReason]
    );

    // Kirim notifikasi
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, 'affiliate_rejected', FALSE, NOW())`,
      [
        app.user_id,
        'Aplikasi Affiliate Ditolak',
        rejectionReason ? `Aplikasi Anda ditolak. Alasan: ${rejectionReason}` : 'Aplikasi Anda ditolak',
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Aplikasi berhasil ditolak',
    });
  } catch (error: any) {
    console.error('❌ Error reject affiliate:', error.message);
    return NextResponse.json(
      { success: false, error: 'Gagal menolak aplikasi' },
      { status: 500 }
    );
  }
}
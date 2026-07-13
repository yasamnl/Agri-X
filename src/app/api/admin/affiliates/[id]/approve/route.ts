import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { sendAffiliateApprovedEmail } from '@/lib/email';

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

    // Cek aplikasi (ambil juga email & nama user untuk kirim notifikasi + email)
    const [applications] = await pool.query<any[]>(
      `SELECT aa.id, aa.user_id, aa.status, aa.referral_code, u.email, u.name
       FROM affiliate_applications aa
       JOIN users u ON u.id = aa.user_id
       WHERE aa.id = ?`,
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
       SET status = 'approved', approved_at = ?, updated_at = ?, affiliate_status = 'aktif'
       WHERE id = ?`,
      [now, now, id]
    );

    // Catat activation request
    await pool.query(
      `INSERT INTO activation_requests 
       (user_id, status, pesan, created_at, updated_at)
       VALUES (?, 'disetujui', 'Aplikasi affiliate Anda telah disetujui', NOW(), NOW())`,
      [app.user_id]
    );

    // Kirim notifikasi (in-app) — FIX: kolom yang benar adalah `reading`, bukan `is_read`
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, reading, created_at)
       VALUES (?, ?, ?, 'affiliate_approved', 0, NOW())`,
      [
        app.user_id,
        'Selamat! Aplikasi Affiliate Disetujui',
        `Aplikasi affiliate Anda telah disetujui. Kode referral: ${app.referral_code}`,
      ]
    );

    // Kirim email pemberitahuan — tidak menggagalkan request kalau email gagal terkirim
    const emailResult = await sendAffiliateApprovedEmail(app.email, app.name);
    if (!emailResult.success) {
      console.error('⚠️ Notifikasi in-app berhasil, tapi email approval gagal terkirim:', emailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: 'Aplikasi berhasil disetujui',
    });
  } catch (error: any) {
    console.error('❌ Error approve affiliate:', error.message);
    return NextResponse.json(
      { success: false, error: 'Gagal menyetujui aplikasi' },
      { status: 500 }
    );
  }
}
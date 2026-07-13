// src/app/api/affiliate/request-reactivation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { sendReactivationRequestEmail } from '@/lib/email';

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

    const userId = decoded.sub;

    connection = await pool.getConnection();

    // 2. Ambil data user + aplikasi affiliate
    const [userRows] = await connection.query(
      `SELECT name, email FROM users WHERE id = ?`,
      [userId]
    );
    const user = (userRows as any[])[0];
    if (!user) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
    }

    const [appRows] = await connection.query(
      `SELECT id, affiliate_status FROM affiliate_applications 
       WHERE user_id = ? AND status = 'approved' 
       ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    const application = (appRows as any[])[0];

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Anda belum terdaftar sebagai affiliate' },
        { status: 404 }
      );
    }

    // 3. Cuma boleh request reaktivasi kalau statusnya memang 'nonaktif'
    if (application.affiliate_status !== 'nonaktif') {
      return NextResponse.json(
        { success: false, error: 'Akun Anda tidak dalam status nonaktif' },
        { status: 400 }
      );
    }

    // 4. Ambil semua admin
    const [adminRows] = await connection.query(
      `SELECT id, name, email FROM users WHERE role = 'admin'`
    );
    const admins = adminRows as any[];

    // 5. Insert notifikasi ke setiap admin
    for (const admin of admins) {
      await connection.query(
        `INSERT INTO notifications 
         (user_id, sender_id, title, message, type, link, action_type, reference_id, created_at)
         VALUES (?, ?, ?, ?, 'system', ?, 'affiliate_reactivation_request', ?, CURRENT_TIMESTAMP(3))`,
        [
          admin.id,
          userId,
          'Permintaan Reaktivasi Akun Affiliate',
          `${user.name} mengajukan permintaan reaktivasi akun affiliate.`,
          `/admin/affiliates`,
          String(application.id),
        ]
      );
    }

    // 6. Kirim email ke setiap admin (tidak menunggu / tidak menggagalkan request kalau email gagal)
    for (const admin of admins) {
      sendReactivationRequestEmail(admin.email, user.name, user.email).catch((err) => {
        console.error(`Gagal kirim email reaktivasi ke admin ${admin.email}:`, err);
      });
    }

    console.log(
      `🔔 Permintaan reaktivasi affiliate dari user ${userId} — dikirim ke ${admins.length} admin`
    );

    return NextResponse.json({
      success: true,
      message: 'Permintaan reaktivasi telah dikirim ke admin.',
    });
  } catch (error: any) {
    console.error('❌ Request reactivation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
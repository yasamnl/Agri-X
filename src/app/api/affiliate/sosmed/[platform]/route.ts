// src/app/api/affiliate/sosmed/[platform]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  let connection;
  try {
    // 1. Auth
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
    const { platform } = params;

    connection = await pool.getConnection();

    // 2. Get affiliate application milik user ini
    const [appRows] = await connection.query(
      `SELECT id FROM affiliate_applications WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    const application = (appRows as any[])[0];
    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Akun affiliate tidak ditemukan' },
        { status: 404 }
      );
    }

    // 3. Hapus baris sosmed berdasarkan platform
    const [result]: any = await connection.query(
      `DELETE FROM affiliate_social_media WHERE affiliate_application_id = ? AND platform = ?`,
      [application.id, platform]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Akun sosmed tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Sosmed DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
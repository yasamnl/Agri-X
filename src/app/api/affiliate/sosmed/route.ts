// src/app/api/affiliate/sosmed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
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

    // 2. Body
    const body = await req.json();
    const { platform, link } = body;
    if (!platform || !link) {
      return NextResponse.json(
        { success: false, error: 'Platform dan link wajib diisi' },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();

    // 3. Get affiliate application milik user ini
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

    // 4. Cek duplikat (platform + link yang sama untuk affiliate ini)
    const [dupRows] = await connection.query(
      `SELECT id FROM affiliate_social_media WHERE affiliate_application_id = ? AND platform = ? AND link = ?`,
      [application.id, platform, link]
    );
    if ((dupRows as any[]).length > 0) {
      return NextResponse.json(
        { success: false, error: 'Akun ini sudah terdaftar' },
        { status: 409 }
      );
    }

    // 5. Insert
    await connection.query(
      `INSERT INTO affiliate_social_media (affiliate_application_id, platform, link, verified, created_at, updated_at)
       VALUES (?, ?, ?, 0, NOW(), NOW())`,
      [application.id, platform, link]
    );

    return NextResponse.json({
      success: true,
      data: { platform, link, verified: false },
    });

  } catch (error: any) {
    console.error('Sosmed POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

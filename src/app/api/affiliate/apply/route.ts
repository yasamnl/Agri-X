// src/app/api/affiliate/apply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { generateSocialMediaUrl, validateSocialMediaUsername } from '@/lib/social-media';

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

    // 2. Parse body
    const body = await req.json();
    const { sosmedAccounts } = body;

    if (!sosmedAccounts || !Array.isArray(sosmedAccounts) || sosmedAccounts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Minimal 1 akun sosial media wajib diisi' },
        { status: 400 }
      );
    }

    // 3. Validate each social media account
    for (const account of sosmedAccounts) {
      if (!account.platform || !account.username) {
        return NextResponse.json(
          { success: false, error: 'Platform dan username wajib diisi' },
          { status: 400 }
        );
      }

      const validation = validateSocialMediaUsername(account.platform, account.username);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        );
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 4. Check if user already has pending application
      const [existing] = await connection.query(
        `SELECT id, status FROM affiliate_applications 
         WHERE user_id = ? AND status IN ('pending', 'approved')`,
        [userId]
      );

      if ((existing as any[]).length > 0) {
        await connection.rollback();
        connection.release();
        return NextResponse.json(
          { 
            success: false, 
            error: 'Anda sudah memiliki aplikasi affiliate yang sedang diproses atau disetujui' 
          },
          { status: 400 }
        );
      }

      // 5. Insert application
      const [appResult] = await connection.query(
        `INSERT INTO affiliate_applications 
         (user_id, sosmed_accounts, status, created_at, updated_at)
         VALUES (?, ?, 'pending', NOW(), NOW())`,
        [userId, JSON.stringify(sosmedAccounts)]
      );

      const applicationId = (appResult as any).insertId;

      // 6. ✅ Insert social media accounts dengan AUTO-GENERATE URL
      for (const account of sosmedAccounts) {
        // ✅ Generate full URL dari username
        const fullUrl = generateSocialMediaUrl(account.platform, account.username);

        await connection.query(
          `INSERT INTO affiliate_social_media 
           (affiliate_application_id, platform, username, link, created_at, updated_at)
           VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [applicationId, account.platform, account.username, fullUrl]
        );
      }

      await connection.commit();
      connection.release();

      return NextResponse.json({
        success: true,
        message: 'Aplikasi affiliate berhasil diajukan! Tim kami akan mereview dalam 1-3 hari kerja.',
        data: { applicationId },
      });

    } catch (error: any) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error: any) {
    console.error('❌ Affiliate apply error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
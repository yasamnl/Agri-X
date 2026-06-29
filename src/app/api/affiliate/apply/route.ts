// File: src/app/api/affiliate/apply/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import crypto from 'crypto';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Please log in again' }, { status: 401 }); // Token tidak valid
    }

    const body = await req.json();
    const { sosmedAccounts } = body;

    // ✅ Debug log
    console.log('📥 Received body:', body);

    // ✅ Validasi dasar - lebih fleksibel
    if (!sosmedAccounts || !Array.isArray(sosmedAccounts)) {
      return NextResponse.json(
        { success: false, error: 'Data sosial media tidak valid. Mohon isi minimal 1 akun.' },
        { status: 400 }
      );
    }

    // ✅ Filter hanya akun yang valid (link terisi)
    const validAccounts = sosmedAccounts.filter(
      (acc: any) => acc && acc.platform && acc.link && acc.link.trim().length >= 3
    );

    if (validAccounts.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Mohon isi minimal 1 akun sosial media dengan username atau URL yang valid (minimal 3 karakter)' 
        },
        { status: 400 }
      );
    }

    // Check if user already applied
    const [existing] = await pool.query(
      'SELECT id, status FROM affiliate_applications WHERE user_id = ?',
      [decoded.sub]
    );

    if (existing[0]) {
      if (existing[0].status === 'approved') {
        return NextResponse.json(
          { success: false, error: 'Anda sudah menjadi affiliate' },
          { status: 409 }
        );
      }
      if (existing[0].status === 'pending') {
        return NextResponse.json(
          { success: false, error: 'Aplikasi Anda sedang diproses' },
          { status: 409 }
        );
      }
      // If rejected, allow re-apply (delete old and create new)
      await pool.query('DELETE FROM affiliate_applications WHERE user_id = ?', [decoded.sub]);
    }

    // Generate referral code
    const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Create application
    const [result] = await pool.query(
      `INSERT INTO affiliate_applications 
       (user_id, sosmed_accounts, status, referral_code, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, NOW(), NOW())`,
      [decoded.sub, JSON.stringify(validAccounts), referralCode]
    );

    const appId = result.insertId;

    // Insert social media accounts ke tabel terpisah
    for (const sosmed of validAccounts) {
      await pool.query(
        `INSERT INTO affiliate_social_media 
         (affiliate_application_id, platform, link, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [appId, sosmed.platform, sosmed.link.trim()]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Aplikasi affiliate berhasil dikirim',
      data: {
        applicationId: appId,
        referralCode,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Apply affiliate error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
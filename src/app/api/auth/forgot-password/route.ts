// src/app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { sendResetPasswordEmail } from '@/lib/email';

// ============================================
// RATE LIMITING (in-memory)
// ============================================
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  // Max 3 request per 15 menit per IP
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
    return { allowed: true };
  }
  
  if (record.count >= 3) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    };
  }
  
  record.count++;
  return { allowed: true };
}

// ============================================
// POST: Request reset password
// ============================================
export async function POST(req: NextRequest) {
  try {
    // ✅ Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan. Coba lagi dalam ${rateCheck.retryAfter} detik.`,
          code: 'RATE_LIMITED',
        },
        { status: 429 }
      );
    }

    // ✅ Parse body
    const body = await req.json();
    const { email } = body;

    // ✅ Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email wajib diisi' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Format email tidak valid' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ✅ Cek user terdaftar
    const [users] = await pool.query(
      'SELECT id, name, email FROM users WHERE email = ?',
      [normalizedEmail]
    );

    const user = (users as any[])[0];

    // ✅ SECURITY: Selalu return success untuk cegah email enumeration
    // (attacker tidak bisa tahu email terdaftar atau tidak)
    if (!user) {
      console.log(`⚠️ Reset password requested for non-existent email: ${normalizedEmail}`);
      
      return NextResponse.json({
        success: true,
        message: 'Jika email terdaftar, Anda akan menerima link reset password.',
      });
    }

    // ✅ Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    // ✅ Simpan token ke kolom reset_token/reset_expires di users
    //    (menimpa token lama kalau ada — otomatis meng-invalidate token sebelumnya)
    await pool.query(
      'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [resetToken, expiresAt, user.id]
    );

    // ✅ Kirim email
    const emailResult = await sendResetPasswordEmail(
      user.email,
      user.name,
      resetToken
    );

    if (!emailResult.success) {
      console.error('❌ Failed to send reset email:', emailResult.error);
      return NextResponse.json(
        {
          success: false,
          error: 'Gagal mengirim email. Silakan coba lagi nanti.',
        },
        { status: 500 }
      );
    }

    console.log(`✅ Reset password email sent to: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Link reset password telah dikirim ke email Anda.',
      // ✅ Hanya untuk development (preview Ethereal)
      ...(process.env.NODE_ENV === 'development' && emailResult.previewUrl && {
        previewUrl: emailResult.previewUrl,
      }),
    });

  } catch (error: any) {
    console.error('❌ Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
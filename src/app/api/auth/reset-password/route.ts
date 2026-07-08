// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import bcrypt from 'bcrypt';
import pool from '@/lib/db';
import { sendPasswordChangedEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  let connection;

  try {
    const body = await req.json();
    const { token, password, confirmPassword } = body;

    // ✅ Validate input
    if (!token || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Semua field wajib diisi' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Password dan konfirmasi tidak cocok' },
        { status: 400 }
      );
    }

    // ✅ Password strength validation
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password minimal 8 karakter' },
        { status: 400 }
      );
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Password harus mengandung huruf besar, huruf kecil, dan angka' 
        },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // ✅ Get and lock token
    const [tokens] = await connection.query(
      `SELECT prt.*, u.email, u.name 
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = ? 
       FOR UPDATE`,
      [token]
    );

    const tokenData = (tokens as any[])[0];

    if (!tokenData) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, error: 'Token tidak valid' },
        { status: 400 }
      );
    }

    // ✅ Check if already used
    if (tokenData.used_at) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, error: 'Token sudah digunakan' },
        { status: 400 }
      );
    }

    // ✅ Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, error: 'Token sudah kedaluwarsa' },
        { status: 400 }
      );
    }

    // ✅ Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // ✅ Update user password
    await connection.query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, tokenData.user_id]
    );

    // ✅ Mark token as used
    await connection.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?',
      [tokenData.id]
    );

    await connection.commit();

    // ✅ Send confirmation email (async, don't block response)
    sendPasswordChangedEmail(tokenData.email, tokenData.name).catch(err => {
      console.error('Failed to send confirmation email:', err);
    });

    console.log(`✅ Password reset successful for user: ${tokenData.email}`);

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diubah. Silakan login dengan password baru.',
    });

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('❌ Reset password error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
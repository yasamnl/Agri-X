// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
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

    // ✅ Cari user berdasarkan reset_token (kolom di tabel users)
    const [userRows] = await connection.query(
      `SELECT id, email, name, reset_token, reset_expires 
       FROM users 
       WHERE reset_token = ? 
       FOR UPDATE`,
      [token]
    );

    const user = (userRows as any[])[0];

    if (!user) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, error: 'Token tidak valid atau sudah digunakan' },
        { status: 400 }
      );
    }

    // ✅ Check expiration
    if (!user.reset_expires || new Date(user.reset_expires) < new Date()) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, error: 'Token sudah kedaluwarsa' },
        { status: 400 }
      );
    }

    // ✅ Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // ✅ Update password, sekaligus hapus token (reset_token/reset_expires)
    //    supaya token yang sama tidak bisa dipakai ulang
    await connection.query(
      `UPDATE users 
       SET password = ?, reset_token = NULL, reset_expires = NULL, updated_at = NOW() 
       WHERE id = ?`,
      [hashedPassword, user.id]
    );

    await connection.commit();

    // ✅ Send confirmation email (async, don't block response)
    sendPasswordChangedEmail(user.email, user.name).catch(err => {
      console.error('Failed to send confirmation email:', err);
    });

    console.log(`✅ Password reset successful for user: ${user.email}`);

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
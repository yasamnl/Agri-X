// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import crypto from 'crypto';
import pool from '@/lib/db';
import { sendAccountVerificationEmail } from '@/lib/email';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password, role = 'buyer' } = await req.json();

    if (!name || !email || !phone || !password) {
      return NextResponse.json(
        { success: false, error: 'Nama, email, nomor telepon, dan password wajib diisi' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'buyer', 'seller'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role specified' },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') console.log(`[REGISTER] Attempting registration for email: ${email}`);
    console.log('SMTP_USER:', process.env.SMTP_USER);
    console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'ada' : 'tidak ada');
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    const [existingRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingRows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Email sudah terdaftar' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const verificationToken = crypto.randomBytes(32).toString('hex'); // 64 karakter

    const [insertResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (
        name, email, no_telp, password, role,
        is_verified, email_verification_token,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
      [name, email, phone, hashedPassword, role, verificationToken]
    );

    const newUserId = insertResult.insertId;

    if (!newUserId) {
      throw new Error('Failed to create user');
    }
// Ambil base URL
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    // Kirim email verifikasi
    try {
      await sendAccountVerificationEmail(email, name, verificationLink);
    } catch (mailErr) {
      console.error('[REGISTER] Gagal mengirim email verifikasi:', mailErr);
      // User tetap dibuat, tapi kasih tau ada masalah pengiriman email
      return NextResponse.json(
        {
          success: true,
          message: 'Registrasi berhasil, tapi email verifikasi gagal terkirim. Hubungi admin.',
        },
        { status: 201 }
      );
    }

    if (process.env.NODE_ENV === 'development') console.log(`[REGISTER] Successfully registered user: ${newUserId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Registrasi berhasil! Silakan cek email Anda untuk verifikasi akun.',
      },
      { status: 201 }
    );

  } catch (err: any) {
    console.error('FULL ERROR');
    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === 'development' ? err.message : 'Registration service unavailable',
        code: err.code,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
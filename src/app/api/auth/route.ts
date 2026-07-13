// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { serialize } from 'cookie';

// Fungsi helper validasi email
const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    // ✅ Validasi input
    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // ✅ Cek apakah email sudah terdaftar
    const [existingRows] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // ✅ Insert user baru
    const [result] = await pool.execute(
      'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, name, 'user'] // role default: 'user'
    );

    const userId = (result as any).insertId;

    // ✅ Respons sukses (tanpa token — registrasi biasanya tidak langsung login)
    return NextResponse.json(
      {
        success: true,
        message: 'User registered successfully. Please log in.',
        user: {
          id: String(userId),
          email,
          name,
          role: 'user'
        }
      },
      { status: 201 }
    );

  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json(
      { success: false, error: 'Registration service unavailable' },
      { status: 500 }
    );
  }
}
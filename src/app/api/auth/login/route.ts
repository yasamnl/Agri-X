// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth';
import crypto from 'crypto';
import pool from '@/lib/db';
import { generateTokens } from '@/lib/jwt';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Ambil user (tambahkan is_verified)
    const [rows] = await pool.execute(
      'SELECT id, email, password, name, role, is_verified FROM users WHERE email = ?',
      [email]
    ) as [any[], any];

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = rows[0];
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // ── CEK VERIFIKASI EMAIL ──────────────────────────────────────────
    if (!user.is_verified) {
      return NextResponse.json(
        {
          success: false,
          error: 'Akun belum diverifikasi. Silakan cek email Anda.',
          code: 'NOT_VERIFIED',
        },
        { status: 403 }
      );
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(String(user.id), user.role);

    // Hash refresh token untuk disimpan
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Ambil metadata client
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const userAgent = req.headers.get('user-agent') || null;

    // Simpan session di DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 hari

    await pool.execute(
      `INSERT INTO user_sessions 
        (user_id, refresh_token_hash, ip_address, user_agent, expires_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [user.id, refreshTokenHash, ip, userAgent, expiresAt]
    );

    // Set cookies (HANYA accessToken di body, refreshToken HANYA di cookie HttpOnly)
    const headers = new Headers();

    headers.append('Set-Cookie', serialize('accessToken', accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    }));

    headers.append('Set-Cookie', serialize('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth/refresh',
    }));

    return new NextResponse(JSON.stringify({
      success: true,
      accessToken,
      user: {
        id: String(user.id),
        email: user.email,
        name: user.name,
        role: user.role,
      }
    }), {
      status: 200,
      headers,
    });

  } catch (err: any) {
    console.error('🔐 Login error:', err);
    return NextResponse.json(
      { success: false, error: 'Authentication service unavailable' },
      { status: 500 }
    );
  }
}
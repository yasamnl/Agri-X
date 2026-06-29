// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { verifyRefreshToken, generateTokens } from '@/lib/jwt';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('refreshToken')?.value;
    if (!refreshToken) {
      return NextResponse.json({ success: false, error: 'No refresh token' }, { status: 401 });
    }

    // Verifikasi JWT refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded || typeof decoded === 'string') {
      return NextResponse.json({ success: false, error: 'Invalid refresh token' }, { status: 401 });
    }

    const userId = decoded.sub; // asumsi sub = user ID

    // Cek apakah session masih valid di DB
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const [sessions] = await pool.execute(
      `SELECT id, user_id, expires_at, is_revoked 
       FROM user_sessions 
       WHERE user_id = ? AND refresh_token_hash = ?`,
      [userId, refreshTokenHash]
    ) as [any[], any];

    if (sessions.length === 0 || sessions[0].is_revoked) {
      return NextResponse.json({ success: false, error: 'Session revoked or not found' }, { status: 401 });
    }

    const session = sessions[0];
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'Refresh token expired' }, { status: 401 });
    }

    // Generate token baru
    const userRole = (await pool.execute('SELECT role FROM users WHERE id = ?', [userId]))[0][0]?.role;
    if (!userRole) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(userId, userRole);

    // Update session: ganti hash (opsional, atau buat session baru)
    // Pendekatan: buat session baru, revoke lama
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    // Revoke session lama
    await pool.execute('UPDATE user_sessions SET is_revoked = true WHERE id = ?', [session.id]);

    // Buat session baru
    await pool.execute(
      `INSERT INTO user_sessions 
        (user_id, refresh_token_hash, ip_address, user_agent, expires_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        newRefreshTokenHash,
        req.ip || null,
        req.headers.get('user-agent') || null,
        newExpiresAt
      ]
    );

    // Set cookies baru
    const headers = new Headers();
    headers.append('Set-Cookie', serialize('accessToken', accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    }));
    headers.append('Set-Cookie', serialize('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth/refresh',
    }));

    return NextResponse.json({ success: true }, { headers });

  } catch (err) {
    console.error('🔄 Refresh error:', err);
    return NextResponse.json({ success: false, error: 'Token refresh failed' }, { status: 401 });
  }
}
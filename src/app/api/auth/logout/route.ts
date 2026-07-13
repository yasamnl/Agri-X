// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refreshToken')?.value;
  
  if (refreshToken) {
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await pool.execute(
      'UPDATE user_sessions SET is_revoked = true WHERE refresh_token_hash = ?',
      [refreshTokenHash]
    );
  }

  // Hapus cookies
  const headers = new Headers();
  headers.append('Set-Cookie', serialize('accessToken', '', { maxAge: 0, path: '/' }));
  headers.append('Set-Cookie', serialize('refreshToken', '', { maxAge: 0, path: '/' }));

  return NextResponse.json({ success: true }, { headers });
}
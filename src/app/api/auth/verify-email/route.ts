// app/api/auth/verify-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const email = req.nextUrl.searchParams.get('email');

  if (!token || !email) {
    return NextResponse.redirect(new URL('/login?verify=invalid', req.url));
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, is_verified FROM users WHERE email = ? AND email_verification_token = ?',
    [email, token]
  );

  if (rows.length === 0) {
    return NextResponse.redirect(new URL('/login?verify=invalid', req.url));
  }

  if (rows[0].is_verified) {
    return NextResponse.redirect(new URL('/login?verify=already', req.url));
  }

  await pool.execute(
    `UPDATE users
     SET is_verified = 1, email_verified_at = NOW(), email_verification_token = NULL
     WHERE id = ?`,
    [rows[0].id]
  );

  return NextResponse.redirect(new URL('/login?verify=success', req.url));
}
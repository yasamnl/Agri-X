// src/app/api/auth/validate-reset-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token tidak valid', valid: false },
        { status: 400 }
      );
    }

    // ✅ Cek token di database
    const [tokens] = await pool.query(
      `SELECT 
        prt.id,
        prt.user_id,
        prt.expires_at,
        prt.used_at,
        u.name as user_name,
        u.email as user_email
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token = ?`,
      [token]
    );

    const tokenData = (tokens as any[])[0];

    if (!tokenData) {
      return NextResponse.json({
        success: true,
        valid: false,
        error: 'Token tidak ditemukan atau sudah tidak valid.',
      });
    }

    // ✅ Cek apakah sudah dipakai
    if (tokenData.used_at) {
      return NextResponse.json({
        success: true,
        valid: false,
        error: 'Token sudah digunakan. Silakan minta link baru.',
      });
    }

    // ✅ Cek apakah sudah expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json({
        success: true,
        valid: false,
        error: 'Token sudah kedaluwarsa. Silakan minta link baru.',
      });
    }

    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        userId: tokenData.user_id,
        userName: tokenData.user_name,
        userEmail: tokenData.user_email,
        expiresAt: tokenData.expires_at,
      },
    });

  } catch (error: any) {
    console.error('❌ Validate token error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server', valid: false },
      { status: 500 }
    );
  }
}
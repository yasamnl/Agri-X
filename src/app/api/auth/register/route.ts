// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import crypto from 'crypto';
import { serialize } from 'cookie';
import pool from '@/lib/db'; //  Sudah pakai pg (PostgreSQL)
import { generateTokens } from '@/lib/jwt';
import { getDeviceType } from '@/lib/device.util';

const getBrowser = (ua: string): string => {
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'Other';
};

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role = 'buyer', avatar } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and password are required' },
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

    console.log(`[REGISTER] Attempting registration for email: ${email}`);

    //  FIX 1: Pakai pool.query() + $1 + result.rows (PostgreSQL style)
    const existingResult = await pool.execute(
      'SELECT id FROM users WHERE email = ?',  //  $1 bukan ?
      [email]
    );

    //  FIX 2: Access .rows untuk dapat array data
    if (existingResult.rows.length > 0) {
      console.log(`[REGISTER] Email already exists: ${email}`);
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    //  FIX 3: INSERT dengan RETURNING untuk dapat ID langsung
    const insertResult = await pool.execute(
      `INSERT INTO users (name, email, password, role, avatar, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,  //  RETURNING id untuk dapat ID tanpa query tambahan
      [name, email, hashedPassword, role, avatar || null]
    );

    //  FIX 4: Ambil ID dari result.rows[0].id
    const newUserId = insertResult.rows[0]?.id;
    
    if (!newUserId) {
      throw new Error('Failed to create user');
    }

    const { accessToken, refreshToken } = generateTokens(String(newUserId), role);
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : realIp || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);
    const browser = getBrowser(userAgent);

    //  FIX 5: Session insert dengan PostgreSQL syntax
    await pool.execute(
      `INSERT INTO user_sessions (
        user_id, refresh_token_hash, ip_address, user_agent, 
        device_type, browser, accessed_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        newUserId, 
        refreshTokenHash, 
        ip, 
        userAgent, 
        deviceType, 
        browser,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) //  expires_at: 7 hari dari sekarang
      ]
    );

    console.log(`[REGISTER] Successfully registered user: ${newUserId}`);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    };

    const headers = new Headers();
    headers.set('Set-Cookie', serialize('refreshToken', refreshToken, cookieOptions));
    headers.append('Set-Cookie', serialize('accessToken', accessToken, { ...cookieOptions, httpOnly: false }));

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful',
        user: { 
          id: String(newUserId), 
          name, 
          email, 
          role,
          avatar: avatar || null,
        }
      },
      { status: 201, headers }
    );

  } catch (err: any) {
    //  FIX 6: Log error detail untuk debugging
    console.error('🔐 Registration error details:', {
      message: err.message,
      code: err.code,      //  PostgreSQL error code (e.g., '23505' = unique violation)
      detail: err.detail,  //  Detail error dari PostgreSQL
      stack: err.stack,
    });
    
    //  FIX 7: Handle specific PostgreSQL errors
    if (err.code === 'ER_DUP_ENTRY') { // Unique violation (email already exists)
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Registration service unavailable' },
      { status: 500 }
    );
  }
}
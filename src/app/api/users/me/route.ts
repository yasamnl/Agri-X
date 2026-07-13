// src/app/api/users/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // ✅ Ambil user ID dari token (tidak perlu dari URL)
    const userId = decoded.sub;

    const result: any = await pool.query(
      `SELECT 
        id, name, email, no_telp, avatar, role, created_at, updated_at
      FROM users 
      WHERE id = ?`,
      [userId]
    );
    const users = result[0];

    if (!users || !users[0]) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const user = users[0];

    return NextResponse.json({
      success: true,
      data: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        phone: user.no_telp,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });

  } catch (error: any) {
    console.error('Get user profile error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
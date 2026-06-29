// src/app/api/admin/users/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

// ============================================================================
// PATCH: Admin - Update user status (active/suspended)
// ============================================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // ✅ Check if user is admin
    const [userCheck] = await pool.query(
      'SELECT role FROM users WHERE id = ?',
      [decoded.sub]
    );

    if (!userCheck[0] || userCheck[0].role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // ✅ Next.js 15: await params
    const { id: userId } = await params;
    const body = await req.json();
    const { status } = body;

    // ✅ Validate status
    if (!status || !['active', 'suspended'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be "active" or "suspended"' },
        { status: 400 }
      );
    }

    // ✅ Check if target user exists
    const [targetUser] = await pool.query(
      'SELECT id, role, status FROM users WHERE id = ?',
      [userId]
    );

    if (!targetUser[0]) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // ✅ Prevent admin from suspending themselves
    if (decoded.sub === parseInt(userId)) {
      return NextResponse.json(
        { success: false, error: 'Cannot change your own status' },
        { status: 400 }
      );
    }

    // ✅ Prevent admin from suspending another admin (optional security)
    if (targetUser[0].role === 'admin' && status === 'suspended') {
      return NextResponse.json(
        { success: false, error: 'Cannot suspend another admin' },
        { status: 403 }
      );
    }

    // ✅ Update user status
    await pool.query(
      'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, userId]
    );

    return NextResponse.json({
      success: true,
      message: `User status updated to ${status}`,
      data: {
        userId: parseInt(userId),
        oldStatus: targetUser[0].status,
        newStatus: status,
      },
    });

  } catch (error: any) {
    console.error('Admin update user error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to update user',
        code: 'ADMIN_UPDATE_USER_ERROR'
      },
      { status: 500 }
    );
  }
}
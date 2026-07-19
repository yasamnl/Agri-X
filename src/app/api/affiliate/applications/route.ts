// src/app/api/affiliate/applications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

// ============================================================================
// GET: List all affiliate applications for current user
// ============================================================================
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

    // ✅ Fetch all applications for this user
    const [applications] = await pool.query(
      `SELECT 
        aa.id,
        aa.user_id,
        aa.sosmed_accounts,
        aa.status,
        aa.referral_code,
        aa.approved_at,
        aa.rejected_at,
        aa.created_at,
        aa.updated_at,
        (SELECT COUNT(*) FROM referral_transactions rt 
         WHERE rt.affiliate_application_id = aa.id) as total_orders,
        (SELECT COALESCE(SUM(rt.komisi), 0) FROM referral_transactions rt 
         WHERE rt.affiliate_application_id = aa.id AND rt.status = 'completed') as total_commission
      FROM affiliate_applications aa
      WHERE aa.user_id = ?
      ORDER BY aa.created_at DESC`,
      [decoded.sub]
    );

    // ✅ Format response
    const formattedApps = (applications as any[]).map((app) => {
      let sosmedAccounts = [];
      try {
        if (app.sosmed_accounts) {
          sosmedAccounts = typeof app.sosmed_accounts === 'string'
            ? JSON.parse(app.sosmed_accounts)
            : app.sosmed_accounts;
        }
      } catch (e) {
        console.warn('Failed to parse sosmed_accounts:', e);
      }

      return {
        id: Number(app.id),
        userId: Number(app.user_id),
        status: app.status,
        referralCode: app.referral_code || null,
        sosmedAccounts,
        approvedAt: app.approved_at,
        rejectedAt: app.rejected_at,
        createdAt: app.created_at,
        updatedAt: app.updated_at,
        stats: {
          totalOrders: Number(app.total_orders || 0),
          totalCommission: Number(app.total_commission || 0),
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedApps,
      total: formattedApps.length,
    });

  } catch (error: any) {
    console.error('❌ GET affiliate applications error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Create new affiliate application
// ============================================================================
export async function POST(req: NextRequest) {
  let connection;

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

    const body = await req.json();
    const { sosmedAccounts } = body;

    // ✅ Validation
    if (!sosmedAccounts || !Array.isArray(sosmedAccounts) || sosmedAccounts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Minimal 1 akun sosial media wajib diisi' },
        { status: 400 }
      );
    }

    // ✅ Check if user already has pending/approved application
    connection = await pool.getConnection();
    
    const [existing] = await connection.query(
      `SELECT id, status FROM affiliate_applications 
       WHERE user_id = ? AND status IN ('pending', 'approved')`,
      [decoded.sub]
    );

    if ((existing as any[]).length > 0) {
      connection.release();
      return NextResponse.json(
        { 
          success: false, 
          error: 'Anda sudah memiliki aplikasi affiliate yang sedang diproses atau disetujui' 
        },
        { status: 400 }
      );
    }

    // ✅ Insert new application
    const [result] = await connection.query(
      `INSERT INTO affiliate_applications 
       (user_id, sosmed_accounts, status, created_at, updated_at)
       VALUES (?, ?, 'pending', NOW(), NOW())`,
      [decoded.sub, JSON.stringify(sosmedAccounts)]
    );

    const applicationId = (result as any).insertId;

    await connection.commit();
    connection.release();

    return NextResponse.json({
      success: true,
      message: 'Aplikasi affiliate berhasil diajukan! Tim kami akan mereview dalam 1-3 hari kerja.',
      data: {
        id: applicationId,
        status: 'pending',
      },
    });

  } catch (error: any) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('❌ POST affiliate application error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
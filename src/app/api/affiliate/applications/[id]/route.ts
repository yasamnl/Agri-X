// src/app/api/affiliate/applications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

// ============================================================================
// GET: Get single affiliate application
// ============================================================================
export async function GET(req: NextRequest, { params }: Params) {
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

    const { id } = await params;
    const applicationId = parseInt(id);

    if (isNaN(applicationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid application ID' },
        { status: 400 }
      );
    }

    // ✅ Fetch application dengan stats
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
        u.name as user_name,
        u.email as user_email,
        u.no_telp as user_phone,
        u.avatar as user_avatar,
        (SELECT COUNT(*) FROM referral_transactions rt 
         WHERE rt.affiliate_application_id = aa.id) as total_orders,
        (SELECT COALESCE(SUM(rt.nominal_transaksi), 0) FROM referral_transactions rt 
         WHERE rt.affiliate_application_id = aa.id AND rt.status = 'completed') as total_revenue,
        (SELECT COALESCE(SUM(rt.komisi), 0) FROM referral_transactions rt 
         WHERE rt.affiliate_application_id = aa.id AND rt.status = 'completed') as total_commission
      FROM affiliate_applications aa
      INNER JOIN users u ON aa.user_id = u.id
      WHERE aa.id = ? AND aa.user_id = ?`,
      [applicationId, decoded.sub]
    );

    const application = (applications as any[])[0];
    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    // ✅ Parse sosmed_accounts JSON
    let sosmedAccounts = [];
    try {
      if (application.sosmed_accounts) {
        sosmedAccounts = typeof application.sosmed_accounts === 'string'
          ? JSON.parse(application.sosmed_accounts)
          : application.sosmed_accounts;
      }
    } catch (e) {
      console.warn('Failed to parse sosmed_accounts:', e);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: Number(application.id),
        userId: Number(application.user_id),
        status: application.status,
        referralCode: application.referral_code || null,
        sosmedAccounts,
        approvedAt: application.approved_at,
        rejectedAt: application.rejected_at,
        createdAt: application.created_at,
        updatedAt: application.updated_at,
        user: {
          name: application.user_name,
          email: application.user_email,
          phone: application.user_phone,
          avatar: application.user_avatar,
        },
        stats: {
          totalOrders: Number(application.total_orders || 0),
          totalRevenue: Number(application.total_revenue || 0),
          totalCommission: Number(application.total_commission || 0),
        },
      },
    });

  } catch (error: any) {
    console.error('❌ GET affiliate application error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT: Update application (cancel by user)
// ============================================================================
export async function PUT(req: NextRequest, { params }: Params) {
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

    const { id } = await params;
    const applicationId = parseInt(id);

    if (isNaN(applicationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid application ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { action } = body;

    // ✅ Only allow cancel action for user
    if (action !== 'cancel') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Only "cancel" is allowed.' },
        { status: 400 }
      );
    }

    // ✅ Check ownership and status
    const [applications] = await pool.query(
      `SELECT id, status FROM affiliate_applications 
       WHERE id = ? AND user_id = ?`,
      [applicationId, decoded.sub]
    );

    const application = (applications as any[])[0];
    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    if (application.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Only pending applications can be cancelled' },
        { status: 400 }
      );
    }

    // ✅ Update status to cancelled
    await pool.query(
      `UPDATE affiliate_applications 
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = ?`,
      [applicationId]
    );

    return NextResponse.json({
      success: true,
      message: 'Application cancelled successfully',
    });

  } catch (error: any) {
    console.error('❌ PUT affiliate application error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Delete application (only if pending)
// ============================================================================
export async function DELETE(req: NextRequest, { params }: Params) {
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

    const { id } = await params;
    const applicationId = parseInt(id);

    if (isNaN(applicationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid application ID' },
        { status: 400 }
      );
    }

    // ✅ Check ownership and status
    const [applications] = await pool.query(
      `SELECT id, status FROM affiliate_applications 
       WHERE id = ? AND user_id = ?`,
      [applicationId, decoded.sub]
    );

    const application = (applications as any[])[0];
    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    if (application.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Only pending applications can be deleted' },
        { status: 400 }
      );
    }

    // ✅ Delete application
    await pool.query(
      `DELETE FROM affiliate_applications WHERE id = ?`,
      [applicationId]
    );

    return NextResponse.json({
      success: true,
      message: 'Application deleted successfully',
    });

  } catch (error: any) {
    console.error('❌ DELETE affiliate application error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
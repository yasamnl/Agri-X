// File: src/app/api/admin/affiliate/applications/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    const [users] = await pool.query(
      `SELECT role FROM users WHERE id = ?`,
      [decoded.sub]
    );

    if (!users[0] || users[0].role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const applicationId = params.id;
    const body = await req.json();

    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Get application
    const [applications] = await pool.query(
      `SELECT id, status, user_id FROM affiliate_applications WHERE id = ?`,
      [applicationId]
    );

    if (!applications[0]) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    if (applications[0].status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Application already processed' },
        { status: 409 }
      );
    }

    // Update application
    if (body.action === 'approve') {
      await pool.query(
        `UPDATE affiliate_applications 
         SET status = 'approved', approved_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [applicationId]
      );

      return NextResponse.json({
        success: true,
        message: 'Application approved successfully'
      });
    } else {
      await pool.query(
        `UPDATE affiliate_applications 
         SET status = 'rejected', rejected_at = NOW(), rejection_reason = ?, updated_at = NOW()
         WHERE id = ?`,
        [body.reason || null, applicationId]
      );

      return NextResponse.json({
        success: true,
        message: 'Application rejected successfully'
      });
    }

  } catch (error: any) {
    console.error('Error processing application:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process application' },
      { status: 500 }
    );
  }
}
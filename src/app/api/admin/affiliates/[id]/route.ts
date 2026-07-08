// src/app/api/admin/affiliates/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);
    const body = await req.json();
    const { action, rejectionReason } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Check if application exists
    const [applications] = await pool.query<any[]>(
      'SELECT id, user_id, status, referral_code FROM affiliate_applications WHERE id = ?',
      [applicationId]
    );

    if (!applications[0]) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    const app = applications[0];

    if (app.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Application already processed' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      await pool.query(
        `UPDATE affiliate_applications 
         SET status = 'approved', approved_at = ?, updated_at = ?
         WHERE id = ?`,
        [now, now, applicationId]
      );

      // Create activation request
      await pool.query(
        `INSERT INTO activation_requests 
         (user_id, status, pesan, created_at, updated_at)
         VALUES (?, 'disetujui', 'Aplikasi affiliate Anda telah disetujui', NOW(), NOW())`,
        [app.user_id]
      );

      // Send notification
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
         VALUES (?, ?, ?, 'affiliate_approved', FALSE, NOW())`,
        [
          app.user_id,
          'Selamat! Aplikasi Affiliate Disetujui',
          `Aplikasi affiliate Anda telah disetujui. Kode referral: ${app.referral_code}`,
        ]
      );

      return NextResponse.json({
        success: true,
        message: 'Application approved',
      });
    } else {
      await pool.query(
        `UPDATE affiliate_applications 
         SET status = 'rejected', rejected_at = ?, updated_at = ?
         WHERE id = ?`,
        [now, now, applicationId]
      );

      // Create activation request
      await pool.query(
        `INSERT INTO activation_requests 
         (user_id, status, pesan, catatan, created_at, updated_at)
         VALUES (?, 'ditolak', 'Aplikasi affiliate Anda ditolak', ?, NOW(), NOW())`,
        [app.user_id, rejectionReason || '']
      );

      // Send notification
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
         VALUES (?, ?, ?, 'affiliate_rejected', FALSE, NOW())`,
        [
          app.user_id,
          'Aplikasi Affiliate Ditolak',
          rejectionReason ? `Aplikasi Anda ditolak. Alasan: ${rejectionReason}` : 'Aplikasi Anda ditolak',
        ]
      );

      return NextResponse.json({
        success: true,
        message: 'Application rejected',
      });
    }

  } catch (error: any) {
    console.error('Process affiliate error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
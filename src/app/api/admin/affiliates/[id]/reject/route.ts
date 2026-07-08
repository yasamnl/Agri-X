// src/app/api/admin/affiliates/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  let connection;

  try {
    // 1. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);

    if (isNaN(applicationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid application ID' },
        { status: 400 }
      );
    }

    // 2. Parse body untuk alasan penolakan
    const body = await req.json();
    const { reason } = body;

    // 3. Start transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 4. Get application
      const [applications] = await connection.query(
        `SELECT aa.*, u.name as user_name, u.email as user_email
         FROM affiliate_applications aa
         JOIN users u ON aa.user_id = u.id
         WHERE aa.id = ? AND aa.status = 'pending'
         FOR UPDATE`,
        [applicationId]
      );

      const application = (applications as any[])[0];

      if (!application) {
        await connection.rollback();
        return NextResponse.json(
          { success: false, error: 'Application not found or already processed' },
          { status: 404 }
        );
      }

      // 5. Update application status
      await connection.query(
        `UPDATE affiliate_applications 
         SET status = 'rejected', 
             rejected_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [applicationId]
      );

      // 6. Commit transaction
      await connection.commit();

      // 7. ✅ Return valid JSON response
      return NextResponse.json({
        success: true,
        message: 'Affiliate application rejected',
        data: {
          applicationId,
          reason: reason || 'No reason provided',
          userName: application.user_name,
          userEmail: application.user_email,
        },
      });

    } catch (error: any) {
      await connection.rollback();
      throw error;
    }

  } catch (error: any) {
    console.error('❌ Reject affiliate error:', error);
    
    // ✅ Pastikan selalu return JSON yang valid
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to reject application' 
      },
      { status: error.status || 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
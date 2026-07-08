// src/app/api/admin/affiliates/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import crypto from 'crypto';

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

    // 2. Start transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 3. Get application
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

      // 4. ✅ Generate unique referral code
      const referralCode = generateReferralCode(application.user_name);

      // 5. Update application status
      await connection.query(
        `UPDATE affiliate_applications 
         SET status = 'approved', 
             referral_code = ?,
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [referralCode, applicationId]
      );

      // 6. Commit transaction
      await connection.commit();

      // 7. ✅ Return valid JSON response
      return NextResponse.json({
        success: true,
        message: 'Affiliate application approved successfully',
        data: {
          applicationId,
          referralCode,
          userName: application.user_name,
          userEmail: application.user_email,
        },
      });

    } catch (error: any) {
      await connection.rollback();
      throw error;
    }

  } catch (error: any) {
    console.error('❌ Approve affiliate error:', error);
    
    // ✅ Pastikan selalu return JSON yang valid
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to approve application' 
      },
      { status: error.status || 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// ✅ Helper: Generate unique referral code
function generateReferralCode(userName: string): string {
  // Format: USER-XXXXXX (contoh: JOHN-A3F9K2)
  const prefix = userName
    .split(' ')[0]
    .toUpperCase()
    .substring(0, 4)
    .padEnd(4, 'X');
  
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  
  return `${prefix}-${random}`;
}
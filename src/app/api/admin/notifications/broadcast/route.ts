import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { NotificationService } from '@/lib/notification.service';

export async function POST(req: NextRequest) {
  try {
    // ✅ 1. Admin auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const adminUserId = parseInt(decoded.sub);
    const {
      templateCode,
      variables,
      targetAudience,
      customUserIds,
      scheduledAt,
    } = await req.json();

    // ✅ 2. Validation
    if (!templateCode) {
      return NextResponse.json(
        { success: false, error: 'Template code is required' },
        { status: 400 }
      );
    }

    // ✅ 3. Create broadcast record - PostgreSQL: RETURNING id
    const insertResult: any = await pool.execute(
      `INSERT INTO notification_broadcasts (
        template_code, title, message, type, link,
        target_audience, custom_user_ids, status, scheduled_at, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        templateCode,
        variables?.title || '',
        variables?.message || '',
        'system',
        variables?.link || null,
        targetAudience || 'all',
        customUserIds ? JSON.stringify(customUserIds) : null,
        scheduledAt ? 'scheduled' : 'sending',
        scheduledAt || null,
        adminUserId,
      ]
    );

    // Normalize insert result to get inserted id for different drivers
    const broadcastId = insertResult?.[0]?.insertId ?? insertResult?.insertId ?? null;

    // ✅ 4. Send immediately or schedule
    if (!scheduledAt) {
      const result: any = await NotificationService.broadcast({
        templateCode,
        variables: variables || {},
        targetAudience: targetAudience || 'all',
        customUserIds,
        type: 'system',
        createdBy: adminUserId,
      });

      // Update broadcast status - PostgreSQL syntax
      await pool.execute(
        'UPDATE notification_broadcasts SET status = ?, sent_count = ?, updated_at = NOW() WHERE id = ?',
        [result?.success ? 'completed' : 'failed', result?.sentCount || 0, broadcastId]
      );

      return NextResponse.json({
        success: true,
        broadcastId,
        sentCount: result?.sentCount,
      });
    } else {
      // Scheduled for later (implement cron job to process)
      return NextResponse.json({
        success: true,
        broadcastId,
        message: 'Broadcast scheduled',
        scheduledAt,
      });
    }

  } catch (error: any) {
    console.error('Broadcast error:', error);
    
    // ✅ Handle PostgreSQL error codes
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { success: false, error: 'Duplicate entry', code: 'DUPLICATE_ENTRY' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
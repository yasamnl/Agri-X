// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

// ✅ ✅ UPDATED: Tambah 'comment' ke validTypes
const VALID_REPORTED_TYPES = [
  'product', 
  'forum_post', 
  'user', 
  'order', 
  'review', 
  'comment',    
  'general'
];

const VALID_REASONS = ['spam', 'fraud', 'inappropriate', 'copyright', 'others'];

export async function POST(req: NextRequest) {
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
    const { 
      reported_type, 
      reported_id, 
      reason, 
      description,
      context_snapshot 
    } = body;

    // ✅ Debug log
    console.log('📥 Received report:', {
      reported_type,
      reported_id,
      reason,
      description_length: description?.length,
      has_context: !!context_snapshot
    });

    // ✅ Validasi reported_type
    if (!reported_type || !VALID_REPORTED_TYPES.includes(reported_type)) {
      console.error('❌ Invalid reported_type:', reported_type);
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid reported type: ${reported_type}. Valid types: ${VALID_REPORTED_TYPES.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // ✅ Validasi reason
    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid reason: ${reason}. Valid reasons: ${VALID_REASONS.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // ✅ Validasi description
    if (!description || description.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Description must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Check duplicate report (24 hours)
    const [existingReports] = await pool.query(
      `SELECT id FROM reports 
       WHERE reporter_id = ? 
       AND reported_type = ? 
       AND reported_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       AND status = 'pending'`,
      [decoded.sub, reported_type, reported_id || 0]
    );

    if (existingReports.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Anda sudah mengirim laporan serupa dalam 24 jam terakhir' 
        },
        { status: 409 }
      );
    }

    // ✅ Insert dengan context_snapshot
    const [result] = await pool.query(
      `INSERT INTO reports 
       (reporter_id, reported_type, reported_id, reason, description, context_snapshot, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        decoded.sub, 
        reported_type, 
        reported_id || 0, 
        reason, 
        description,
        context_snapshot ? JSON.stringify(context_snapshot) : null,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Laporan berhasil dikirim',
      data: { id: result.insertId },
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Create report error:', error);
    
    // ✅ Handle MySQL ENUM error
    if (error.code === 'ER_DATA_TOO_LONG' || error.sqlState === '22001') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Tipe laporan tidak valid. Silakan refresh halaman dan coba lagi.' 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
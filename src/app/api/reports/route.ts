// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

// ✅ PASTIKAN 'comment' ADA DI SINI
const VALID_TYPES = [
  'product', 
  'forum_post', 
  'user', 
  'order', 
  'review', 
  'comment',    // ← INI PENTING!
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
    const { reported_type, reported_id, reason, description, context_snapshot } = body;

    if (process.env.NODE_ENV === 'development') console.log('📥 [BACKEND] received_type:', reported_type);

    // Validasi reported_type
    if (!reported_type || !VALID_TYPES.includes(reported_type)) {
      console.error('❌ Invalid reported_type:', reported_type);
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid reported type: "${reported_type}". Valid: ${VALID_TYPES.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Validasi reason
    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reason' },
        { status: 400 }
      );
    }

    // Validasi description
    if (!description || description.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Description must be at least 5 characters' },
        { status: 400 }
      );
    }

    // Check duplicate
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM reports 
       WHERE reporter_id = ? AND reported_type = ? AND reported_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       AND status = 'pending'`,
      [decoded.sub, reported_type, reported_id || 0]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Anda sudah mengirim laporan serupa dalam 24 jam terakhir' },
        { status: 409 }
      );
    }

    // Insert
    const [result] = await pool.query<ResultSetHeader>(
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

    if (process.env.NODE_ENV === 'development') console.log('✅ Success! ID:', result.insertId);

    return NextResponse.json({
      success: true,
      message: 'Laporan berhasil dikirim',
      data: { id: result.insertId },
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error:', error);
    
    // Handle ENUM error
    if (error.code === 'ER_TRUNCATED_WRONG_VALUE' || 
        error.sqlMessage?.includes('Data truncated')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database ENUM error. Jalankan: ALTER TABLE reports MODIFY COLUMN reported_type ENUM(...)' 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
// src/app/api/admin/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

// Mapping status Indonesia → Database

// ============================================================================
// GET: Get list of reports (NO PARAMS - only query parameters)
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    // ✅ Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // ✅ Parse query parameters (NOT route params)
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 100);
    const status = searchParams.get('status') || 'all';
    const jenis = searchParams.get('jenis') || 'all';
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    
    const offset = (page - 1) * limit;

    // ✅ Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      conditions.push('r.status = ?');
      params.push(status);
    }

    if (jenis && jenis !== 'all') {
      conditions.push('r.reason = ?');
      params.push(jenis);
    }

    if (search) {
      conditions.push('(r.description LIKE ? OR up.name LIKE ? OR ut.name LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (dateFrom) {
      conditions.push('DATE(r.created_at) >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('DATE(r.created_at) <= ?');
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ✅ Fetch reports
    const [] = await pool.query<any[]>(
      `SELECT 
        r.id,
        r.reporter_id,
        r.reported_id,
        r.reason,
        r.description,
        r.status,
        r.admin_note,
        r.resolved_by,
        r.created_at,
        r.updated_at,
        up.name as reporter_name,
        up.email as reporter_email,
        up.avatar as reporter_avatar,
        ut.name as reported_name,
        ut.email as reported_email,
        ut.avatar as reported_avatar
      FROM reports r
      LEFT JOIN users up ON r.reporter_id = up.id
      LEFT JOIN users ut ON r.reported_id = ut.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // ✅ Get total count
    const [countResult]: any = await pool.query(
      `SELECT COUNT(*) as total
       FROM reports r
       LEFT JOIN users up ON r.reporter_id = up.id
       LEFT JOIN users ut ON r.reported_id = ut.id
       ${whereClause}`,
      params
    );

    const total = countResult[0]?.total || 0;

    // ✅ Get status counts
    const [statusCounts]: any = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM reports
       GROUP BY status`
    );

    const statusCountMap: Record<string, number> = {
      all: total,
      menunggu: 0,
      ditinjau: 0,
      selesai: 0,
      ditolak: 0,
    };

    statusCounts.forEach((row: any) => {
      statusCountMap[row.status] = Number(row.count);
    });

    // ✅ Get jenis counts
    // Di bagian query untuk jenisCounts
const [jenisCounts]: any = await pool.query(
  `SELECT reason, COUNT(*) as count
   FROM reports
   GROUP BY reason`
);

const jenisCountMap: Record<string, number> = {};
jenisCounts.forEach((row: any) => {
  jenisCountMap[row.reason] = Number(row.count);
});

// Di response
return NextResponse.json({
  success: true,
  data: {
    // ...
    jenisCounts: {
      all: total,
      spam: jenisCountMap['spam'] || 0,
      fraud: jenisCountMap['fraud'] || 0,
      inappropriate: jenisCountMap['inappropriate'] || 0,
      copyright: jenisCountMap['copyright'] || 0,
      others: jenisCountMap['others'] || 0,
    },
  },
});

  } catch (error: any) {
    console.error('Admin reports error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch reports' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH: Update report status
// ============================================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ success: boolean; message: string; data: { id: number; oldStatus: any; newStatus: any; resolvedBy: string; }; }> | NextResponse<{ success: boolean; error: any; }>> {
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
    const reportId = parseInt(id);
    const body = await req.json();
    const { status, adminNote } = body;

    // Validasi status
    const validStatuses = ['menunggu', 'ditinjau', 'selesai', 'ditolak'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Check if report exists
    const [reports]: any = await pool.query(
      'SELECT id, status, reporter_id FROM reports WHERE id = ?',
      [reportId]
    );

    if (!reports[0]) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      );
    }

    const oldStatus = reports[0].status;
    const reporterId = reports[0].reporter_id;

    // ✅ UPDATE: Tambah resolved_by dengan ID admin yang sedang login
    await pool.query(
      `UPDATE reports 
       SET status = ?, 
           admin_note = ?, 
           resolved_by = ?,
           updated_at = NOW() 
       WHERE id = ?`,
      [status, adminNote || null, decoded.sub, reportId]
      //              ↑ admin note  ↑ admin ID yang menulis note
    );

    // Create notification for reporter
    if (reporterId) {
      const statusMessages: Record<string, string> = {
        menunggu: 'Laporan Anda sedang menunggu peninjauan',
        ditinjau: 'Laporan Anda sedang ditinjau oleh tim kami',
        selesai: 'Laporan Anda telah selesai ditindaklanjuti',
        ditolak: 'Laporan Anda tidak dapat ditindaklanjuti',
      };

      const message = `${statusMessages[status]}${adminNote ? `\n\nCatatan: ${adminNote}` : ''}`;

      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, reading, created_at)
         VALUES (?, ?, ?, 'report_status', FALSE, NOW())`,
        [reporterId, 'Update Status Laporan', message]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Report updated successfully',
      data: {
        id: reportId,
        oldStatus,
        newStatus: status,
        resolvedBy: decoded.sub, // ✅ Return admin ID
      },
    });

  } catch (error: any) {
    console.error('Update report error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Delete report
// ============================================================================
export async function DELETE(
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
    const reportId = parseInt(id, 10);

    if (isNaN(reportId)) {
      return NextResponse.json({ success: false, error: 'Invalid report ID' }, { status: 400 });
    }

    const [reports]: any = await pool.query('SELECT id FROM reports WHERE id = ?', [reportId]);

    if (!reports[0]) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    await pool.query('DELETE FROM reports WHERE id = ?', [reportId]);

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully',
      data: { id: reportId },
    });

  } catch (error: any) {
    console.error('DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
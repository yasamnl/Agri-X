// src/app/api/admin/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 100);
    const status = searchParams.get('status') || 'all';
    const type = searchParams.get('type') || 'all';
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      conditions.push('r.status = ?');
      params.push(status);
    }

    if (type && type !== 'all') {
      conditions.push('r.reported_type = ?');
      params.push(type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch reports
    const [reports] = await pool.query<any[]>(
      `SELECT 
        r.id,
        r.reporter_id,
        r.reported_type,
        r.reported_id,
        r.reason,
        r.description,
        r.status,
        r.admin_note,
        r.context_snapshot,
        r.created_at,
        r.updated_at,
        u.name as reporter_name,
        u.email as reporter_email,
        u.avatar as reporter_avatar
      FROM reports r
      LEFT JOIN users u ON r.reporter_id = u.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // ✅ Fetch context data untuk setiap report
    const reportsWithContext = await Promise.all(
      reports.map(async (report: any) => {
        let contextData = null;

        try {
          // Parse context_snapshot jika ada
          if (report.context_snapshot) {
            contextData = typeof report.context_snapshot === 'string' 
              ? JSON.parse(report.context_snapshot) 
              : report.context_snapshot;
          }

          // ✅ Jika tidak ada context_snapshot, fetch dari database
          if (!contextData && report.reported_id) {
            switch (report.reported_type) {
              case 'forum_post':
                const [posts] = await pool.query<any[]>(
                  `SELECT p.id, p.title, p.content, p.user_id, u.name as author_name, u.avatar as author_avatar, c.name as category_name
                   FROM forum_posts p
                   LEFT JOIN users u ON p.user_id = u.id
                   LEFT JOIN forum_categories c ON p.category_id = c.id
                   WHERE p.id = ?`,
                  [report.reported_id]
                );
                if (posts[0]) {
                  contextData = {
                    type: 'forum_post',
                    id: posts[0].id,
                    title: posts[0].title,
                    content: posts[0].content,
                    author: {
                      id: posts[0].user_id,
                      name: posts[0].author_name,
                      avatar: posts[0].author_avatar,
                    },
                    category: posts[0].category_name,
                  };
                }
                break;

              case 'comment':
                const [comments] = await pool.query<any[]>(
                  `SELECT c.id, c.content, c.user_id, c.post_id, u.name as author_name, u.avatar as author_avatar,
                          p.title as post_title, p.content as post_content
                   FROM forum_comments c
                   LEFT JOIN users u ON c.user_id = u.id
                   LEFT JOIN forum_posts p ON c.post_id = p.id
                   WHERE c.id = ?`,
                  [report.reported_id]
                );
                if (comments[0]) {
                  contextData = {
                    type: 'comment',
                    id: comments[0].id,
                    content: comments[0].content,
                    author: {
                      id: comments[0].user_id,
                      name: comments[0].author_name,
                      avatar: comments[0].author_avatar,
                    },
                    parentPost: {
                      id: comments[0].post_id,
                      title: comments[0].post_title,
                      content: comments[0].post_content,
                    },
                  };
                }
                break;

              case 'product':
                const [products] = await pool.query<any[]>(
                  `SELECT p.id, p.name, p.description, p.price, p.unit, p.image_path, p.seller_id,
                          u.name as seller_name, u.avatar as seller_avatar, c.name as category_name
                   FROM products p
                   LEFT JOIN users u ON p.seller_id = u.id
                   LEFT JOIN category c ON p.category_id = c.id
                   WHERE p.id = ?`,
                  [report.reported_id]
                );
                if (products[0]) {
                  contextData = {
                    type: 'product',
                    id: products[0].id,
                    name: products[0].name,
                    description: products[0].description,
                    price: products[0].price,
                    unit: products[0].unit,
                    image: products[0].image_path,
                    seller: {
                      id: products[0].seller_id,
                      name: products[0].seller_name,
                      avatar: products[0].seller_avatar,
                    },
                    category: products[0].category_name,
                  };
                }
                break;

              case 'user':
                const [users] = await pool.query<any[]>(
                  'SELECT id, name, email, avatar, role FROM users WHERE id = ?',
                  [report.reported_id]
                );
                if (users[0]) {
                  contextData = {
                    type: 'user',
                    id: users[0].id,
                    name: users[0].name,
                    email: users[0].email,
                    avatar: users[0].avatar,
                    role: users[0].role,
                  };
                }
                break;

              default:
                // General report - no context needed
                break;
            }
          }
        } catch (error) {
          console.error('Error fetching context for report:', report.id, error);
        }

        return {
          id: Number(report.id),
          reporter: {
            id: Number(report.reporter_id),
            name: report.reporter_name,
            email: report.reporter_email,
            avatar: report.reporter_avatar,
          },
          reportedType: report.reported_type,
          reportedId: Number(report.reported_id),
          reason: report.reason,
          description: report.description,
          statusLaporan: report.status,
          adminNote: report.admin_note,
          contextData, // ✅ Data kontekstual
          tanggalLaporan: report.created_at,
          updatedAt: report.updated_at,
        };
      })
    );

    // Get total count
    const [countResult] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM reports r ${whereClause}`,
      params
    );

    const total = countResult[0]?.total || 0;

    // Get status counts
    const [statusCounts] = await pool.query<any[]>(
      `SELECT status, COUNT(*) as count FROM reports GROUP BY status`
    );

    const statusCountMap: Record<string, number> = {};
    statusCounts.forEach((row: any) => {
      statusCountMap[row.status] = Number(row.count);
    });

    // Get type counts
    const [typeCounts] = await pool.query<any[]>(
      `SELECT reported_type, COUNT(*) as count FROM reports GROUP BY reported_type`
    );

    const typeCountMap: Record<string, number> = {};
    typeCounts.forEach((row: any) => {
      typeCountMap[row.reported_type] = Number(row.count);
    });

    return NextResponse.json({
      success: true,
      data: {
        reports: reportsWithContext,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        statusCounts: {
          all: total,
          menunggu: statusCountMap['pending'] || 0,
          ditinjau: statusCountMap['reviewed'] || 0,
          selesai: statusCountMap['resolved'] || 0,
          ditolak: statusCountMap['dismissed'] || 0,
        },
        typeCounts: {
          all: total,
          forum_post: typeCountMap['forum_post'] || 0,
          comment: typeCountMap['comment'] || 0,
          product: typeCountMap['product'] || 0,
          user: typeCountMap['user'] || 0,
          general: typeCountMap['general'] || 0,
        },
      },
    });

  } catch (error: any) {
    console.error('Admin reports error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
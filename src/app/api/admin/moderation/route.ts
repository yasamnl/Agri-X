// src/app/api/admin/moderation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

// ============================================================================
// GET: Fetch posts for moderation (all statuses)
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending'; // Can be 'all', 'pending', 'approved', 'rejected'
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = '';
    const params: any[] = [];

    if (status !== 'all') {
      whereClause = 'WHERE fp.status = ?';
      params.push(status);
    }

    // Get posts with images
    const [posts] = await pool.query<any[]>(
      `SELECT 
        fp.id,
        fp.title,
        fp.content,
        fp.status,
        fp.admin_note,
        fp.views,
        fp.likes as likes,
        fp.comments_count,
        fp.created_at,
        u.name as author_name,
        u.email as author_email,
        COUNT(fpi.id) as image_count
      FROM forum_posts fp
      LEFT JOIN users u ON fp.user_id = u.id
      LEFT JOIN forum_post_images fpi ON fp.id = fpi.post_id
      ${whereClause}
      GROUP BY fp.id
      ORDER BY fp.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get images for each post
    const postsWithImages = await Promise.all(
      posts.map(async (post: any) => {
        const [images]: any = await pool.query(
          `SELECT 
            id,
            image_url,
            image_alt,
            image_source,
            display_order,
            is_primary,
            created_at
          FROM forum_post_images
          WHERE post_id = ?
          ORDER BY display_order ASC, is_primary DESC`,
          [post.id]
        );

        return {
          ...post,
          images: images.map((img: any) => ({
            ...img,
            is_primary: Boolean(img.is_primary),
          })),
        };
      })
    );

    // Get stats
    const [stats]: any = await pool.query(
      `SELECT 
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as approved_today,
        SUM(CASE WHEN status = 'rejected' AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as rejected_today
      FROM forum_posts`
    );

    return NextResponse.json({
      success: true,
      posts: postsWithImages,
      stats: stats[0] || { pending_count: 0, approved_today: 0, rejected_today: 0 },
    });

  } catch (error: any) {
    console.error('Moderation GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Approve/Reject post (ALLOW RE-REVIEW)
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    // Handle broadcast announcement
    if (body.broadcast) {
      return await handleBroadcast(body, decoded);
    }

    const { postId, action, adminNote } = body;

    if (!postId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    // Get post details
    const [posts]: any = await pool.query(
      `SELECT id, user_id, title, status FROM forum_posts WHERE id = ?`,
      [postId]
    );

    if (!posts[0]) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      );
    }

    const post = posts[0];
    const oldStatus = post.status;

    // ✅ REMOVED: Allow re-review of already processed posts
    // if (post.status !== 'pending') {
    //   return NextResponse.json(
    //     { success: false, error: 'Post already processed' },
    //     { status: 400 }
    //   );
    // }

    // Update post status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    await pool.query(
      `UPDATE forum_posts 
       SET status = ?, 
           admin_note = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [newStatus, adminNote || null, postId]
    );

    // Create notification for user
    const notificationTitle = action === 'approve' 
      ? 'Post Anda Disetujui' 
      : 'Post Anda Ditolak';
    
    const notificationMessage = action === 'approve'
      ? `Post "${post.title}" Anda telah disetujui dan sekarang publik.`
      : `Post "${post.title}" Anda ditolak.${adminNote ? ` Alasan: ${adminNote}` : ''}`;

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, reading, created_at)
       VALUES (?, ?, ?, 'forum_moderation', false, NOW())`,
      [post.user_id, notificationTitle, notificationMessage]
    );

    return NextResponse.json({
      success: true,
      message: `Post ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: {
        postId,
        oldStatus,
        newStatus,
      }
    });

  } catch (error: any) {
    console.error('Moderation POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Handle broadcast announcement
// ============================================================================
async function handleBroadcast(body: any, _admin: any) {
  const { title, message, targetAudience, customUserIds, link } = body;

  if (!title || !message) {
    return NextResponse.json(
      { success: false, error: 'Title and message are required' },
      { status: 400 }
    );
  }

  let userIds: number[] = [];

  if (targetAudience === 'all') {
    const [users]: any = await pool.query('SELECT id FROM users');
    userIds = users.map((u: any) => u.id);
  } else if (targetAudience === 'active') {
    const [users]: any = await pool.query(
      `SELECT DISTINCT user_id FROM orders 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    userIds = users.map((u: any) => u.user_id);
  } else if (targetAudience === 'premium') {
    const [users]: any = await pool.query(
      `SELECT id FROM users WHERE role = 'premium' OR subscription_status = 'active'`
    );
    userIds = users.map((u: any) => u.id);
  } else if (targetAudience === 'custom' && customUserIds) {
    userIds = customUserIds.filter((id: number) => !isNaN(id));
  }

  // Create notifications for all users
  if (userIds.length > 0) {
    const values = userIds.map(userId => [
      userId,
      title,
      message,
      link || null,
      'broadcast',
      false,
      new Date(),
    ]);

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, link, type, reading, created_at)
       VALUES ?`,
      [values]
    );
  }

  return NextResponse.json({
    success: true,
    message: `Pengumuman berhasil dikirim ke ${userIds.length} user`,
    recipientsCount: userIds.length,
  });
}
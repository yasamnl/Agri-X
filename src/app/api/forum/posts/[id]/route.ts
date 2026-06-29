// src/app/api/forum/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);

    if (isNaN(postId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    // Get current user if authenticated
    let currentUser: { id: string; role: string } | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      if (decoded) {
        currentUser = { id: decoded.sub, role: decoded.role };
      }
    }

    // Build query
    const userLikeSelect = currentUser
      ? `(SELECT COUNT(*) > 0 FROM forum_likes WHERE post_id = p.id AND user_id = ?) as is_liked`
      : `FALSE as is_liked`;

    const userBookmarkSelect = currentUser
      ? `(SELECT COUNT(*) > 0 FROM forum_bookmarks WHERE post_id = p.id AND user_id = ?) as is_bookmarked`
      : `FALSE as is_bookmarked`;

    const query = `
      SELECT 
        p.id,
        p.user_id,
        p.category_id,
        p.title,
        p.content,
        p.status,
        p.admin_note,
        p.views,
        p.likes,
        p.comments_count,
        CASE WHEN p.is_pinned = 1 THEN TRUE ELSE FALSE END as is_pinned,
        p.is_locked,
        p.created_at,
        p.updated_at,
        u.name as author_name,
        u.avatar as author_avatar,
        c.name as category_name,
        c.slug as category_slug,
        c.icon as category_icon,
        (SELECT COUNT(*) FROM forum_likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id AND is_deleted = FALSE) as comment_count,
        ${userLikeSelect},
        ${userBookmarkSelect}
      FROM forum_posts p
      INNER JOIN users u ON p.user_id = u.id
      INNER JOIN forum_categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.is_deleted = FALSE
    `;

    const queryParams: any[] = [];
    if (currentUser) {
      queryParams.push(currentUser.id, currentUser.id);
    }
    queryParams.push(postId);

    const [posts] = await pool.execute(query, queryParams);

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      );
    }

    const post = posts[0];

    // Increment view count (jangan increment jika author sendiri)
    if (!currentUser || currentUser.id !== String(post.user_id)) {
      await pool.execute(
        'UPDATE forum_posts SET views = views + 1 WHERE id = ?',
        [postId]
      );
      post.views = Number(post.views) + 1;
    }

    // Fetch images
    const [images] = await pool.execute(
      `SELECT id, image_url, image_alt, image_source, display_order, is_primary, created_at
       FROM forum_post_images 
       WHERE post_id = ? 
       ORDER BY display_order ASC, id ASC`,
      [postId]
    );

    return NextResponse.json({
      success: true,
      post: {
        ...post,
        is_pinned: Boolean(post.is_pinned),
        is_liked: Boolean(post.is_liked),
        is_bookmarked: Boolean(post.is_bookmarked),
        images: Array.isArray(images) ? images : [],
      },
    });

  } catch (error: any) {
    console.error('Get post detail error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
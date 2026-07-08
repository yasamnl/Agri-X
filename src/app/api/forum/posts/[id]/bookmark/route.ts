// src/app/api/forum/posts/[id]/bookmark/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(
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
    
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const postId = parseInt(id);

    if (isNaN(postId)) {
      return NextResponse.json({ success: false, error: 'Invalid post ID' }, { status: 400 });
    }

    // Check if post exists
    const [posts] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM forum_posts WHERE id = ? AND is_deleted = FALSE',
      [postId]
    );

    if (!posts[0]) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    // Check if already bookmarked
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM forum_bookmarks WHERE user_id = ? AND post_id = ?',
      [decoded.sub, postId]
    );

    if (existing[0]) {
      // Remove bookmark
      await pool.query(
        'DELETE FROM forum_bookmarks WHERE id = ?',
        [existing[0].id]
      );

      return NextResponse.json({
        success: true,
        bookmarked: false,
        message: 'Bookmark removed',
      });
    } else {
      // Add bookmark
      await pool.query(
        'INSERT INTO forum_bookmarks (user_id, post_id, created_at) VALUES (?, ?, NOW())',
        [decoded.sub, postId]
      );

      return NextResponse.json({
        success: true,
        bookmarked: true,
        message: 'Bookmark added',
      });
    }

  } catch (error: any) {
    console.error('Bookmark error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
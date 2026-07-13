// src/app/api/forum/posts/[id]/preference/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

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

    const body = await req.json();
    const { type } = body;

    // Validasi type
    const validTypes = ['hide', 'not_interested', 'muted'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid preference type' },
        { status: 400 }
      );
    }

    // Check if post exists & get category/author info
    const [posts]: any = await pool.query(
      'SELECT id, category_id, user_id FROM forum_posts WHERE id = ? AND is_deleted = FALSE',
      [postId]
    );

    if (!posts[0]) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    const post = posts[0];

    // Check if preference already exists
    const [existing]: any = await pool.query(
      'SELECT id FROM forum_user_post_preferences WHERE user_id = ? AND post_id = ? AND preference_type = ?',
      [decoded.sub, postId, type]
    );

    if (existing[0]) {
      // Remove preference (toggle off)
      await pool.query(
        'DELETE FROM forum_user_post_preferences WHERE id = ?',
        [existing[0].id]
      );

      return NextResponse.json({
        success: true,
        action: 'removed',
        message: `${type} preference removed`,
      });
    } else {
      // Add preference
      await pool.query(
        `INSERT INTO forum_user_post_preferences 
         (user_id, post_id, category_id, author_id, preference_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          decoded.sub, 
          postId, 
          post.category_id, 
          post.user_id, 
          type
        ]
      );

      // Jika "not_interested", tambahkan juga preferensi untuk category tersebut
      if (type === 'not_interested' && post.category_id) {
        // Check jika belum ada preferensi untuk category ini
        const [existingCategory]: any = await pool.query(
          'SELECT id FROM forum_user_post_preferences WHERE user_id = ? AND category_id = ? AND post_id IS NULL AND preference_type = ?',
          [decoded.sub, post.category_id, 'not_interested']
        );

        if (!existingCategory[0]) {
          await pool.query(
            `INSERT INTO forum_user_post_preferences 
             (user_id, category_id, preference_type, created_at, updated_at)
             VALUES (?, ?, 'not_interested', NOW(), NOW())`,
            [decoded.sub, post.category_id]
          );
        }
      }

      return NextResponse.json({
        success: true,
        action: 'added',
        message: `${type} preference added`,
      });
    }

  } catch (error: any) {
    console.error('Preference error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET: Check user preferences for a post
export async function GET(
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

    const [preferences]: any = await pool.query(
      'SELECT preference_type FROM forum_user_post_preferences WHERE user_id = ? AND post_id = ?',
      [decoded.sub, postId]
    );

    return NextResponse.json({
      success: true,
      data: {
        preferences: preferences.map((p: any) => ({
          type: p.preference_type      })),
      },
    });

  } catch (error: any) {
    console.error('Get preferences error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { NotificationService } from '@/lib/notification.service';

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    // ✅ 1. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = parseInt(decoded.sub);
    const { id } = await params;

    // ✅ 2. Get post details - PostgreSQL syntax
    const [posts] = await pool.execute(
      'SELECT user_id, title FROM forum_posts WHERE id = ? AND is_deleted = FALSE',
      [id]
    );
    const post = posts[0];

    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    // ✅ 3. Check if already liked
    const [existingLikes] = await pool.execute(
      'SELECT id FROM forum_likes WHERE user_id = ? AND post_id = ?',
      [userId, id]
    );

    let liked = false;

    if (existingLikes.length > 0) {
      // Unlike - PostgreSQL: rowCount untuk cek hasil
      const { rowCount } = await pool.execute(
        'DELETE FROM forum_likes WHERE user_id = ? AND post_id = ?',
        [userId, id]
      );
      
      if (rowCount > 0) {
        await pool.execute('UPDATE forum_posts SET likes = likes - 1 WHERE id = ?', [id]);
      }
      liked = false;
    } else {
      // Like
      await pool.execute(
        'INSERT INTO forum_likes (user_id, post_id, created_at) VALUES (?, ?, NOW())',
        [userId, id]
      );
      await pool.execute('UPDATE forum_posts SET likes = likes + 1 WHERE id = ?', [id]);
      liked = true;

      // ✅ Send notification to post owner (if not liking own post)
      if (post.user_id !== userId) {
        const [users] = await pool.execute(
          'SELECT name FROM users WHERE id = ?',
          [userId]
        );
        const liker = users[0];

        await NotificationService.send({
          userId: post.user_id,
          senderId: userId,
          type: 'forum',
          templateCode: 'forum_like',
          variables: {
            username: liker?.name || 'Someone',
            post_title: post.title.substring(0, 50),
            post_id: id,
          },
          actionType: 'forum_like',
          referenceId: id,
        });
      }
    }

    return NextResponse.json({
      success: true,
      liked,
    });

  } catch (error: any) {
    console.error('Like post error:', error);
    
    // ✅ Handle unique constraint (duplicate like)
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ success: true, liked: true }); // Already liked
    }
    
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
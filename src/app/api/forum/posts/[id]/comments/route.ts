import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const resolvedParams = await params;
    const postId = resolvedParams.id;

    if (!postId || isNaN(Number(postId))) {
      return NextResponse.json({ success: false, error: 'Invalid Post ID' }, { status: 400 });
    }

    let comments = [];

    try {
      // ✅ FIX: Ubah ASC → DESC untuk urutan terbaru ke terlama
      const [rows] = await pool.execute(`SELECT 
          c.id,
          c.content,
          c.created_at,
          c.parent_id,
          c.likes as like_count,
          u.name as user_name,
          u.avatar as user_avatar
        FROM forum_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ? 
          AND c.status = 'approved' 
          AND c.is_deleted = FALSE
        ORDER BY c.created_at DESC  -- ✅ DESC = terbaru di atas`, [postId]);

      // Transform flat data to nested tree structure
      const commentsMap = new Map();
      const rootComments = [];

      rows.forEach((row: any) => {
        // ✅ Convert string numbers to actual numbers
        const comment = {
          id: Number(row.id),
          content: row.content,
          created_at: row.created_at,
          parent_id: row.parent_id ? Number(row.parent_id) : null,
          like_count: Number(row.like_count),
          user_name: row.user_name,
          user_avatar: row.user_avatar || null,
          replies: [],
        };
        
        commentsMap.set(comment.id, comment);
      });

      rows.forEach((row: any) => {
        const commentId = Number(row.id);
        const parentId = row.parent_id ? Number(row.parent_id) : null;
        
        if (parentId !== null) {
          const parent = commentsMap.get(parentId);
          if (parent) {
            parent.replies.push(commentsMap.get(commentId));
          }
        } else {
          rootComments.push(commentsMap.get(commentId));
        }
      });

      comments = rootComments;

    } catch (dbError: any) {
      console.error('Database Error:', dbError.message);
      if (dbError.code === 'ER_NO_SUCH_TABLE' || dbError.code === 'ER_BAD_FIELD_ERROR') {
         console.warn('Schema mismatch or missing table. Returning empty comments.');
         comments = [];
      } else {
        throw dbError;
      }
    }

    return NextResponse.json({
      success: true,
      comments: comments,
    });

  } catch (error: any) {
    console.error('Get comments API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
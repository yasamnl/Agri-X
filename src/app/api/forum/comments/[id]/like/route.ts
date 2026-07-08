import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';

type Params = {
  params: Promise<{ id: string }>;
};

// ============================================
// POST: Toggle Like/Unlike pada Komentar
// ============================================
export async function POST(req: NextRequest, { params }: Params) {
  let connection;
  
  try {
    // 1. Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = Number(decoded.sub);
    const resolvedParams = await params;
    const commentId = Number(resolvedParams.id);

    if (!commentId || isNaN(commentId)) {
      return NextResponse.json({ success: false, error: 'Invalid comment ID' }, { status: 400 });
    }

    // 2. Start Transaction untuk konsistensi data
    connection = await pool.getConnection();
    await connection.query('START TRANSACTION');

    try {
      // 3. Validasi Komentar: Harus ada, approved, dan tidak dihapus
      const [commentRows]: any[] = await connection.execute(
        `SELECT id, post_id, user_id, likes, status, is_deleted 
         FROM forum_comments 
         WHERE id = ?`,
        [commentId]
      );

      if (commentRows.length === 0) {
        throw new Error('Komentar tidak ditemukan');
      }

      const comment = commentRows[0];

      if (comment.is_deleted || comment.status !== 'approved') {
        throw new Error('Komentar tidak tersedia');
      }

      // 4. Cek apakah user sudah like komentar ini sebelumnya
      const [likeRows]: any[] = await connection.execute(
        `SELECT id FROM forum_likes WHERE user_id = ? AND comment_id = ?`,
        [userId, commentId]
      );

      const alreadyLiked = likeRows.length > 0;
      let newLikeCount = comment.likes;

      if (alreadyLiked) {
        // ✅ UNLIKE: Hapus record like & kurangi counter
        await connection.execute(
          `DELETE FROM forum_likes WHERE user_id = ? AND comment_id = ?`,
          [userId, commentId]
        );
        newLikeCount = Math.max(0, newLikeCount - 1);
      } else {
        // ✅ LIKE: Tambah record like & tambah counter
        await connection.execute(
          `INSERT INTO forum_likes (user_id, comment_id, created_at) VALUES (?, ?, NOW())`,
          [userId, commentId]
        );
        newLikeCount += 1;
      }

      // 5. Update denormalized likes count di tabel forum_comments
      await connection.execute(
        `UPDATE forum_comments SET likes = ?, updated_at = NOW() WHERE id = ?`,
        [newLikeCount, commentId]
      );

      // 6. Commit Transaction
      await connection.query('COMMIT');

      return NextResponse.json({
        success: true,
        liked: !alreadyLiked, // Status setelah toggle
        likeCount: newLikeCount,
        message: alreadyLiked ? 'Like dihapus' : 'Terima kasih atas like-nya!'
      });

    } catch (error: any) {
      // Rollback jika ada error di tengah transaksi
      if (connection) await connection.query('ROLLBACK');
      throw error;
    } finally {
      if (connection) connection.release();
    }

  } catch (err: any) {
    if (connection) {
      try { await connection.query('ROLLBACK'); connection.release(); } catch (e) {}
    }
    console.error('Error toggling comment like:', err);
    return handleAPIError(err, 'POST /api/forum/comments/[id]/like');
  }
}

// ============================================
// GET: Cek status like user pada komentar
// ============================================
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('Authorization');
    
    // Jika tidak ada token, return false (user belum login/tidak like)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: true, liked: false });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    // Jika token invalid, return false
    if (!decoded) {
      return NextResponse.json({ success: true, liked: false });
    }

    const userId = Number(decoded.sub);
    const resolvedParams = await params;
    const commentId = Number(resolvedParams.id);

    if (!commentId || isNaN(commentId)) {
      return NextResponse.json({ success: false, error: 'Invalid comment ID' }, { status: 400 });
    }

    // Cek apakah user sudah like
    const [rows]: any[] = await pool.execute(
      `SELECT id FROM forum_likes WHERE user_id = ? AND comment_id = ?`,
      [userId, commentId]
    );

    return NextResponse.json({
      success: true,
      liked: rows.length > 0
    });

  } catch (err: any) {
    console.error('Error checking comment like status:', err);
    return handleAPIError(err, 'GET /api/forum/comments/[id]/like');
  }
}
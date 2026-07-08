// src/app/api/forum/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

// ============================================
// HELPER: Handle API Error
// ============================================
function handleAPIError(error: any, context: string) {
  console.error(`Error in ${context}:`, error);
  return NextResponse.json(
    { 
      success: false, 
      error: error.message || 'Internal server error' 
    },
    { status: 500 }
  );
}

// ============================================================================
// GET: Fetch forum posts dengan filter status, pagination, & preferensi user
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'newest';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = (page - 1) * limit;
    const userId = searchParams.get('userId');

    // ✅ Ambil info user dari token untuk permission check & preferensi
    const authHeader = req.headers.get('Authorization');
    let currentUser: { id: string; role: string } | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      if (decoded) {
        currentUser = { id: decoded.sub, role: decoded.role };
      }
    }

    // ============================================
    // ✅ BAGIAN BARU: Ambil Preferensi User
    // ============================================
    let hidePostIds: number[] = [];
    let notInterestedCategoryIds: number[] = [];

    if (currentUser) {
      try {
        // Ambil post yang di-hide oleh user
        const [hiddenPosts] = await pool.execute(
          'SELECT post_id FROM forum_user_post_preferences WHERE user_id = ? AND preference_type = ? AND post_id IS NOT NULL',
          [currentUser.id, 'hide']
        );
        hidePostIds = (hiddenPosts as any[]).map((p) => Number(p.post_id));

        // Ambil category yang tidak diminati oleh user
        const [notInterestedCategories] = await pool.execute(
          'SELECT category_id FROM forum_user_post_preferences WHERE user_id = ? AND preference_type = ? AND category_id IS NOT NULL AND post_id IS NULL',
          [currentUser.id, 'not_interested']
        );
        notInterestedCategoryIds = (notInterestedCategories as any[]).map((c) => Number(c.category_id));
      } catch (prefError) {
        // Jika tabel belum ada, lanjutkan tanpa filter preferensi
        if (process.env.NODE_ENV === 'development') console.warn('forum_user_post_preferences table not found, skipping preference filter');
      }
    }

    // ============================================
    // BUILD STATUS CONDITION
    // ============================================
    let statusCondition = 'p.status = \'approved\'';
    const statusParams: any[] = [];
    
    if (currentUser) {
      if (currentUser.role === 'admin') {
        statusCondition = 'p.is_deleted = FALSE';
      } else if (userId && userId === currentUser.id) {
        statusCondition = '(p.status = \'approved\' OR p.user_id = ?)';
        statusParams.push(currentUser.id);
      } else {
        statusCondition = 'p.status = \'approved\'';
      }
    }

    // ============================================
    // ✅ BUILD MAIN QUERY dengan is_liked & is_bookmarked
    // ============================================
    const userLikeSelect = currentUser 
      ? `(SELECT COUNT(*) > 0 FROM forum_likes WHERE post_id = p.id AND user_id = ?) as is_liked`
      : `FALSE as is_liked`;
    
    const userBookmarkSelect = currentUser
      ? `(SELECT COUNT(*) > 0 FROM forum_bookmarks WHERE post_id = p.id AND user_id = ?) as is_bookmarked`
      : `FALSE as is_bookmarked`;

    let query = `
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
      WHERE p.is_deleted = FALSE AND ${statusCondition}
    `;

    const params: any[] = [...statusParams];

    // ✅ Tambahkan user_id untuk subquery is_liked & is_bookmarked
    if (currentUser) {
      params.push(currentUser.id, currentUser.id);
    }

    // ============================================
    // ✅ FILTER: Exclude post yang di-hide
    // ============================================
    if (hidePostIds.length > 0) {
      const placeholders = hidePostIds.map(() => '?').join(',');
      query += ` AND p.id NOT IN (${placeholders})`;
      params.push(...hidePostIds);
    }

    // ============================================
    // ✅ FILTER: Exclude post dari category yang tidak diminati
    // ============================================
    if (notInterestedCategoryIds.length > 0) {
      const placeholders = notInterestedCategoryIds.map(() => '?').join(',');
      query += ` AND p.category_id NOT IN (${placeholders})`;
      params.push(...notInterestedCategoryIds);
    }

    // ============================================
    // FILTER BY CATEGORY
    // ============================================
    if (category && category !== 'all') {
      query += ' AND c.slug = ?';
      params.push(category);
    }

    // ============================================
    // FILTER BY SEARCH
    // ============================================
    if (search) {
      query += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // ============================================
    // SORTING
    // ============================================
    if (sort === 'popular') {
      query += ' ORDER BY p.likes DESC, p.created_at DESC';
    } else if (sort === 'comments') {
      query += ' ORDER BY p.comments_count DESC, p.created_at DESC';
    } else if (sort === 'oldest') {
      query += ' ORDER BY p.created_at ASC';
    } else {
      // Default: newest, dengan pinned posts di atas
      query += ' ORDER BY p.is_pinned DESC, p.created_at DESC';
    }

    // ============================================
    // PAGINATION
    // ============================================
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // ============================================
    // EXECUTE QUERY
    // ============================================
    const [posts] = await pool.execute(query, params);

    // ============================================
    // GET TOTAL COUNT FOR PAGINATION
    // ============================================
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM forum_posts p
      INNER JOIN forum_categories c ON p.category_id = c.id
      WHERE p.is_deleted = FALSE AND ${statusCondition}
    `;
    const countParams: any[] = [...statusParams];

    // ✅ Apply same filters to count query
    if (hidePostIds.length > 0) {
      const placeholders = hidePostIds.map(() => '?').join(',');
      countQuery += ` AND p.id NOT IN (${placeholders})`;
      countParams.push(...hidePostIds);
    }

    if (notInterestedCategoryIds.length > 0) {
      const placeholders = notInterestedCategoryIds.map(() => '?').join(',');
      countQuery += ` AND p.category_id NOT IN (${placeholders})`;
      countParams.push(...notInterestedCategoryIds);
    }
    
    if (category && category !== 'all') {
      countQuery += ' AND c.slug = ?';
      countParams.push(category);
    }
    if (search) {
      countQuery += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = (countResult as any)[0]?.total || 0;

    // ============================================
    // FETCH IMAGES dari tabel forum_post_images (batch query)
    // ============================================
    const postIds = (Array.isArray(posts) ? posts : []).map((p: any) => p.id);
    let imagesMap: Record<number, any[]> = {};
    
    if (postIds.length > 0) {
      try {
        const [images] = await pool.execute(
          `SELECT post_id, id, image_url, image_alt, image_source, display_order, is_primary
           FROM forum_post_images
           WHERE post_id IN (${postIds.map(() => '?').join(',')})
           ORDER BY post_id, display_order ASC, id ASC`,
          postIds
        );

        (images as any[]).forEach((img) => {
          if (!imagesMap[img.post_id]) {
            imagesMap[img.post_id] = [];
          }
          imagesMap[img.post_id].push({
            id: Number(img.id),
            image_url: img.image_url,
            image_alt: img.image_alt,
            image_source: img.image_source,
            display_order: Number(img.display_order),
            is_primary: Boolean(img.is_primary),
          });
        });
      } catch (imgError) {
        if (process.env.NODE_ENV === 'development') console.warn('Failed to fetch images:', imgError);
      }
    }

    // ============================================
    // FORMAT RESPONSE
    // ============================================
    const postsWithImages = (Array.isArray(posts) ? posts : []).map((post: any) => ({
      ...post,
      id: Number(post.id),
      user_id: Number(post.user_id),
      category_id: Number(post.category_id),
      views: Number(post.views || 0),
      like_count: Number(post.like_count || 0),
      comment_count: Number(post.comment_count || 0),
      is_pinned: Boolean(post.is_pinned),
      is_locked: Boolean(post.is_locked),
      is_liked: Boolean(post.is_liked),
      is_bookmarked: Boolean(post.is_bookmarked),
      images: imagesMap[post.id] || [],
    }));

    return NextResponse.json({
      success: true,
      posts: postsWithImages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1,
      },
    });

  } catch (error: any) {
    return handleAPIError(error, 'GET /api/forum/posts');
  }
}
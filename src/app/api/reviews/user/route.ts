// src/app/api/reviews/user/route.ts
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
    
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;

    const [reviews] = await pool.query<any[]>(
      `SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        p.id as product_id,
        p.name as product_name,
        p.image_path as product_image
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      data: {
        reviews: reviews.map((r: any) => ({
          id: Number(r.id),
          rating: Number(r.rating),
          comment: r.comment,
          createdAt: r.created_at,
          product: {
            id: Number(r.product_id),
            name: r.product_name,
            image: r.product_image,
          },
        })),
      },
    });

  } catch (error: any) {
    console.error('Get user reviews error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
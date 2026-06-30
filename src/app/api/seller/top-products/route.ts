// src/app/api/seller/top-products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // 1. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded || decoded.role !== 'seller') {
      return NextResponse.json(
        { success: false, error: 'Seller access required' },
        { status: 403 }
      );
    }

    const sellerId = decoded.sub;

    // 2. Parse params
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '5'), 1), 20);

    // 3. ✅ Fetch top products dengan rating
    const [products] = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.image_path,
        p.price,
        p.stock,
        COALESCE(SUM(oi.quantity), 0) as total_sold,
        COALESCE(SUM(oi.subtotal), 0) as total_revenue,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as review_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.seller_id = ? AND p.status != 'deleted'
      GROUP BY p.id
      HAVING total_sold > 0
      ORDER BY total_sold DESC, total_revenue DESC
      LIMIT ?`,
      [sellerId, limit]
    );

    const formattedProducts = (products as any[]).map((p: any) => ({
      id: Number(p.id),
      name: p.name,
      image: p.image_path,
      price: Number(p.price),
      stock: Number(p.stock),
      totalSold: Number(p.total_sold || 0),
      totalRevenue: Number(p.total_revenue || 0),
      avgRating: Number(p.avg_rating || 0),
      reviewCount: Number(p.review_count || 0),
    }));

    return NextResponse.json({
      success: true,
      data: {
        products: formattedProducts,
      },
    });

  } catch (error: any) {
    console.error('❌ GET /api/seller/top-products error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
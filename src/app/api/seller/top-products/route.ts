// src/app/api/seller/top-products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'seller') {
      return NextResponse.json({ success: false, error: 'Seller access required' }, { status: 403 });
    }

    const sellerId = decoded.sub;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '5'), 1), 20);

    // ✅ Query dengan subquery terpisah (hindari cartesian product)
    const [products] = await pool.query(
      `SELECT 
        p.id, p.name, p.image_path, p.price, p.stock,
        COALESCE(sales.total_sold, 0) as total_sold,
        COALESCE(sales.total_revenue, 0) as total_revenue,
        COALESCE(reviews_data.avg_rating, 0) as avg_rating,
        COALESCE(reviews_data.review_count, 0) as review_count
      FROM products p
      LEFT JOIN (
        SELECT 
          oi.product_id,
          SUM(oi.quantity) as total_sold,
          SUM(oi.subtotal) as total_revenue
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'completed'
        GROUP BY oi.product_id
      ) sales ON p.id = sales.product_id
      LEFT JOIN (
        SELECT 
          product_id,
          AVG(rating) as avg_rating,
          COUNT(*) as review_count
        FROM reviews
        GROUP BY product_id
      ) reviews_data ON p.id = reviews_data.product_id
      WHERE p.seller_id = ? AND p.status != 'deleted'
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
      data: { products: formattedProducts },
    });

  } catch (error: any) {
    console.error('❌ GET /api/seller/top-products error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
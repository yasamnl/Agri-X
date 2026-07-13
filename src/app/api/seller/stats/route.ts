// src/app/api/seller/stats/route.ts
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

    const [stats] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM products 
         WHERE seller_id = ? AND status != 'deleted') as total_products,
        
        (SELECT COALESCE(SUM(oi.subtotal), 0)
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         INNER JOIN products p ON oi.product_id = p.id
         WHERE p.seller_id = ? AND o.status = 'completed') as total_sales,
        
        (SELECT COUNT(DISTINCT o.id)
         FROM orders o
         INNER JOIN order_items oi ON o.id = oi.order_id
         INNER JOIN products p ON oi.product_id = p.id
         WHERE p.seller_id = ?) as total_orders,
        
        (SELECT COUNT(DISTINCT o.id)
         FROM orders o
         INNER JOIN order_items oi ON o.id = oi.order_id
         INNER JOIN products p ON oi.product_id = p.id
         WHERE p.seller_id = ? 
         AND o.status IN ('paid', 'processing', 'shipped')) as active_orders,
        
        (SELECT COALESCE(AVG(r.rating), 0)
         FROM reviews r
         INNER JOIN products p ON r.product_id = p.id
         WHERE p.seller_id = ?) as avg_rating,
        
        (SELECT COUNT(*)
         FROM reviews r
         INNER JOIN products p ON r.product_id = p.id
         WHERE p.seller_id = ?) as total_reviews,
        
        (SELECT COALESCE(SUM(oi.subtotal), 0)
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         INNER JOIN products p ON oi.product_id = p.id
         WHERE p.seller_id = ? 
         AND o.status = 'completed'
         AND MONTH(o.created_at) = MONTH(CURRENT_DATE())
         AND YEAR(o.created_at) = YEAR(CURRENT_DATE())) as monthly_revenue,
        
        (SELECT COALESCE(SUM(oi.subtotal), 0)
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         INNER JOIN products p ON oi.product_id = p.id
         WHERE p.seller_id = ? 
         AND o.status = 'completed'
         AND DATE(o.created_at) = CURDATE()) as daily_revenue,
        
        (SELECT COUNT(DISTINCT o.id)
         FROM orders o
         INNER JOIN order_items oi ON o.id = oi.order_id
         INNER JOIN products p ON oi.product_id = p.id
         WHERE p.seller_id = ? 
         AND DATE(o.created_at) = CURDATE()) as daily_orders`,
      [
        sellerId, sellerId, sellerId, sellerId,
        sellerId, sellerId, sellerId, sellerId, sellerId
      ]
    );

    const data = (stats as any[])[0] || {};

    return NextResponse.json({
      success: true,
      data: {
        totalProducts: Number(data.total_products || 0),
        totalSales: Number(data.total_sales || 0),
        totalOrders: Number(data.total_orders || 0),
        activeOrders: Number(data.active_orders || 0),
        avgRating: Number(data.avg_rating || 0),
        totalReviews: Number(data.total_reviews || 0),
        monthlyRevenue: Number(data.monthly_revenue || 0),
        dailyRevenue: Number(data.daily_revenue || 0),
        dailyOrders: Number(data.daily_orders || 0),
      },
    });

  } catch (error: any) {
    console.error('❌ GET /api/seller/stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
// src/app/api/seller/stats/route.ts
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

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    if (decoded.role !== 'seller') {
      return NextResponse.json(
        { success: false, error: 'Seller access required' },
        { status: 403 }
      );
    }

    const sellerId = decoded.sub;

    // 2. ✅ Single efficient query untuk semua stats
    const [statsRows] = await pool.query(
      `SELECT
        -- Total produk aktif
        (SELECT COUNT(*) FROM products 
         WHERE seller_id = ? AND status != 'deleted') as total_products,
        
        -- Total penjualan (completed orders)
        (SELECT COALESCE(SUM(oi.subtotal), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.seller_id = ? AND o.status = 'completed') as total_sales,
        
        -- Total pesanan
        (SELECT COUNT(DISTINCT o.id)
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         WHERE oi.seller_id = ?) as total_orders,
        
        -- Pesanan aktif (paid, processing, shipped)
        (SELECT COUNT(DISTINCT o.id)
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         WHERE oi.seller_id = ? 
         AND o.status IN ('paid', 'processing', 'shipped')) as active_orders,
        
        -- Rating rata-rata
        (SELECT COALESCE(AVG(r.rating), 0)
         FROM reviews r
         JOIN products p ON r.product_id = p.id
         WHERE p.seller_id = ?) as avg_rating,
        
        -- Total ulasan
        (SELECT COUNT(*)
         FROM reviews r
         JOIN products p ON r.product_id = p.id
         WHERE p.seller_id = ?) as total_reviews,
        
        -- Pendapatan bulan ini
        (SELECT COALESCE(SUM(oi.subtotal), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.seller_id = ? 
         AND o.status = 'completed'
         AND MONTH(o.created_at) = MONTH(CURRENT_DATE())
         AND YEAR(o.created_at) = YEAR(CURRENT_DATE())) as monthly_revenue,
        
        -- Pendapatan hari ini
        (SELECT COALESCE(SUM(oi.subtotal), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.seller_id = ? 
         AND o.status = 'completed'
         AND DATE(o.created_at) = CURDATE()) as daily_revenue,
        
        -- Pesanan hari ini
        (SELECT COUNT(DISTINCT o.id)
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         WHERE oi.seller_id = ? 
         AND DATE(o.created_at) = CURDATE()) as daily_orders`,
      [
        sellerId, sellerId, sellerId, sellerId,
        sellerId, sellerId, sellerId, sellerId, sellerId
      ]
    );

    const stats = (statsRows as any[])[0] || {};

    return NextResponse.json({
      success: true,
      data: {
        totalProducts: Number(stats.total_products || 0),
        totalSales: Number(stats.total_sales || 0),
        totalOrders: Number(stats.total_orders || 0),
        activeOrders: Number(stats.active_orders || 0),
        avgRating: Number(stats.avg_rating || 0),
        totalReviews: Number(stats.total_reviews || 0),
        monthlyRevenue: Number(stats.monthly_revenue || 0),
        dailyRevenue: Number(stats.daily_revenue || 0),
        dailyOrders: Number(stats.daily_orders || 0),
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
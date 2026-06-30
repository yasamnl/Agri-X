// src/app/api/seller/sales-chart/route.ts
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
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7'), 1), 30);

    // 3. ✅ Fetch data penjualan per hari
    const [salesData] = await pool.query(
      `SELECT 
        DATE(o.created_at) as date,
        COALESCE(SUM(oi.subtotal), 0) as revenue,
        COUNT(DISTINCT o.id) as orders
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.seller_id = ?
        AND o.status = 'completed'
        AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(o.created_at)
      ORDER BY date ASC`,
      [sellerId, days]
    );

    // 4. ✅ Generate data lengkap (isi 0 jika tidak ada data)
    const chartData = [];
    const salesMap = new Map<string, any>();

    (salesData as any[]).forEach((row: any) => {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      salesMap.set(dateStr, row);
    });

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];

      const dayData = salesMap.get(dateStr);

      chartData.push({
        date: dateStr,
        label: date.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: 'numeric',
        }),
        revenue: Number(dayData?.revenue || 0),
        orders: Number(dayData?.orders || 0),
      });
    }

    // 5. Calculate summary
    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = chartData.reduce((sum, d) => sum + d.orders, 0);

    return NextResponse.json({
      success: true,
      data: {
        chart: chartData,
        summary: {
          totalRevenue,
          totalOrders,
          avgRevenue: Number((totalRevenue / days).toFixed(0)),
          avgOrders: Number((totalOrders / days).toFixed(1)),
        },
      },
    });

  } catch (error: any) {
    console.error('❌ GET /api/seller/sales-chart error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
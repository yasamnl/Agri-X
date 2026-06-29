// src/app/api/seller/sales-chart/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
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
        { success: false, error: 'Forbidden: Seller access required' },
        { status: 403 }
      );
    }

    const sellerId = decoded.sub;

    // ✅ Ambil parameter period dari query string (default 7 hari)
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7'), 1), 30);

    // ✅ Fetch data penjualan per hari
    const [salesData] = await pool.query(
      `SELECT 
        DATE(o.created_at) as date,
        COALESCE(SUM(oi.subtotal), 0) as revenue,
        COUNT(DISTINCT o.id) as orders
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      INNER JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
        AND o.status = 'completed'
        AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(o.created_at)
      ORDER BY date ASC`,
      [sellerId, days]
    );

    // ✅ Generate data untuk semua hari (isi 0 jika tidak ada data)
    const chartData = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayData = salesData.find((d: any) => {
        const dDate = new Date(d.date).toISOString().split('T')[0];
        return dDate === dateStr;
      });

      chartData.push({
        date: dateStr,
        label: date.toLocaleDateString('id-ID', { 
          weekday: 'short', 
          day: 'numeric',
          month: 'short'
        }),
        revenue: Number(dayData?.revenue || 0),
        orders: Number(dayData?.orders || 0),
      });
    }

    // ✅ Hitung total
    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = chartData.reduce((sum, d) => sum + d.orders, 0);
    const avgRevenue = totalRevenue / days;
    const avgOrders = totalOrders / days;

    return NextResponse.json({
      success: true,
      data: {
        chart: chartData,
        period: {
          days,
          startDate: chartData[0]?.date,
          endDate: chartData[chartData.length - 1]?.date,
        },
        summary: {
          totalRevenue,
          totalOrders,
          avgRevenue: Number(avgRevenue.toFixed(0)),
          avgOrders: Number(avgOrders.toFixed(1)),
          peakDay: chartData.reduce((max, d) => d.revenue > max.revenue ? d : max, chartData[0]),
          lowestDay: chartData.reduce((min, d) => d.revenue < min.revenue ? d : min, chartData[0]),
        },
      },
    });

  } catch (error: any) {
    console.error('❌ Sales chart error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
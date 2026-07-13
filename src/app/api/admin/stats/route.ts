// src/app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    // Check if user is admin
    const [userCheck] = await pool.query<any[]>(
      'SELECT role FROM users WHERE id = ?',
      [decoded.sub]
    );

    if (!userCheck[0] || userCheck[0].role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Execute all queries in parallel with proper error handling
    const results = await Promise.allSettled<[any[], any[]]>([
      // Total users
      pool.query<any[]>('SELECT COUNT(*) as count FROM users'),
      
      // Total products (excluding deleted)
      pool.query<any[]>('SELECT COUNT(*) as count FROM products WHERE status != ?', ['deleted']),
      
      // Total transactions
      pool.query<any[]>('SELECT COUNT(*) as count FROM orders'),
      
      // Total revenue (completed orders)
      pool.query<any[]>('SELECT COALESCE(SUM(grand_total), 0) as total FROM orders WHERE status = ?', ['completed']),
      
      // Pending reports
      pool.query<any[]>('SELECT COUNT(*) as count FROM user_reports WHERE status_laporan = ?', ['menunggu']),
      
      // Pending products
      pool.query<any[]>('SELECT COUNT(*) as count FROM products WHERE status = ?', ['pending']),
      
      // Recent activities (last 10) - Fixed UNION ALL syntax
      pool.query<any[]>(`
        (SELECT 
          'user' as type,
          CONCAT('New user registered: ', COALESCE(nama_lengkap, 'Unknown')) as title,
          CONCAT('Email: ', COALESCE(email, 'N/A')) as description,
          created_at as timestamp,
          'pending' as status
        FROM users
        ORDER BY created_at DESC
        LIMIT 5)
        
        UNION ALL
        
        (SELECT 
          'product' as type,
          CONCAT('New product: ', COALESCE(name, 'Unknown')) as title,
          CONCAT('Price: Rp ', COALESCE(FORMAT(price, 0), '0')) as description,
          created_at as timestamp,
          status
        FROM products
        WHERE status != 'deleted'
        ORDER BY created_at DESC
        LIMIT 5)
        
        ORDER BY timestamp DESC
        LIMIT 10
      `)
    ]);

    // Extract data safely
    const totalUsers = results[0].status === 'fulfilled' ? results[0].value?.[0]?.[0] || { count: 0 } : { count: 0 };
    const totalProducts = results[1].status === 'fulfilled' ? results[1].value?.[0]?.[0] || { count: 0 } : { count: 0 };
    const totalTransactions = results[2].status === 'fulfilled' ? results[2].value?.[0]?.[0] || { count: 0 } : { count: 0 };
    const totalRevenue = results[3].status === 'fulfilled' ? results[3].value?.[0]?.[0] || { total: 0 } : { total: 0 };
    const pendingReports = results[4].status === 'fulfilled' ? results[4].value?.[0]?.[0] || { count: 0 } : { count: 0 };
    const pendingProducts = results[5].status === 'fulfilled' ? results[5].value?.[0]?.[0] || { count: 0 } : { count: 0 };
    const recentActivities = results[6].status === 'fulfilled' ? results[6].value?.[0] || [] : [];

    // Format recent activities safely
    const formattedActivities = Array.isArray(recentActivities) 
      ? recentActivities.map((activity: any, index: number) => ({
          id: `activity_${index}_${Date.now()}`,
          type: activity.type || 'unknown',
          title: activity.title || 'No title',
          description: activity.description || 'No description',
          timestamp: activity.timestamp ? new Date(activity.timestamp).toISOString() : new Date().toISOString(),
          status: activity.status || 'unknown',
        }))
      : [];

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers: Number(totalUsers.count) || 0,
          totalProducts: Number(totalProducts.count) || 0,
          totalTransactions: Number(totalTransactions.count) || 0,
          totalRevenue: Number(totalRevenue.total) || 0,
          pendingReports: Number(pendingReports.count) || 0,
          pendingProducts: Number(pendingProducts.count) || 0,
        },
        recentActivities: formattedActivities,
      },
    });

  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch admin statistics',
        code: 'ADMIN_STATS_ERROR'
      },
      { status: 500 }
    );
  }
}
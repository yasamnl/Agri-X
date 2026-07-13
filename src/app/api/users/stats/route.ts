// src/app/api/account/stats/route.ts
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

    // Get all statistics in parallel
    const [
      [orderStats],
      [activeOrders],
      [totalSpent],
      [wishlistCount],
      [reviewCount],
      [voucherCount],
      [notificationCount],
      [memberSince]
    ] = await Promise.all([
      // Order stats
      pool.query(
        `SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN status IN ('pending', 'processing', 'shipped') THEN 1 ELSE 0 END) as active_orders
        FROM orders WHERE user_id = ?`,
        [userId]
      ) as Promise<any>,
      // Active orders detail
      pool.query(
        `SELECT status as status, COUNT(*) as count 
         FROM orders 
         WHERE user_id = ? AND status IN ('pending', 'processing', 'shipped')
         GROUP BY status`,
        [userId]
      ) as Promise<any>,
      // Total spent
      pool.query(
        `SELECT COALESCE(SUM(grand_total), 0) as total 
         FROM orders 
         WHERE user_id = ? AND status = 'completed'`,
        [userId]
      ) as Promise<any>,
      // Wishlist count
      pool.query(
        `SELECT COUNT(*) as count FROM wishlist WHERE user_id = ?`,
        [userId]
      ).catch(() => [{ count: 0 }]) as Promise<any>,
      // Review count
      pool.query(
        `SELECT COUNT(*) as count FROM reviews WHERE user_id = ?`,
        [userId]
      ).catch(() => [{ count: 0 }]) as Promise<any>,
      // Voucher count
      pool.query(
        `SELECT COUNT(*) as count FROM user_vouchers 
         WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()`,
        [userId]
      ).catch(() => [{ count: 0 }]) as Promise<any>,
      // Unread notifications
      pool.query(
        `SELECT COUNT(*) as count FROM notifications 
         WHERE user_id = ? AND is_read = FALSE`,
        [userId]
      ).catch(() => [{ count: 0 }]) as Promise<any>,
      // Member since
      pool.query(
        `SELECT created_at FROM users WHERE id = ?`,
        [userId]
      ) as Promise<any>,
    ]);

    // Format active orders
    const activeOrdersMap: Record<string, number> = {};
    activeOrders.forEach((row: any) => {
      activeOrdersMap[row.status] = Number(row.count);
    });

    return NextResponse.json({
      success: true,
      data: {
        totalOrders: Number(orderStats[0]?.total_orders || 0),
        completedOrders: Number(orderStats[0]?.completed_orders || 0),
        activeOrders: Number(orderStats[0]?.active_orders || 0),
        activeOrdersDetail: activeOrdersMap,
        totalSpent: Number(totalSpent[0]?.total || 0),
        wishlistCount: Number(wishlistCount[0]?.count || 0),
        reviewCount: Number(reviewCount[0]?.count || 0),
        voucherCount: Number(voucherCount[0]?.count || 0),
        unreadNotifications: Number(notificationCount[0]?.count || 0),
        memberSince: memberSince[0]?.created_at,
      },
    });

  } catch (error: any) {
    console.error('Account stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
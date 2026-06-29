// src/app/api/admin/affiliates/stats/route.ts
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
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Get overall statistics
    const [
      [totalApplications],
      [approvedCount],
      [pendingCount],
      [rejectedCount],
      [totalRevenue],
      [totalCommission],
      [topAffiliates]
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM affiliate_applications'),
      pool.query("SELECT COUNT(*) as count FROM affiliate_applications WHERE status = 'approved'"),
      pool.query("SELECT COUNT(*) as count FROM affiliate_applications WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) as count FROM affiliate_applications WHERE status = 'rejected'"),
      pool.query(
        `SELECT COALESCE(SUM(o.grand_total), 0) as total 
         FROM orders o 
         WHERE o.affiliate_id IS NOT NULL AND o.status = 'completed'`
      ),
      pool.query(
        `SELECT COALESCE(SUM(ae.commission_earned), 0) as total 
         FROM affiliate_earnings ae`
      ),
      pool.query(
        `SELECT 
          aa.user_id,
          u.name,
          aa.referral_code,
          COUNT(DISTINCT o.id) as total_orders,
          COALESCE(SUM(o.grand_total), 0) as total_revenue,
          COALESCE(SUM(ae.commission_earned), 0) as total_commission
        FROM affiliate_applications aa
        JOIN users u ON aa.user_id = u.id
        LEFT JOIN orders o ON o.affiliate_id = aa.user_id AND o.status = 'completed'
        LEFT JOIN affiliate_earnings ae ON ae.affiliate_id = aa.user_id
        WHERE aa.status = 'approved'
        GROUP BY aa.user_id, u.name, aa.referral_code
        ORDER BY total_revenue DESC
        LIMIT 5`
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalApplications: Number(totalApplications[0]?.count || 0),
        approvedCount: Number(approvedCount[0]?.count || 0),
        pendingCount: Number(pendingCount[0]?.count || 0),
        rejectedCount: Number(rejectedCount[0]?.count || 0),
        totalRevenue: Number(totalRevenue[0]?.total || 0),
        totalCommission: Number(totalCommission[0]?.total || 0),
        topAffiliates: topAffiliates.map((a: any) => ({
          userId: Number(a.user_id),
          name: a.name,
          referralCode: a.referral_code,
          totalOrders: Number(a.total_orders),
          totalRevenue: Number(a.total_revenue),
          totalCommission: Number(a.total_commission),
        })),
      },
    });

  } catch (error: any) {
    console.error('Affiliate stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
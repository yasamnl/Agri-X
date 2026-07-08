// src/app/api/admin/affiliates/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // 1. Auth check (admin only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // 2. ✅ Fetch stats menggunakan tabel yang ada
    const [
      pendingCount,
      approvedCount,
      rejectedCount,
      totalCommission,
      totalWithdrawals,
      totalClicks,
      totalTransactions,
      topAffiliates,
    ] = await Promise.all([
      // Pending applications
      pool.query("SELECT COUNT(*) as count FROM affiliate_applications WHERE status = 'pending'"),
      
      // Approved applications
      pool.query("SELECT COUNT(*) as count FROM affiliate_applications WHERE status = 'approved'"),
      
      // Rejected applications
      pool.query("SELECT COUNT(*) as count FROM affiliate_applications WHERE status = 'rejected'"),
      
      // ✅ Total komisi dari referral_transactions
      pool.query(
        `SELECT COALESCE(SUM(rt.komisi), 0) as total 
         FROM referral_transactions rt
         WHERE rt.status = 'completed'`
      ),
      
      // ✅ Total withdrawal yang sudah diproses
      pool.query(
        `SELECT COALESCE(SUM(aw.nominal), 0) as total 
         FROM affiliate_withdrawals aw
         WHERE aw.status = 'COMPLETED'`
      ),
      
      // Total clicks
      pool.query("SELECT COUNT(*) as count FROM referral_clicks"),
      
      // Total transactions
      pool.query("SELECT COUNT(*) as count FROM referral_transactions"),
      
      // ✅ Top 5 affiliates (approved only)
      pool.query(
        `SELECT 
          aa.user_id as userId,
          u.name,
          aa.referral_code as referralCode,
          COUNT(rt.id) as totalOrders,
          COALESCE(SUM(rt.nominal_transaksi), 0) as totalRevenue,
          COALESCE(SUM(rt.komisi), 0) as totalCommission
        FROM affiliate_applications aa
        INNER JOIN users u ON aa.user_id = u.id
        LEFT JOIN referral_transactions rt 
          ON aa.id = rt.affiliate_application_id 
          AND rt.status = 'completed'
        WHERE aa.status = 'approved'
        GROUP BY aa.id, aa.user_id, u.name, aa.referral_code
        ORDER BY totalCommission DESC
        LIMIT 5`
      ),
    ]);

    // 3. Format response
    const totalApplications = 
      Number((pendingCount as any[])[0]?.count || 0) +
      Number((approvedCount as any[])[0]?.count || 0) +
      Number((rejectedCount as any[])[0]?.count || 0);

    return NextResponse.json({
      success: true,
      data: {
        // ✅ Alias untuk konsistensi dengan frontend
        totalApplications,
        pendingCount: Number((pendingCount as any[])[0]?.count || 0),
        approvedCount: Number((approvedCount as any[])[0]?.count || 0),
        rejectedCount: Number((rejectedCount as any[])[0]?.count || 0),
        
        // ✅ Alias tambahan
        pendingApplications: Number((pendingCount as any[])[0]?.count || 0),
        approvedAffiliates: Number((approvedCount as any[])[0]?.count || 0),
        rejectedApplications: Number((rejectedCount as any[])[0]?.count || 0),
        
        totalRevenue: Number((totalWithdrawals as any[])[0]?.total || 0),
        totalCommission: Number((totalCommission as any[])[0]?.total || 0),
        totalWithdrawals: Number((totalWithdrawals as any[])[0]?.total || 0),
        totalClicks: Number((totalClicks as any[])[0]?.count || 0),
        totalTransactions: Number((totalTransactions as any[])[0]?.count || 0),
        
        // ✅ Top affiliates
        topAffiliates: (topAffiliates as any[]).map((aff: any) => ({
          userId: Number(aff.userId),
          name: aff.name,
          referralCode: aff.referralCode,
          totalOrders: Number(aff.totalOrders || 0),
          totalRevenue: Number(aff.totalRevenue || 0),
          totalCommission: Number(aff.totalCommission || 0),
        })),
      },
    });

  } catch (error: any) {
    console.error('❌ Affiliate stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
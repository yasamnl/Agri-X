// src/app/api/affiliate/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { 
  getAffiliateByUserId, 
  getAffiliateDashboardStats,
  getAffiliateTransactions 
} from '@/lib/affiliate';

export async function GET(req: NextRequest) {
  try {
    // 1. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // 2. Get affiliate application
    const affiliate = await getAffiliateByUserId(decoded.sub);
    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Anda belum terdaftar sebagai affiliate' },
        { status: 404 }
      );
    }

    // 3. Get stats
    const stats = await getAffiliateDashboardStats(affiliate.id);
    if (!stats) {
      return NextResponse.json(
        { success: false, error: 'Gagal memuat statistik' },
        { status: 500 }
      );
    }

    // 4. Get recent transactions (last 5)
    const { transactions } = await getAffiliateTransactions(affiliate.id, 1, 5);

    // 5. Get chart data (last 7 days)
    const [chartData] = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as transactions,
        SUM(komisi) as commission
       FROM affiliate_transactions
       WHERE affiliate_application_id = ?
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [affiliate.id]
    );

    // Fill missing days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayData = (chartData as any[]).find((d: any) => {
        const dDate = new Date(d.date).toISOString().split('T')[0];
        return dDate === dateStr;
      });

      last7Days.push({
        date: dateStr,
        label: date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
        transactions: Number(dayData?.transactions || 0),
        commission: Number(dayData?.commission || 0),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        stats,
        recentTransactions: transactions,
        chartData: last7Days,
      },
    });

  } catch (error: any) {
    console.error('❌ Affiliate dashboard error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
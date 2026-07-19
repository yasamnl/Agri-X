// src/app/api/affiliate/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  let connection;
  try {
    // 1. Auth
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

    connection = await pool.getConnection();

    // 2. Get user data
    const [userRows] = await connection.query(
      `SELECT name, email FROM users WHERE id = ?`,
      [userId]
    );
    const user = (userRows as any[])[0];
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // 3. Get affiliate application
    const [appRows] = await connection.query(
      `SELECT id, status, affiliate_status, sosmed_accounts, referral_code FROM affiliate_applications WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    const application = (appRows as any[])[0];
    if (!application) {
      // User belum daftar affiliate
      return NextResponse.json({
        success: true,
        data: {
          user,
          affiliate: null,
          totalClicks: 0,
          totalTransactions: 0,
          availableBalance: 0,
          referralLink: null,
          sosmedList: [],
          platformStats: [],
        }
      });
    }

    // 4. Get social media accounts from affiliate_social_media
    const [sosmedRows] = await connection.query(
      `SELECT platform, link, verified FROM affiliate_social_media WHERE affiliate_application_id = ?`,
      [application.id]
    );
    let sosmedList = sosmedRows as any[];

    // If no data in affiliate_social_media (fallback to sosmed_accounts JSON)
    if (sosmedList.length === 0 && application.sosmed_accounts) {
      try {
        const parsed = JSON.parse(application.sosmed_accounts);
        if (Array.isArray(parsed)) {
          sosmedList = parsed.map((item: any) => ({
            platform: item.platform,
            link: item.link || item.username, // fallback
            verified: item.verified || false,
          }));
        }
      } catch (_) { /* ignore */ }
    }

    // 5. Get stats (clicks, transactions, commission)
    const [clickCountRows] = await connection.query(
      `SELECT COUNT(*) AS total FROM referral_clicks WHERE affiliate_application_id = ?`,
      [application.id]
    );
    const totalClicks = Number((clickCountRows as any[])[0]?.total || 0);

    const [trxRows] = await connection.query(
      `SELECT COUNT(*) AS total_trx, COALESCE(SUM(komisi), 0) AS total_komisi 
       FROM referral_transactions 
       WHERE affiliate_application_id = ? AND status = 'sukses'`,
      [application.id]
    );
    const totalTransactions = Number((trxRows as any[])[0]?.total_trx || 0);
    const totalKomisiEarned = Number((trxRows as any[])[0]?.total_komisi || 0);

    const [withdrawnRows] = await connection.query(
      `SELECT COALESCE(SUM(nominal), 0) AS total_withdrawn 
       FROM affiliate_withdrawals 
       WHERE affiliate_application_id = ? AND status != 'REJECTED'`,
      [application.id]
    );
    const totalWithdrawn = Number((withdrawnRows as any[])[0]?.total_withdrawn || 0);

    // Refresh kolom total_komisi (cache saldo tersedia) di affiliate_applications
    const availableBalance = totalKomisiEarned - totalWithdrawn;
    await connection.query(
      `UPDATE affiliate_applications SET total_komisi = ? WHERE id = ?`,
      [availableBalance, application.id]
    );


    // 6. Platform stats - jumlah klik per platform dari tabel referral_clicks
    const [platformRows] = await connection.query(
      `SELECT platform, COUNT(*) AS total_clicks 
       FROM referral_clicks 
       WHERE affiliate_application_id = ? 
       GROUP BY platform 
       ORDER BY total_clicks DESC`,
      [application.id]
    );
    const platformStats = (platformRows as any[]).map((row) => ({
      platform: row.platform || 'direct',
      total_clicks: Number(row.total_clicks),
    }));

    // 7. Build referral link
    const referralLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}?ref=${application.referral_code || application.id}`;

    return NextResponse.json({
      success: true,
      data: {
        user,
        affiliate: {
          id: application.id,
          status: application.status,
          affiliateStatus: application.affiliate_status || 'aktif',
        },
        totalClicks,
        totalTransactions,
        availableBalance,
        referralLink,
        referralCode: application.referral_code || application.id,
        sosmedList,
        platformStats,
      }
    });

  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
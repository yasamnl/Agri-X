import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: 'ID tidak valid' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body; // 'aktif', 'nonaktif', 'diblokir'
    if (!status || !['aktif', 'nonaktif', 'diblokir'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Status tidak valid' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    try {
      // Mulai transaksi
      await connection.beginTransaction();

      // Cek apakah user memiliki aplikasi yang approved
      const [checkRows] = await connection.query(
        `SELECT 
           aa.id as application_id,
           aa.user_id,
           aa.affiliate_status as current_status,
           aa.approved_at as joinedAt,
           aa.sosmed_accounts as sosmedAccounts,
           u.name,
           u.email,
           u.avatar
         FROM affiliate_applications aa
         JOIN users u ON aa.user_id = u.id
         WHERE aa.user_id = ? AND aa.approved_at IS NOT NULL`,
        [userId]
      );

      const checkRow = (checkRows as any[])[0];
      if (!checkRow) {
        await connection.rollback();
        connection.release();
        return NextResponse.json(
          { success: false, error: 'User tidak ditemukan atau belum approved' },
          { status: 404 }
        );
      }

      // Update affiliate_status
      await connection.query(
        `UPDATE affiliate_applications 
         SET affiliate_status = ?,
             updated_at = NOW()
         WHERE user_id = ? AND approved_at IS NOT NULL`,
        [status, userId]
      );

      // Ambil data lengkap dengan total komisi setelah update
      const [rows] = await connection.query(
        `SELECT 
           aa.id as application_id,
           aa.user_id,
           aa.affiliate_status as status,
           aa.approved_at as joinedAt,
           aa.sosmed_accounts as sosmedAccounts,
           u.name,
           u.email,
           u.avatar,
           COALESCE(SUM(rt.commission_amount), 0) as totalCommission
         FROM affiliate_applications aa
         JOIN users u ON aa.user_id = u.id
         LEFT JOIN referral_transactions rt ON rt.affiliate_application_id = aa.id
         WHERE aa.user_id = ?
         GROUP BY aa.id, aa.user_id, aa.affiliate_status, aa.approved_at, aa.sosmed_accounts, u.name, u.email, u.avatar`,
        [userId]
      );

      // Commit transaksi
      await connection.commit();

      const row = (rows as any[])[0];
      
      // Parse sosmedAccounts
      let rawSosmed = [];
      try {
        rawSosmed = row.sosmedAccounts ? JSON.parse(row.sosmedAccounts) : [];
      } catch (_) {
        rawSosmed = [];
      }
      
      const sosmedAccounts = rawSosmed.map((acc: any) => ({
        platform: acc.platform || '',
        username: acc.username || '',
        url: acc.link || acc.url || '',
      }));

      const userData = {
        id: row.user_id,
        name: row.name,
        email: row.email,
        avatar: row.avatar,
        joinedAt: row.joinedAt,
        totalCommission: parseFloat(row.totalCommission) || 0,
        status: row.status,
        sosmedAccounts,
      };

      connection.release();

      return NextResponse.json({
        success: true,
        message: `Status berhasil diubah menjadi ${status}`,
        data: userData,
      });
    } catch (error) {
      // Rollback jika ada error
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error: any) {
    console.error('❌ Error update status:', error.message);
    return NextResponse.json(
      { success: false, error: 'Gagal mengubah status: ' + error.message },
      { status: 500 }
    );
  }
}

// Tambahkan GET method untuk mengambil detail affiliator
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);
    
    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: 'ID tidak valid' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT 
         aa.id as application_id,
         aa.user_id,
         aa.affiliate_status as status,
         aa.approved_at as joinedAt,
         aa.sosmed_accounts as sosmedAccounts,
         u.name,
         u.email,
         u.avatar,
         COALESCE(SUM(rt.commission_amount), 0) as totalCommission
       FROM affiliate_applications aa
       JOIN users u ON aa.user_id = u.id
       LEFT JOIN referral_transactions rt ON rt.affiliate_application_id = aa.id
       WHERE aa.user_id = ? AND aa.approved_at IS NOT NULL
       GROUP BY aa.id, aa.user_id, aa.affiliate_status, aa.approved_at, aa.sosmed_accounts, u.name, u.email, u.avatar`,
      [userId]
    );

    connection.release();

    const row = (rows as any[])[0];
    if (!row) {
      return NextResponse.json(
        { success: false, error: 'Affiliator tidak ditemukan' },
        { status: 404 }
      );
    }

    // Parse sosmedAccounts
    let rawSosmed = [];
    try {
      rawSosmed = row.sosmedAccounts ? JSON.parse(row.sosmedAccounts) : [];
    } catch (_) {
      rawSosmed = [];
    }
    
    const sosmedAccounts = rawSosmed.map((acc: any) => ({
      platform: acc.platform || '',
      username: acc.username || '',
      url: acc.link || acc.url || '',
    }));

    const userData = {
      id: row.user_id,
      name: row.name,
      email: row.email,
      avatar: row.avatar,
      joinedAt: row.joinedAt,
      totalCommission: parseFloat(row.totalCommission) || 0,
      status: row.status,
      sosmedAccounts,
    };

    return NextResponse.json({
      success: true,
      data: userData,
    });
  } catch (error: any) {
    console.error('❌ Error GET affiliate detail:', error.message);
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data affiliator' },
      { status: 500 }
    );
  }
}
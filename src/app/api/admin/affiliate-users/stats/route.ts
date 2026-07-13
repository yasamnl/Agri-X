import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const connection = await pool.getConnection();

    // Query: count approved users grouped by affiliate_status
    const [rows] = await connection.query(`
      SELECT 
        affiliate_status,
        COUNT(*) as count
      FROM affiliate_applications
      WHERE approved_at IS NOT NULL
      GROUP BY affiliate_status
    `);

    connection.release();

    // Inisialisasi
    let total = 0;
    let aktif = 0;
    let nonaktif = 0;
    let diblokir = 0;

    (rows as any[]).forEach((row) => {
      total += row.count;
      if (row.affiliate_status === 'aktif') aktif = row.count;
      else if (row.affiliate_status === 'nonaktif') nonaktif = row.count;
      else if (row.affiliate_status === 'diblokir') diblokir = row.count;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalAfiliator: total,
        affiliateAktif: aktif,
        affiliateNonaktif: nonaktif,
        affiliateBlokir: diblokir,
      },
    });
  } catch (error: any) {
    console.error('❌ Error stats pengguna:', error.message);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat statistik pengguna affiliate' },
      { status: 500 }
    );
  }
}
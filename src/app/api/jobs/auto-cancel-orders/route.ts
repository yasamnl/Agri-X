import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [result]: any = await pool.execute(`
      UPDATE orders
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE status = 'pending'
      AND payment_deadline <= NOW()
    `);

    return NextResponse.json({
      success: true,
      affectedRows: result.affectedRows,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: 'Auto cancel gagal'
      },
      {
        status: 500
      }
    );
  }
}
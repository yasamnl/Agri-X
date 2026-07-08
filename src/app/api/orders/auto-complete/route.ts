import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [result]: any = await pool.execute(`
      UPDATE orders
      SET status = 'completed',
          updated_at = NOW()
      WHERE status = 'shipped'
      AND shipped_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)
    `);

    return NextResponse.json({
      success: true,
      affectedRows: result.affectedRows,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      error: 'Failed auto complete orders'
    });
  }
}
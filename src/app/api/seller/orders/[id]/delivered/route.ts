import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded || decoded.role !== 'seller') {
      return NextResponse.json(
        { success: false, error: 'Seller access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    // Pastikan order milik seller
    const [ownershipCheck] = await pool.query(
      'SELECT id FROM order_items WHERE order_id = ? AND seller_id = ? LIMIT 1',
      [orderId, decoded.sub]
    );

    if ((ownershipCheck as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Order tidak ditemukan' },
        { status: 404 }
      );
    }

    // Ambil status order
    const [orders] = await pool.query(
      'SELECT id, status FROM orders WHERE id = ?',
      [orderId]
    );

    const order = (orders as any[])[0];

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order tidak ditemukan' },
        { status: 404 }
      );
    }

    // Hanya boleh jika sudah dikirim
    if (order.status !== 'shipped') {
      return NextResponse.json(
        {
          success: false,
          error: 'Pesanan belum dalam status dikirim.',
        },
        { status: 400 }
      );
    }

    // Update menjadi delivered
    await pool.query(
      `UPDATE orders
       SET status = 'delivered',
           delivered_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [orderId]
    );

    return NextResponse.json({
      success: true,
      message: 'Barang berhasil dikonfirmasi sampai.',
      data: {
        orderId,
        newStatus: 'delivered',
      },
    });

  } catch (error: any) {
    console.error('❌ POST delivered error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Server error',
      },
      { status: 500 }
    );
  }
}
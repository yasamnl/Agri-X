// src/app/api/seller/orders/[id]/ship/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'seller') {
      return NextResponse.json({ success: false, error: 'Seller access required' }, { status: 403 });
    }

    const { id } = await params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await req.json();
    const { courierCode, courierName, trackingNumber } = body;

    // Validation
    if (!courierCode) {
      return NextResponse.json({ success: false, error: 'Kode kurir wajib diisi' }, { status: 400 });
    }
    if (!trackingNumber) {
      return NextResponse.json({ success: false, error: 'Nomor resi wajib diisi' }, { status: 400 });
    }

    // Verify seller owns items in this order
    const [ownershipCheck] = await pool.query(
      'SELECT id FROM order_items WHERE order_id = ? AND seller_id = ? LIMIT 1',
      [orderId, decoded.sub]
    );

    if ((ownershipCheck as any[]).length === 0) {
      return NextResponse.json({ success: false, error: 'Order tidak ditemukan' }, { status: 404 });
    }

    // Check current order status
    const [orders] = await pool.query(
      'SELECT id, status FROM orders WHERE id = ?',
      [orderId]
    );

    const order = (orders as any[])[0];
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order tidak ditemukan' }, { status: 404 });
    }

    // Only allow shipping if status is 'paid' or 'processing'
    if (!['paid', 'processing'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: `Tidak dapat mengirim order dengan status "${order.status}"`,
      }, { status: 400 });
    }

    // Update order with tracking info
    await pool.query(
      `UPDATE orders 
       SET tracking_number = ?, 
           courier_code = ?, 
           courier_name = ?,
           status = 'shipped',
           shipped_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [trackingNumber, courierCode, courierName || courierCode, orderId]
    );

    return NextResponse.json({
      success: true,
      message: 'Pesanan berhasil ditandai sebagai dikirim',
      data: {
        orderId,
        trackingNumber,
        courierCode,
        courierName: courierName || courierCode,
        newStatus: 'shipped',
      },
    });

  } catch (error: any) {
    console.error('❌ POST ship order error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
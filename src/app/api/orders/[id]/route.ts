// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

// ============================================================================
// TYPES
// ============================================================================
interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  productImage: string | null;
  price: number;
  quantity: number;
  subtotal: number;
}

// ============================================================================
// GET: Get order by ID
// ============================================================================
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    // ✅ Fetch order
    const [orders] = await pool.query(
      `SELECT o.*,
        u.name as user_name,
        u.email as user_email,
        u.no_telp as user_phone,
        a.recipient_name, a.recipient_phone,
        a.detail as address_detail,
        a.province, a.city, a.district,
        a.village, a.zip_code
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN address a ON o.address_id = a.id
      WHERE o.id = ? AND (o.user_id = ? OR EXISTS (
        SELECT 1 FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = o.id AND p.seller_id = ?
      ))`,
      [orderId, decoded.sub, decoded.sub]
    );

    const order = (orders as any[])[0];
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // ✅ Fetch order_items DENGAN product name & image
    const [items] = await pool.query(
      `SELECT 
        oi.id, 
        oi.order_id, 
        oi.product_id,
        oi.price_at_order, 
        oi.quantity, 
        oi.subtotal,
        p.name as product_name,
        p.image_path as product_image
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?`,
      [orderId]
    );

    // ✅ Fetch payment TANPA va_number
    const [payments] = await pool.query(
      `SELECT id, method, amount, status, transaction_id, payment_type, created_at
      FROM payment
      WHERE order_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
      [orderId]
    );

    return NextResponse.json({
      success: true,
      data: {
        id: Number(order.id),
        orderId: Number(order.id),
        userId: Number(order.user_id),
        addressId: Number(order.address_id),
        transactionId: order.transaction_id,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        paymentGateway: order.payment_gateway,
        paymentUrl: order.payment_url,
        paymentDeadline: order.payment_deadline,
        totalProductPrice: Number(order.total_product_price || 0),
        shippingCost: Number(order.shipping_cost || 0),
        paymentFee: Number(order.payment_fee || 0),
        grandTotal: Number(order.grand_total || 0),
        isPreOrder: Boolean(order.is_pre_order),
        estimatedShipDate: order.estimated_ship_date,
        poStatus: order.po_status,
        createdAt: order.created_at,
        user: {
          name: order.user_name,
          email: order.user_email,
          phone: order.user_phone,
        },
        address: {
          recipientName: order.recipient_name,
          recipientPhone: order.recipient_phone,
          detail: order.address_detail,
          province: order.province,
          city: order.city,
          district: order.district,
          village: order.village,
          zipCode: order.zip_code,
        },
        // ✅ Items dengan product name & image
        items: (items as any[]).map((item: any) => ({
          id: Number(item.id),
          orderId: Number(item.order_id),
          productId: Number(item.product_id),
          productName: item.product_name || 'Produk',
          productImage: item.product_image || null,
          price: Number(item.price_at_order),
          quantity: Number(item.quantity),
          subtotal: Number(item.subtotal),
        })),
        payment: (payments as any[])[0] || null,
      },
    });

  } catch (error: any) {
    console.error('❌ GET /api/orders/[id] error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
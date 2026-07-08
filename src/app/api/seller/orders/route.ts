// src/app/api/seller/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // ============================================
    // 1. AUTH CHECK
    // ============================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    if (decoded.role !== 'seller') {
      return NextResponse.json(
        { success: false, error: 'Seller access required' },
        { status: 403 }
      );
    }

    const sellerId = decoded.sub;

    // ============================================
    // 2. PARSE QUERY PARAMS
    // ============================================
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const offset = (page - 1) * limit;

    // ============================================
    // 3. BUILD QUERY
    // ============================================
    let statusFilter = '';
    const params: any[] = [sellerId];

    if (status !== 'all') {
      statusFilter = ' AND o.status = ?';
      params.push(status);
    }

    // ============================================
    // 4. FETCH ORDERS
    // ============================================
    const [orders] = await pool.query(
      `SELECT DISTINCT
        o.id,
        o.status,
        o.payment_status,
        o.payment_method,
        o.payment_gateway,
        o.tracking_number,
        o.courier_code,
        o.courier_name,
        o.grand_total,
        o.total_product_price,
        o.shipping_cost,
        o.payment_fee,
        o.is_pre_order,
        o.created_at,
        u.name as buyer_name,
        u.email as buyer_email,
        u.no_telp as buyer_phone,
        a.recipient_name,
        a.recipient_phone,
        a.detail as address_detail,
        a.province,
        a.city,
        a.district,
        a.village,
        a.zip_code
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN users u ON o.user_id = u.id
      JOIN address a ON o.address_id = a.id
      WHERE oi.seller_id = ? ${statusFilter}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // ============================================
    // 5. COUNT TOTAL
    // ============================================
    const [countResult] = await pool.query(
      `SELECT COUNT(DISTINCT o.id) as total
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.seller_id = ? ${statusFilter}`,
      params
    );

    const total = Number((countResult as any[])[0]?.total || 0);

    // ============================================
    // 6. STATUS COUNTS
    // ============================================
    const [statusCounts] = await pool.query(
      `SELECT o.status, COUNT(DISTINCT o.id) as count
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.seller_id = ?
       GROUP BY o.status`,
      [sellerId]
    );

    const countMap: Record<string, number> = {
      all: total,
      pending_payment: 0,
      paid: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
    };

    (statusCounts as any[]).forEach((row: any) => {
      countMap[row.status] = Number(row.count);
    });

    // ============================================
    // 7. FETCH ITEMS FOR EACH ORDER
    // ============================================
    const ordersWithItems = await Promise.all(
      (orders as any[]).map(async (order) => {
        const [items] = await pool.query(
          `SELECT 
            oi.id,
            oi.product_id,
            oi.price_at_order,
            oi.quantity,
            oi.subtotal,
            p.name AS current_product_name,
            p.image_path AS product_image,
            p.unit AS product_unit
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?`,
          [order.id]
        );

        return {
          id: Number(order.id),
          orderId: Number(order.id),
          status: order.status,
          paymentStatus: order.payment_status,
          paymentMethod: order.payment_method,
          paymentGateway: order.payment_gateway,
          trackingNumber: order.tracking_number,
          courierCode: order.courier_code,
          courierName: order.courier_name,
          grandTotal: Number(order.grand_total || 0),
          totalProductPrice: Number(order.total_product_price || 0),
          shippingCost: Number(order.shipping_cost || 0),
          paymentFee: Number(order.payment_fee || 0),
          isPreOrder: Boolean(order.is_pre_order),
          createdAt: order.created_at,
          buyer: {
            name: order.buyer_name,
            email: order.buyer_email,
            phone: order.buyer_phone,
          },
          address: {
            recipientName: order.recipient_name,
            recipientPhone: order.recipient_phone,
            detail: order.address_detail,
            province: order.province,
            city: order.city,
            district: order.district,
            villageName: order.village,
            zip_code: order.zip_code,
          },
          items: (items as any[]).map((item: any) => ({
            id: Number(item.id),
            productId: Number(item.product_id),
            price: Number(item.price_at_order),
            quantity: Number(item.quantity),
            subtotal: Number(item.subtotal),
            currentProductName: item.current_product_name,
            productImage: item.product_image,
            productUnit: item.product_unit,
          })),
        };
      })
    );

    // ============================================
    // 8. RETURN RESPONSE
    // ============================================
    return NextResponse.json({
      success: true,
      orders: ordersWithItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts: countMap,
    });

  } catch (error: any) {
    console.error('❌ GET /api/seller/orders error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
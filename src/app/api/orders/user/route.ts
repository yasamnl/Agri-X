// src/app/api/orders/user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // ✅ Verify authentication
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

    // ✅ Get user ID from token (lebih aman)
    const userId = decoded.sub;

    // ✅ Get query parameters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // ✅ Build query
    let query = `
      SELECT 
        o.id,
        o.user_id,
        o.grand_total,
        o.shipping_cost,
        o.total_product_price,
        o.status,
        o.payment_method,
        o.payment_status,
        o.created_at,
        o.updated_at
      FROM orders o
      WHERE o.user_id = ?
    `;
    const queryParams: any[] = [userId];

    if (status && status !== 'all') {
      query += ' AND o.status = ?';
      queryParams.push(status);
    }

    query += ' ORDER BY o.created_at DESC LIMIT ?';
    queryParams.push(limit);

    // ✅ Fetch orders
    const [orders] = await pool.query(query, queryParams);

    // ✅ Fetch order items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order: any) => {
        const [items] = await pool.query(
          `SELECT 
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.quantity,
            oi.price,
            oi.subtotal,
            p.name as product_name,
            p.image_path as product_image,
            p.unit as product_unit,
            u.name as seller_name
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          LEFT JOIN users u ON p.seller_id = u.id
          WHERE oi.order_id = ?`,
          [order.id]
        );

        return {
          id: Number(order.id),
          orderId: order.order_id ? Number(order.order_id) : Number(order.id),
          userId: Number(order.user_id),
          grandTotal: Number(order.grand_total),
          shippingCost: Number(order.shipping_cost),
          totalProductPrice: Number(order.total_product_price),
          status: order.status,
          paymentMethod: order.payment_method,
          paymentStatus: order.payment_status,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          items: items.map((item: any) => ({
            id: Number(item.id),
            orderId: Number(item.order_id),
            productId: Number(item.product_id),
            productName: item.product_name,
            productImage: item.product_image,
            productUnit: item.product_unit,
            sellerName: item.seller_name,
            quantity: Number(item.quantity),
            price: Number(item.price),
            subtotal: Number(item.subtotal),
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      orders: ordersWithItems,
    });

  } catch (error: any) {
    console.error('Get user orders error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
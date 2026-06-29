// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';

type Params = {
  params: Promise<{ id: string }>;
};

// ✅ Helper untuk format date
const formatDate = (date: any): string | null => {
  if (!date) return null;
  try {
    return new Date(date).toISOString();
  } catch {
    return null;
  }
};

// ✅ Helper: Safe number conversion
const safeNumber = (val: any, fallback: number = 0): number => {
  if (val === null || val === undefined) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

// ✅ Helper: Safe boolean conversion
const safeBoolean = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  return Number(val) === 1;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    // ============================================
    // 1. AUTH & VALIDATION
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

    const userId = decoded.sub;
    const resolvedParams = await params;
    const orderId = Number(resolvedParams.id);

    if (!orderId || isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Order ID' },
        { status: 400 }
      );
    }

    console.log('📦 [GET /api/orders/:id] Fetching order:', {
      orderId,
      userId,
    });

    // ============================================
    // 2. FETCH ORDER + ADDRESS (Single Query)
    // ============================================
    const [orderRows] = await pool.query(
      `SELECT 
        o.id,
        o.transaction_id,
        o.user_id,
        o.address_id,
        o.status,
        o.payment_status,
        o.payment_method,
        o.payment_gateway,
        o.payment_url,
        o.payment_deadline,
        o.payment_fee,
        o.total_product_price,
        o.shipping_cost,
        o.grand_total,
        o.is_pre_order,
        o.estimated_ship_date,
        o.po_status,
        o.created_at,
        o.updated_at,
        a.detail AS address_detail,
        a.province,
        a.city,
        a.district,
        a.village_code,
        a.village,
        a.zip_code,
        a.recipient_name,
        a.recipient_phone
      FROM orders o
      LEFT JOIN address a ON o.address_id = a.id
      WHERE o.id = ? AND o.user_id = ?`,
      [orderId, userId]
    );

    if (!(orderRows as any[])[0]) {
      return NextResponse.json(
        { success: false, error: 'Order not found or unauthorized' },
        { status: 404 }
      );
    }

    const order = (orderRows as any[])[0];

    // ============================================
    // 3. FETCH PAYMENT RECORD (Latest)
    // ============================================
    const [paymentRows] = await pool.query(
      `SELECT 
        id,
        va_number,
        bank_name,
        transaction_id,
        payment_deadline,
        payment_time,
        status as payment_record_status,
        method,
        amount,
        created_at
      FROM payment
      WHERE order_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
      [orderId]
    );

    const payment = (paymentRows as any[])[0] || {};

    // ============================================
    // 4. FETCH ORDER ITEMS
    // ============================================
    const [itemsRows] = await pool.query(
      `SELECT 
        oi.id,
        oi.product_id,
        oi.quantity,
        oi.price_at_order,
        oi.subtotal,
        p.name AS current_product_name,
        p.image_path AS product_image,
        p.unit AS product_unit
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?`,
      [orderId]
    );

    // ============================================
    // 5. FORMAT RESPONSE
    // ============================================
    const formattedOrder = {
      // ✅ ID Internal (bukan transaction_id)
      id: safeNumber(order.id),
      orderId: safeNumber(order.id),
      
      // ✅ Identifiers
      transactionId: order.transaction_id,
      userId: safeNumber(order.user_id),
      addressId: safeNumber(order.address_id),
      
      // ✅ Status
      status: order.status,
      paymentStatus: order.payment_status,
      poStatus: order.po_status,
      
      // ✅ Payment Info
      paymentMethod: order.payment_method,
      paymentGateway: order.payment_gateway,
      paymentUrl: order.payment_url,
      paymentDeadline: formatDate(order.payment_deadline),
      paymentFee: safeNumber(order.payment_fee),
      
      // ✅ VA Info (dari payment table)
      vaNumber: payment.va_number || null,
      bankName: payment.bank_name || null,
      paidAt: formatDate(payment.payment_time || payment.created_at),
      
      // ✅ Pricing
      totalProductPrice: safeNumber(order.total_product_price),
      shippingCost: safeNumber(order.shipping_cost),
      grandTotal: safeNumber(order.grand_total),
      
      // ✅ Pre-Order Info
      isPreOrder: safeBoolean(order.is_pre_order),
      estimatedShipDate: formatDate(order.estimated_ship_date),
      
      // ✅ Shipping Info
      courierService: order.courier_service,
      courierCode: order.courier_code,
      trackingNumber: order.tracking_number,
      
      // ✅ Timestamps
      createdAt: formatDate(order.created_at),
      updatedAt: formatDate(order.updated_at),
      
      // ✅ Address (nested object)
      address: {
        detail: order.address_detail || '',
        province: order.province || '',
        city: order.city || '',
        district: order.district || '',
        villageCode: order.village_code || '',
        villageName: order.village || '',
        zipCode: order.zip_code || '',
        recipientName: order.recipient_name || '',
        recipientPhone: order.recipient_phone || '',
      },
      
      // ✅ Order Items (array)
      items: (itemsRows as any[]).map((item: any) => ({
        id: safeNumber(item.id),
        productId: safeNumber(item.product_id),
        productName: item.product_name || item.current_product_name || 'Produk Dihapus',
        quantity: safeNumber(item.quantity),
        price: safeNumber(item.price_at_order),
        subtotal: safeNumber(item.subtotal),
        productImage: item.product_image || null,
        unit: item.product_unit || 'pcs',
      })),
      
      // ✅ Payment Record (nested object)
      payment: {
        id: safeNumber(payment.id),
        method: payment.method,
        amount: safeNumber(payment.amount),
        status: payment.payment_record_status,
        transactionId: payment.transaction_id,
        vaNumber: payment.va_number,
        bankName: payment.bank_name,
        paymentDeadline: formatDate(payment.payment_deadline),
        paidAt: formatDate(payment.payment_time || payment.created_at),
        createdAt: formatDate(payment.created_at),
      },
    };

    console.log('✅ [GET /api/orders/:id] Success:', {
      orderId,
      status: order.status,
      paymentStatus: order.payment_status,
      itemsCount: (itemsRows as any[]).length,
    });

    return NextResponse.json({
      success: true,
      order: formattedOrder,
      // ✅ Alias untuk backward compatibility
      data: formattedOrder,
    });

  } catch (error: any) {
    console.error('❌ [GET /api/orders/:id] Error:', error);
    
    // ✅ Handle specific MySQL error codes
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json(
        { success: false, error: 'Table not found', code: 'TABLE_NOT_FOUND' },
        { status: 500 }
      );
    }
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('❌ Missing column:', error.message);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database schema mismatch', 
          code: 'COLUMN_NOT_FOUND',
          detail: error.message 
        },
        { status: 500 }
      );
    }
    if (error.code === 'ER_CONN_HOST_ERROR' || error.message?.includes('timeout')) {
      return NextResponse.json(
        { success: false, error: 'Database connection timeout', code: 'DB_TIMEOUT' },
        { status: 503 }
      );
    }
    
    return handleAPIError(error, 'GET /api/orders/[id]');
  }
}
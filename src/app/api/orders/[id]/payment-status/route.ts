// src/app/api/orders/[id]/payment-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';
import { coreApi } from '@/lib/midtrans';

// ✅ Midtrans Transaction Status Constants
const MIDTRANS_STATUS = {
  SETTLEMENT: 'settlement',
  CAPTURE: 'capture',
  PENDING: 'pending',
  DENY: 'deny',
  CANCEL: 'cancel',
  EXPIRE: 'expire',
  REFUND: 'refund',
  PARTIAL_REFUND: 'partial_refund',
} as const;

// ✅ Internal Order Status Constants
const ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// ✅ Internal Payment Status Constants
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  EXPIRED: 'expired',
} as const;

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    // ============================================
    // 1. AUTHENTICATION
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

    // ============================================
    // 2. PARSE & VALIDATE ORDER ID
    // ============================================
    const resolvedParams = await params;
    const orderId = parseInt(resolvedParams.id);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') console.log('💳 [PAYMENT STATUS] Checking order:', { orderId, userId });

    // ============================================
    // 3. FETCH ORDER FROM DATABASE
    // ============================================
    const [orderRows]: any = await pool.query(
      `SELECT 
        o.id,
        o.user_id,
        o.address_id,
        o.transaction_id,
        o.status,
        o.payment_status,
        o.payment_method,
        o.payment_gateway,
        o.payment_url,
        o.va_number,
        o.payment_deadline,
        o.total_product_price,
        o.shipping_cost,
        o.payment_fee,
        o.grand_total,
        o.is_pre_order,
        o.estimated_ship_date,
        o.po_status,
        o.notes,
        o.created_at,
        o.updated_at,
        a.recipient_name,
        a.recipient_phone,
        a.detail as address_detail,
        a.province,
        a.city,
        a.district,
        a.village_name,
        a.village_code,
        a.zip_code
      FROM orders o
      LEFT JOIN address a ON o.address_id = a.id
      WHERE o.id = ? AND o.user_id = ?`,
      [orderId, userId]
    );

    if (!orderRows[0]) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const order = orderRows[0];

    if (process.env.NODE_ENV === 'development') console.log('📦 [PAYMENT STATUS] Order loaded:', {
      orderId: order.id,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      transactionId: order.transaction_id,
      vaNumber: order.va_number,
    });

    // ============================================
    // 4. HANDLE COD ORDERS (Skip Midtrans Check)
    // ============================================
    if (order.payment_method === 'cod') {
      if (process.env.NODE_ENV === 'development') console.log('💵 [PAYMENT STATUS] COD order - skip Midtrans check');
      
      // Fetch items for COD order
      const [itemsRows] = await pool.query(
        `SELECT 
          oi.id,
          oi.order_id,
          oi.product_id,
          oi.product_name,
          oi.price_at_order,
          oi.quantity,
          oi.subtotal,
          p.image_path as product_image,
          p.unit
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?`,
        [orderId]
      );

      return NextResponse.json({
        success: true,
        data: {
          id: Number(order.id),
          orderId: Number(order.id),
          status: order.status,
          paymentStatus: order.payment_status,
          paymentMethod: order.payment_method,
          paymentGateway: order.payment_gateway,
          vaNumber: order.va_number,
          paymentDeadline: order.payment_deadline 
            ? new Date(order.payment_deadline).toISOString() 
            : null,
          totalProductPrice: Number(order.total_product_price || 0),
          shippingCost: Number(order.shipping_cost || 0),
          paymentFee: Number(order.payment_fee || 0),
          grandTotal: Number(order.grand_total || 0),
          isPreOrder: Boolean(order.is_pre_order),
          estimatedShipDate: order.estimated_ship_date,
          poStatus: order.po_status,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          shippingAddress: {
            recipientName: order.recipient_name || '',
            recipientPhone: order.recipient_phone || '',
            detail: order.address_detail || '',
            province: order.province || '',
            city: order.city || '',
            district: order.district || '',
            villageName: order.village_name || '',
            villageCode: order.village_code || '',
            zipCode: order.zip_code || '',
          },
          items: (itemsRows as any[]).map((item: any) => ({
            id: Number(item.id),
            productId: Number(item.product_id),
            productName: item.product_name || 'Produk Dihapus',
            priceAtOrder: Number(item.price_at_order || 0),
            price: Number(item.price_at_order || 0),
            quantity: Number(item.quantity || 0),
            subtotal: Number(item.subtotal || 0),
            unit: item.unit || 'pcs',
            productImage: item.product_image || null,
          })),
          message: 'Pesanan COD - pembayaran dilakukan saat barang diterima',
          source: 'local',
        },
      });
    }

    // ============================================
    // 5. SKIP MIDTRANS CHECK IF ALREADY PAID
    // ============================================
    if (order.payment_status === PAYMENT_STATUS.PAID) {
      if (process.env.NODE_ENV === 'development') console.log('✅ [PAYMENT STATUS] Already paid - skip Midtrans check');
      
      const [itemsRows] = await pool.query(
        `SELECT 
          oi.id, oi.order_id, oi.product_id, oi.product_name,
          oi.price_at_order, oi.quantity, oi.subtotal,
          p.image_path as product_image, p.unit
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?`,
        [orderId]
      );

      return NextResponse.json({
        success: true,
        data: {
          id: Number(order.id),
          orderId: Number(order.id),
          status: order.status,
          paymentStatus: order.payment_status,
          paymentMethod: order.payment_method,
          paymentGateway: order.payment_gateway,
          vaNumber: order.va_number,
          transactionId: order.transaction_id,
          paymentDeadline: order.payment_deadline 
            ? new Date(order.payment_deadline).toISOString() 
            : null,
          totalProductPrice: Number(order.total_product_price || 0),
          shippingCost: Number(order.shipping_cost || 0),
          paymentFee: Number(order.payment_fee || 0),
          grandTotal: Number(order.grand_total || 0),
          isPreOrder: Boolean(order.is_pre_order),
          estimatedShipDate: order.estimated_ship_date,
          poStatus: order.po_status,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          shippingAddress: {
            recipientName: order.recipient_name || '',
            recipientPhone: order.recipient_phone || '',
            detail: order.address_detail || '',
            province: order.province || '',
            city: order.city || '',
            district: order.district || '',
            villageName: order.village_name || '',
            villageCode: order.village_code || '',
            zipCode: order.zip_code || '',
          },
          items: (itemsRows as any[]).map((item: any) => ({
            id: Number(item.id),
            productId: Number(item.product_id),
            productName: item.product_name || 'Produk Dihapus',
            priceAtOrder: Number(item.price_at_order || 0),
            price: Number(item.price_at_order || 0),
            quantity: Number(item.quantity || 0),
            subtotal: Number(item.subtotal || 0),
            unit: item.unit || 'pcs',
            productImage: item.product_image || null,
          })),
          message: 'Pembayaran sudah dikonfirmasi',
          source: 'local',
        },
      });
    }

    // ============================================
    // 6. CHECK MIDTRANS STATUS
    // ============================================
    let midtransStatus: any = null;
    let midtransError = false;

    // ✅ Use transaction_id as Midtrans reference (not va_number!)
    const midtransReference = order.transaction_id || order.va_number;

    if (midtransReference) {
      try {
        if (process.env.NODE_ENV === 'development') console.log('🔍 [PAYMENT STATUS] Checking Midtrans:', midtransReference);
        
        // CoreApi.transaction does not exist on the SDK typings in this project.
        // Use direct Midtrans HTTP API call as a fallback using MIDTRANS_SERVER_KEY.
        const midtransServerKey = process.env.MIDTRANS_SERVER_KEY;
        if (!midtransServerKey) throw new Error('Missing MIDTRANS_SERVER_KEY');

        const isSandbox = process.env.NODE_ENV !== 'production';
        const baseUrl = isSandbox
          ? 'https://api.sandbox.midtrans.com/v2'
          : 'https://api.midtrans.com/v2';

        const url = `${baseUrl}/${encodeURIComponent(midtransReference)}/status`;
        const auth = Buffer.from(`${midtransServerKey}:`).toString('base64');

        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Midtrans status check failed: ${res.status} ${text}`);
        }

        midtransStatus = await res.json();
        
        if (process.env.NODE_ENV === 'development') console.log('💳 [MIDTRANS] Response:', {
          transaction_id: midtransStatus.transaction_id,
          transaction_status: midtransStatus.transaction_status,
          fraud_status: midtransStatus.fraud_status,
          status_code: midtransStatus.status_code,
          gross_amount: midtransStatus.gross_amount,
        });
      } catch (error: any) {
        console.error('❌ [MIDTRANS] Check error:', error.message);
        midtransError = true;
        
        // Continue with local status if Midtrans fails
      }
    } else {
      if (process.env.NODE_ENV === 'development') console.warn('⚠️ [PAYMENT STATUS] No transaction_id or va_number found');
    }

    // ============================================
    // 7. MAP MIDTRANS STATUS TO INTERNAL STATUS
    // ============================================
    let newPaymentStatus = order.payment_status;
    let newOrderStatus = order.status;
    let statusMessage = '';
    let shouldUpdateDb = false;

    if (midtransStatus && !midtransError) {
      const { transaction_status, fraud_status } = midtransStatus;

      // ✅ Settlement = Payment completed successfully
      if (transaction_status === MIDTRANS_STATUS.SETTLEMENT) {
        newPaymentStatus = PAYMENT_STATUS.PAID;
        newOrderStatus = order.is_pre_order 
          ? 'pre_order_confirmed' 
          : ORDER_STATUS.PROCESSING;
        statusMessage = 'Pembayaran berhasil diselesaikan';
        shouldUpdateDb = true;
      }
      // ✅ Capture + Accept = Payment captured and accepted
      else if (transaction_status === MIDTRANS_STATUS.CAPTURE) {
        if (fraud_status === 'accept') {
          newPaymentStatus = PAYMENT_STATUS.PAID;
          newOrderStatus = order.is_pre_order 
            ? 'pre_order_confirmed' 
            : ORDER_STATUS.PROCESSING;
          statusMessage = 'Pembayaran berhasil';
          shouldUpdateDb = true;
        } else if (fraud_status === 'challenge') {
          newPaymentStatus = PAYMENT_STATUS.PENDING;
          newOrderStatus = ORDER_STATUS.PENDING;
          statusMessage = 'Pembayaran sedang diverifikasi oleh bank';
        }
      }
      // ✅ Pending = Waiting for payment
      else if (transaction_status === MIDTRANS_STATUS.PENDING) {
        newPaymentStatus = PAYMENT_STATUS.PENDING;
        newOrderStatus = ORDER_STATUS.PENDING;
        statusMessage = 'Menunggu pembayaran';
      }
      // ✅ Deny = Payment denied by bank
      else if (transaction_status === MIDTRANS_STATUS.DENY) {
        newPaymentStatus = PAYMENT_STATUS.FAILED;
        newOrderStatus = ORDER_STATUS.CANCELLED;
        statusMessage = 'Pembayaran ditolak oleh bank';
        shouldUpdateDb = true;
      }
      // ✅ Cancel = Payment cancelled by user
      else if (transaction_status === MIDTRANS_STATUS.CANCEL) {
        newPaymentStatus = PAYMENT_STATUS.FAILED;
        newOrderStatus = ORDER_STATUS.CANCELLED;
        statusMessage = 'Pembayaran dibatalkan';
        shouldUpdateDb = true;
      }
      // ✅ Expire = Payment expired (24 hours passed)
      else if (transaction_status === MIDTRANS_STATUS.EXPIRE) {
        newPaymentStatus = PAYMENT_STATUS.EXPIRED;
        newOrderStatus = ORDER_STATUS.CANCELLED;
        statusMessage = 'Batas waktu pembayaran telah berakhir';
        shouldUpdateDb = true;
      }
      // ✅ Refund = Payment refunded
      else if (transaction_status === MIDTRANS_STATUS.REFUND || 
               transaction_status === MIDTRANS_STATUS.PARTIAL_REFUND) {
        newPaymentStatus = PAYMENT_STATUS.REFUNDED;
        newOrderStatus = ORDER_STATUS.CANCELLED;
        statusMessage = 'Pembayaran telah direfund';
        shouldUpdateDb = true;
      }
    } else if (midtransError) {
      statusMessage = 'Gagal mengecek status pembayaran, menggunakan status lokal';
    } else {
      statusMessage = 'Transaksi belum dibuat';
    }

    // ============================================
    // 8. UPDATE DATABASE IF STATUS CHANGED
    // ============================================
    if (shouldUpdateDb && 
        (newPaymentStatus !== order.payment_status || 
         newOrderStatus !== order.status)) {
      
      if (process.env.NODE_ENV === 'development') console.log('🔄 [PAYMENT STATUS] Updating order:', {
        orderId,
        oldPaymentStatus: order.payment_status,
        newPaymentStatus,
        oldOrderStatus: order.status,
        newOrderStatus,
      });

      try {
        await pool.query(
          `UPDATE orders 
           SET payment_status = ?, 
               status = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [newPaymentStatus, newOrderStatus, orderId]
        );

        // ✅ If payment successful, update PO status if applicable
        if (newPaymentStatus === PAYMENT_STATUS.PAID && order.is_pre_order) {
          await pool.query(
            `UPDATE orders 
             SET po_status = 'confirmed',
                 updated_at = NOW()
             WHERE id = ?`,
            [orderId]
          );
        }

        if (process.env.NODE_ENV === 'development') console.log('✅ [PAYMENT STATUS] Order updated successfully');
      } catch (updateError: any) {
        console.error('❌ [PAYMENT STATUS] Update error:', updateError.message);
        // Continue with response even if update fails
      }
    }

    // ============================================
    // 9. FETCH ORDER ITEMS
    // ============================================
    const [itemsRows] = await pool.query(
      `SELECT 
        oi.id,
        oi.order_id,
        oi.product_id,
        oi.product_name,
        oi.price_at_order,
        oi.quantity,
        oi.subtotal,
        p.image_path as product_image,
        p.unit
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?`,
      [orderId]
    );

    // ============================================
    // 10. FORMAT & RETURN RESPONSE
    // ============================================
    return NextResponse.json({
      success: true,
      data: {
        id: Number(order.id),
        orderId: Number(order.id),
        transactionId: order.transaction_id,
        status: newOrderStatus,
        paymentStatus: newPaymentStatus,
        paymentMethod: order.payment_method,
        paymentGateway: order.payment_gateway,
        paymentUrl: order.payment_url,
        vaNumber: order.va_number,
        paymentDeadline: order.payment_deadline 
          ? new Date(order.payment_deadline).toISOString() 
          : null,
        totalProductPrice: Number(order.total_product_price || 0),
        shippingCost: Number(order.shipping_cost || 0),
        paymentFee: Number(order.payment_fee || 0),
        grandTotal: Number(order.grand_total || 0),
        isPreOrder: Boolean(order.is_pre_order),
        estimatedShipDate: order.estimated_ship_date,
        poStatus: order.po_status,
        notes: order.notes,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        shippingAddress: {
          recipientName: order.recipient_name || '',
          recipientPhone: order.recipient_phone || '',
          detail: order.address_detail || '',
          province: order.province || '',
          city: order.city || '',
          district: order.district || '',
          villageName: order.village_name || '',
          villageCode: order.village_code || '',
          zipCode: order.zip_code || '',
        },
        items: (itemsRows as any[]).map((item: any) => ({
          id: Number(item.id),
          orderId: Number(item.order_id),
          productId: Number(item.product_id),
          productName: item.product_name || 'Produk Dihapus',
          priceAtOrder: Number(item.price_at_order || 0),
          price: Number(item.price_at_order || 0),
          quantity: Number(item.quantity || 0),
          subtotal: Number(item.subtotal || 0),
          unit: item.unit || 'pcs',
          productImage: item.product_image || null,
        })),
        midtransStatus: midtransStatus ? {
          transactionStatus: midtransStatus.transaction_status,
          fraudStatus: midtransStatus.fraud_status,
          statusCode: midtransStatus.status_code,
        } : null,
        message: statusMessage,
        source: midtransStatus && !midtransError ? 'midtrans' : 'local',
      },
    });

  } catch (error: any) {
    console.error('❌ [PAYMENT STATUS] Error:', error);
    
    // ✅ Handle specific error types
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json(
        { success: false, error: 'Table not found', code: 'TABLE_NOT_FOUND' },
        { status: 500 }
      );
    }
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return NextResponse.json(
        { success: false, error: 'Column not found', code: 'COLUMN_NOT_FOUND' },
        { status: 500 }
      );
    }
    if (error.code === 'ER_CONN_HOST_ERROR' || error.message?.includes('timeout')) {
      return NextResponse.json(
        { success: false, error: 'Database connection timeout', code: 'DB_TIMEOUT' },
        { status: 503 }
      );
    }
    
    return handleAPIError(error, 'GET /api/orders/[id]/payment-status');
  }
}
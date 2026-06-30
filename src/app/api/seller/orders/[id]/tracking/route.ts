// src/app/api/seller/orders/[id]/tracking/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { trackShipment, normalizeToOrderStatus } from '@/lib/courier-api';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
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

    // 1. Verify seller owns items in this order
    const [ownershipCheck] = await pool.query(
      'SELECT id FROM order_items WHERE order_id = ? AND seller_id = ? LIMIT 1',
      [orderId, decoded.sub]
    );

    if ((ownershipCheck as any[]).length === 0) {
      return NextResponse.json({ success: false, error: 'Order tidak ditemukan' }, { status: 404 });
    }

    // 2. Get order with tracking info
    const [orders] = await pool.query(
      `SELECT id, order_number, status, tracking_number, courier_code, 
              courier_name, shipped_at, delivered_at
       FROM orders WHERE id = ?`,
      [orderId]
    );

    const order = (orders as any[])[0];
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order tidak ditemukan' }, { status: 404 });
    }

    if (!order.tracking_number) {
      return NextResponse.json({
        success: true,
        data: {
          orderId,
          orderNumber: order.order_number,
          hasTracking: false,
          message: 'Order belum memiliki nomor resi',
        },
      });
    }

    // 3. Validate tracking data
    if (!order.courier_code) {
      return NextResponse.json({
        success: true,
        data: {
          orderId,
          orderNumber: order.order_number,
          hasTracking: true,
          trackingNumber: order.tracking_number,
          courier: { code: 'unknown', name: 'Unknown' },
          orderStatus: order.status,
          trackingStatus: 'Unknown',
          shippedAt: order.shipped_at,
          deliveredAt: order.delivered_at,
          lastUpdate: null,
          history: [],
          source: 'cached',
          warning: 'Kode kurir tidak ditemukan. Tracking tidak dapat dilakukan.',
        },
      });
    }

    // 4. Live tracking with better error handling
    let liveTracking = null;
    let trackingError = null;

    try {
      console.log('🔍 [SELLER TRACKING] Starting tracking:', {
        orderId,
        courierCode: order.courier_code,
        trackingNumber: order.tracking_number,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds

      try {
        liveTracking = await trackShipment(order.courier_code, order.tracking_number);
        clearTimeout(timeoutId);
        
        console.log('✅ [SELLER TRACKING] Success:', {
          status: liveTracking.status,
          historyCount: liveTracking.history.length,
        });
      } catch (abortError: any) {
        clearTimeout(timeoutId);
        
        if (abortError.name === 'AbortError') {
          trackingError = 'Request timeout. Server kurir tidak merespons.';
        } else {
          trackingError = abortError.message || 'Tracking failed';
        }
        
        console.error('⚠️ [SELLER TRACKING] Failed:', trackingError);
      }
    } catch (error: any) {
      console.error('⚠️ [SELLER TRACKING] Error:', error.message);
      trackingError = error.message;
    }

    // 5. Get saved history
    const [historyRows] = await pool.query(
      `SELECT status, description, location, tracking_time
       FROM shipment_tracking 
       WHERE order_id = ?
       ORDER BY tracking_time DESC`,
      [orderId]
    );

    // 6. Save new events & update status if live tracking successful
    if (liveTracking && liveTracking.history.length > 0) {
      for (const event of liveTracking.history) {
        try {
          await pool.query(
            `INSERT IGNORE INTO shipment_tracking 
             (order_id, status, description, location, tracking_time, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [orderId, liveTracking.status, event.description, event.location, event.date]
          );
        } catch (e) {
          // Ignore duplicate
        }
      }

      // Update order status
      const newStatus = normalizeToOrderStatus(liveTracking.status);
      if (newStatus && newStatus !== order.status) {
        const updateFields = ['status = ?', 'updated_at = NOW()'];
        const updateValues: any[] = [newStatus];

        if (newStatus === 'delivered' && !order.delivered_at) {
          updateFields.push('delivered_at = NOW()');
        }

        updateValues.push(orderId);

        await pool.query(
          `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }
    }

    // 7. Build response
    const trackingHistory = liveTracking?.history.length
      ? liveTracking.history
      : (historyRows as any[]).map((h: any) => ({
          date: h.tracking_time,
          description: h.description,
          location: h.location,
        }));

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        orderNumber: order.order_number,
        hasTracking: true,
        trackingNumber: order.tracking_number,
        courier: {
          code: order.courier_code,
          name: order.courier_name || order.courier_code,
        },
        orderStatus: order.status,
        trackingStatus: liveTracking?.status || 'Unknown',
        shippedAt: order.shipped_at,
        deliveredAt: order.delivered_at,
        lastUpdate: liveTracking?.lastUpdate || null,
        history: trackingHistory,
        source: liveTracking ? 'live' : 'cached',
        warning: trackingError ? `Live tracking gagal: ${trackingError}` : null,
      },
    });

  } catch (error: any) {
    console.error('❌ GET seller tracking error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
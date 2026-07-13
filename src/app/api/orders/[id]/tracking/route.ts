// src/app/api/orders/[id]/tracking/route.ts
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
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    // 1. Get order - verify ownership
    const [orders] = await pool.query(
      `SELECT id, status, tracking_number, courier_code, 
              courier_name, shipped_at, delivered_at, user_id
       FROM orders 
       WHERE id = ? AND user_id = ?`,
      [orderId, decoded.sub]
    );

    const order = (orders as any[])[0];
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order tidak ditemukan' }, { status: 404 });
    }

    // 2. Check if order has tracking number
    if (!order.tracking_number) {
      return NextResponse.json({
        success: true,
        data: {
          orderId,
          orderNumber: order.id,
          hasTracking: false,
          message: 'Pesanan belum memiliki nomor resi',
        },
      });
    }

    // 3. Validate tracking data
    if (!order.courier_code) {
      return NextResponse.json({
        success: true,
        data: {
          orderId,
          orderNumber: order.id,
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

    // 4. Try live tracking with better error handling
    let liveTracking = null;
    let trackingError = null;

    try {
      if (process.env.NODE_ENV === 'development') console.log('🔍 [BUYER TRACKING] Starting tracking:', {
        orderId,
        courierCode: order.courier_code,
        trackingNumber: order.tracking_number,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        liveTracking = await trackShipment(
          order.courier_code,
          order.tracking_number
        );
        clearTimeout(timeoutId);
        
        if (process.env.NODE_ENV === 'development') console.log('✅ [BUYER TRACKING] Success:', {
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
        
        console.error('⚠️ [BUYER TRACKING] Failed:', trackingError);
      }
    } catch (error: any) {
      console.error('⚠️ Live tracking failed:', error.message);
      trackingError = error.message;
    }

    // 5. Get saved tracking history
    const [historyRows] = await pool.query(
      `SELECT status, description, location, tracking_time
       FROM shipment_tracking 
       WHERE order_id = ?
       ORDER BY tracking_time DESC`,
      [orderId]
    );

    // 6. If live tracking available, save new events & update status
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

      // Update order status jika ada perubahan
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
        orderNumber: order.id,
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
    console.error('❌ GET /api/orders/[id]/tracking error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
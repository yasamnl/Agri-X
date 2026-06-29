// src/app/api/orders/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { NotificationService } from '@/lib/notification.service';

type Params = {
  params: Promise<{ id: string }>;
};

// ============================================================================
// ✅ Helper: Check if column exists in table
// ============================================================================
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const [rows] = await pool.query(
      `SELECT 1 FROM information_schema.columns 
       WHERE table_name = ? AND column_name = ? AND table_schema = DATABASE()`,
      [tableName, columnName]
    );
    return (rows as any[]).length > 0;
  } catch {
    return false;
  }
}

// ============================================================================
// PATCH: Update order status (Admin only)
// ============================================================================
export async function PATCH(req: NextRequest, { params }: Params) {
  let connection;

  try {
    // ============================================
    // 1. AUTH CHECK (Admin only)
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
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // ============================================
    // 2. PARSE & VALIDATE INPUT
    // ============================================
    const { id } = await params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { status, courier, trackingNumber, reason } = body;

    console.log('📦 [ORDER STATUS] Update request:', {
      orderId,
      status,
      courier,
      trackingNumber,
      reason,
      adminId: decoded.sub,
    });

    // ✅ Validasi status
    const validStatuses = [
      'pending',
      'paid',
      'processing',
      'shipped',
      'delivered',
      'completed',
      'cancelled'
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid status. Valid options: ${validStatuses.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // ✅ Validasi courier jika status = shipped
    if (status === 'shipped' && !courier) {
      return NextResponse.json(
        { success: false, error: 'Courier is required for shipped status' },
        { status: 400 }
      );
    }

    // ============================================
    // 3. GET DATABASE CONNECTION & START TRANSACTION
    // ============================================
    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // ============================================
      // 4. FETCH ORDER DETAILS (dengan lock)
      // ============================================
      const [orders] = await connection.query(
        `SELECT 
          o.id,
          o.user_id,
          o.status as current_status,
          o.payment_status,
          o.payment_method,
          o.grand_total,
          o.is_pre_order,
          u.nama_lengkap as user_name,
          u.email as user_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ? AND o.status != 'deleted'
        FOR UPDATE`,
        [orderId]
      );

      const order = (orders as any[])[0];

      if (!order) {
        await connection.rollback();
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        );
      }

      console.log('📦 [ORDER STATUS] Current order:', {
        id: order.id,
        currentStatus: order.current_status,
        paymentStatus: order.payment_status,
        userId: order.user_id,
      });

      // ============================================
      // 5. VALIDATE STATUS TRANSITION
      // ============================================
      const currentStatus = order.current_status;
      
      // ✅ Validasi transisi status yang valid
      const validTransitions: Record<string, string[]> = {
        'pending': ['paid', 'cancelled'],
        'paid': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['delivered', 'completed'],
        'delivered': ['completed'],
        'completed': [],  // Tidak bisa diubah lagi
        'cancelled': [],  // Tidak bisa diubah lagi
      };

      const allowedNext = validTransitions[currentStatus] || [];
      
      if (!allowedNext.includes(status)) {
        await connection.rollback();
        return NextResponse.json(
          { 
            success: false, 
            error: `Tidak dapat mengubah status dari "${currentStatus}" ke "${status}". Transisi yang diizinkan: ${allowedNext.join(', ') || 'tidak ada'}` 
          },
          { status: 400 }
        );
      }

      // ============================================
      // 6. UPDATE ORDER STATUS
      // ============================================
      
      // ✅ Cek apakah kolom courier & tracking_number ada
      const hasCourierColumn = await columnExists('orders', 'courier');
      const hasTrackingColumn = await columnExists('orders', 'tracking_number');

      // ✅ Build dynamic UPDATE query (MySQL syntax dengan ?)
      const updateFields: string[] = ['status = ?', 'updated_at = NOW()'];
      const updateValues: any[] = [status];

      // ✅ Tambah courier & tracking_number jika status = shipped
      if (status === 'shipped') {
        if (hasCourierColumn) {
          updateFields.push('courier = ?');
          updateValues.push(courier);
        }
        if (hasTrackingColumn && trackingNumber) {
          updateFields.push('tracking_number = ?');
          updateValues.push(trackingNumber);
        }
      }

      // ✅ Jika cancelled, update payment_status juga
      if (status === 'cancelled') {
        updateFields.push('payment_status = ?');
        updateValues.push('refunded');
      }

      // ✅ Jika completed, set payment_status = paid (jika belum)
      if (status === 'completed' && order.payment_status !== 'paid') {
        updateFields.push('payment_status = ?');
        updateValues.push('paid');
      }

      // ✅ Tambahkan orderId di akhir values (untuk WHERE clause)
      updateValues.push(orderId);

      const updateQuery = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`;
      
      console.log('📦 [ORDER STATUS] Update query:', updateQuery);
      console.log('📦 [ORDER STATUS] Update values:', updateValues);

      const [updateResult] = await connection.query(updateQuery, updateValues);

      // ✅ ✅ ✅ FIX: MySQL menggunakan affectedRows, BUKAN rowCount
      if ((updateResult as any).affectedRows === 0) {
        await connection.rollback();
        return NextResponse.json(
          { success: false, error: 'Order could not be updated' },
          { status: 500 }
        );
      }

      console.log('✅ [ORDER STATUS] Order updated successfully');

      // ============================================
      // 7. HANDLE PRE-ORDER SPECIFIC LOGIC
      // ============================================
      if (order.is_pre_order && status === 'shipped') {
        // Update po_status ke 'shipped'
        await connection.query(
          `UPDATE orders SET po_status = 'shipped', updated_at = NOW() WHERE id = ?`,
          [orderId]
        );
        console.log('📦 [PO] Updated po_status to shipped');
      }

      // ============================================
      // 8. SEND NOTIFICATION
      // ============================================
      let notificationResult = null;

      try {
        switch (status) {
          case 'paid':
            notificationResult = await NotificationService.send({
              userId: order.user_id,
              type: 'order',
              templateCode: 'order_paid',
              variables: {
                order_id: String(order.id),
                total_amount: String(order.grand_total),
              },
              actionType: 'order_paid',
              referenceId: String(orderId),
            });
            break;

          case 'processing':
            notificationResult = await NotificationService.send({
              userId: order.user_id,
              type: 'order',
              templateCode: 'order_processing',
              variables: {
                order_id: String(order.id),
              },
              actionType: 'order_processing',
              referenceId: String(orderId),
            });
            break;

          case 'shipped':
            notificationResult = await NotificationService.send({
              userId: order.user_id,
              type: 'order',
              templateCode: 'order_shipped',
              variables: {
                order_id: String(order.id),
                courier: courier || 'Kurir',
                tracking_number: trackingNumber || '-',
              },
              actionType: 'order_shipped',
              referenceId: String(orderId),
            });
            break;

          case 'delivered':
            notificationResult = await NotificationService.send({
              userId: order.user_id,
              type: 'order',
              templateCode: 'order_delivered',
              variables: {
                order_id: String(order.id),
              },
              actionType: 'order_delivered',
              referenceId: String(orderId),
            });
            break;

          case 'completed':
            notificationResult = await NotificationService.send({
              userId: order.user_id,
              type: 'order',
              templateCode: 'order_completed',
              variables: {
                order_id: String(order.id),
              },
              actionType: 'order_completed',
              referenceId: String(orderId),
            });
            break;

          case 'cancelled':
            notificationResult = await NotificationService.send({
              userId: order.user_id,
              type: 'order',
              templateCode: 'order_cancelled',
              variables: {
                order_id: String(order.id),
                reason: reason || 'Dibatalkan oleh admin',
              },
              actionType: 'order_cancelled',
              referenceId: String(orderId),
            });
            break;
        }

        if (notificationResult) {
          console.log('📧 [NOTIFICATION] Sent:', notificationResult);
        }
      } catch (notifError: any) {
        // ✅ Jangan gagal jika notifikasi error, log saja
        console.error('⚠️ [NOTIFICATION] Failed to send:', notifError.message);
      }

      // ============================================
      // 9. COMMIT TRANSACTION
      // ============================================
      await connection.commit();
      console.log('✅ [ORDER STATUS] Transaction committed');

      // ============================================
      // 10. RETURN SUCCESS RESPONSE
      // ============================================
      return NextResponse.json({
        success: true,
        message: `Status pesanan berhasil diubah ke "${status}"`,
        data: {
          orderId,
          previousStatus: currentStatus,
          newStatus: status,
          updatedBy: decoded.sub,
          notification: notificationResult ? 'sent' : 'skipped',
        },
      });

    } catch (error: any) {
      await connection.rollback();
      console.error('❌ [ORDER STATUS] Transaction rolled back:', error.message);
      throw error;
    }

  } catch (error: any) {
    console.error('❌ [ORDER STATUS] Error:', error);

    // ✅ Handle MySQL specific errors
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json(
        { success: false, error: 'Table not found', code: 'TABLE_NOT_FOUND' },
        { status: 500 }
      );
    }
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return NextResponse.json(
        { success: false, error: 'Column not found: ' + error.message, code: 'COLUMN_NOT_FOUND' },
        { status: 500 }
      );
    }
    if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
      return NextResponse.json(
        { success: false, error: 'Order sedang diproses, coba lagi', code: 'LOCK_TIMEOUT' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
// src/app/api/webhook/midtrans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { completeAffiliateTransaction, cancelAffiliateTransaction } from '@/lib/affiliate';

// ============================================
// MIDTRANS WEBHOOK HANDLER
// ============================================
export async function POST(req: NextRequest) {
  try {
    // 1. Parse request body
    const body = await req.json();
    
    if (process.env.NODE_ENV === 'development') console.log('💳 [MIDTRANS WEBHOOK] Received:', {
      order_id: body.order_id,
      transaction_status: body.transaction_status,
      fraud_status: body.fraud_status,
      status_code: body.status_code,
    });

    // 2. Verify signature (security check)
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      console.error('❌ [MIDTRANS WEBHOOK] Server key not configured');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const signatureKey = crypto
      .createHash('sha512')
      .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
      .digest('hex');

    if (signatureKey !== body.signature_key) {
      console.error('❌ [MIDTRANS WEBHOOK] Invalid signature');
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 3. Extract order ID from Midtrans order_id format (AGR-123-timestamp)
    const midtransOrderId = body.order_id;
    const orderIdMatch = midtransOrderId.match(/^AGR-(\d+)-/);
    
    if (!orderIdMatch) {
      console.error('❌ [MIDTRANS WEBHOOK] Invalid order_id format:', midtransOrderId);
      return NextResponse.json(
        { success: false, error: 'Invalid order_id format' },
        { status: 400 }
      );
    }

    const orderId = parseInt(orderIdMatch[1]);
    const transactionStatus = body.transaction_status;
    const fraudStatus = body.fraud_status;

    // 4. Get current order from database
    const [orders] = await pool.query(
      `SELECT id, status, payment_status, affiliate_application_id 
       FROM orders WHERE id = ?`,
      [orderId]
    );

    const order = (orders as any[])[0];
    if (!order) {
      console.error('❌ [MIDTRANS WEBHOOK] Order not found:', orderId);
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // 5. Map Midtrans status to our order status
    let newOrderStatus = order.status;
    let newPaymentStatus = order.payment_status;
    let shouldUpdateOrder = false;

    switch (transactionStatus) {
      case 'capture':
        // Credit card transaction captured
        if (fraudStatus === 'challenge') {
          // Fraud detected, manual review needed
          newPaymentStatus = 'pending';
          shouldUpdateOrder = true;
          if (process.env.NODE_ENV === 'development') console.log(`⚠️ [MIDTRANS WEBHOOK] Order ${orderId}: Fraud challenge detected`);
        } else if (fraudStatus === 'accept') {
          // Payment successful
          newPaymentStatus = 'paid';
          newOrderStatus = 'paid';
          shouldUpdateOrder = true;
          if (process.env.NODE_ENV === 'development') console.log(`✅ [MIDTRANS WEBHOOK] Order ${orderId}: Payment captured successfully`);
        }
        break;

      case 'settlement':
        // Payment settled (bank transfer, e-wallet, etc)
        newPaymentStatus = 'paid';
        newOrderStatus = 'paid';
        shouldUpdateOrder = true;
        if (process.env.NODE_ENV === 'development') console.log(`✅ [MIDTRANS WEBHOOK] Order ${orderId}: Payment settled`);
        break;

      case 'pending':
        // Waiting for payment
        newPaymentStatus = 'pending';
        shouldUpdateOrder = true;
        if (process.env.NODE_ENV === 'development') console.log(`⏳ [MIDTRANS WEBHOOK] Order ${orderId}: Waiting for payment`);
        break;

      case 'deny':
        // Payment denied by bank or fraud system
        newPaymentStatus = 'failed';
        newOrderStatus = 'cancelled';
        shouldUpdateOrder = true;
        if (process.env.NODE_ENV === 'development') console.log(`❌ [MIDTRANS WEBHOOK] Order ${orderId}: Payment denied`);
        break;

      case 'cancel':
        // Transaction cancelled by user or system
        newPaymentStatus = 'failed';
        newOrderStatus = 'cancelled';
        shouldUpdateOrder = true;
        if (process.env.NODE_ENV === 'development') console.log(`❌ [MIDTRANS WEBHOOK] Order ${orderId}: Transaction cancelled`);
        break;

      case 'expire':
        // Transaction expired (payment deadline passed)
        newPaymentStatus = 'expired';
        newOrderStatus = 'cancelled';
        shouldUpdateOrder = true;
        if (process.env.NODE_ENV === 'development') console.log(`⏰ [MIDTRANS WEBHOOK] Order ${orderId}: Transaction expired`);
        break;

      case 'refund':
        // Full refund
        newPaymentStatus = 'refunded';
        newOrderStatus = 'cancelled';
        shouldUpdateOrder = true;
        if (process.env.NODE_ENV === 'development') console.log(`💰 [MIDTRANS WEBHOOK] Order ${orderId}: Full refund processed`);
        break;

      case 'partial_refund':
        // Partial refund (keep order active)
        newPaymentStatus = 'refunded';
        shouldUpdateOrder = true;
        if (process.env.NODE_ENV === 'development') console.log(`💰 [MIDTRANS WEBHOOK] Order ${orderId}: Partial refund processed`);
        break;

      default:
        if (process.env.NODE_ENV === 'development') console.warn(`⚠️ [MIDTRANS WEBHOOK] Unknown transaction status: ${transactionStatus}`);
        return NextResponse.json(
          { success: false, error: 'Unknown transaction status' },
          { status: 400 }
        );
    }

    // 6. Update order status if changed
    if (shouldUpdateOrder) {
      const updateFields: string[] = ['payment_status = ?', 'updated_at = NOW()'];
      const updateValues: any[] = [newPaymentStatus];

      if (newOrderStatus !== order.status) {
        updateFields.push('status = ?');
        updateValues.push(newOrderStatus);
      }

      // Add timestamp for specific statuses
      if (newPaymentStatus === 'paid') {
        updateFields.push('paid_at = NOW()');
      } else if (newOrderStatus === 'cancelled') {
        updateFields.push('cancelled_at = NOW()');
      }

      updateValues.push(orderId);

      await pool.query(
        `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      if (process.env.NODE_ENV === 'development') console.log(`✅ [MIDTRANS WEBHOOK] Order ${orderId} updated: status=${newOrderStatus}, payment=${newPaymentStatus}`);
    }

    // 7. Handle affiliate commission
    if (order.affiliate_application_id) {
      if (newPaymentStatus === 'paid') {
        // Payment successful - complete affiliate transaction
        const result = await completeAffiliateTransaction(orderId);
        
        if (result.success) {
          if (process.env.NODE_ENV === 'development') console.log(`✅ [MIDTRANS WEBHOOK] Affiliate commission completed for order ${orderId}: Rp ${result.komisi}`);
        } else {
          console.error(`❌ [MIDTRANS WEBHOOK] Failed to complete affiliate commission for order ${orderId}:`, result.error);
        }
      } else if (newOrderStatus === 'cancelled') {
        // Order cancelled - cancel affiliate transaction
        const result = await cancelAffiliateTransaction(orderId);
        
        if (result.success) {
          if (process.env.NODE_ENV === 'development') console.log(`✅ [MIDTRANS WEBHOOK] Affiliate commission cancelled for order ${orderId}`);
        } else {
          console.error(`❌ [MIDTRANS WEBHOOK] Failed to cancel affiliate commission for order ${orderId}:`, result.error);
        }
      }
    }

    // 8. Return success response
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      data: {
        orderId,
        transactionStatus,
        newOrderStatus,
        newPaymentStatus,
      },
    });

  } catch (error: any) {
    console.error('❌ [MIDTRANS WEBHOOK] Error:', error);
    
    // Return 500 to trigger Midtrans retry
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// GET endpoint for testing (optional)
// ============================================
export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Midtrans webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
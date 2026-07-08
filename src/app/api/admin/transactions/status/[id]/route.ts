// src/app/api/admin/transactions/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    // Check if user is admin
    const userCheck = await pool.query(
      'SELECT role FROM users WHERE id = ?',
      [decoded.sub]
    ) as any;

    if (!userCheck[0] || userCheck[0].role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const transactionId = parseInt(id);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Check if transaction exists
    const transactions = await pool.query(
      'SELECT id, status, invoice_number, user_id, grand_total FROM orders WHERE id = ?',
      [transactionId]
    ) as any;

    if (!transactions[0]) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const transaction = transactions[0];
    const oldStatus = transaction.status;

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      pending: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['completed'],
      completed: [],
      cancelled: [],
    };

    if (!validTransitions[oldStatus]?.includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot change status from ${oldStatus} to ${status}` 
        },
        { status: 400 }
      );
    }

    // Update transaction status
    await pool.query(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, transactionId]
    );

    // If status is completed, update product stock
    if (status === 'completed') {
      // Get order items
      const orderItems = await pool.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [transactionId]
      ) as any;

      // Update stock for each product
      for (const item of orderItems[0]) {
        await pool.query(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    // Create notification for user
    const statusMessages: Record<string, string> = {
      processing: 'Pesanan Anda sedang diproses',
      shipped: 'Pesanan Anda telah dikirim',
      completed: 'Pesanan Anda telah selesai',
      cancelled: 'Pesanan Anda telah dibatalkan',
    };

    if (statusMessages[status]) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
         VALUES (?, ?, ?, 'order_status', FALSE, NOW())`,
        [
          transaction.user_id,
          'Update Status Pesanan',
          `${statusMessages[status]}. Invoice: ${transaction.invoice_number}`,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Transaction status updated to ${status}`,
      data: {
        id: transactionId,
        invoiceNumber: transaction.invoice_number,
        oldStatus,
        newStatus: status,
      },
    });

  } catch (error: any) {
    console.error('Admin update transaction status error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to update transaction status' 
      },
      { status: 500 }
    );
  }
}
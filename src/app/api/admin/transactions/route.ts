// src/app/api/admin/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // ✅ Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // ✅ Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 100);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const paymentMethod = searchParams.get('paymentMethod') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';
    
    const offset = (page - 1) * limit;

    // ✅ Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      conditions.push('o.status = ?');
      params.push(status);
    }

    if (paymentMethod) {
      conditions.push('o.payment_method = ?');
      params.push(paymentMethod);
    }

    if (search) {
      conditions.push('(o.transaction_id LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (dateFrom) {
      conditions.push('DATE(o.created_at) >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('DATE(o.created_at) <= ?');
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ✅ Validate sort column
    const validSortColumns = ['created_at', 'grand_total', 'status', 'transaction_id'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';

    // ✅ Fetch transactions with pagination
    const [transactions] = await pool.query(
      `SELECT 
        o.id,
        o.transaction_id,
        o.user_id,
        o.grand_total,
        o.shipping_cost,
        o.total_product_price,
        o.status,
        o.payment_method,
        o.payment_status,
        o.address_id,
        o.created_at,
        o.updated_at,
        u.name as buyer_name,
        u.email as buyer_email,
        u.no_telp as buyer_phone,
        COUNT(DISTINCT oi.product_id) as total_items,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // ✅ Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(DISTINCT o.id) as total
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ${whereClause}`,
      params
    );

    const total = countResult[0]?.total || 0;

    // ✅ Get status counts for filter badges
    const [statusCounts] = await pool.query(
      `SELECT 
        status,
        COUNT(*) as count,
        SUM(grand_total) as total_amount
       FROM orders
       GROUP BY status`
    );

    const statusCountMap: Record<string, { count: number; amount: number }> = {};
    statusCounts.forEach((row: any) => {
      statusCountMap[row.status] = {
        count: Number(row.count),
        amount: Number(row.total_amount)
      };
    });

    // ✅ Get payment method counts
    const [paymentCounts] = await pool.query(
      `SELECT 
        payment_method,
        COUNT(*) as count
       FROM orders
       GROUP BY payment_method`
    );

    const paymentCountMap: Record<string, number> = {};
    paymentCounts.forEach((row: any) => {
      paymentCountMap[row.payment_method] = Number(row.count);
    });

    // ✅ Get summary statistics
    const [summary] = await pool.query(
      `SELECT 
        COUNT(*) as total_orders,
        SUM(grand_total) as total_revenue,
        AVG(grand_total) as avg_order_value,
        SUM(CASE WHEN status = 'completed' THEN grand_total ELSE 0 END) as completed_revenue,
        SUM(CASE WHEN status = 'pending' THEN grand_total ELSE 0 END) as pending_revenue
       FROM orders
       ${dateFrom || dateTo ? `WHERE ${dateFrom ? 'DATE(created_at) >= ?' : '1=1'} ${dateTo ? 'AND DATE(created_at) <= ?' : ''}` : ''}`,
      [dateFrom, dateTo].filter(Boolean)
    );

    // ✅ Format response
    const formattedTransactions = transactions.map((t: any) => ({
      id: Number(t.id),
      transactionId: t.transaction_id,
      buyer: {
        id: Number(t.user_id),
        name: t.buyer_name,
        email: t.buyer_email,
        phone: t.buyer_phone,
      },
      items: {
        count: Number(t.total_items),
        quantity: Number(t.total_quantity),
      },
      pricing: {
        subtotal: Number(t.total_product_price),
        shipping: Number(t.shipping_cost),
        total: Number(t.grand_total),
      },
      status: t.status,
      payment: {
        method: t.payment_method,
        status: t.payment_status,
      },
      addressId: t.address_id,
      notes: t.notes,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        statusCounts: {
          all: {
            count: Object.values(statusCountMap).reduce((sum: number, s: any) => sum + s.count, 0),
            amount: Object.values(statusCountMap).reduce((sum: number, s: any) => sum + s.amount, 0),
          },
          pending: statusCountMap['pending'] || { count: 0, amount: 0 },
          processing: statusCountMap['processing'] || { count: 0, amount: 0 },
          shipped: statusCountMap['shipped'] || { count: 0, amount: 0 },
          completed: statusCountMap['completed'] || { count: 0, amount: 0 },
          cancelled: statusCountMap['cancelled'] || { count: 0, amount: 0 },
        },
        paymentCounts: {
          all: Object.values(paymentCountMap).reduce((sum: number, c: number) => sum + c, 0),
          midtrans: paymentCountMap['midtrans'] || 0,
          cod: paymentCountMap['cod'] || 0,
          bank_transfer: paymentCountMap['bank_transfer'] || 0,
        },
        summary: summary[0] ? {
          totalOrders: Number(summary[0].total_orders),
          totalRevenue: Number(summary[0].total_revenue),
          avgOrderValue: Number(summary[0].avg_order_value),
          completedRevenue: Number(summary[0].completed_revenue),
          pendingRevenue: Number(summary[0].pending_revenue),
        } : null,
      },
    });

  } catch (error: any) {
    console.error('Admin transactions error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch transactions' 
      },
      { status: 500 }
    );
  }
}
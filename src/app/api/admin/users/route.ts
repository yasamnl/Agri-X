// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
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
    const [userCheck] = (await pool.query(
      'SELECT role FROM users WHERE id = ?',
      [decoded.sub]
    )) as any;

    if (!userCheck[0] || userCheck[0].role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const minTransactions = searchParams.get('minTransactions') || '';
    const maxTransactions = searchParams.get('maxTransactions') || '';
    const offset = (page - 1) * limit;

    // Build base query with transaction count
    let query = `
      SELECT 
        u.*,
        COUNT(DISTINCT o.id) as total_transactions,
        COALESCE(SUM(o.grand_total), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Search filter
    if (search) {
      query += ' AND (u.nama_lengkap LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Role filter
    if (role && role !== 'all') {
      query += ' AND u.role = ?';
      params.push(role);
    }

    // Status filter
    if (status && status !== 'all') {
      query += ' AND u.status = ?';
      params.push(status);
    }

    // Date range filter
    if (dateFrom) {
      query += ' AND DATE(u.created_at) >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ' AND DATE(u.created_at) <= ?';
      params.push(dateTo);
    }

    // Group by user before having clause
    query += ' GROUP BY u.id';

    // Transaction count filters (must be after GROUP BY)
    if (minTransactions) {
      query += ' HAVING COUNT(DISTINCT o.id) >= ?';
      params.push(parseInt(minTransactions));
    }

    if (maxTransactions) {
      if (minTransactions) {
        query += ' AND COUNT(DISTINCT o.id) <= ?';
      } else {
        query += ' HAVING COUNT(DISTINCT o.id) <= ?';
      }
      params.push(parseInt(maxTransactions));
    }

    // Order and pagination
    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Get users
    const [users] = (await pool.query(query, params)) as any;

    // Build count query (without transaction filters for accuracy)
    let countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (search) {
      countQuery += ' AND (u.nama_lengkap LIKE ? OR u.email LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (role && role !== 'all') {
      countQuery += ' AND u.role = ?';
      countParams.push(role);
    }

    if (status && status !== 'all') {
      countQuery += ' AND u.status = ?';
      countParams.push(status);
    }

    if (dateFrom) {
      countQuery += ' AND DATE(u.created_at) >= ?';
      countParams.push(dateFrom);
    }

    if (dateTo) {
      countQuery += ' AND DATE(u.created_at) <= ?';
      countParams.push(dateTo);
    }

    const [countResult] = (await pool.query(countQuery, countParams)) as any;
    const total = countResult[0].total;

    return NextResponse.json({
      success: true,
      data: {
        users: users.map((user: any) => ({
          id: user.id,
          name: user.nama_lengkap || user.name,
          email: user.email,
          role: user.role,
          status: user.status || 'active',
          createdAt: user.created_at,
          totalTransactions: Number(user.total_transactions) || 0,
          totalSpent: Number(user.total_spent) || 0,
          avatar: user.avatar || null,
          noTelp: user.no_telp || null,
          isVerified: user.is_verified || false,
          emailVerifiedAt: user.email_verified_at || null,
        })),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error: any) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch users',
        code: 'ADMIN_USERS_ERROR'
      },
      { status: 500 }
    );
  }
}
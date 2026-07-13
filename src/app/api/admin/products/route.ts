import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  try {
    // ✅ Auth check - hanya admin yang bisa akses
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // ✅ Parse query params
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const offset = (page - 1) * limit;

    // ✅ Build query dengan search & filter - PostgreSQL syntax
    let query = `SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.unit,
        p.stock,
        p.sold_count,
        p.origin_village_code,
        p.min_order,
        p.seller_id,
        p.harvest_date,
        p.image_path,
        p.category,
        p.status,
        p.po_quota,
        p.po_sold,
        p.category_id,
        p.created_at,
        p.updated_at,
        u.name as seller_name,
        u.email as seller_email,
        c.name as category_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN category c ON p.category_id = c.id
      WHERE p.status != 'deleted'`;
    
    const params: any[] = [];
    let paramIndex = 1;

    // ✅ Search filter - PostgreSQL: $1, $2, ...
    if (search) {
      query += ` AND (
        p.name LIKE $${paramIndex} OR 
        p.description LIKE $${paramIndex + 1} OR 
        p.category LIKE $${paramIndex + 2} OR 
        u.name LIKE $${paramIndex + 3} OR
        c.name LIKE $${paramIndex + 4}
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
      paramIndex += 5;
    }

    // ✅ Status filter
    if (status && ['ready_stock', 'pre-order', 'sold_out'].includes(status)) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // ✅ Pagination
    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // ✅ Execute query - PostgreSQL: pool.query() + { rows }
    // pool.execute returns [rows, fields] - cast to any to satisfy TS
    const productsResult: any = await pool.execute(query, params);
    const products: any[] = productsResult[0] || [];

    // ✅ Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total 
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN category c ON p.category_id = c.id
      WHERE p.status != 'deleted'`;
    const countParams: any[] = [];
    let countParamIndex = 1;
    
    if (search) {
      countQuery += ` AND (
        p.name LIKE $${countParamIndex} OR 
        p.description LIKE $${countParamIndex + 1} OR 
        p.category LIKE $${countParamIndex + 2} OR 
        u.name LIKE $${countParamIndex + 3} OR
        c.name LIKE $${countParamIndex + 4}
      )`;
      const searchParam = `%${search}%`;
      countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
      countParamIndex += 5;
    }
    if (status && ['ready_stock', 'pre-order', 'sold_out'].includes(status)) {
      countQuery += ` AND p.status = $${countParamIndex}`;
      countParams.push(status);
    }

    const countResultRaw: any = await pool.execute(countQuery, countParams);
    const countRows: any[] = countResultRaw[0] || [];
    const total = Number(countRows[0]?.total || 0);

    // ✅ Format response - Convert types for consistency
    const formattedProducts = products.map((p: any) => ({
      id: Number(p.id),
      name: p.name,
      description: p.description,
      price: Number(p.price),
      unit: p.unit,
      stock: Number(p.stock),
      sold_count: Number(p.sold_count),
      origin_village_code: p.origin_village_code,
      min_order: Number(p.min_order),
      seller_id: Number(p.seller_id),
      seller_name: p.seller_name,
      seller_email: p.seller_email,
      harvest_date: p.harvest_date,
      image_path: p.image_path,
      category: p.category,
      category_name: p.category_name,
      status: p.status,
      po_quota: p.po_quota ? Number(p.po_quota) : null,
      po_sold: p.po_sold ? Number(p.po_sold) : null,
      category_id: Number(p.category_id),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return NextResponse.json({
      success: true,
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1,
      },
    });

  } catch (error: any) {
    console.error('Error fetching products:', error);
    
    // ✅ Handle PostgreSQL error codes
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
    
    return handleAPIError(error, 'GET /api/admin/products');
  }
}
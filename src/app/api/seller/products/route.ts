// src/app/api/seller/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

// ============================================================================
// GET: List seller's products
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'seller') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Seller access required' },
        { status: 403 }
      );
    }

    const sellerId = decoded.sub;
    const { searchParams } = new URL(req.url);
    
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const category = searchParams.get('category') || 'all';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ['p.seller_id = ?', "p.status != 'deleted'"];
    const params: any[] = [sellerId];

    if (search.trim()) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam);
    }

    if (status && status !== 'all') {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (category && category !== 'all') {
      conditions.push('p.category = ?');
      params.push(category);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Validate sort field
    const validSortFields = ['created_at', 'price', 'stock', 'sold_count', 'name'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // ✅ Main query dengan rating stats
    const [products] = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.unit,
        p.stock,
        p.min_order,
        p.sold_count,
        p.category,
        p.category_id,
        p.status,
        p.harvest_date,
        p.image_path,
        p.po_quota,
        p.po_sold,
        p.created_at,
        p.updated_at,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as review_count
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.${sortField} ${sortDir}
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Count query
    const [countResult] = await pool.query(
      `SELECT COUNT(DISTINCT p.id) as total
       FROM products p
       ${whereClause}`,
      params
    );

    const total = Number(countResult[0]?.total || 0);

    // Status counts untuk filter
    const [statusCounts] = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM products
       WHERE seller_id = ? AND status != 'deleted'
       GROUP BY status`,
      [sellerId]
    );

    const statusCountMap: Record<string, number> = {};
    statusCounts.forEach((row: any) => {
      statusCountMap[row.status] = Number(row.count);
    });

    // Format response
    const formattedProducts = products.map((p: any) => ({
      id: Number(p.id),
      name: p.name,
      description: p.description,
      price: Number(p.price),
      unit: p.unit,
      stock: Number(p.stock),
      minOrder: Number(p.min_order),
      soldCount: Number(p.sold_count || 0),
      category: p.category,
      categoryId: p.category_id ? Number(p.category_id) : null,
      status: p.status,
      harvestDate: p.harvest_date,
      imagePath: p.image_path,
      poQuota: p.po_quota ? Number(p.po_quota) : null,
      poSold: Number(p.po_sold || 0),
      avgRating: Number(p.avg_rating || 0),
      reviewCount: Number(p.review_count || 0),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        products: formattedProducts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        statusCounts: {
          all: total,
          ready_stock: statusCountMap['ready_stock'] || 0,
          pre_order: statusCountMap['pre_order'] || 0,
          sold_out: statusCountMap['sold_out'] || 0,
        },
      },
    });

  } catch (error: any) {
    console.error('❌ Get seller products error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Create new product
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'seller') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Seller access required' },
        { status: 403 }
      );
    }

    const sellerId = decoded.sub;
    const body = await req.json();

    const {
      name,
      description,
      price,
      unit,
      stock,
      minOrder,
      category,
      categoryId,
      status,
      harvestDate,
      imagePath,
      poQuota,
    } = body;

    // Validation
    if (!name || !price || !unit) {
      return NextResponse.json(
        { success: false, error: 'Nama, harga, dan satuan wajib diisi' },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO products 
       (seller_id, name, description, price, unit, stock, min_order, 
        category, category_id, status, harvest_date, image_path, 
        po_quota, po_sold, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [
        sellerId,
        name,
        description || null,
        price,
        unit,
        stock || 0,
        minOrder || 1,
        category || null,
        categoryId || null,
        status || 'ready_stock',
        harvestDate || null,
        imagePath || null,
        poQuota || null,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Produk berhasil ditambahkan',
      data: { id: result.insertId },
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Create product error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
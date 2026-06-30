// src/app/api/seller/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
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

    const sellerId = decoded.sub;
    const { searchParams } = new URL(req.url);
    
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.seller_id = ? AND p.status != ?';
    const params: any[] = [sellerId, 'deleted'];

    if (status !== 'all') {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    if (search.trim()) {
      whereClause += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam);
    }

    const [products] = await pool.query(
      `SELECT 
        p.id, p.name, p.description, p.price, p.unit, p.stock,
        p.min_order, p.sold_count, p.category, p.category_id,
        p.status, p.harvest_date, p.image_path,
        p.po_quota, p.po_sold, p.created_at, p.updated_at,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as review_count
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(DISTINCT p.id) as total
       FROM products p
       ${whereClause}`,
      params
    );

    const total = Number((countResult as any[])[0]?.total || 0);

    const [statusCounts] = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM products
       WHERE seller_id = ? AND status != 'deleted'
       GROUP BY status`,
      [sellerId]
    );

    const statusMap: Record<string, number> = {
      all: total,
      ready_stock: 0,
      pre_order: 0,
      sold_out: 0,
    };

    (statusCounts as any[]).forEach((row: any) => {
      statusMap[row.status] = Number(row.count);
    });

    return NextResponse.json({
      success: true,
      data: {
        products: (products as any[]).map((p: any) => ({
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
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        statusCounts: statusMap,
      },
    });

  } catch (error: any) {
    console.error('❌ GET /api/seller/products error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db-adapter';
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

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.status != ?';
    const params: any[] = ['deleted'];

    if (status !== 'all' && ['ready_stock', 'pre-order', 'sold_out'].includes(status)) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    if (search.trim()) {
      whereClause += ' AND (p.name LIKE ? OR p.description LIKE ? OR u.name LIKE ?)';
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    // Products query with rating aggregates (same as seller API format)
    const productsResult = await db.execute(
      `SELECT 
        p.id, p.name, p.description, p.price, p.unit, p.stock,
        p.min_order, p.sold_count, p.category, p.category_id,
        p.status, p.harvest_date, p.image_path,
        p.po_quota, p.po_sold, p.created_at, p.updated_at,
        p.seller_id,
        u.name as seller_name,
        u.email as seller_email,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as review_count
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN reviews r ON p.id = r.product_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const products: any[] = productsResult[0] || [];

    // Count total
    const countResult = await db.execute(
      `SELECT COUNT(DISTINCT p.id) as total
       FROM products p
       LEFT JOIN users u ON p.seller_id = u.id
       ${whereClause}`,
      params
    );

    const total = Number((countResult[0] as any[])[0]?.total || 0);

    // Status counts (all status variants)
    const statusCountsResult = await db.execute(
      `SELECT status, COUNT(*) as count
       FROM products
       WHERE status != ?
       GROUP BY status`,
      ['deleted']
    );

    const statusMap: Record<string, number> = {
      all: total,
      ready_stock: 0,
      pre_order: 0,
      sold_out: 0,
    };

    ((statusCountsResult[0] as any[]) || []).forEach((row: any) => {
      statusMap[row.status] = Number(row.count);
    });

    // Format response - match seller API format (camelCase, includes ratings)
    return NextResponse.json({
      success: true,
      data: {
        products: products.map((p: any) => ({
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
          sellerId: Number(p.seller_id),
          sellerName: p.seller_name,
          sellerEmail: p.seller_email,
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
    console.error('❌ GET /api/admin/products error:', error);
    return handleAPIError(error, 'GET /api/admin/products');
  }
}
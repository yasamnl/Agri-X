// src/app/api/seller/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

type Params = {
  params: Promise<{ id: string }>;
};

// ============================================================================
// GET: Get single product
// ============================================================================
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'seller') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const [products] = await pool.query(
      `SELECT 
        p.id, p.name, p.description, p.price, p.unit, p.stock, 
        p.min_order, p.sold_count, p.category, p.category_id, 
        p.status, p.harvest_date, p.image_path, p.po_quota, p.po_sold,
        p.created_at, p.updated_at,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as review_count
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.id = ? AND p.seller_id = ? AND p.status != 'deleted'
      GROUP BY p.id`,
      [productId, decoded.sub]
    );

    if (!products[0]) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      );
    }

    const p = products[0];

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });

  } catch (error: any) {
    console.error('❌ Get product error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH: Update product
// ============================================================================
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'seller') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    // Verify ownership
    const [existing] = await pool.query(
      'SELECT id FROM products WHERE id = ? AND seller_id = ?',
      [productId, decoded.sub]
    );

    if (!existing[0]) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      );
    }

    const body = await req.json();
    
    // Build dynamic update
    const allowedFields = [
      'name', 'description', 'price', 'unit', 'stock', 'min_order',
      'category', 'category_id', 'status', 'harvest_date', 
      'image_path', 'po_quota'
    ];
    
    const updates: string[] = [];
    const values: any[] = [];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }
    
    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada field yang diupdate' },
        { status: 400 }
      );
    }
    
    updates.push('updated_at = NOW()');
    values.push(productId, decoded.sub);

    await pool.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = ? AND seller_id = ?`,
      values
    );

    return NextResponse.json({
      success: true,
      message: 'Produk berhasil diupdate',
    });

  } catch (error: any) {
    console.error('❌ Update product error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Soft delete product
// ============================================================================
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'seller') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    // Soft delete
    const [result] = await pool.query(
      `UPDATE products 
       SET status = 'deleted', updated_at = NOW() 
       WHERE id = ? AND seller_id = ? AND status != 'deleted'`,
      [productId, decoded.sub]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Produk berhasil dihapus',
    });

  } catch (error: any) {
    console.error('❌ Delete product error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
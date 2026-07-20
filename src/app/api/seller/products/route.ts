// src/app/api/seller/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import db from '@/lib/db-adapter';
import pool from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

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

    const [products] = await db.execute(
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

    const [countResult] = await db.execute(
      `SELECT COUNT(DISTINCT p.id) as total
       FROM products p
       ${whereClause}`,
      params
    );

    const total = Number((countResult as any[])[0]?.total || 0);

    const [statusCounts] = await db.execute(
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

export async function POST(req: NextRequest) {
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

    const formData = await req.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const price = Number(formData.get('price'));
    const unit = formData.get('unit') as string;
    const stock = Number(formData.get('stock') || 0);
    const minOrder = Number(formData.get('minOrder') || 1);
    const category = formData.get('category') as string;
    const categoryId = formData.get('categoryId') ? Number(formData.get('categoryId')) : null;
    const status = (formData.get('status') as string) || 'ready_stock';
    const harvestDate = formData.get('harvestDate') as string;
    const poQuota = formData.get('poQuota') ? Number(formData.get('poQuota')) : null;
    const weight = Number(formData.get('weight') || 0);
    const imageFile = formData.get('image') as File | null;

    if (!name?.trim() || !price || !unit?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Nama, harga, dan satuan wajib diisi' },
        { status: 400 }
      );
    }

    let imagePath: string | null = null;
    if (imageFile && imageFile.size > 0) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `${timestamp}-${random}-${name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)}.webp`;
      const uploadDir = path.join(process.cwd(), 'public', 'products');
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      imagePath = `/products/${filename}`;
    }

    const [result] = await pool.execute(
      `INSERT INTO products (
        name, description, price, unit, stock, min_order, seller_id,
        category, category_id, status, harvest_date, image_path,
        po_quota, weight, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        name.trim(),
        description?.trim() || null,
        price,
        unit.trim(),
        stock,
        minOrder,
        decoded.sub,
        category?.trim() || null,
        categoryId,
        status,
        harvestDate || null,
        imagePath,
        poQuota,
        weight,
      ]
    );

    const insertId = (result as any).insertId;

    return NextResponse.json({
      success: true,
      message: 'Produk berhasil ditambahkan',
      data: { id: insertId, imagePath },
    }, { status: 201 });
  } catch (error: any) {
    console.error('❌ POST /api/seller/products error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
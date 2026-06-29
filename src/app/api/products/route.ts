// app/api/products/route.ts - ✅ MySQL Version
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db'; // ✅ Pastikan ini import mysql2/promise
import { handleAPIError } from '@/lib/middleware';
import { verifyAccessToken } from '@/utils/jwt.util';

// Tipe Product: sesuaikan dengan return MySQL
interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  sold_count: number;
  category_id: number | null;
  min_order: number;
  seller_id: number;
  user_name: string;
  harvest_date: string | null;
  image_path: string;
  category: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  
  // ✅ NEW: Pre-Order quota fields
  po_quota: number | null;
  po_sold: number;
  
  // ✅ NEW: Rating stats from reviews
  rating: number;
  total_reviews: number;
  rating_breakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

// Tipe untuk input POST
interface ProductInput {
  name: string;
  description?: string;
  price: number;
  unit: string;
  stock: number;
  min_order: number;
  seller_id: number;
  harvest_date?: string;
  image_path?: string;
  category?: string;
  status?: 'pre-order' | 'ready_stock' | 'sold_out';
  category_id?: number;
}

// ============================================================================
// GET: Fetch products dengan filter & pagination - ✅ MySQL Syntax
// ============================================================================
// src/app/api/products/route.ts

// ✅ Helper: Validasi sort field (anti SQL injection)
const VALID_SORT_FIELDS = ['created_at', 'price', 'sold_count', 'rating', 'name', 'stock'];

// ✅ Helper: Cek apakah kolom ada di tabel (MySQL version)
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const [rows] = await pool.execute(
      `SELECT 1 FROM information_schema.columns 
       WHERE table_name = ? AND column_name = ? AND table_schema = DATABASE()`,
      [tableName, columnName]
    );
    return (rows as any[]).length > 0;
  } catch {
    return false;
  }
}

// ✅ Helper: Format product response dengan type conversion
function formatProductResponse(product: any) {
  if (!product) return null;
  return {
    id: Number(product.id),
    name: product.name,
    description: product.description,
    price: Number(product.price),
    unit: product.unit,
    stock: Number(product.stock),
    sold_count: Number(product.sold_count || 0),
    min_order: Number(product.min_order),
    seller_id: Number(product.seller_id),
    user_name: product.user_name,
    harvest_date: product.harvest_date 
      ? new Date(product.harvest_date).toISOString().split('T')[0] 
      : null,
    image_path: product.image_path,
    category: product.category,
    category_id: product.category_id ? Number(product.category_id) : null,
    status: product.status,
    created_at: product.created_at ? new Date(product.created_at).toISOString() : null,
    updated_at: product.updated_at ? new Date(product.updated_at).toISOString() : null,
    
    // ✅ Pre-Order quota fields
    po_quota: product.po_quota ? Number(product.po_quota) : null,
    po_sold: Number(product.po_sold || 0),
    
    // ✅ Rating stats (will be overridden if available)
    rating: Number(product.avg_rating) || 0,
    total_reviews: Number(product.total_reviews) || 0,
    rating_breakdown: {
      5: Number(product.count_5 || 0),
      4: Number(product.count_4 || 0),
      3: Number(product.count_3 || 0),
      2: Number(product.count_2 || 0),
      1: Number(product.count_1 || 0),
    },
  };
}

// ============================================================================
// GET: List Products with Filters, Pagination, Rating & PO Quota
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // ✅ Filter params
    const category = searchParams.get('category');
    const categoryId = searchParams.get('category_id');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const sellerId = searchParams.get('seller_id');
    
    // ✅ Pagination params (support both 'page' and 'offset')
    const pageParam = searchParams.get('page');
    const offsetParam = searchParams.get('offset');
    const limitParam = searchParams.get('limit');
    
    // Sort & order params
    const sort = searchParams.get('sort');
    const order = searchParams.get('order') || 'desc';

    // ✅ Calculate pagination
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam), 1), 100) : 20;
    let page = 1;
    let offset = 0;
    
    if (pageParam) {
      page = Math.max(parseInt(pageParam), 1);
      offset = (page - 1) * limit;
    } else if (offsetParam) {
      offset = Math.max(parseInt(offsetParam), 0);
      page = Math.floor(offset / limit) + 1;
    }

    // ✅ Validate sort field
    const sortBy = sort && VALID_SORT_FIELDS.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // ✅ Cek kolom opsional di tabel products
    const hasPoQuota = await columnExists('products', 'po_quota');
    const hasPoSold = await columnExists('products', 'po_sold');
    const hasIsDeleted = await columnExists('reviews', 'is_deleted');

    // ✅ Build main query dengan JOIN reviews untuk rating stats
    let query = `
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.price, 
        p.unit, 
        p.stock,
        p.sold_count,
        p.category_id,
        p.min_order, 
        p.seller_id,
        u.name as user_name,
        p.harvest_date, 
        p.image_path, 
        p.category, 
        p.status,
        ${hasPoQuota ? 'p.po_quota,' : 'NULL as po_quota,'}
        ${hasPoSold ? 'p.po_sold,' : '0 as po_sold,'}
        p.created_at, 
        p.updated_at,
        
        -- ✅ Rating stats dari tabel reviews
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.id) as total_reviews,
        SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) as count_5,
        SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) as count_4,
        SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) as count_3,
        SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) as count_2,
        SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) as count_1
        
      FROM products p
      INNER JOIN users u ON p.seller_id = u.id
      LEFT JOIN reviews r ON p.id = r.product_id ${hasIsDeleted ? 'AND r.is_deleted = FALSE' : ''}
      WHERE p.status != 'deleted'
    `;
    
    const params: any[] = [];

    // ✅ Filter by status (jika ada)
    if (status && status !== 'all') {
      query += ' AND p.status = ?';
      params.push(status);
    }

    // ✅ Filter by seller_id (untuk halaman seller)
    if (sellerId && !isNaN(parseInt(sellerId))) {
      query += ' AND p.seller_id = ?';
      params.push(parseInt(sellerId));
    }

    // ✅ Filter by search (name or description)
    if (search && search.trim()) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam);
    }

    // ✅ Filter by category_id (prioritas) atau category string
    if (categoryId && !isNaN(parseInt(categoryId))) {
      query += ' AND p.category_id = ?';
      params.push(parseInt(categoryId));
    } else if (category) {
      query += ' AND p.category = ?';
      params.push(category);
    }

    // ✅ GROUP BY karena ada aggregate functions
    query += ' GROUP BY p.id';

    // ✅ ORDER BY (support sort by rating yang merupakan aggregate field)
    if (sortBy === 'rating') {
      query += ` ORDER BY avg_rating ${sortOrder}, p.id DESC`;
    } else {
      query += ` ORDER BY p.${sortBy} ${sortOrder}, p.id DESC`;
    }

    // ✅ Pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // ✅ Execute main query
    const [rows] = await pool.execute(query, params);
    const products = Array.isArray(rows) ? rows : [];

    // ✅ Format response
    const formattedProducts = products.map((p: any) => {
      const formatted = formatProductResponse(p);
      // ✅ Pastikan rating di-format dengan 1 decimal
      formatted.rating = parseFloat(Number(formatted.rating).toFixed(1));
      return formatted;
    });

    // ✅ Build count query (MUST match main query filters)
    let countQuery = `
      SELECT COUNT(DISTINCT p.id) as total 
      FROM products p
      INNER JOIN users u ON p.seller_id = u.id
      LEFT JOIN reviews r ON p.id = r.product_id ${hasIsDeleted ? 'AND r.is_deleted = FALSE' : ''}
      WHERE p.status != 'deleted'
    `;
    const countParams: any[] = [];
    
    // ✅ Apply same filters to count query
    if (status && status !== 'all') {
      countQuery += ' AND p.status = ?';
      countParams.push(status);
    }
    
    if (sellerId && !isNaN(parseInt(sellerId))) {
      countQuery += ' AND p.seller_id = ?';
      countParams.push(parseInt(sellerId));
    }
    
    if (search && search.trim()) {
      countQuery += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const searchParam = `%${search.trim()}%`;
      countParams.push(searchParam, searchParam);
    }
    
    if (categoryId && !isNaN(parseInt(categoryId))) {
      countQuery += ' AND p.category_id = ?';
      countParams.push(parseInt(categoryId));
    } else if (category) {
      countQuery += ' AND p.category = ?';
      countParams.push(category);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = Number((countResult as any)[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ 
      success: true, 
      products: formattedProducts,
      pagination: {
        page,
        limit,
        offset,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    });

  } catch (error: any) {
    console.error('Error fetching products:', error);
    
    // ✅ Handle MySQL specific errors
    if (error.code === 'ETIMEDOUT' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection timeout. Please try again.', 
          code: 'DB_TIMEOUT' 
        },
        { status: 503 }
      );
    }
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Products table not found', 
          code: 'TABLE_NOT_FOUND' 
        },
        { status: 500 }
      );
    }
    
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid sort field or column not found', 
          code: 'INVALID_SORT' 
        },
        { status: 400 }
      );
    }
    
    return handleAPIError(error, 'GET /api/products');
  }
}

// ============================================================================
// POST: Create new product - ✅ MySQL Syntax
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const userRole = decoded.role;

    if (userRole === 'buyer') {
      return NextResponse.json({ success: false, error: 'Buyers cannot create products' }, { status: 403 });
    }

    if (userRole === 'seller' && userId) {
      const bodyTemp = await req.json();
      const bodySellerId = typeof bodyTemp.seller_id === 'number' 
        ? bodyTemp.seller_id 
        : parseInt(bodyTemp.seller_id, 10);
      
      if (bodySellerId !== parseInt(userId, 10)) {
        return NextResponse.json({ 
          success: false, 
          error: 'You can only create products for yourself' 
        }, { status: 403 });
      }
    }

    const body: Omit<ProductInput, 'id' | 'created_at' | 'updated_at'> = await req.json();
    const { name, description, price, unit, stock, min_order, seller_id, harvest_date, image_path, category, status, category_id } = body;

    // Validasi required fields
    if (!name || price === undefined || price === null || typeof price !== 'number' || !unit || seller_id === undefined) {
      throw new Error('Name, price, unit, and seller_id are required');
    }

    const sellerIdNum = typeof seller_id === 'number' ? seller_id : parseInt(seller_id, 10);
    if (isNaN(sellerIdNum) || sellerIdNum <= 0) {
      throw new Error('Invalid seller_id format. Must be a positive integer.');
    }

    const allowedStatuses: Array<'pre-order' | 'ready_stock' | 'sold_out'> = ['pre-order', 'ready_stock', 'sold_out'];
    if (status && !allowedStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
    }

    if (isNaN(price) || price < 0 || isNaN(stock) || stock < 0 || isNaN(min_order) || min_order < 1) {
      throw new Error('Price, stock must be non-negative, min_order must be at least 1');
    }

    // ✅ MySQL INSERT (tanpa RETURNING, pakai LAST_INSERT_ID())
    const insertQuery = `INSERT INTO products (
        name, description, price, unit, stock, min_order, 
        seller_id, harvest_date, image_path, category, status, category_id,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
    
    const insertParams = [
      name,
      description ?? null,
      price,
      unit,
      stock ?? 0,
      min_order,
      sellerIdNum,
      harvest_date ? new Date(harvest_date).toISOString().split('T')[0] : null,
      image_path ?? null,
      category ?? null,
      status ?? 'pre-order',
      category_id ?? null,
    ];

    // ✅ MySQL: execute() return [rows, fields], gunakan result.insertId
    const [insertResult] = await pool.execute(insertQuery, insertParams);
    const insertId = (insertResult as any).insertId;

    // ✅ Fetch inserted product dengan JOIN users untuk user_name
    const [fetchResult] = await pool.execute(
      `SELECT 
        p.*, u.name as user_name
       FROM products p
       INNER JOIN users u ON p.seller_id = u.id
       WHERE p.id = ?`,
      [insertId]
    );
    
    const inserted = (fetchResult as any[])[0];
    if (!inserted) {
      throw new Error('Failed to fetch created product');
    }

    // Format response product
    const newProduct: Product = {
      id: Number(inserted.id),
      name: inserted.name,
      description: inserted.description,
      price: Number(inserted.price),
      unit: inserted.unit,
      stock: Number(inserted.stock),
      min_order: Number(inserted.min_order),
      seller_id: Number(inserted.seller_id),
      user_name: inserted.user_name,
      harvest_date: inserted.harvest_date 
        ? new Date(inserted.harvest_date).toISOString().split('T')[0] 
        : null,
      image_path: inserted.image_path,
      category: inserted.category,
      category_id: inserted.category_id ? Number(inserted.category_id) : null,
      status: inserted.status,
      created_at: inserted.created_at ? new Date(inserted.created_at).toISOString() : new Date().toISOString(),
      updated_at: inserted.updated_at ? new Date(inserted.updated_at).toISOString() : new Date().toISOString(),
    };

    return NextResponse.json({ success: true, product: newProduct }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating product:', error);
    
    // ✅ Handle MySQL duplicate entry
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { success: false, error: 'Product with this name already exists', code: 'DUPLICATE_ENTRY' },
        { status: 409 }
      );
    }
    
    return handleAPIError(error, 'POST /api/products');
  }
}

// ============================================================================
// PUT: Update product - ✅ MySQL Syntax
// ============================================================================
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const { id, ...updates } = await req.json();

    if (!id) {
      throw new Error('Product ID is required for update');
    }

    // ✅ Cek kepemilikan produk - MySQL syntax
    const [checkResult] = await pool.execute(
      'SELECT seller_id FROM products WHERE id = ? AND status != ?',
      [id, 'deleted']
    );
    
    const checkRows = checkResult as any[];
    if (checkRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }
    
    const product = checkRows[0];
    if (Number(product.seller_id) !== parseInt(userId, 10) && decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // ✅ Build dynamic UPDATE query dengan ? placeholders
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.price !== undefined) {
      updateFields.push('price = ?');
      params.push(updates.price);
    }
    if (updates.stock !== undefined) {
      updateFields.push('stock = ?');
      params.push(updates.stock);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.image_path !== undefined) {
      updateFields.push('image_path = ?');
      params.push(updates.image_path);
    }
    if (updates.category_id !== undefined) {
      updateFields.push('category_id = ?');
      params.push(updates.category_id);
    }
    
    // Selalu update updated_at
    updateFields.push('updated_at = NOW()');
    
    // WHERE clause params
    params.push(id, userId, decoded.role);

    const query = `UPDATE products 
      SET ${updateFields.join(', ')} 
      WHERE id = ? AND (seller_id = ? OR ? = 'admin')`;

    const [updateResult] = await pool.execute(query, params);
    const affectedRows = (updateResult as any).affectedRows;
    
    if (affectedRows === 0) {
      return NextResponse.json({ success: false, error: 'Update failed or no changes' }, { status: 404 });
    }

    // ✅ Fetch updated product untuk response
    const [fetchResult] = await pool.execute(
      `SELECT 
        p.*, u.name as user_name
       FROM products p
       INNER JOIN users u ON p.seller_id = u.id
       WHERE p.id = ?`,
      [id]
    );
    
    const updated = (fetchResult as any[])[0];

    return NextResponse.json({ 
      success: true, 
      product: {
        id: Number(updated.id),
        name: updated.name,
        price: Number(updated.price),
        stock: Number(updated.stock),
        status: updated.status,
        updated_at: new Date(updated.updated_at).toISOString(),
      }
    });

  } catch (error: any) {
    console.error('Error updating product:', error);
    return handleAPIError(error, 'PUT /api/products');
  }
}

// ============================================================================
// DELETE: Soft delete product - ✅ MySQL Syntax
// ============================================================================
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const { id } = await req.json();

    if (!id) {
      throw new Error('Product ID is required');
    }

    // ✅ Soft delete: update status ke 'deleted' - MySQL syntax
    const [result] = await pool.execute(
      `UPDATE products 
       SET status = 'deleted', updated_at = NOW() 
       WHERE id = ? AND (seller_id = ? OR ? = 'admin')`,
      [id, userId, decoded.role]
    );

    const affectedRows = (result as any).affectedRows;
    if (affectedRows === 0) {
      return NextResponse.json({ success: false, error: 'Product not found or forbidden' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Product deleted' });

  } catch (error: any) {
    console.error('Error deleting product:', error);
    return handleAPIError(error, 'DELETE /api/products');
  }
}
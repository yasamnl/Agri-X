// src/app/api/products/[id]/route.ts - MySQL Version
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

type Params = {
  params: Promise<{ id: string }>;
};

// ✅ Helper: Validasi ID format
function isValidId(id: string): boolean {
  return /^\d+$/.test(id);
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
    min_order: Number(product.min_order),
    seller_id: Number(product.seller_id),
    harvest_date: product.harvest_date ? new Date(product.harvest_date).toISOString() : null,
    image_path: product.image_path,
    category: product.category,
    status: product.status,
    created_at: product.created_at ? new Date(product.created_at).toISOString() : null,
    updated_at: product.updated_at ? new Date(product.updated_at).toISOString() : null,
    // ✅ Rating stats (default values)
    rating: 0,
    total_reviews: 0,
    rating_breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };
}

// ✅ Helper: Cek apakah kolom ada di tabel (MySQL version)
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    // ✅ MySQL: information_schema.columns tanpa table_schema = 'public'
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

// ============================================================================
// GET: Get Single Product by ID
// ============================================================================
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    if (!isValidId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID format', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const productId = Number(id);

    // ✅ 1. Fetch product data - MySQL syntax: ? placeholder + pool.execute()
    const productQuery = `
      SELECT 
        id, name, description, price, unit, stock, min_order, seller_id, 
        harvest_date, image_path, category, status, created_at, updated_at 
      FROM products 
      WHERE id = ? AND status != 'deleted'
    `;
    
    // ✅ MySQL: pool.execute() returns [rows, fields]
    const [productRows] = await pool.execute(productQuery, [productId]);
    const products = productRows as any[];

    if (!Array.isArray(products) || products.length === 0) {
      // ✅ Debug: Cek apakah produk ada tapi status deleted
      const [checkRows] = await pool.execute(
        'SELECT id, name, status FROM products WHERE id = ?',
        [productId]
      );
      const checkProducts = checkRows as any[];
      
      if (checkProducts.length > 0) {
        console.warn(`⚠️ Product ${productId} exists but status = '${checkProducts[0].status}'`);
        return NextResponse.json(
          { 
            success: false, 
            error: `Produk "${checkProducts[0].name}" tidak tersedia (Status: ${checkProducts[0].status})`,
            code: 'PRODUCT_UNAVAILABLE'
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const product = products[0];

    // ✅ 2. Fetch rating stats - MySQL: SUM(CASE WHEN ...) instead of FILTER
    const hasIsDeleted = await columnExists('reviews', 'is_deleted');
    
    // ✅ MySQL: Use SUM(CASE WHEN ...) instead of COUNT(*) FILTER
    const ratingQuery = `
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as count_5,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as count_4,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as count_3,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as count_2,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as count_1
      FROM reviews 
      WHERE product_id = ? ${hasIsDeleted ? 'AND is_deleted = FALSE' : ''}
    `;
    
    const [ratingRows] = await pool.execute(ratingQuery, [productId]);
    const ratingResults = ratingRows as any[];
    const ratingStats = ratingResults[0] || {};

    // ✅ Format rating breakdown
    const ratingBreakdown = {
      5: Number(ratingStats.count_5) || 0,
      4: Number(ratingStats.count_4) || 0,
      3: Number(ratingStats.count_3) || 0,
      2: Number(ratingStats.count_2) || 0,
      1: Number(ratingStats.count_1) || 0,
    };

    const totalReviews = Number(ratingStats.total_reviews) || 0;
    const averageRating = totalReviews > 0 ? Number(ratingStats.average_rating) : 0;

    // ✅ Format final response
    const formattedProduct = {
      ...formatProductResponse(product),
      rating: parseFloat(averageRating.toFixed(1)),
      total_reviews: totalReviews,
      rating_breakdown: ratingBreakdown,
    };

    return NextResponse.json({
      success: true,
      product: formattedProduct,
    });

  } catch (error: any) {
    console.error('Error fetching product:', error);
    
    // ✅ Handle MySQL specific error codes
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json(
        { success: false, error: 'Table not found', code: 'TABLE_NOT_FOUND' },
        { status: 500 }
      );
    }
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return NextResponse.json(
        { success: false, error: 'Column not found: ' + (error.message || ''), code: 'COLUMN_NOT_FOUND' },
        { status: 500 }
      );
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      return NextResponse.json(
        { success: false, error: 'Database connection timeout', code: 'DB_TIMEOUT' },
        { status: 503 }
      );
    }
    
    return handleAPIError(error, 'GET /api/products/[id]');
  }
}

// ============================================================================
// PUT: Update Entire Product (Replace)
// ============================================================================
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!isValidId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await req.json();
    const { 
      name, description, price, unit, stock, min_order, 
      seller_id, harvest_date, image_path, category, status 
    } = body;

    // Validasi Wajib
    if (!name || price === undefined || unit === undefined || seller_id === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, price, unit, and seller_id are required' }, 
        { status: 400 }
      );
    }

    // Validasi Tipe Data & Logika
    const numPrice = Number(price);
    const numStock = Number(stock || 0);
    const numMinOrder = Number(min_order || 1);
    const numSellerId = Number(seller_id);

    if (isNaN(numPrice) || numPrice < 0) return NextResponse.json({ success: false, error: 'Invalid price' }, { status: 400 });
    if (isNaN(numStock) || numStock < 0) return NextResponse.json({ success: false, error: 'Invalid stock' }, { status: 400 });
    if (isNaN(numMinOrder) || numMinOrder < 1) return NextResponse.json({ success: false, error: 'Invalid min_order' }, { status: 400 });
    if (isNaN(numSellerId)) return NextResponse.json({ success: false, error: 'Invalid seller_id' }, { status: 400 });

    const allowedStatuses = ['pre-order', 'ready_stock', 'sold_out', 'deleted'];
    const finalStatus = status && allowedStatuses.includes(status) ? status : 'ready_stock';

    // ✅ MySQL: ? placeholder + NOW() for timestamp
    const query = `
      UPDATE products
      SET name = ?, description = ?, price = ?, unit = ?, stock = ?, 
          min_order = ?, seller_id = ?, harvest_date = ?, image_path = ?, 
          category = ?, status = ?, updated_at = NOW()
      WHERE id = ?
    `;

    const values = [
      name,
      description || null,
      numPrice,
      unit,
      numStock,
      numMinOrder,
      numSellerId,
      harvest_date || null,
      image_path || null,
      category || null,
      finalStatus,
      Number(id),  // ✅ Ensure numeric for WHERE clause
    ];

    // ✅ MySQL: pool.execute() returns [result, fields], use affectedRows
    const [updateResult] = await pool.execute(query, values);
    const updateInfo = updateResult as any;

    if (updateInfo.affectedRows === 0) {
      return NextResponse.json({ success: false, error: 'Product not found or no changes made' }, { status: 404 });
    }

    // ✅ Fetch updated data
    const [updatedRows] = await pool.execute('SELECT * FROM products WHERE id = ?', [Number(id)]);
    const updatedProducts = updatedRows as any[];
    
    return NextResponse.json({ 
      success: true, 
      product: formatProductResponse(updatedProducts[0]) 
    });

  } catch (error: any) {
    console.error('Error updating product (PUT):', error);
    return handleAPIError(error, 'PUT /api/products/[id]');
  }
}

// ============================================================================
// PATCH: Partial Update (Update specific fields only)
// ============================================================================
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!isValidId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await req.json();
    
    // Whitelist fields yang boleh diupdate (Security!)
    const allowedFields = [
      'name', 'description', 'price', 'unit', 'stock', 
      'min_order', 'seller_id', 'harvest_date', 'image_path', 
      'category', 'status'
    ];

    const updateFields: string[] = [];
    const values: any[] = [];

    Object.keys(body).forEach((key) => {
      if (allowedFields.includes(key) && body[key] !== undefined) {
        // ✅ MySQL: ? placeholder (bukan $1)
        updateFields.push(`${key} = ?`);
        
        // Konversi tipe data khusus
        if (key === 'price') values.push(Number(body[key]));
        else if (key === 'stock') values.push(Number(body[key]));
        else if (key === 'min_order') values.push(Number(body[key]));
        else if (key === 'seller_id') values.push(Number(body[key]));
        else values.push(body[key]);
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    // ✅ Tambah updated_at + WHERE clause dengan spacing yang benar
    updateFields.push('updated_at = NOW()');
    values.push(Number(id));  // ✅ Parameter untuk WHERE id = ?

    // ✅ FIX: Proper spacing in query string + MySQL ? placeholder
    const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ? AND status != 'deleted'`;
    
    const [result] = await pool.execute(query, values);
    const updateInfo = result as any;

    // ✅ MySQL: affectedRows untuk cek affected rows
    if (updateInfo.affectedRows === 0) {
      return NextResponse.json({ success: false, error: 'Product not found or already deleted' }, { status: 404 });
    }

    // ✅ Fetch fresh data
    const [updatedRows] = await pool.execute('SELECT * FROM products WHERE id = ?', [Number(id)]);
    const updatedProducts = updatedRows as any[];

    return NextResponse.json({ 
      success: true, 
      product: formatProductResponse(updatedProducts[0]) 
    });

  } catch (error: any) {
    console.error('Error updating product (PATCH):', error);
    return handleAPIError(error, 'PATCH /api/products/[id]');
  }
}

// ============================================================================
// DELETE: Soft Delete (Change status to 'deleted')
// ============================================================================
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!isValidId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    // ✅ MySQL: ? placeholder + NOW()
    const query = 'UPDATE products SET status = ?, updated_at = NOW() WHERE id = ?';
    const [result] = await pool.execute(query, ['deleted', Number(id)]);
    const deleteInfo = result as any;

    // ✅ MySQL: affectedRows untuk cek affected rows
    if (deleteInfo.affectedRows === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Product deleted successfully' 
    });

  } catch (error: any) {
    console.error('Error deleting product:', error);
    return handleAPIError(error, 'DELETE /api/products/[id]');
  }
}
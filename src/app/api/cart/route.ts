// src/app/api/cart/route.ts - MySQL Version
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

// ✅ Helper: Convert MySQL tinyint(1) to boolean
const toBoolean = (val: any): boolean => {
  return val === 1 || val === '1' || val === true || val === 't';
};

// ✅ Helper: Parse MySQL date string (YYYY-MM-DD) to Date object
const parseMySQLDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'string') {
    // MySQL returns dates as 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS'
    const [datePart] = dateVal.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day); // JS months are 0-indexed
    }
  }
  return null;
};

// ==================== GET: Ambil Cart Items ====================
export async function GET(req: NextRequest) {
  try {
    // 1. Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;

    // 2. Query Data Cart + Product Details (MySQL syntax)
    // ✅ Gunakan ? untuk parameterized query
    // ✅ pool.execute() return [rows, fields] untuk SELECT
    let rows: any[] = [];
    try {
      const [resultRows] = await pool.execute(
        `SELECT 
          ci.id as cart_id,
          ci.product_id,
          ci.quantity,
          p.id as product_id,
          p.name as product_name,
          p.price as product_price,
          p.image_path as product_image_path,
          p.stock as product_stock,
          p.min_order as product_min_order,
          p.status as product_status,
          p.unit as product_unit,
          p.weight as product_weight,
          p.origin_village_code as product_origin_village_code
         FROM cart_items ci
         INNER JOIN products p ON ci.product_id = p.id
         WHERE ci.user_id = ?`,
        [userId]
      ) as [any[], any];
      rows = Array.isArray(resultRows) ? resultRows : [];
    } catch (dbErr: any) {
      console.error('Database query error:', dbErr);
      if (dbErr.code === 'ETIMEDOUT' || dbErr.code === 'PROTOCOL_CONNECTION_LOST') {
        return NextResponse.json(
          { success: false, error: 'Database connection timeout. Please try again.', code: 'DB_TIMEOUT' },
          { status: 503 }
        );
      }
      if (dbErr.code === 'ER_NO_SUCH_TABLE') {
        return NextResponse.json(
          { success: false, error: 'Cart or products table not found', code: 'TABLE_NOT_FOUND' },
          { status: 500 }
        );
      }
      throw dbErr;
    }

    // 3. Format Data agar rapi di Frontend
    // ✅ MySQL returns numbers as numbers, strings as strings, tinyint(1) as 0/1
    const formattedItems = (rows || []).map((row: any) => ({
      id: Number(row.cart_id),
      productId: Number(row.product_id),
      quantity: Number(row.quantity),
      product: {
        id: Number(row.product_id),
        name: String(row.product_name || ''),
        price: Number(row.product_price),
        image_path: row.product_image_path,
        stock: Number(row.product_stock),
        min_order: Number(row.product_min_order),
        status: String(row.product_status || ''),
        unit: String(row.product_unit || ''),
        weight: Number(row.product_weight) || 0,
        originVillageCode: row.product_origin_village_code,
      },
    }));

    // 4. Hitung Total di Backend
    const totalItems = formattedItems.length;
    const totalQuantity = formattedItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = formattedItems.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);
    const totalWeight = formattedItems.reduce((sum, item) => {
      return sum + (item.product.weight * item.quantity);
    }, 0);

    // 5. Return JSON
    return NextResponse.json({
      success: true,
      formattedCartItems: formattedItems,
      totalItems,
      totalQuantity,
      totalPrice,
      totalWeight,
    });

  } catch (err: any) {
    console.error('Error fetching cart:', err);
    return handleAPIError(err, 'GET /api/cart');
  }
}

// ==================== POST: Tambah ke Cart ====================
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { productId, quantity } = await req.json();

    if (!productId || !quantity || quantity <= 0) {
      throw new Error('Product ID and quantity are required');
    }

    // ✅ MySQL: pool.execute() + ? placeholder
    let productRows: any[] = [];
    try {
      const [resultRows] = await pool.execute(
        `SELECT id, name, stock, min_order, status, po_quota, po_sold, harvest_date, unit 
         FROM products WHERE id = ? AND status != ?`,
        [productId, 'deleted']
      ) as [any[], any];
      productRows = Array.isArray(resultRows) ? resultRows : [];
    } catch (dbErr: any) {
      console.error('Product query error:', dbErr);
      throw new Error('Gagal memuat data produk');
    }

    if (productRows.length === 0) {
      throw new Error('Produk tidak ditemukan atau sudah dihapus.');
    }

    const product = productRows[0];

    // ✅ Validasi: Produk Sold Out
    if (product.status === 'sold_out') {
      throw new Error(`😔 Maaf, "${product.name}" sedang habis. Silakan cek produk lain.`);
    }

    // ✅ LOGIKA PRE-ORDER: Validasi Kuota
    if (product.status === 'pre-order' || product.status === 'pre_order') {
      const poQuota = Number(product.po_quota) || 0;
      const poSold = Number(product.po_sold) || 0;
      const remainingQuota = poQuota - poSold;
      
      if (remainingQuota <= 0) {
        throw new Error(`🚫 Kuota Pre-Order "${product.name}" sudah penuh. Terima kasih atas antusiasmenya!`);
      }
      
      if (quantity > remainingQuota) {
        throw new Error(`⚠️ Kuota tersisa hanya ${remainingQuota} ${product.unit}. Silakan kurangi jumlah pesanan.`);
      }

      // ✅ Validasi: Tanggal Panen (MySQL date string handling)
      if (!product.harvest_date) {
        throw new Error(`📅 Tanggal panen "${product.name}" belum ditetapkan. Silakan hubungi petani untuk konfirmasi.`);
      }

      const harvestDate = parseMySQLDate(product.harvest_date);
      if (!harvestDate) {
        throw new Error('Format tanggal panen tidak valid.');
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      harvestDate.setHours(0, 0, 0, 0);
      
      if (harvestDate < today) {
        const dateStr = harvestDate.toLocaleDateString('id-ID', {
          day: 'numeric', month: 'long', year: 'numeric'
        });
        throw new Error(`🍂 Masa panen "${product.name}" (${dateStr}) sudah lewat. Produk akan segera diupdate oleh petani.`);
      }
    }
    
    // ✅ LOGIKA READY_STOCK: Validasi Stok & Min Order
    else if (product.status === 'ready_stock') {
      const minOrder = Number(product.min_order) || 1;
      const stock = Number(product.stock) || 0;
      
      if (quantity < minOrder) {
        throw new Error(`📦 Minimal pesanan "${product.name}" adalah ${minOrder} ${product.unit}.`);
      }
      if (quantity > stock) {
        throw new Error(`❌ Stok "${product.name}" tersisa ${stock} ${product.unit}. Silakan kurangi jumlah pesanan.`);
      }
    }
    
    else {
      throw new Error(`⚠️ "${product.name}" sedang tidak tersedia untuk dipesan.`);
    }

    // ✅ Cek apakah produk sudah ada di keranjang user
    let existingCartRows: any[] = [];
    try {
      const [resultRows] = await pool.execute(
        'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      ) as [any[], any];
      existingCartRows = Array.isArray(resultRows) ? resultRows : [];
    } catch (dbErr: any) {
      console.error('Cart check error:', dbErr);
      throw new Error('Gagal memeriksa keranjang');
    }

    if (existingCartRows.length > 0) {
      const existingQuantity = Number(existingCartRows[0].quantity);
      const newQuantity = existingQuantity + quantity;

      // ✅ Validasi ulang total quantity setelah update
      if (product.status === 'pre-order' || product.status === 'pre_order') {
        const poQuota = Number(product.po_quota) || 0;
        const poSold = Number(product.po_sold) || 0;
        const remainingQuota = poQuota - poSold;
        if (newQuantity > remainingQuota) {
          throw new Error(`⚠️ Total di keranjang melebihi kuota Pre-Order. Sisa kuota: ${remainingQuota} ${product.unit}.`);
        }
      } else if (product.status === 'ready_stock') {
        const stock = Number(product.stock) || 0;
        if (newQuantity > stock) {
          throw new Error(`❌ Total quantity melebihi stok tersedia (${stock} ${product.unit}).`);
        }
      }

      // ✅ UPDATE: mysql2 return [result, fields], result.affectedRows untuk count
      const [updateResult] = await pool.execute(
        'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE user_id = ? AND product_id = ?',
        [newQuantity, userId, productId]
      );
      
      // ✅ MySQL: use affectedRows, NOT rowCount
      if ((updateResult as any).affectedRows === 0) {
        throw new Error('Gagal update keranjang');
      }
    } else {
      // ✅ INSERT
      const [insertResult] = await pool.execute(
        'INSERT INTO cart_items (user_id, product_id, quantity, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [userId, productId, quantity]
      );
      
      if (!(insertResult as any).insertId) {
        throw new Error('Gagal menambahkan ke keranjang');
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: '✅ Produk berhasil ditambahkan ke keranjang!',
      data: { productId, quantity }
    });

  } catch (err: any) {
    console.error('Error adding to cart:', err);
    const userMessage = err.message || 'Terjadi kesalahan saat menambahkan ke keranjang.';
    return NextResponse.json(
      { success: false, error: userMessage },
      { status: err.message?.includes('Unauthorized') ? 401 : 400 }
    );
  }
}

// ==================== PUT: Update Quantity (Absolute) ====================
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { productId, quantity } = await req.json();

    if (!productId || quantity === undefined || quantity < 0) {
      throw new Error('Product ID and quantity are required');
    }

    // ✅ Hapus item jika quantity = 0
    if (quantity === 0) {
      const [deleteResult] = await pool.execute(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      );

      // ✅ MySQL: use affectedRows
      if ((deleteResult as any).affectedRows === 0) {
        throw new Error('Product not found in cart for deletion');
      }

      return NextResponse.json({ success: true, message: 'Product removed from cart successfully' });
    }

    // ✅ Ambil produk
    let productRows: any[] = [];
    try {
      const [rows] = await pool.execute(
        `SELECT id, stock, min_order, status, po_quota, po_sold, harvest_date 
         FROM products WHERE id = ? AND status != ?`,
        [productId, 'deleted']
      ) as [any[], any];
      productRows = Array.isArray(rows) ? rows : [];
    } catch (dbErr: any) {
      console.error('Product query error:', dbErr);
      throw new Error('Gagal memuat data produk');
    }

    if (productRows.length === 0) {
      throw new Error('Product not found or deleted');
    }

    const product = productRows[0];

    if (product.status === 'sold_out') {
      throw new Error('Product is currently sold out.');
    }

    // ✅ VALIDASI PRE-ORDER
    if (product.status === 'pre-order') {
      const poQuota = Number(product.po_quota) || 0;
      const poSold = Number(product.po_sold) || 0;
      const remainingQuota = poQuota - poSold;
      const minOrder = Number(product.min_order) || 1;
      
      if (quantity < minOrder) {
        throw new Error(`Quantity must be at least ${minOrder} for pre-order items.`);
      }
      if (quantity > remainingQuota) {
        throw new Error(`Kuota Pre-Order tersisa ${remainingQuota}.`);
      }
      
      if (product.harvest_date) {
        const harvestDate = parseMySQLDate(product.harvest_date);
        if (!harvestDate) {
          throw new Error('Format harvest_date tidak valid');
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        harvestDate.setHours(0, 0, 0, 0);
        
        if (harvestDate < today) {
          const dateStr = product.harvest_date instanceof Date 
            ? product.harvest_date.toISOString().split('T')[0] 
            : String(product.harvest_date).split(' ')[0];
          throw new Error(`Tanggal panen Pre-Order (${dateStr}) sudah lewat.`);
        }
      }
    }
    // ✅ VALIDASI READY_STOCK
    else if (product.status === 'ready_stock') {
      const minOrder = Number(product.min_order) || 1;
      const stock = Number(product.stock) || 0;
      
      if (quantity < minOrder) {
        throw new Error(`Quantity must be at least ${minOrder}`);
      }
      if (quantity > stock) {
        throw new Error(`Insufficient stock. Available: ${stock}`);
      }
    } else {
      throw new Error('Product is currently unavailable.');
    }

    // ✅ Update quantity - MySQL: use affectedRows
    const [updateResult] = await pool.execute(
      'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE user_id = ? AND product_id = ?',
      [quantity, userId, productId]
    );

    if ((updateResult as any).affectedRows === 0) {
      throw new Error('Product not found in cart');
    }

    return NextResponse.json({ success: true, message: 'Cart item quantity updated successfully' });

  } catch (err: any) {
    console.error('Error updating cart item quantity:', err);
    return handleAPIError(err, 'PUT /api/cart');
  }
}

// ==================== PATCH: Update Quantity (Relative/Delta) ====================
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { productId, delta } = await req.json();

    if (!productId || delta === undefined) {
      throw new Error('Product ID and delta (change amount) are required');
    }

    if (typeof delta !== 'number' || !Number.isInteger(delta)) {
      throw new Error('Delta must be an integer (e.g., +2, -1)');
    }

    // ✅ Ambil item keranjang saat ini
    let cartRows: any[] = [];
    try {
      const [rows] = await pool.execute(
        'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      ) as [any[], any];
      cartRows = Array.isArray(rows) ? rows : [];
    } catch (dbErr: any) {
      console.error('Cart query error:', dbErr);
      throw new Error('Gagal memeriksa keranjang');
    }

    if (cartRows.length === 0) {
      throw new Error('Product not found in cart');
    }

    const currentQuantity = Number(cartRows[0].quantity);
    const newQuantity = currentQuantity + delta;

    // Jika hasilnya <= 0, hapus item
    if (newQuantity <= 0) {
      const [deleteResult] = await pool.execute(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      );
      
      if ((deleteResult as any).affectedRows === 0) {
        throw new Error('Product not found in cart for deletion');
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Product removed from cart (quantity <= 0)' 
      });
    }

    // ✅ Ambil produk
    let productRows: any[] = [];
    try {
      const [rows] = await pool.execute(
        `SELECT id, stock, min_order, status, po_quota, po_sold, harvest_date 
         FROM products WHERE id = ? AND status != ?`,
        [productId, 'deleted']
      ) as [any[], any];
      productRows = Array.isArray(rows) ? rows : [];
    } catch (dbErr: any) {
      console.error('Product query error:', dbErr);
      // Jika produk tidak ada, hapus dari cart
      await pool.execute(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      );
      throw new Error('Product is no longer available');
    }

    if (productRows.length === 0) {
      await pool.execute(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      );
      throw new Error('Product is no longer available');
    }

    const product = productRows[0];

    if (product.status === 'sold_out') {
      throw new Error('Product is currently sold out.');
    }

    // ✅ VALIDASI PRE-ORDER
    if (product.status === 'pre-order') {
      const poQuota = Number(product.po_quota) || 0;
      const poSold = Number(product.po_sold) || 0;
      const remainingQuota = poQuota - poSold;
      const minOrder = Number(product.min_order) || 1;
      
      if (newQuantity < minOrder) {
        throw new Error(`Quantity must be at least ${minOrder} for pre-order items.`);
      }
      if (newQuantity > remainingQuota) {
        throw new Error(`Kuota Pre-Order tersisa ${remainingQuota}.`);
      }
      
      if (product.harvest_date) {
        const harvestDate = parseMySQLDate(product.harvest_date);
        if (!harvestDate) {
          throw new Error('Format harvest_date tidak valid');
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        harvestDate.setHours(0, 0, 0, 0);
        
        if (harvestDate < today) {
          const dateStr = String(product.harvest_date).split(' ')[0];
          throw new Error(`Tanggal panen Pre-Order (${dateStr}) sudah lewat.`);
        }
      }
    }
    // ✅ VALIDASI READY_STOCK
    else if (product.status === 'ready_stock') {
      const minOrder = Number(product.min_order) || 1;
      const stock = Number(product.stock) || 0;
      
      if (newQuantity < minOrder) {
        throw new Error(`Quantity must be at least ${minOrder}`);
      }
      if (newQuantity > stock) {
        throw new Error(`Insufficient stock. Available: ${stock}`);
      }
    } else {
      throw new Error('Product is currently unavailable.');
    }

    // ✅ Update quantity - MySQL: use affectedRows
    const [updateResult] = await pool.execute(
      'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE user_id = ? AND product_id = ?',
      [newQuantity, userId, productId]
    );

    if ((updateResult as any).affectedRows === 0) {
      throw new Error('Failed to update cart item');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Cart item quantity updated successfully',
      newQuantity
    });

  } catch (err: any) {
    console.error('Error patching cart item:', err);
    return handleAPIError(err, 'PATCH /api/cart');
  }
}

// ==================== DELETE: Hapus Item dari Cart ====================
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { productId } = await req.json();

    if (!productId) {
      throw new Error('Product ID is required');
    }

    // ✅ Hapus item - MySQL: use affectedRows
    const [deleteResult] = await pool.execute(
      'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if ((deleteResult as any).affectedRows === 0) {
      throw new Error('Product not found in cart');
    }

    return NextResponse.json({ success: true, message: 'Product removed from cart successfully' });

  } catch (err: any) {
    console.error('Error removing product from cart:', err);
    return handleAPIError(err, 'DELETE /api/cart');
  }
}
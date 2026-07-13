// src/app/api/seller/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { extractFilename } from '@/lib/image-helpers';

type Params = { params: Promise<{ id: string }> };

// ============================================
// GET: Get single product
// ============================================
export async function GET(req: NextRequest, { params }: Params) {
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

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const [products] = await pool.query(
      `SELECT * FROM products 
       WHERE id = ? AND seller_id = ? AND status != 'deleted'`,
      [productId, decoded.sub]
    );

    const product = (products as any[])[0];
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: Number(product.id),
        name: product.name,
        description: product.description,
        price: Number(product.price),
        unit: product.unit,
        stock: Number(product.stock),
        minOrder: Number(product.min_order),
        category: product.category,
        categoryId: product.category_id ? Number(product.category_id) : null,
        status: product.status,
        harvestDate: product.harvest_date,
        imagePath: product.image_path,
        poQuota: product.po_quota ? Number(product.po_quota) : null,
        poSold: Number(product.po_sold || 0),
        weight: Number(product.weight || 0),
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      },
    });

  } catch (error: any) {
    console.error('❌ GET product error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: Update product (dengan image replace)
// ============================================
export async function PUT(req: NextRequest, { params }: Params) {
  let connection;

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

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    // ✅ Parse multipart form data
    const formData = await req.formData();
    
    // Extract fields
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const price = Number(formData.get('price'));
    const unit = formData.get('unit') as string;
    const stock = Number(formData.get('stock'));
    const minOrder = Number(formData.get('minOrder'));
    const category = formData.get('category') as string;
    const categoryId = formData.get('categoryId') ? Number(formData.get('categoryId')) : null;
    const status = formData.get('status') as string;
    const harvestDate = formData.get('harvestDate') as string;
    const poQuota = formData.get('poQuota') ? Number(formData.get('poQuota')) : null;
    const weight = Number(formData.get('weight'));
    const removeImage = formData.get('removeImage') === 'true';
    
    const imageFile = formData.get('image') as File | null;

    // ✅ Validation
    if (!name || !price || !unit) {
      return NextResponse.json(
        { success: false, error: 'Nama, harga, dan satuan wajib diisi' },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // ✅ Verify ownership
      const [existing] = await connection.query(
        `SELECT id, image_path FROM products 
         WHERE id = ? AND seller_id = ? AND status != 'deleted'
         FOR UPDATE`,
        [productId, decoded.sub]
      );

      const existingProduct = (existing as any[])[0];
      if (!existingProduct) {
        await connection.rollback();
        connection.release();
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404 }
        );
      }

      let imagePath = existingProduct.image_path;

      // ✅ Handle image upload/replace
      if (imageFile && imageFile.size > 0) {
        // Generate unique filename
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const filename = `${timestamp}-${random}-${name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)}.webp`;
        
        // ✅ Save ke public/products/
        const uploadDir = path.join(process.cwd(), 'public', 'products');
        await fs.mkdir(uploadDir, { recursive: true });
        
        const filePath = path.join(uploadDir, filename);
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        await fs.writeFile(filePath, buffer);
        
        imagePath = `/products/${filename}`;
        
        if (process.env.NODE_ENV === 'development') console.log(`✅ New image saved: ${imagePath}`);
        
        // ✅ Delete old image jika ada
        if (existingProduct.image_path && existingProduct.image_path !== imagePath) {
          try {
            const oldFilename = extractFilename(existingProduct.image_path);
            const oldFilePath = path.join(process.cwd(), 'public', 'products', oldFilename);
            await fs.unlink(oldFilePath);
            if (process.env.NODE_ENV === 'development') console.log(`🗑️ Old image deleted: ${existingProduct.image_path}`);
          } catch (deleteError) {
            if (process.env.NODE_ENV === 'development') console.warn('⚠️ Failed to delete old image:', deleteError);
          }
        }
      } else if (removeImage) {
        // ✅ Remove image
        if (existingProduct.image_path) {
          try {
            const oldFilename = extractFilename(existingProduct.image_path);
            const oldFilePath = path.join(process.cwd(), 'public', 'products', oldFilename);
            await fs.unlink(oldFilePath);
            if (process.env.NODE_ENV === 'development') console.log(`🗑️ Image removed: ${existingProduct.image_path}`);
          } catch (deleteError) {
            if (process.env.NODE_ENV === 'development') console.warn('⚠️ Failed to delete image:', deleteError);
          }
        }
        imagePath = null;
      }

      // ✅ Update product
      await connection.query(
        `UPDATE products SET
          name = ?,
          description = ?,
          price = ?,
          unit = ?,
          stock = ?,
          min_order = ?,
          category = ?,
          category_id = ?,
          status = ?,
          harvest_date = ?,
          image_path = ?,
          po_quota = ?,
          weight = ?,
          updated_at = NOW()
        WHERE id = ? AND seller_id = ?`,
        [
          name, description, price, unit, stock, minOrder,
          category, categoryId, status, harvestDate,
          imagePath, poQuota, weight,
          productId, decoded.sub
        ]
      );

      await connection.commit();
      connection.release();

      return NextResponse.json({
        success: true,
        message: 'Produk berhasil diupdate',
        data: {
          id: productId,
          imagePath,
        },
      });

    } catch (error: any) {
      await connection.rollback();
      throw error;
    }

  } catch (error: any) {
    console.error('❌ PUT product error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// ============================================
// DELETE: Soft delete product
// ============================================
export async function DELETE(req: NextRequest, { params }: Params) {
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

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    // Get product with image path
    const [products] = await pool.query(
      `SELECT id, image_path FROM products 
       WHERE id = ? AND seller_id = ? AND status != 'deleted'`,
      [productId, decoded.sub]
    );

    const product = (products as any[])[0];
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Soft delete
    await pool.query(
      `UPDATE products SET status = 'deleted', updated_at = NOW() WHERE id = ?`,
      [productId]
    );

    // ✅ Optional: Delete image file juga
    if (product.image_path) {
      try {
        const filename = extractFilename(product.image_path);
        const filePath = path.join(process.cwd(), 'public', 'products', filename);
        await fs.unlink(filePath);
        if (process.env.NODE_ENV === 'development') console.log(`🗑️ Image deleted: ${product.image_path}`);
      } catch (deleteError) {
        if (process.env.NODE_ENV === 'development') console.warn('⚠️ Failed to delete image:', deleteError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Produk berhasil dihapus',
    });

  } catch (error: any) {
    console.error('❌ DELETE product error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
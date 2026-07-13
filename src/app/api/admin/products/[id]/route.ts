// src/app/api/admin/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

// ============================================================================
// PATCH: Update product status
// ============================================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { status, note } = body;

    // Validate status
    const validStatuses = ['pending', 'ready_stock', 'pre-order', 'sold_out'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if product exists
    const [products] = (await pool.query(
      'SELECT id, name, status, seller_id FROM products WHERE id = ?',
      [productId]
    )) as any;

    if (!products[0]) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const product = products[0];
    const oldStatus = product.status;

    // Update product status
    await pool.query(
      'UPDATE products SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, productId]
    );

    // Create notification for seller if status changed
    if (status !== oldStatus && product.seller_id) {
      const statusMessages: Record<string, string> = {
        pending: `Produk "${product.name}" Anda dikembalikan ke status Pending.${note ? ` Alasan: ${note}` : ''}`,
        ready_stock: `Produk "${product.name}" Anda telah disetujui dan sekarang Ready Stock.${note ? ` Catatan: ${note}` : ''}`,
        'pre-order': `Status produk "${product.name}" Anda diubah menjadi Pre-Order.${note ? ` Catatan: ${note}` : ''}`,
        sold_out: `Status produk "${product.name}" Anda diubah menjadi Sold Out.${note ? ` Catatan: ${note}` : ''}`,
      };

      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, reading, created_at)
         VALUES (?, ?, ?, 'product_status', FALSE, NOW())`,
        [product.seller_id, 'Update Status Produk', statusMessages[status]]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Product status updated to ${status}`,
      data: {
        id: productId,
        name: product.name,
        oldStatus,
        newStatus: status,
      },
    });

  } catch (error: any) {
    console.error('Admin update product error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to update product' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Delete product (soft delete)
// ============================================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { note } = body;

    // Check if product exists
    const [products] = (await pool.query(
      'SELECT id, name, seller_id, status FROM products WHERE id = ?',
      [productId]
    )) as any;

    if (!products[0]) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const product = products[0];

    // Soft delete (set status to 'deleted')
    await pool.query(
      "UPDATE products SET status = 'deleted', updated_at = NOW() WHERE id = ?",
      [productId]
    );

    // Notify seller
    if (product.seller_id) {
      const message = `Produk "${product.name}" Anda telah dihapus oleh admin.${note ? ` Alasan: ${note}` : ''}`;
      
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, reading, created_at)
         VALUES (?, ?, ?, 'product_deleted', FALSE, NOW())`,
        [product.seller_id, 'Produk Dihapus', message]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        id: productId,
        name: product.name,
      },
    });

  } catch (error: any) {
    console.error('Admin delete product error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to delete product' 
      },
      { status: 500 }
    );
  }
}
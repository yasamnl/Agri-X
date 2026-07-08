// src/app/api/address/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';

// ✅ Next.js 15+ menggunakan async params
type Params = {
  params: Promise<{ id: string }>;
};

// ============================================================================
// GET: Get single address
// ============================================================================
export async function GET(req: NextRequest, { params }: Params) {
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

    // ✅ Read ID from URL params (async untuk Next.js 15+)
    const { id } = await params;
    const addressId = parseInt(id);

    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid address ID' },
        { status: 400 }
      );
    }

    const [addresses] = await pool.query<any[]>(
      `SELECT * FROM address 
       WHERE id = ? AND user_id = ?`,
      [addressId, decoded.sub]
    );

    if (!addresses[0]) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: addresses[0],
    });

  } catch (error: any) {
    console.error('❌ GET address error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT: Update address (termasuk set as default)
// ============================================================================
export async function PUT(req: NextRequest, { params }: Params) {
  let connection;
  
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

    // ✅ ✅ ✅ FIX: Read ID dari URL params dengan benar
    const { id } = await params;
    const addressId = parseInt(id);

    if (process.env.NODE_ENV === 'development') console.log('🔧 [PUT /api/address/[id]] Params:', { id, addressId });

    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid address ID format' },
        { status: 400 }
      );
    }

    const body = await req.json();
    if (process.env.NODE_ENV === 'development') console.log('📦 [PUT /api/address/[id]] Body:', body);

    // ✅ Verify ownership - pastikan address milik user ini
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingAddresses] = await connection.query(
      'SELECT id, is_default FROM address WHERE id = ? AND user_id = ?',
      [addressId, decoded.sub]
    );

    if (!(existingAddresses as any[])[0]) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, error: 'Address not found or unauthorized' },
        { status: 404 }
      );
    }

    // ✅ ✅ ✅ HANDLE: Set as Default Address
    if (body.isDefault === true) {
      if (process.env.NODE_ENV === 'development') console.log('⭐ Setting address', addressId, 'as default');

      // 1. Reset semua alamat user ke is_default = 0
      await connection.query(
        'UPDATE address SET is_default = 0 WHERE user_id = ?',
        [decoded.sub]
      );

      // 2. Set alamat yang dipilih ke is_default = 1
      await connection.query(
        'UPDATE address SET is_default = 1, updated_at = NOW() WHERE id = ? AND user_id = ?',
        [addressId, decoded.sub]
      );

      await connection.commit();
      if (process.env.NODE_ENV === 'development') console.log('✅ Address', addressId, 'set as default successfully');

      return NextResponse.json({
        success: true,
        message: 'Alamat utama berhasil diubah',
        data: { id: addressId, is_default: true },
      });
    }

    // ✅ ✅ ✅ HANDLE: Full Update Address
    const allowedFields = [
      'recipient_name', 'recipientName',
      'recipient_phone', 'recipientPhone',
      'province', 'city', 'district',
      'village_code', 'villageCode',
      'village_name', 'villageName',
      'detail', 'zip_code', 'zipCode',
      'is_default', 'isDefault'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Normalize field names (snake_case)
        const dbField = field
          .replace('recipientName', 'recipient_name')
          .replace('recipientPhone', 'recipient_phone')
          .replace('villageCode', 'village_code')
          .replace('villageName', 'village_name')
          .replace('zipCode', 'zip_code')
          .replace('isDefault', 'is_default');
        
        updates.push(`${dbField} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, error: 'Tidak ada field yang diupdate' },
        { status: 400 }
      );
    }

    // Jika is_default di-set true, reset alamat lain dulu
    if (body.is_default === true || body.isDefault === true) {
      await connection.query(
        'UPDATE address SET is_default = 0 WHERE user_id = ?',
        [decoded.sub]
      );
    }

    updates.push('updated_at = NOW()');
    values.push(addressId, decoded.sub);

    const [updateResult] = await connection.query(
      `UPDATE address SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    await connection.commit();

    if ((updateResult as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'No changes made' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Alamat berhasil diupdate',
    });

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('❌ PUT address error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// ============================================================================
// DELETE: Delete address
// ============================================================================
export async function DELETE(req: NextRequest, { params }: Params) {
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

    // ✅ Read ID dari URL params
    const { id } = await params;
    const addressId = parseInt(id);

    if (isNaN(addressId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid address ID' },
        { status: 400 }
      );
    }

    // Check if this is the default address
    const [addresses] = await pool.query(
      'SELECT is_default FROM address WHERE id = ? AND user_id = ?',
      [addressId, decoded.sub]
    );

    if (!(addresses as any[])[0]) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    // Delete address
    const [result] = await pool.query(
      'DELETE FROM address WHERE id = ? AND user_id = ?',
      [addressId, decoded.sub]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    // If deleted address was default, set another as default
    if ((addresses as any[])[0].is_default) {
      await pool.query(
        `UPDATE address 
         SET is_default = 1 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [decoded.sub]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Alamat berhasil dihapus',
    });

  } catch (error: any) {
    console.error('❌ DELETE address error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
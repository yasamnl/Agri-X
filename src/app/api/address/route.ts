// src/app/api/address/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

// ============================================================================
// GET: Get user's addresses
// ============================================================================
export async function GET(req: NextRequest) {
  try {
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

    // ✅ MySQL: Ambil semua field yang diperlukan
    const [rows] = await pool.execute(
      `SELECT 
        id, user_id,
        detail, 
        province, city, district,           
        village_code, village,   
        zip_code, 
        recipient_name, recipient_phone, 
        is_default, created_at, updated_at, deleted_at
      FROM address 
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY is_default DESC, created_at DESC`,
      [Number(userId)]
    );

    // ✅ Format response dengan ALIAS untuk konsistensi frontend
    const addresses = Array.isArray(rows) ? rows.map((row: any) => {
      // ✅ Fallback values
      const villageName = row.village || '';
      const villageCode = row.village_code || '';
      const recipientName = row.recipient_name || '';
      const recipientPhone = row.recipient_phone || '';
      const detail = row.detail || '';
      const zipCode = row.zip_code || '';

      return {
        // ✅ ID & User
        id: Number(row.id),
        userId: Number(row.user_id),
        
        // ✅ Label (opsional)
        label: row.label || '',
        
        // ✅ Detail alamat
        detail,
        address: detail,  // ← ALIAS untuk kompatibilitas
        
        // ✅ Lokasi (Nama saja)
        province: row.province || '',
        city: row.city || '',
        district: row.district || '',
        
        // ✅ Desa (NAMA + KODE)
        village: villageName,           // ← Nama desa (dari kolom 'village')
        villageName: villageName,       // ← ALIAS untuk frontend
        villageCode: villageCode,       // ← Kode desa (untuk ongkir)
        village_code: villageCode,      // ← ALIAS snake_case
        
        // ✅ Kode pos
        zipCode,
        postalCode: zipCode,            // ← ALIAS
        postal_code: zipCode,           // ← ALIAS snake_case
        
        // ✅ Penerima
        recipientName,
        recipient_name: recipientName,  // ← ALIAS snake_case
        recipientPhone,
        recipient_phone: recipientPhone,// ← ALIAS snake_case
        
        // ✅ Default flag
        isDefault: Boolean(row.is_default),
        is_default: Boolean(row.is_default), // ← ALIAS snake_case
        
        // ✅ Timestamps
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
        deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
      };
    }) : [];

    // ✅ Debug log (bisa dihapus di production)
    if (addresses.length > 0) {
      console.log('📬 [ADDRESS API] Returning addresses:', {
        count: addresses.length,
        sample: {
          id: addresses[0].id,
          village: addresses[0].village,
          villageName: addresses[0].villageName,
          villageCode: addresses[0].villageCode,
        }
      });
    }

    return NextResponse.json({
      success: true,
      addresses: addresses,
      total: addresses.length,
    });

  } catch (err: any) {
    console.error('❌ Error fetching addresses:', err);
    return handleAPIError(err, 'GET /api/address');
  }
}

// ============================================================================
// POST: Create new address
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
    const body = await req.json();

    console.log('📬 [ADDRESS API] Create request:', body);

    // ✅ Parse body dengan fallback untuk berbagai format
    const label = body.label || '';
    const recipientName = body.recipientName || body.recipient_name || '';
    const recipientPhone = body.recipientPhone || body.recipient_phone || '';
    const province = body.province || '';
    const city = body.city || '';
    const district = body.district || '';
    
    // ✅ Field desa - PENTING!
    const villageName = body.villageName || body.village_name || body.village || '';
    const villageCode = body.villageCode || body.village_code || '';
    
    const detail = body.detail || body.address || '';
    const zipCode = body.zipCode || body.zip_code || body.postalCode || body.postal_code || '';
    const isDefault = body.isDefault ?? body.is_default ?? false;

    // Validasi
    if (!recipientName || !recipientPhone) {
      return NextResponse.json(
        { success: false, error: 'Nama dan nomor telepon penerima wajib diisi' },
        { status: 400 }
      );
    }

    if (!province || !city || !district || !villageName) {
      return NextResponse.json(
        { success: false, error: 'Lokasi lengkap (provinsi, kota, kecamatan, desa) wajib diisi' },
        { status: 400 }
      );
    }

    if (!detail) {
      return NextResponse.json(
        { success: false, error: 'Detail alamat wajib diisi' },
        { status: 400 }
      );
    }

    // Jika isDefault, unset default address lain
    if (isDefault) {
      await pool.execute(
        'UPDATE address SET is_default = FALSE WHERE user_id = ?',
        [userId]
      );
    }

    // ✅ INSERT dengan semua field
    const [result] = await pool.execute(
      `INSERT INTO address (
        user_id, 
        recipient_name, recipient_phone,
        province, city, district, 
        village, village_code,
        detail, zip_code,
        is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        recipientName, recipientPhone,
        province, city, district,
        villageName, villageCode,  // ✅ village = nama desa
        detail, zipCode,
        isDefault ? 1 : 0,
      ]
    );

    console.log('✅ [ADDRESS API] Address created:', result.insertId);

    return NextResponse.json({
      success: true,
      message: 'Alamat berhasil ditambahkan',
      data: { id: result.insertId },
    }, { status: 201 });

  } catch (err: any) {
    console.error('❌ Error creating address:', err);
    return handleAPIError(err, 'POST /api/address');
  }
}
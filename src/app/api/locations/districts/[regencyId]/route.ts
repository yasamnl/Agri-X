// src/app/api/locations/districts/[regencyId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

// Definisikan tipe untuk params (Next.js 15+ menggunakan Promise)
type Params = {
  params: Promise<{
    regencyId: string;
  }>;
};

// ============================================================================
// ✅ GET: Fetch districts by regency_id
// ============================================================================
export async function GET(request: NextRequest, { params }: Params) {
  try {
    // ✅ Await params untuk Next.js 15+
    const { regencyId } = await params;

    // Validasi regencyId
    if (!regencyId || typeof regencyId !== 'string' || regencyId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'regencyId is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // ✅ PostgreSQL: pool.query() returns { rows, fields }
    // ✅ PostgreSQL: Gunakan $1, $2 untuk parameterized query
    const [rows] = await pool.execute(
      'SELECT id, name FROM districts WHERE regency_id = ? ORDER BY name ASC',
      [regencyId]
    );

    return NextResponse.json({
      success: true,
      data: rows || [],  // ✅ rows sudah array, tidak perlu Array.isArray check
    });

  } catch (error: any) {
    console.error('Error fetching districts from PostgreSQL:', error);
    return handleAPIError(error, 'GET /api/locations/districts/[regencyId]');
  }
}

// ============================================================================
// ✅ POST: Create new district
// ============================================================================
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { regencyId } = await params;

    // Validasi regencyId
    if (!regencyId || typeof regencyId !== 'string' || regencyId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'regencyId is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'District name is required' },
        { status: 400 }
      );
    }

    // ✅ Cek apakah regency_id valid (gunakan $1 untuk PostgreSQL)
    const [regencyCheck] = await pool.execute(
      'SELECT id FROM regencies WHERE id = ?',
      [regencyId]
    );

    if (regencyCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Regency not found' },
        { status: 404 }
      );
    }

    // ✅ PostgreSQL: Gunakan RETURNING clause untuk mendapatkan id yang di-insert
    const [rows] = await pool.execute(
      `INSERT INTO districts (regency_id, name) 
       VALUES (?, ?)`,
      [regencyId, name.trim()]
    );

    const insertedId = rows[0]?.id;

    return NextResponse.json({
      success: true,
      message: 'District created successfully',
      id: insertedId,
    });

  } catch (error: any) {
    console.error('Error creating district in PostgreSQL:', error);
    
    // ✅ Handle specific PostgreSQL errors
    if (error.code === 'ER_DUP_ENTRY') { // unique_violation
      return NextResponse.json(
        { success: false, error: 'District dengan nama ini sudah ada untuk regency tersebut' },
        { status: 409 }
      );
    }
    
    if (error.code === 'ER_NO_REFERENCED_ROW_2') { // foreign_key_violation
      return NextResponse.json(
        { success: false, error: 'Regency ID tidak valid' },
        { status: 400 }
      );
    }
    
    return handleAPIError(error, 'POST /api/locations/districts/[regencyId]');
  }
}
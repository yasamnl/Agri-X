// src/app/api/locations/districts/[regencyId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

// ✅ Next.js 15+ params type (Promise)
type Params = {
  params: Promise<{
    regencyId: string;
  }>;
};

// ============================================================================
// GET: Fetch districts by regency_id
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

    // ✅ MySQL: Gunakan ? untuk parameterized query
    const [rows] = await pool.execute(
      'SELECT id, name FROM districts WHERE regency_id = ? ORDER BY name ASC',
      [regencyId]
    );

    return NextResponse.json({
      success: true,
      data: rows || [],
    });

  } catch (error: any) {
    console.error('❌ Error fetching districts:', error);
    return handleAPIError(error, 'GET /api/locations/districts/[regencyId]');
  }
}

// ============================================================================
// POST: Create new district
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

    // ✅ Cek apakah regency_id valid
    const [regencyCheck] = await pool.execute(
      'SELECT id FROM regencies WHERE id = ?',
      [regencyId]
    );

    if ((regencyCheck as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Regency not found' },
        { status: 404 }
      );
    }

    // ✅ MySQL: INSERT dengan parameterized query
    const [result] = await pool.execute(
      `INSERT INTO districts (regency_id, name) 
       VALUES (?, ?)`,
      [regencyId, name.trim()]
    );

    const insertedId = (result as any).insertId;

    return NextResponse.json({
      success: true,
      message: 'District created successfully',
      id: insertedId,
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error creating district:', error);
    
    // ✅ Handle MySQL specific errors
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { success: false, error: 'District dengan nama ini sudah ada untuk regency tersebut' },
        { status: 409 }
      );
    }
    
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return NextResponse.json(
        { success: false, error: 'Regency ID tidak valid' },
        { status: 400 }
      );
    }
    
    return handleAPIError(error, 'POST /api/locations/districts/[regencyId]');
  }
}

// ============================================================================
// PUT: Update district
// ============================================================================
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { regencyId } = await params;
    const body = await request.json();
    const { id, name } = body;

    if (!id || !name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'District ID and name are required' },
        { status: 400 }
      );
    }

    // ✅ Update district
    const [result] = await pool.execute(
      `UPDATE districts 
       SET name = ?, updated_at = NOW()
       WHERE id = ? AND regency_id = ?`,
      [name.trim(), id, regencyId]
    );

    const affectedRows = (result as any).affectedRows;

    if (affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'District not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'District updated successfully',
    });

  } catch (error: any) {
    console.error('❌ Error updating district:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { success: false, error: 'District dengan nama ini sudah ada' },
        { status: 409 }
      );
    }
    
    return handleAPIError(error, 'PUT /api/locations/districts/[regencyId]');
  }
}

// ============================================================================
// DELETE: Delete district
// ============================================================================
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { regencyId } = await params;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'District ID is required' },
        { status: 400 }
      );
    }

    // ✅ Delete district
    const [result] = await pool.execute(
      'DELETE FROM districts WHERE id = ? AND regency_id = ?',
      [id, regencyId]
    );

    const affectedRows = (result as any).affectedRows;

    if (affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'District not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'District deleted successfully',
    });

  } catch (error: any) {
    console.error('❌ Error deleting district:', error);
    return handleAPIError(error, 'DELETE /api/locations/districts/[regencyId]');
  }
}
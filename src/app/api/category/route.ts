// src/app/api/category/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isActive = searchParams.get('is_active') ?? 'true';

    // ✅ MySQL: ? placeholder (bukan $1, $2)
    // ✅ FIX: Hapus c.created_at dan c.updated_at karena kolom tidak ada di tabel
    const query = `
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.description_category,
        c.is_active,
        c.display_order,
        COUNT(p.id) as product_count
      FROM category c
      LEFT JOIN products p ON c.id = p.category_id AND p.status != ?
      WHERE c.is_active = ?
      GROUP BY c.id, c.name, c.slug, c.description_category, c.is_active, c.display_order
      ORDER BY c.display_order ASC, c.name ASC
    `;

    // ✅ MySQL: pool.execute() + [rows, fields] destructuring
    const [rows] = await pool.execute(query, ['deleted', isActive === 'true']);

    // ✅ Format response: convert types untuk konsistensi frontend
    const categories = (rows as any[]).map((c: any) => ({
      id: Number(c.id),
      name: c.name,
      slug: c.slug,
      description_category: c.description_category,
      is_active: Boolean(c.is_active),  // ✅ MySQL TINYINT(1) → boolean
      display_order: Number(c.display_order) || 0,
      product_count: Number(c.product_count) || 0,
      // ✅ Timestamp default (kolom tidak ada di tabel)
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return NextResponse.json({ 
      success: true, 
      categories,
      count: categories.length,
    });

  } catch (error: any) {
    console.error('Error fetching categories:', error);
    
    // ✅ Handle MySQL error codes
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json(
        { success: false, error: 'Table category not found', code: 'TABLE_NOT_FOUND' },
        { status: 500 }
      );
    }
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return NextResponse.json(
        { success: false, error: `Column error: ${error.sqlMessage}`, code: 'COLUMN_NOT_FOUND' },
        { status: 500 }
      );
    }
    if (error.code === 'ER_PARSE_ERROR') {
      return NextResponse.json(
        { success: false, error: 'SQL syntax error', code: 'SQL_ERROR' },
        { status: 500 }
      );
    }
    
    return handleAPIError(error, 'GET /api/category');
  }
}
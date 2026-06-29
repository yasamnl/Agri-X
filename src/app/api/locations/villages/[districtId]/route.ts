import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

type Params = {
  params: Promise<{
    districtId: string;
  }>;
};

interface PostPayload {
  name: string;
  district_id: string;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { districtId } = await params;

    if (!districtId || typeof districtId !== 'string' || districtId.trim() === '') {
      throw new Error('districtId is required and must be a non-empty string');
    }

    // ✅ PostgreSQL syntax: $1 untuk parameter
    const [rows] = await pool.execute(
      'SELECT id, name FROM villages WHERE district_id = ? ORDER BY name ASC',
      [districtId.toString()]
    );

    return NextResponse.json({
      success: true,
      data: Array.isArray(rows) ? rows : []
    });

  } catch (error: any) {
    console.error('Error fetching villages from local DB:', error);
    return handleAPIError(error, 'GET /api/locations/villages/[districtId]');
  }
}

// ✅ POST: Tambahkan data desa baru
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { districtId } = await params;

    if (!districtId || typeof districtId !== 'string' || districtId.trim() === '') {
      throw new Error('districtId is required and must be a non-empty string');
    }

    const body: PostPayload = await request.json();
    const { name, district_id } = body;

    if (!name || !district_id) {
      throw new Error('Name and district_id are required');
    }

    // ✅ INSERT dengan RETURNING id (PostgreSQL feature)
    const [rows] = await pool.execute(
      'INSERT INTO villages (name, district_id) VALUES (?, ?)',
      [name, district_id]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Village added successfully',
      id: rows[0]?.id
    });

  } catch (error: any) {
    console.error('Error adding village to local DB:', error);
    return handleAPIError(error, 'POST /api/locations/villages/[districtId]');
  }
}
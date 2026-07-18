import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return NextResponse.json({
    success: true,
    data: {
      id,
      message: 'Affiliate social media route placeholder',
    },
  });
}

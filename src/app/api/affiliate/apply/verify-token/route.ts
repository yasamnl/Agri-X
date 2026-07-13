import { NextRequest, NextResponse } from 'next/server';
import { verificationStore } from '@/lib/verificationStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token diperlukan' },
        { status: 400 }
      );
    }

    const success = verificationStore.verifyToken(token);
    if (success) {
      return NextResponse.json({ success: true, message: 'Token berhasil diverifikasi' });
    } else {
      return NextResponse.json(
        { success: false, error: 'Token tidak valid atau sudah kadaluarsa' },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal verifikasi token' },
      { status: 500 }
    );
  }
}
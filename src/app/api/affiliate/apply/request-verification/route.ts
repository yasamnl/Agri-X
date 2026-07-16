import { NextRequest, NextResponse } from 'next/server';
import { verificationStore } from '@/lib/verificationStore';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, platform, username, session_key } = body;

    // Validasi
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email wajib diisi' },
        { status: 400 }
      );
    }
    if (!platform) {
      return NextResponse.json(
        { success: false, error: 'Platform wajib diisi' },
        { status: 400 }
      );
    }
    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username wajib diisi' },
        { status: 400 }
      );
    }
    if (!session_key) {
      return NextResponse.json(
        { success: false, error: 'Session key tidak ditemukan' },
        { status: 400 }
      );
    }

    // Buat token
    const token = verificationStore.createToken(email, platform, username, session_key);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationLink = `${baseUrl}/affiliate/verify-sosmed?token=${token}`;

    // Kirim email (background)
    sendVerificationEmail(email, platform, username, verificationLink)
      .then((result) => {
        if (result.success) {
          console.log(`✅ Email verifikasi terkirim ke ${email}`);
        } else {
          console.error(`❌ Gagal kirim email ke ${email}:`, result.error);
        }
      })
      .catch((err) => console.error('🔥 Email sending error:', err));

    return NextResponse.json({
      success: true,
      message: `Link verifikasi telah dikirim ke ${email}. Cek inbox/spam kamu!`,
    });
  } catch (error: any) {
    console.error('🔥 Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
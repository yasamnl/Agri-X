// src/app/api/affiliate/withdraw/verify-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { getAffiliateByUserId } from '@/lib/affiliate';

// Simpan OTP sementara di memory (HANYA UNTUK DEMO)
// Di production, gunakan Redis atau database
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

// Fungsi untuk menyimpan OTP (dipanggil dari request-otp)
export function storeOTP(affiliateId: string, otp: string) {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 menit
  otpStore.set(affiliateId, { otp, expiresAt });
  
  // Auto cleanup
  setTimeout(() => {
    if (otpStore.has(affiliateId)) {
      const data = otpStore.get(affiliateId);
      if (data && data.expiresAt < Date.now()) {
        otpStore.delete(affiliateId);
      }
    }
  }, 10 * 60 * 1000);
}

// Fungsi untuk verifikasi OTP
export function verifyOTP(affiliateId: string, inputOTP: string): boolean {
  const stored = otpStore.get(affiliateId);
  if (!stored) {
    return false;
  }
  
  if (stored.expiresAt < Date.now()) {
    otpStore.delete(affiliateId);
    return false;
  }
  
  return stored.otp === inputOTP;
}

export function deleteOTP(affiliateId: string) {
  otpStore.delete(affiliateId);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // 2. Pastikan user memang affiliate approved
    const affiliate = await getAffiliateByUserId(decoded.sub);
    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Anda belum terdaftar sebagai affiliate' },
        { status: 404 }
      );
    }

    // 3. Parse body
    const body = await req.json();
    const { otp } = body;

    if (!otp || typeof otp !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Kode OTP wajib diisi' },
        { status: 400 }
      );
    }

    // 4. Verifikasi OTP dari store
    const isValid = verifyOTP(affiliate.id, otp);
    
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Kode OTP tidak valid atau sudah kadaluwarsa.' },
        { status: 400 }
      );
    }

    // Hapus OTP setelah berhasil diverifikasi (sekali pakai)
    deleteOTP(affiliate.id);

    return NextResponse.json({
      success: true,
      message: 'OTP berhasil diverifikasi.',
    });
  } catch (error: any) {
    console.error('❌ Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
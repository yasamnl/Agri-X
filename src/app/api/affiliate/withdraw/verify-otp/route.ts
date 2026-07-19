// src/app/api/affiliate/withdraw/verify-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { getAffiliateByUserId } from '@/lib/affiliate';
import { WithdrawalOtp } from '@/lib/withdrawal-otp';

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

    // 4. Cari & verifikasi OTP dari tabel WithdrawalOTP
    const otpRecord = await WithdrawalOtp.verify(otp);

    if (!otpRecord || otpRecord.userId !== Number(decoded.sub)) {
      return NextResponse.json(
        { success: false, error: 'Kode OTP tidak valid atau sudah kadaluwarsa.' },
        { status: 400 }
      );
    }

    // 5. Invalidate (sekali pakai)
    await otpRecord.invalidate();

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
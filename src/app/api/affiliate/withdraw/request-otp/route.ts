// src/app/api/affiliate/withdraw/request-otp/route.ts
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

    // 3. Generate OTP dan simpan ke tabel WithdrawalOTP
    const otp = await WithdrawalOtp.generate(decoded.sub);

    console.log(`📱 [OTP DEMO] Kode OTP untuk user ${decoded.sub}: ${otp.otpCode}`);

    // 4. Kirim OTP via email
    const user = await otp.user();
    if (user?.email) {
      const emailResult = await otp.sendOtp(user.email);
      if (!emailResult.success) {
        console.error('❌ Gagal kirim email OTP:', emailResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Kode OTP telah dikirim ke email Anda.',
      demo_otp: otp.otpCode,
    });
  } catch (error: any) {
    console.error('❌ Request OTP error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
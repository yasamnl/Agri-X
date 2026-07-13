// src/app/api/affiliate/withdraw/request-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { getAffiliateByUserId } from '@/lib/affiliate';
import { storeOTP } from '../verify-otp/route';
import pool from '@/lib/db';
import { sendWithdrawalOtpEmail } from '@/lib/email';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    // 3. Generate OTP dan simpan
    const otp = generateOTP();
    storeOTP(affiliate.id, otp);
    
    console.log(`📱 [OTP DEMO] Kode OTP untuk affiliate ${affiliate.id}: ${otp}`);

    // 4. Ambil data user untuk dikirimi email
    const [userRows] = await pool.query(
      `SELECT name, email FROM users WHERE id = ?`,
      [decoded.sub]
    );
    const user = (userRows as any[])[0];

    // 5. Kirim OTP via email (kode yang sama dengan yang disimpan)
    if (user?.email) {
      const emailResult = await sendWithdrawalOtpEmail(user.email, user.name, otp);
      if (!emailResult.success) {
        console.error('❌ Gagal kirim email OTP:', emailResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Kode OTP telah dikirim ke email Anda.',
      demo_otp: otp,
    });
  } catch (error: any) {
    console.error('❌ Request OTP error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
// app/api/affiliate/apply/check-verification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verificationStore } from '@/lib/verificationStore';

export async function POST(req: NextRequest) {
  try {
    const { email, session_key, accounts } = await req.json();

    const verifiedAccounts = await verificationStore.getVerifiedTokens(email, session_key);

    // Filter hanya yang ada di list accounts
    const matched = verifiedAccounts.filter((v) =>
      accounts.some((a: any) => a.platform === v.platform && a.username === v.username)
    );

    return NextResponse.json({
      success: true,
      verified_accounts: matched,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Gagal cek verifikasi' }, { status: 500 });
  }
}
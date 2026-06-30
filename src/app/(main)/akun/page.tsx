// src/app/(main)/akun/page.tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyAccessTokenServer } from '@/lib/auth';

export default async function AccountPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;

  // ✅ Redirect jika tidak ada token
  if (!token) {
    redirect('/login?callbackUrl=/akun');
  }

  // ✅ Verify token
  const decoded = verifyAccessTokenServer(token);
  
  if (!decoded) {
    redirect('/login?callbackUrl=/akun');
  }

  // ✅ Redirect berdasarkan role (TANPA try-catch!)
  if (decoded.role === 'seller') {
    redirect('/akun/seller');
  }
  
  redirect('/akun/buyer');
}
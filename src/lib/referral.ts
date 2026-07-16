// lib/referral.ts

//  * Mendeteksi platform asal pengunjung dari referer URL dan user agent
//  * Fungsi ini adalah kunci utama untuk tracking platform asal referral
export function detectPlatformFromReferer(): string {
  if (typeof window === 'undefined') return 'direct';
  
  try {
    const referer = document.referrer.toLowerCase();
    
    // Deteksi dari referer URL
    if (referer.includes('instagram.com')) return 'instagram';
    if (referer.includes('tiktok.com')) return 'tiktok';
    if (referer.includes('youtube.com') || referer.includes('youtu.be')) return 'youtube';
    if (referer.includes('twitter.com') || referer.includes('x.com')) return 'twitter';
    if (referer.includes('facebook.com') || referer.includes('fb.com')) return 'facebook';
    if (referer.includes('whatsapp.com')) return 'whatsapp';
    if (referer.includes('telegram.org') || referer.includes('t.me')) return 'telegram';
    if (referer.includes('linkedin.com')) return 'linkedin';
    if (referer.includes('pinterest.com')) return 'pinterest';
    if (referer.includes('tumblr.com')) return 'tumblr';
    if (referer.includes('line.me')) return 'line';
    if (referer.includes('wechat.com')) return 'wechat';
    
    // Deteksi dari user agent (social media apps in-app browser)
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('instagram')) return 'instagram';
    if (ua.includes('tiktok')) return 'tiktok';
    if (ua.includes('fbav') || ua.includes('facebook')) return 'facebook';
    if (ua.includes('twitter')) return 'twitter';
    
    return 'direct';
  } catch (error) {
    console.error('Detect platform error:', error);
    return 'direct';
  }
}

//  * Melacak klik referral dengan deteksi platform secara otomatis
//  * Fungsi ini akan mengirim request ke API untuk mencatat klik referral
export async function trackReferralClick(referralCode: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!referralCode) {
      return { success: false, error: 'No referral code' };
    }

    // Deteksi platform asal secara otomatis
    const platform = detectPlatformFromReferer();
    
    console.log(`🔍 Tracking klik referral ${referralCode} dari platform: ${platform}`);

    // Kirim ke API tanpa parameter platform di URL
    const url = new URL('/api/affiliate/track-click', window.location.origin);
    url.searchParams.set('ref', referralCode);
    url.searchParams.set('platform', platform);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Tracking error:', errorData);
      return { success: false, error: errorData.error || 'Tracking failed' };
    }

    return { success: true };
  } catch (error) {
    console.error('Track referral click error:', error);
    return { success: false, error: 'Network error' };
  }
}

//  * Menyimpan kode referral di localStorage dan sessionStorage
export function storeReferralCode(code: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('affiliate_referral_code', code);
    sessionStorage.setItem('affiliate_referral_code', code);
  } catch (error) {
    console.error('Store referral code error:', error);
  }
}

//  * Mengambil kode referral yang tersimpan di localStorage atau sessionStorage
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem('affiliate_referral_code') || 
           sessionStorage.getItem('affiliate_referral_code') || 
           null;
  } catch (error) {
    return null;
  }
}

//  * Menghapus kode referral dari localStorage dan sessionStorage
//  * Digunakan saat user sudah menyelesaikan transaksi atau logout
export function clearStoredReferralCode(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('affiliate_referral_code');
    sessionStorage.removeItem('affiliate_referral_code');
  } catch (error) {
    console.error('Clear referral code error:', error);
  }
}

//  * Membuat link referral lengkap dengan kode referral untuk sharing
export function getReferralLink(
  baseUrl: string,
  referralCode: string
): string {
  return `${baseUrl}?ref=${referralCode}`;
}
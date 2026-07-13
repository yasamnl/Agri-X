// src/lib/social-media.ts
// Helper untuk generate URL sosial media dari username

export type SocialMediaPlatform = 
  | 'instagram' 
  | 'tiktok' 
  | 'youtube' 
  | 'twitter' 
  | 'facebook' 
  | 'website'
  | string;

export interface SocialMediaConfig {
  platform: SocialMediaPlatform;
  label: string;
  icon: string;
  color: string;
  prefix: string;
  placeholder: string;
  regex: RegExp;
  generateUrl: (username: string) => string;
}

// ✅ Konfigurasi per platform
export const SOCIAL_MEDIA_CONFIGS: Record<string, SocialMediaConfig> = {
  instagram: {
    platform: 'instagram',
    label: 'Instagram',
    icon: 'FaInstagram',
    color: 'text-pink-500',
    prefix: '@',
    placeholder: 'username (contoh: johndoe)',
    regex: /^[a-zA-Z0-9._]{1,30}$/,
    generateUrl: (username) => `https://instagram.com/${username}`,
  },
  tiktok: {
    platform: 'tiktok',
    label: 'TikTok',
    icon: 'FaTiktok',
    color: 'text-gray-800 dark:text-white',
    prefix: '@',
    placeholder: 'username (contoh: johndoe)',
    regex: /^[\w.\d]{2,24}$/,
    generateUrl: (username) => `https://tiktok.com/@${username}`,
  },
  youtube: {
    platform: 'youtube',
    label: 'YouTube',
    icon: 'FaYoutube',
    color: 'text-red-600',
    prefix: '@',
    placeholder: 'channel handle (contoh: @johndoe)',
    regex: /^@?[\w-]{3,30}$/,
    generateUrl: (username) => {
      const cleanUsername = username.startsWith('@') ? username : `@${username}`;
      return `https://youtube.com/${cleanUsername}`;
    },
  },
  twitter: {
    platform: 'twitter',
    label: 'Twitter/X',
    icon: 'FaTwitter',
    color: 'text-blue-400',
    prefix: '@',
    placeholder: 'username (contoh: johndoe)',
    regex: /^[a-zA-Z0-9_]{1,15}$/,
    generateUrl: (username) => `https://twitter.com/${username}`,
  },
  facebook: {
    platform: 'facebook',
    label: 'Facebook',
    icon: 'FaFacebook',
    color: 'text-blue-600',
    prefix: '',
    placeholder: 'username atau page name',
    regex: /^[a-zA-Z0-9.]{5,50}$/,
    generateUrl: (username) => `https://facebook.com/${username}`,
  },
  website: {
    platform: 'website',
    label: 'Website',
    icon: 'FaGlobe',
    color: 'text-blue-500',
    prefix: '',
    placeholder: 'https://example.com',
    regex: /^https?:\/\/.+/i,
    generateUrl: (url) => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
      }
      return url;
    },
  },
};

// ✅ FIX: Generate URL dengan defensive programming
export function generateSocialMediaUrl(
  platform: SocialMediaPlatform | string,
  username: string | null | undefined
): string {
  // ✅ Guard: Handle undefined/null/empty
  if (!username || typeof username !== 'string') {
    return '#'; // Fallback ke hash jika tidak ada username
  }

  const cleanUsername = username.trim();
  
  if (!cleanUsername) {
    return '#'; // Fallback jika username kosong
  }

  // ✅ Jika username sudah URL lengkap, return langsung
  if (cleanUsername.startsWith('http://') || cleanUsername.startsWith('https://')) {
    return cleanUsername;
  }

  const config = SOCIAL_MEDIA_CONFIGS[platform.toLowerCase()];
  if (!config) {
    // Fallback: return username sebagai-is
    return cleanUsername;
  }

  return config.generateUrl(cleanUsername);
}

// ✅ FIX: Validasi username dengan defensive programming
export function validateSocialMediaUsername(
  platform: SocialMediaPlatform | string,
  username: string | null | undefined
): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username tidak boleh kosong' };
  }

  const cleanUsername = username.trim();
  
  if (!cleanUsername) {
    return { valid: false, error: 'Username tidak boleh kosong' };
  }

  const config = SOCIAL_MEDIA_CONFIGS[platform.toLowerCase()];
  if (!config) {
    return { valid: false, error: 'Platform tidak dikenali' };
  }

  if (!config.regex.test(cleanUsername)) {
    return { 
      valid: false, 
      error: `Format username tidak valid untuk ${config.label}` 
    };
  }

  return { valid: true };
}

// ✅ FIX: Get display username dengan defensive programming
export function getDisplayUsername(
  platform: SocialMediaPlatform | string,
  username: string | null | undefined
): string {
  if (!username || typeof username !== 'string') {
    return '-'; // Fallback
  }

  const cleanUsername = username.trim();
  
  if (!cleanUsername) {
    return '-';
  }

  // Untuk website, tampilkan domain saja
  if (platform === 'website') {
    try {
      const url = new URL(cleanUsername.startsWith('http') ? cleanUsername : `https://${cleanUsername}`);
      return url.hostname;
    } catch {
      return cleanUsername;
    }
  }

  const config = SOCIAL_MEDIA_CONFIGS[platform.toLowerCase()];
  if (!config) return cleanUsername;
  
  return `${config.prefix}${cleanUsername}`;
}

// ✅ NEW: Extract username dari URL (untuk data lama)
export function extractUsernameFromUrl(
  platform: SocialMediaPlatform | string,
  url: string | null | undefined
): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const cleanUrl = url.trim();
  
  if (!cleanUrl) {
    return '';
  }

  try {
    // Jika sudah URL lengkap
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      const urlObj = new URL(cleanUrl);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      // Instagram: instagram.com/username
      if (platform === 'instagram' && pathParts.length > 0) {
        return pathParts[0];
      }
      
      // TikTok: tiktok.com/@username
      if (platform === 'tiktok' && pathParts.length > 0) {
        return pathParts[0].replace('@', '');
      }
      
      // YouTube: youtube.com/@username
      if (platform === 'youtube' && pathParts.length > 0) {
        return pathParts[0].replace('@', '');
      }
      
      // Twitter: twitter.com/username
      if (platform === 'twitter' && pathParts.length > 0) {
        return pathParts[0];
      }
      
      // Facebook: facebook.com/username
      if (platform === 'facebook' && pathParts.length > 0) {
        return pathParts[0];
      }
      
      // Website: return hostname
      if (platform === 'website') {
        return urlObj.hostname;
      }
    }
    
    // Jika bukan URL, return as-is
    return cleanUrl;
  } catch {
    return cleanUrl;
  }
}
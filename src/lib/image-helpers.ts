// src/lib/image-helpers.ts

/**
 * ✅ Normalize image URL - convert full URL ke relative path
 * Contoh:
 * - "https://localhost:3000/products/bawang.jpg" → "/products/bawang.jpg"
 * - "http://192.168.1.1:3000/products/cabai.jpg" → "/products/cabai.jpg"
 * - "/products/bawang.jpg" → "/products/bawang.jpg" (tetap)
 * - "https://external.com/img.jpg" → "https://external.com/img.jpg" (tetap)
 */
export function normalizeImageUrl(
  src: string | null | undefined,
  fallback: string = '/images/placeholder.jpg'
): string {
  if (!src || typeof src !== 'string') {
    return fallback;
  }

  const trimmed = src.trim();
  if (!trimmed) return fallback;

  // ✅ Jika sudah relative path, return as-is
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // ✅ Jika full URL, extract pathname
  try {
    const url = new URL(trimmed);
    
    const isLocalDomain = 
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.startsWith('192.168.') ||
      url.hostname.includes('agri-x.com') ||
      url.hostname.includes('agri-x.vercel.app');

    if (isLocalDomain) {
      return url.pathname + url.search;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * ✅ Get placeholder image berdasarkan kategori
 */
export function getPlaceholderImage(category?: string): string {
  const placeholders: Record<string, string> = {
    'sayuran': '/images/placeholder-vegetable.jpg',
    'buah': '/images/placeholder-fruit.jpg',
    'bumbu': '/images/placeholder-spice.jpg',
    'beras': '/images/placeholder-rice.jpg',
    'default': '/images/placeholder.jpg',
  };

  if (!category) return placeholders.default;
  
  const normalizedCategory = category.toLowerCase();
  for (const [key, value] of Object.entries(placeholders)) {
    if (normalizedCategory.includes(key)) {
      return value;
    }
  }

  return placeholders.default;
}

/**
 * ✅ BARU: Extract filename dari path
 * Contoh: 
 * - "/products/1234567890-abc123-bawang.webp" → "1234567890-abc123-bawang.webp"
 * - "https://localhost:3000/products/image.jpg" → "image.jpg"
 */
export function extractFilename(imagePath: string | null | undefined): string {
  if (!imagePath || typeof imagePath !== 'string') {
    return '';
  }

  const trimmed = imagePath.trim();
  if (!trimmed) return '';

  try {
    // Jika URL penuh, extract pathname dulu
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      return url.pathname.split('/').pop() || '';
    }

    // Jika relative path, ambil bagian terakhir
    return trimmed.split('/').pop() || '';
  } catch {
    // Fallback: split manual
    return trimmed.split('/').pop() || '';
  }
}

/**
 * ✅ BARU: Generate unique filename untuk upload
 */
export function generateImageFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const cleanName = originalName
    .replace(/\.[^/.]+$/, '') // hapus ekstensi
    .replace(/[^a-zA-Z0-9-_]/g, '-') // ganti karakter aneh dengan -
    .substring(0, 50); // limit panjang

  return `${timestamp}-${random}-${cleanName}.webp`;
}
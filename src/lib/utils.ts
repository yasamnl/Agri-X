// src/lib/utils.ts

// ============================================================================
// DATA TRANSFORMATION (Snake_case <-> CamelCase)
// ============================================================================

/**
 * Ubah snake_case (dari DB) -> camelCase (untuk Frontend)
 */
export function keysToCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(keysToCamelCase);
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      // Regex ubah 'user_id' jadi 'userId'
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      result[camelKey] = keysToCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

/**
 * Ubah camelCase (dari Frontend) -> snake_case (untuk DB)
 */
export function keysToSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(keysToSnakeCase);
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      // Regex ubah 'userId' jadi 'user_id'
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = keysToSnakeCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

// ============================================================================
// SAFE TYPE CONVERSION (BARU - untuk mencegah error undefined)
// ============================================================================

/**
 * Konversi aman ke number (mencegah NaN)
 * @param val - Value yang akan dikonversi
 * @param fallback - Nilai default jika konversi gagal (default: 0)
 */
export function safeNumber(val: any, fallback: number = 0): number {
  if (val === null || val === undefined) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

/**
 * Konversi aman ke boolean
 * @param val - Value yang akan dikonversi
 */
export function safeBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true';
  if (typeof val === 'number') return val !== 0;
  return false;
}

/**
 * Konversi aman ke string
 * @param val - Value yang akan dikonversi
 * @param fallback - Nilai default jika null/undefined (default: '')
 */
export function safeString(val: any, fallback: string = ''): string {
  if (val === null || val === undefined) return fallback;
  return String(val);
}

/**
 * Konversi aman ke array
 * @param val - Value yang akan dikonversi
 */
export function safeArray<T>(val: any): T[] {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

// ============================================================================
// FORMATTING (Currency, Date, Number)
// ============================================================================

/**
 * Format angka menjadi format mata uang Rupiah
 * @param amount - Jumlah dalam angka
 * @returns String format Rupiah (contoh: "Rp 50.000")
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return 'Rp 0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'Rp 0';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format tanggal ke format Indonesia (AMAN DARI ERROR)
 * @param date - String atau Date object
 * @returns String format tanggal Indonesia (contoh: "7 Januari 2026") atau "-" jika invalid
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    // Cek apakah date valid
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.warn('Error formatting date:', date);
    return '-';
  }
}

/**
 * Format tanggal pendek (AMAN DARI ERROR)
 * @param date - String atau Date object
 * @returns String format tanggal pendek (contoh: "07/01/2026") atau "-" jika invalid
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '-';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch (error) {
    return '-';
  }
}

/**
 * Format tanggal + waktu (BARU - AMAN DARI ERROR)
 * @param date - String atau Date object
 * @returns String format "7 Januari 2026, 14:30" atau "-" jika invalid
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.warn('Error formatting datetime:', date);
    return '-';
  }
}

/**
 * Format tanggal + waktu pendek (BARU - AMAN DARI ERROR)
 * @param date - String atau Date object
 * @returns String format "07/01/2026 14:30" atau "-" jika invalid
 */
export function formatDateTimeShort(date: string | Date | null | undefined): string {
  if (!date) return '-';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch (error) {
    return '-';
  }
}

/**
 * Format waktu relatif (contoh: "2 jam yang lalu")
 * ✅ DIPERBAIKI: Tambah null check dan try-catch
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffInSeconds < 0) return 'Baru saja';
    if (diffInSeconds < 60) return 'Baru saja';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit yang lalu`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam yang lalu`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} hari yang lalu`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} minggu yang lalu`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} bulan yang lalu`;
    
    return `${Math.floor(diffInSeconds / 31536000)} tahun yang lalu`;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.warn('Error formatting relative time:', date);
    return '-';
  }
}

/**
 * Format angka dengan separator ribuan
 */
export function formatNumber(number: number | string | null | undefined): string {
  if (number === null || number === undefined) return '0';
  const num = typeof number === 'string' ? parseFloat(number) : number;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('id-ID').format(num);
}

// ============================================================================
// TEXT & STRING UTILS
// ============================================================================

/**
 * Potong teks jika terlalu panjang
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Capitalize setiap kata (BARU)
 * @param text - "john doe" -> "John Doe"
 */
export function capitalizeWords(text: string): string {
  if (!text) return '';
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get initial dari nama (contoh: "John Doe" -> "JD")
 */
export function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Slugify string untuk URL
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Escape HTML characters untuk mencegah XSS (BARU)
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Strip HTML tags dari string (BARU)
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validasi email
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validasi nomor telepon Indonesia
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

/**
 * Validasi URL (untuk gambar produk/forum)
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Cek apakah value null atau undefined
 */
export function isNullOrUndefined(value: any): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Cek apakah object kosong
 */
export function isEmpty(obj: object | string | any[] | null | undefined): boolean {
  if (!obj) return true;
  if (typeof obj === 'string') return obj.trim().length === 0;
  if (Array.isArray(obj)) return obj.length === 0;
  return Object.keys(obj).length === 0;
}

/**
 * Validasi password strength (BARU)
 * @returns Object dengan isValid dan messages
 */
export function validatePassword(password: string): { 
  isValid: boolean; 
  messages: string[];
  strength: 'weak' | 'medium' | 'strong';
} {
  const messages: string[] = [];
  
  if (!password) {
    return { isValid: false, messages: ['Password wajib diisi'], strength: 'weak' };
  }
  
  if (password.length < 8) messages.push('Minimal 8 karakter');
  if (!/[A-Z]/.test(password)) messages.push('Minimal 1 huruf kapital');
  if (!/[a-z]/.test(password)) messages.push('Minimal 1 huruf kecil');
  if (!/[0-9]/.test(password)) messages.push('Minimal 1 angka');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) messages.push('Minimal 1 simbol');
  
  const strength: 'weak' | 'medium' | 'strong' = 
    messages.length === 0 ? 'strong' : 
    messages.length <= 2 ? 'medium' : 'weak';
  
  return {
    isValid: messages.length === 0,
    messages,
    strength,
  };
}

// ============================================================================
// MATH & CALCULATION
// ============================================================================

/**
 * Hitung diskon
 */
export function calculateDiscount(originalPrice: number, discountPercent: number): number {
  return originalPrice - (originalPrice * discountPercent / 100);
}

/**
 * Hitung persentase diskon
 */
export function calculateDiscountPercent(originalPrice: number, discountedPrice: number): number {
  if (originalPrice === 0) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}

/**
 * Generate random string untuk ID
 */
export function generateId(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generate UUID v4 (BARU)
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Clamp number ke range tertentu (BARU)
 * @param value - Nilai yang akan di-clamp
 * @param min - Nilai minimum
 * @param max - Nilai maksimum
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Round number ke decimal tertentu (BARU)
 */
export function roundTo(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

// ============================================================================
// ASYNC & PERFORMANCE
// ============================================================================

/**
 * Sleep/delay untuk async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function untuk search/input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function (BARU) - untuk scroll/resize events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================================================
// FILE & MEDIA
// ============================================================================

/**
 * Format ukuran file (bytes ke KB, MB, GB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get file extension dari filename (BARU)
 */
export function getFileExtension(filename: string): string {
  if (!filename) return '';
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

/**
 * Get filename tanpa extension (BARU)
 */
export function getFileNameWithoutExtension(filename: string): string {
  if (!filename) return '';
  return filename.replace(/\.[^/.]+$/, '');
}

// ============================================================================
// QUERY STRING
// ============================================================================

/**
 * Parse query string dari URL
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!queryString) return params;
  
  const search = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  
  search.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  });
  
  return params;
}

/**
 * Build query string dari object
 */
export function buildQueryString(params: Record<string, any>): string {
  return Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

// ============================================================================
// ERROR HANDLING (BARU - untuk mencegah error toLocaleString)
// ============================================================================

/**
 * Extract error message dari unknown error (BARU)
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'Terjadi kesalahan yang tidak diketahui';
}

/**
 * Safe JSON parse (BARU) - tidak throw error jika invalid JSON
 */
export function safeJsonParse<T = any>(json: string, fallback: T | null = null): T | null {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Safe localStorage get (BARU)
 */
export function safeLocalStorageGet<T = any>(key: string, fallback: T | null = null): T | null {
  try {
    if (typeof window === 'undefined') return fallback;
    const item = window.localStorage.getItem(key);
    if (!item) return fallback;
    return safeJsonParse<T>(item, fallback);
  } catch {
    return fallback;
  }
}

/**
 * Safe localStorage set (BARU)
 */
export function safeLocalStorageSet(key: string, value: any): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// UI UTILITIES (BARU)
// ============================================================================

/**
 * Conditional className (seperti clsx) (BARU)
 * @example classNames('btn', isActive && 'btn-active', { 'btn-disabled': isDisabled })
 */
export function classNames(...args: any[]): string {
  const classes: string[] = [];
  
  for (const arg of args) {
    if (!arg) continue;
    
    if (typeof arg === 'string' || typeof arg === 'number') {
      classes.push(String(arg));
    } else if (Array.isArray(arg)) {
      const inner = classNames(...arg);
      if (inner) classes.push(inner);
    } else if (typeof arg === 'object') {
      for (const key in arg) {
        if (Object.prototype.hasOwnProperty.call(arg, key) && arg[key]) {
          classes.push(key);
        }
      }
    }
  }
  
  return classes.join(' ');
}

/**
 * Get status badge config (BARU) - untuk konsistensi UI
 */
export function getStatusConfig(status: string): { 
  label: string; 
  color: string; 
  bgColor: string; 
  icon?: string;
} {
  const configs: Record<string, any> = {
    // Order status
    pending: { label: 'Menunggu', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
    paid: { label: 'Dibayar', color: 'text-blue-800', bgColor: 'bg-blue-100' },
    processing: { label: 'Diproses', color: 'text-blue-800', bgColor: 'bg-blue-100' },
    shipped: { label: 'Dikirim', color: 'text-purple-800', bgColor: 'bg-purple-100' },
    delivered: { label: 'Selesai', color: 'text-green-800', bgColor: 'bg-green-100' },
    completed: { label: 'Selesai', color: 'text-green-800', bgColor: 'bg-green-100' },
    cancelled: { label: 'Dibatalkan', color: 'text-red-800', bgColor: 'bg-red-100' },
    
    // Report status
    menunggu: { label: 'Menunggu', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
    ditinjau: { label: 'Ditinjau', color: 'text-blue-800', bgColor: 'bg-blue-100' },
    ditolak: { label: 'Ditolak', color: 'text-red-800', bgColor: 'bg-red-100' },
    
    // Product status
    ready_stock: { label: 'Ready Stock', color: 'text-green-800', bgColor: 'bg-green-100' },
    'pre-order': { label: 'Pre-Order', color: 'text-blue-800', bgColor: 'bg-blue-100' },
    sold_out: { label: 'Habis', color: 'text-red-800', bgColor: 'bg-red-100' },
    
    // User status
    active: { label: 'Aktif', color: 'text-green-800', bgColor: 'bg-green-100' },
    suspended: { label: 'Ditangguhkan', color: 'text-red-800', bgColor: 'bg-red-100' },
    inactive: { label: 'Tidak Aktif', color: 'text-gray-800', bgColor: 'bg-gray-100' },
  };
  
  return configs[status] || { 
    label: status, 
    color: 'text-gray-800', 
    bgColor: 'bg-gray-100' 
  };
}

/**
 * Copy text to clipboard (BARU)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback untuk browser lama
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        textArea.remove();
        return true;
      } catch (error) {
        textArea.remove();
        return false;
      }
    }
  } catch (error) {
    console.error('Copy to clipboard failed:', error);
    return false;
  }
}

// ============================================================================
// DATE HELPERS (BARU)
// ============================================================================

/**
 * Cek apakah tanggal sudah lewat (BARU)
 */
export function isDateExpired(date: string | Date | null | undefined): boolean {
  if (!date) return true;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return true;
    return d.getTime() < Date.now();
  } catch {
    return true;
  }
}

/**
 * Hitung selisih hari antara 2 tanggal (BARU)
 */
export function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Tambah hari ke tanggal (BARU)
 */
export function addDays(date: string | Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format countdown (BARU) - untuk timer pembayaran
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':');
}
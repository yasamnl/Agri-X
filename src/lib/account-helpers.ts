// src/lib/account-helpers.ts
import { formatCurrency as baseFormatCurrency, formatDate as baseFormatDate } from '@/lib/utils';

export const safeNumber = (val: any, fallback: number = 0): number => {
  if (val === null || val === undefined) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

export const formatCurrency = baseFormatCurrency;
export const formatDate = baseFormatDate;

export const getStatusBadge = (status: string) => {
  const badges: Record<string, { className: string; label: string }> = {
    pending: { className: 'badge badge-pending', label: 'Menunggu Pembayaran' },
    processing: { className: 'badge badge-processing', label: 'Diproses' },
    shipped: { className: 'badge badge-shipped', label: 'Dikirim' },
    delivered: { className: 'badge badge-completed', label: 'Selesai' },
    completed: { className: 'badge badge-completed', label: 'Selesai' },
    cancelled: { className: 'badge badge-cancelled', label: 'Dibatalkan' },
  };
  return badges[status] || badges.pending;
};

export const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && (response.status === 503 || response.status >= 500)) {
        throw new Error(`Server error: ${response.status}`);
      }
      return response;
    } catch (error: any) {
      lastError = error;
      const isTransient =
        error.message?.includes('timeout') ||
        error.message?.includes('network') ||
        error.message?.includes('Failed to fetch');
      if (!isTransient || attempt === maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
  throw lastError;
};
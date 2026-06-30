// src/hooks/useSellerData.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { sellerApi, SellerDashboardData } from '@/lib/seller-api';

interface UseSellerDataOptions {
  enabled?: boolean;
  cacheDuration?: number;
  throttleDuration?: number;
}

interface UseSellerDataReturn {
  data: SellerDashboardData;
  isLoading: boolean;
  error: string | null;
  refetch: (force?: boolean) => Promise<void>;
  lastUpdated: number | null;
}

export function useSellerData(
  options: UseSellerDataOptions = {}
): UseSellerDataReturn {
  const {
    enabled = true,
    cacheDuration = 60000, // 60 seconds cache
    throttleDuration = 30000, // 30 seconds throttle
  } = options;

  const [data, setData] = useState<SellerDashboardData>({
    stats: null,
    chart: [],
    topProducts: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // ✅ Refs untuk anti-spam
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const cacheRef = useRef<{ data: SellerDashboardData; timestamp: number } | null>(null);
  const hasFetchedRef = useRef(false); // ✅ Track if already fetched

  const fetchData = useCallback(
    async (force: boolean = false) => {
      // Guard 1: Disabled
      if (!enabled) return;

      // Guard 2: Already fetching
      if (isFetchingRef.current) {
        return;
      }

      // Guard 3: Throttle (kecuali force)
      const now = Date.now();
      if (!force && now - lastFetchTimeRef.current < throttleDuration) {
        return;
      }

      // Guard 4: Cache valid (kecuali force)
      if (!force && cacheRef.current && now - cacheRef.current.timestamp < cacheDuration) {
        setData(cacheRef.current.data);
        return;
      }

      // ✅ Start fetching
      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;
      setIsLoading(true);
      setError(null);

      try {
        const result = await sellerApi.getAll();

        setData(result);
        setLastUpdated(now);
        hasFetchedRef.current = true;

        // ✅ Update cache
        cacheRef.current = {
          data: result,
          timestamp: now,
        };
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data');
      } finally {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [enabled, throttleDuration, cacheDuration]
  );

  // ✅ Initial fetch on mount - hanya sekali
  useEffect(() => {
    if (enabled && !hasFetchedRef.current) {
      fetchData();
    }

    return () => {
      isFetchingRef.current = false;
    };
  }, [enabled, fetchData]);

  const refetch = useCallback(
    async (force: boolean = false) => {
      await fetchData(force);
    },
    [fetchData]
  );

  return {
    data,
    isLoading,
    error,
    refetch,
    lastUpdated,
  };
}
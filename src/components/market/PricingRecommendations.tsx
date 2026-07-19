'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Package, Store, TrendingUp } from 'lucide-react';
import { formatMarketPrice, type MarketPrice } from '@/lib/market-prices';

interface ProductItem {
  id: number;
  name: string;
  price: number;
  unit?: string;
  category?: string;
  seller_id?: number;
  user_name?: string;
  status?: string;
}

interface RecommendationItem {
  id: number;
  name: string;
  price: number;
  unit: string;
  sellerName: string;
  category?: string;
  marketCommodity?: string;
  marketPrice?: number;
  variancePercent: number;
  status: 'Kompetitif' | 'Perlu Penyesuaian' | 'Data Pasar Tidak Tersedia';
  reason: string;
  priority: 'Tinggi' | 'Sedang' | 'Rendah';
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getCategoryKey(category?: string): string {
  const normalized = normalizeText(category || '');
  if (normalized.includes('beras') || normalized.includes('rice')) return 'beras';
  if (normalized.includes('cabai') || normalized.includes('cabe') || normalized.includes('bawang') || normalized.includes('chili') || normalized.includes('onion') || normalized.includes('garlic')) return 'bumbu';
  if (normalized.includes('tomat') || normalized.includes('kentang') || normalized.includes('wortel') || normalized.includes('kubis') || normalized.includes('sayur') || normalized.includes('vegetable')) return 'sayuran';
  if (normalized.includes('pisang') || normalized.includes('jeruk') || normalized.includes('apel') || normalized.includes('mangga') || normalized.includes('buah') || normalized.includes('fruit')) return 'buah';
  if (normalized.includes('ayam') || normalized.includes('telur') || normalized.includes('daging') || normalized.includes('ikan') || normalized.includes('protein') || normalized.includes('meat') || normalized.includes('egg')) return 'protein';
  return 'lainnya';
}

function buildRecommendation(product: ProductItem, marketPrices: MarketPrice[]): RecommendationItem {
  const normalizedProductName = normalizeText(product.name);
  const categoryKey = getCategoryKey(product.category);

  const scoredMatches = marketPrices
    .map((marketPrice) => {
      const commodityText = normalizeText(marketPrice.commodity);
      let score = 0;

      if (commodityText.includes('beras') && normalizedProductName.includes('beras')) score += 6;
      if ((commodityText.includes('cabai') || commodityText.includes('cabe')) && (normalizedProductName.includes('cabai') || normalizedProductName.includes('cabe'))) score += 6;
      if ((commodityText.includes('bawang') || commodityText.includes('onion')) && (normalizedProductName.includes('bawang') || normalizedProductName.includes('onion'))) score += 6;
      if (commodityText.includes('tomat') && normalizedProductName.includes('tomat')) score += 6;
      if (commodityText.includes('kentang') && normalizedProductName.includes('kentang')) score += 6;
      if (commodityText.includes('wortel') && normalizedProductName.includes('wortel')) score += 6;
      if (commodityText.includes('kubis') && normalizedProductName.includes('kubis')) score += 6;
      if (commodityText.includes('pisang') && normalizedProductName.includes('pisang')) score += 6;
      if (commodityText.includes('jeruk') && normalizedProductName.includes('jeruk')) score += 6;
      if (commodityText.includes('apel') && normalizedProductName.includes('apel')) score += 6;
      if (commodityText.includes('mangga') && normalizedProductName.includes('mangga')) score += 6;
      if (commodityText.includes('ayam') && normalizedProductName.includes('ayam')) score += 6;
      if (commodityText.includes('telur') && normalizedProductName.includes('telur')) score += 6;
      if (commodityText.includes('daging') && normalizedProductName.includes('daging')) score += 6;
      if (commodityText.includes('ikan') && normalizedProductName.includes('ikan')) score += 6;
      if (commodityText.includes('minyak') && normalizedProductName.includes('minyak')) score += 6;
      if (commodityText.includes('gula') && normalizedProductName.includes('gula')) score += 6;
      if (commodityText.includes('tepung') && normalizedProductName.includes('tepung')) score += 6;

      if (getCategoryKey(marketPrice.category) === categoryKey) score += 3;
      if (commodityText.includes('beras') && categoryKey === 'beras') score += 2;
      if ((commodityText.includes('cabai') || commodityText.includes('cabe') || commodityText.includes('bawang')) && categoryKey === 'bumbu') score += 2;
      if ((commodityText.includes('tomat') || commodityText.includes('kentang') || commodityText.includes('wortel') || commodityText.includes('kubis')) && categoryKey === 'sayuran') score += 2;
      if ((commodityText.includes('pisang') || commodityText.includes('jeruk') || commodityText.includes('apel') || commodityText.includes('mangga')) && categoryKey === 'buah') score += 2;
      if ((commodityText.includes('ayam') || commodityText.includes('telur') || commodityText.includes('daging') || commodityText.includes('ikan')) && categoryKey === 'protein') score += 2;

      const productTokens = normalizedProductName.split(' ').filter(Boolean);
      productTokens.forEach((token) => {
        if (commodityText.includes(token)) score += 1;
      });

      return { marketPrice, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const categoryMatch = marketPrices.find((item) => getCategoryKey(item.category) === categoryKey);
  const bestMatch = scoredMatches[0]?.marketPrice || categoryMatch;
  const marketPrice = bestMatch?.price;

  if (!marketPrice || !bestMatch) {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit || 'kg',
      sellerName: product.user_name || 'Seller',
      category: product.category,
      variancePercent: 0,
      status: 'Data Pasar Tidak Tersedia',
      reason: 'Belum ada data pasar yang cocok untuk produk ini.',
      priority: 'Rendah',
    };
  }

  const variancePercent = ((product.price - marketPrice) / marketPrice) * 100;

  let status: RecommendationItem['status'] = 'Kompetitif';
  let priority: RecommendationItem['priority'] = 'Rendah';
  let reason = 'Harga berada dalam rentang kompetitif pasar.';

  if (Math.abs(variancePercent) > 10) {
    status = 'Perlu Penyesuaian';
    priority = Math.abs(variancePercent) > 20 ? 'Tinggi' : 'Sedang';
    const difference = Math.abs(product.price - marketPrice);
    const direction = product.price > marketPrice ? 'lebih mahal' : 'lebih murah';
    reason = `Harga kamu ${direction} rata-rata pasar sebesar ${formatMarketPrice(difference)} (${variancePercent.toFixed(1)}%).`;
  } else if (variancePercent > 0) {
    reason = `Harga kamu hanya ${variancePercent.toFixed(1)}% di atas rata-rata pasar.`;
  } else if (variancePercent < 0) {
    reason = `Harga kamu ${Math.abs(variancePercent).toFixed(1)}% di bawah rata-rata pasar.`;
  }

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    unit: product.unit || 'kg',
    sellerName: product.user_name || 'Seller',
    category: product.category,
    marketCommodity: bestMatch.commodity,
    marketPrice,
    variancePercent,
    status,
    reason,
    priority,
  };
}

export function PricingRecommendations() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [productsResponse, marketResponse] = await Promise.all([
          fetch('/api/products?limit=50&status=ready_stock'),
          fetch('/api/market-prices'),
        ]);

        if (!productsResponse.ok) throw new Error('Gagal memuat produk');
        if (!marketResponse.ok) throw new Error('Gagal memuat data pasar');

        const productsPayload = await productsResponse.json();
        const marketPayload = await marketResponse.json();

        const fetchedProducts = Array.isArray(productsPayload?.products)
          ? productsPayload.products
          : Array.isArray(productsPayload?.data)
            ? productsPayload.data
            : Array.isArray(productsPayload?.data?.products)
              ? productsPayload.data.products
              : [];

        const fetchedMarketPrices = Array.isArray(marketPayload?.data)
          ? marketPayload.data
          : Array.isArray(marketPayload?.prices)
            ? marketPayload.prices
            : [];

        if (isMounted) {
          setProducts(fetchedProducts);
          setMarketPrices(fetchedMarketPrices);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Terjadi kesalahan saat memuat data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const recommendations = useMemo(() => {
    return products
      .filter((product) => Number(product.price) > 0)
      .map((product) => buildRecommendation(product, marketPrices))
      .sort((a, b) => {
        const priorityRank = { Tinggi: 0, Sedang: 1, Rendah: 2 };
        return priorityRank[a.priority] - priorityRank[b.priority];
      });
  }, [products, marketPrices]);

  const competitiveCount = recommendations.filter((item) => item.status === 'Kompetitif').length;
  const adjustmentCount = recommendations.filter((item) => item.status === 'Perlu Penyesuaian').length;
  const unavailableCount = recommendations.filter((item) => item.status === 'Data Pasar Tidak Tersedia').length;

  if (loading) {
    return (
      <div className="rounded-3xl border border-border bg-surface/60 p-8 text-center text-text-secondary">
        Memuat rekomendasi harga terbaru...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Rekomendasi harga</p>
            <h1 className="mt-2 text-2xl font-bold text-text-primary">Bandingkan harga produk Anda dengan pasar terkini</h1>
            <p className="mt-2 max-w-5xl text-sm text-text-secondary">
              Halaman ini memakai data pasar live dari SISKAPERBAPO dan menilai apakah harga produk Anda masih kompetitif.
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 shadow-sm dark:bg-background/70">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-secondary">Ringkasan</p>
            <div className="mt-2 flex gap-3 text-sm">
              <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">{competitiveCount} kompetitif</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{adjustmentCount} perlu penyesuaian</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{unavailableCount} data pasar belum ada</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recommendations.map((item) => {
          const isAdjustment = item.status === 'Perlu Penyesuaian';
          const isCompetitive = item.status === 'Kompetitif';

          return (
            <article key={item.id} className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-secondary">{item.category || 'Produk'}</p>
                  <h2 className="mt-1 text-lg font-semibold text-text-primary">{item.name}</h2>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${isAdjustment ? 'bg-amber-100 text-amber-700' : isCompetitive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                  {item.status}
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-text-secondary">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  <span>{item.sellerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>Harga Anda: {formatMarketPrice(item.price)} / {item.unit}</span>
                </div>
                {item.marketPrice ? (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Pasar: {formatMarketPrice(item.marketPrice)} / {item.unit}</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl bg-background/70 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  {item.variancePercent > 0 ? <ArrowUpRight className="h-4 w-4 text-amber-600" /> : item.variancePercent < 0 ? <ArrowDownRight className="h-4 w-4 text-green-600" /> : null}
                  <span>{item.reason}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-text-secondary">Prioritas: {item.priority}</span>
                {item.marketCommodity ? <span className="text-text-secondary">Pasar: {item.marketCommodity}</span> : null}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

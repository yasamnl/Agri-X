// src/lib/seller-api.ts
export interface SellerStats {
  totalProducts: number;
  totalSales: number;
  totalOrders: number;
  activeOrders: number;
  avgRating: number;
  totalReviews: number;
  monthlyRevenue: number;
  dailyRevenue: number;
  dailyOrders: number;
}

export interface ChartDataPoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  id: number;
  name: string;
  image: string | null;
  price: number;
  stock: number;
  totalSold: number;
  totalRevenue: number;
  avgRating: number;
  reviewCount: number;
}

export interface SellerDashboardData {
  stats: SellerStats | null;
  chart: ChartDataPoint[];
  topProducts: TopProduct[];
}

class SellerApiClient {
  private baseUrl = '/api/seller';

  private async fetchWithAuth<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API error');
      }

      return data.data;
    } catch (error: any) {
      // ✅ Network error handling
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Periksa koneksi internet Anda.');
      }
      throw error;
    }
  }

  private getToken(): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; accessToken=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  async getStats(): Promise<SellerStats> {
    return this.fetchWithAuth<SellerStats>('/stats');
  }

  async getSalesChart(days: number = 7): Promise<{
    chart: ChartDataPoint[];
    summary: {
      totalRevenue: number;
      totalOrders: number;
      avgRevenue: number;
      avgOrders: number;
    };
  }> {
    return this.fetchWithAuth(`/sales-chart?days=${days}`);
  }

  async getTopProducts(limit: number = 5): Promise<TopProduct[]> {
    const data = await this.fetchWithAuth<{ products: TopProduct[] }>(
      `/top-products?limit=${limit}`
    );
    return data.products;
  }

  async getAll(): Promise<SellerDashboardData> {
    const [statsResult, chartResult, productsResult] = await Promise.allSettled([
      this.getStats(),
      this.getSalesChart(7),
      this.getTopProducts(5),
    ]);

    return {
      stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
      chart: chartResult.status === 'fulfilled' ? chartResult.value.chart : [],
      topProducts: productsResult.status === 'fulfilled' ? productsResult.value : [],
    };
  }
}

export const sellerApi = new SellerApiClient();
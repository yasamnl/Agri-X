export interface Product {
  reviewCount: number;
  image: string | undefined;
  id: number;
  name: string;
  description?: string;
  price: number;
  unit: string;
  stock: number;
  sold_count?: number; // ✅ Optional (karena bisa undefined dari API)
  origin_village_code?: string;
  min_order?: number;
  seller_id: number;
  harvest_date?: string;
  image_path?: string;
  category?: string;
  category_id?: number;
  rating?: number;
  reviews?: number;
  status: 'ready_stock' | 'pre_order' | 'sold_out' | 'deleted';
  badge?: 'Terlaris' | 'Baru';
  created_at?: string;
  updated_at?: string;

  
  // ✅ Rating stats dari backend
  total_reviews?: number;
  rating_breakdown?: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };

  // ✅ Pre-Order quota dari database
  po_quota?: number | null;
  po_sold?: number;
}

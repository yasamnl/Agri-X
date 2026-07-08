// src/types/index.ts (contoh)
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  minOrder?: number;
  farmerName: string; // Bisa berasal dari seller_id
  harvestDate?: string | null; // Bisa null
  image: string; // Path gambar dari public
  category?: string | null; // Bisa null
  stockStatus: 'active' | 'inactive' | 'sold_out' | 'deleted'; // Status dinamis
  createdAt: string;
  updatedAt: string;
}
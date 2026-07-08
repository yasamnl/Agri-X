// src/components/account/types.ts

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  createdAt: string;
}

export interface AccountStats {
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  activeOrdersDetail: Record<string, number>;
  totalSpent: number;
  reviewCount: number;
  voucherCount: number;
  unreadNotifications: number;
  memberSince: string;
}

export interface SellerStats {
  totalProducts: number;
  totalSales: number;
  totalOrders: number;
  activeOrders: number;
  avgRating: number;
  totalReviews: number;
  monthlyRevenue: number;
  dailyRevenue: number;
}

export interface ChartData {
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
}

export interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  product: {
    id: number;
    name: string;
    image: string | null;
  };
}

export interface Voucher {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  minPurchase: number;
  maxDiscount: number;
  description: string;
  expiresAt: string;
}

export interface Tab {
  id: string;
  label: string;
  icon: any;
}

export const BUYER_TABS: Tab[] = [
  { id: 'overview', label: 'Ringkasan', icon: 'Home' },
  { id: 'orders', label: 'Pesanan', icon: 'ShoppingBag' },
  { id: 'reviews', label: 'Ulasan', icon: 'Star' },
  { id: 'vouchers', label: 'Voucher', icon: 'Ticket' },
  { id: 'address', label: 'Alamat', icon: 'MapPin' },
  { id: 'settings', label: 'Pengaturan', icon: 'Settings' },
];

export const SELLER_TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'BarChart3' },
  { id: 'products', label: 'Produk Saya', icon: 'Package' },
  { id: 'orders', label: 'Pesanan', icon: 'ShoppingBag' },
  { id: 'reviews', label: 'Ulasan', icon: 'Star' },
  { id: 'settings', label: 'Pengaturan', icon: 'Settings' },
];
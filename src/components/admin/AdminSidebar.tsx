// src/components/admin/AdminSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Users, Package, ShoppingCart, 
  AlertTriangle, MessageSquare, ArrowLeft,
  X, Award
} from 'lucide-react';

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Kelola User', icon: Users },
  { href: '/admin/products', label: 'Kelola Produk', icon: Package },
  { href: '/admin/transactions', label: 'Transaksi', icon: ShoppingCart },
  { href: '/admin/affiliates', label: 'Kelola Affiliate', icon: Award }, // ✅ NEW
  { href: '/admin/reports', label: 'Laporan', icon: AlertTriangle },
  { href: '/admin/moderation', label: 'Moderasi Forum', icon: MessageSquare },
];

export function AdminSidebar({ isOpen, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay untuk mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside 
        data-sidebar
        className={`
          fixed top-0 left-0 h-full bg-surface border-r border-border z-50
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:w-64
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <h2 className="font-bold text-text-primary">Admin Panel</h2>
              <p className="text-xs text-text-secondary">Agri-X Management</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="lg:hidden p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onToggle}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${isActive 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="relative min-h-screen">
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
            <Link
              href="/"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Kembali ke Beranda</span>
            </Link>
          </div>
          </div>
      </aside>
    </>
  );
}
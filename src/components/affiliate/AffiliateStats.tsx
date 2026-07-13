// src/components/affiliate/AffiliateStats.tsx
'use client';

import { TrendingUp, Users, ShoppingBag, Eye } from 'lucide-react';

interface AffiliateStatsProps {
  totalClicks: number;
  totalTransactions: number;
  totalCommission: number;
  totalReferrals: number;
}

export function AffiliateStats({
  totalClicks,
  totalTransactions,
  totalCommission,
  totalReferrals,
}: AffiliateStatsProps) {
  const stats = [
    {
      label: 'Total Klik',
      value: totalClicks.toLocaleString('id-ID'),
      icon: Eye,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Total Transaksi',
      value: totalTransactions.toLocaleString('id-ID'),
      icon: ShoppingBag,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: 'Total Komisi',
      value: `Rp ${totalCommission.toLocaleString('id-ID')}`,
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Total Referral',
      value: totalReferrals.toLocaleString('id-ID'),
      icon: Users,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="card hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-text-primary">
                {stat.value}
              </p>
              <p className="text-sm text-text-secondary">{stat.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
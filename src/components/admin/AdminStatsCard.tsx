// src/components/admin/AdminStatsCard.tsx
`use client`;

import { LucideIcon } from 'lucide-react';

interface AdminStatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'green' | 'blue' | 'purple' | 'orange' | 'red';
}

const colorMap = {
  green: {
    bg: 'bg-primary/10',
    icon: 'text-primary',
    trend: 'text-green-600 dark:text-green-400',
  },
  blue: {
    bg: 'bg-blue-500/10',
    icon: 'text-blue-500',
    trend: 'text-blue-600 dark:text-blue-400',
  },
  purple: {
    bg: 'bg-purple-500/10',
    icon: 'text-purple-500',
    trend: 'text-purple-600 dark:text-purple-400',
  },
  orange: {
    bg: 'bg-orange-500/10',
    icon: 'text-orange-500',
    trend: 'text-orange-600 dark:text-orange-400',
  },
  red: {
    bg: 'bg-red-500/10',
    icon: 'text-red-500',
    trend: 'text-red-600 dark:text-red-400',
  },
};

export function AdminStatsCard({ title, value, icon: Icon, trend, color }: AdminStatsCardProps) {
  const colors = colorMap[color];

  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-text-secondary mb-1">{title}</p>
          <p className="text-3xl font-bold text-text-primary">{value}</p>
          
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${colors.trend}`}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-text-secondary text-xs">dari bulan lalu</span>
            </div>
          )}
        </div>
        
        <div className={`w-14 h-14 ${colors.bg} rounded-2xl flex items-center justify-center`}>
          <Icon className={`w-7 h-7 ${colors.icon}`} />
        </div>
      </div>
    </div>
  );
}
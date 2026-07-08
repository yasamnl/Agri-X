// src/components/affiliate/TransactionList.tsx
'use client';

import { ShoppingBag, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Transaction {
  id: number;
  product_name: string;
  nominal_transaksi: number;
  komisi: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

export function TransactionList({ transactions, isLoading }: TransactionListProps) {
  const getStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'Pending', className: 'badge-warning' },
      completed: { label: 'Selesai', className: 'badge-success' },
      cancelled: { label: 'Dibatalkan', className: 'badge-danger' },
    };
    const { label, className } = config[status as keyof typeof config] || config.pending;
    return <span className={`badge ${className}`}>{label}</span>;
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-4">
              <div className="w-12 h-12 bg-surface rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface rounded w-3/4" />
                <div className="h-3 bg-surface rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="card text-center py-10">
        <ShoppingBag className="w-16 h-16 mx-auto text-text-muted mb-4" />
        <p className="text-text-secondary mb-2">Belum ada transaksi</p>
        <p className="text-sm text-text-muted">
          Transaksi referral Anda akan muncul di sini
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Riwayat Transaksi
        </h3>
        <span className="text-sm text-text-secondary">
          {transactions.length} transaksi
        </span>
      </div>

      <div className="space-y-3">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-start gap-4 p-4 bg-surface/50 rounded-xl hover:bg-surface transition-colors"
          >
            {/* Icon */}
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-6 h-6 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-semibold text-text-primary truncate">
                  {transaction.product_name}
                </h4>
                {getStatusBadge(transaction.status)}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-text-secondary mb-2">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(transaction.created_at), 'dd MMM yyyy', { locale: id })}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-muted">Nilai Transaksi</p>
                  <p className="font-semibold text-text-primary">
                    Rp {transaction.nominal_transaksi.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted">Komisi Anda</p>
                  <p className="font-bold text-primary">
                    Rp {transaction.komisi.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
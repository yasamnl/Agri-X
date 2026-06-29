// src/components/affiliate/AffiliateBalance.tsx
'use client';

import { Wallet, ArrowUpRight, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AffiliateBalanceProps {
  balance: number;
  totalCommission: number;
  totalWithdrawn: number;
}

export function AffiliateBalance({
  balance,
  totalCommission,
  totalWithdrawn,
}: AffiliateBalanceProps) {
  const router = useRouter();

  return (
    <div className="bg-gradient-to-br from-primary to-secondary rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Saldo Tersedia</p>
              <p className="text-xs text-white/60">Dapat ditarik kapan saja</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/affiliate/withdrawal')}
            className="bg-white text-primary px-4 py-2 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all hover:shadow-lg active:scale-95"
          >
            <ArrowUpRight className="w-4 h-4 inline mr-1" />
            Tarik Saldo
          </button>
        </div>

        {/* Balance */}
        <div className="mb-6">
          <p className="text-4xl font-bold mb-1">
            Rp {balance.toLocaleString('id-ID')}
          </p>
          <p className="text-white/80 text-sm">
            ≈ {Math.floor(balance / 25000).toLocaleString('id-ID')} kg beras
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-white/80" />
              <p className="text-xs text-white/80">Total Komisi</p>
            </div>
            <p className="text-lg font-semibold">
              Rp {totalCommission.toLocaleString('id-ID')}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-white/80" />
              <p className="text-xs text-white/80">Sudah Ditarik</p>
            </div>
            <p className="text-lg font-semibold">
              Rp {totalWithdrawn.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
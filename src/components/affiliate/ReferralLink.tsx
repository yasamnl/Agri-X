// src/components/affiliate/ReferralLink.tsx
'use client';

import { useState } from 'react';
import { Copy, Check, Share2, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReferralLinkProps {
  referralCode: string;
  userId: number;
}

export function ReferralLink({ referralCode, userId }: ReferralLinkProps) {
  const [copied, setCopied] = useState(false);
  
  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/ref/${userId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link berhasil disalin!');
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Gagal menyalin link');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bergabung dengan Agri X',
          text: 'Dapatkan komisi menarik dengan bergabung menjadi affiliate Agri X!',
          url: referralLink,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Link2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-text-primary">Link Referral Anda</h3>
          <p className="text-sm text-text-secondary">Bagikan untuk mendapatkan komisi</p>
        </div>
      </div>

      {/* Link Display */}
      <div className="bg-surface rounded-xl p-4 mb-4 border border-border">
        <p className="text-sm text-text-primary font-mono break-all">
          {referralLink}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleCopy}
          className="btn-primary flex-1"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Tersalin!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Salin Link
            </>
          )}
        </button>
        <button
          onClick={handleShare}
          className="btn-outline flex-1"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Bagikan
        </button>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-primary/5 rounded-xl border border-primary/20">
        <p className="text-xs text-text-secondary">
          💡 <span className="font-semibold">Tips:</span> Setiap pembelian melalui link Anda akan memberikan komisi 5% dari nilai transaksi.
        </p>
      </div>
    </div>
  );
}
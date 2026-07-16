'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import toast from 'react-hot-toast';
import '../dashboard/dashboard_affiliate.css';

interface Transaction {
  id: number;
  product_name: string;
  nominal_transaksi: number;
  komisi: number;
  persen_komisi: number;
  status: string; // pending | completed | cancelled
  created_at: string;
}

interface Withdrawal {
  id: number;
  bank: string;
  no_rekening: string;
  nama_pemilik: string;
  nominal: number;
  status: string; // PENDING | COMPLETED | FAILED
  processed_at: string | null;
  created_at: string;
}

const TRANSAKSI_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Menunggu', cls: 'status-pending' },
  completed: { label: 'Sukses', cls: 'status-success' },
  cancelled: { label: 'Dibatalkan', cls: 'status-muted' },
};

const PENARIKAN_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Menunggu', cls: 'status-pending' },
  completed: { label: 'Berhasil', cls: 'status-success' },
  failed: { label: 'Gagal', cls: 'status-danger' },
};

function StatusBadge({ status, type }: { status: string; type: 'transaksi' | 'penarikan' }) {
  const key = status.toLowerCase();
  const map = type === 'transaksi' ? TRANSAKSI_STATUS : PENARIKAN_STATUS;
  const info = map[key] || { label: status, cls: 'status-muted' };
  return <span className={`riwayat-status ${info.cls}`}>{info.label}</span>;
}

export default function RiwayatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'transaksi' | 'penarikan'>(
    (searchParams.get('tab') as 'transaksi' | 'penarikan') || 'transaksi'
  );

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async (tab: 'transaksi' | 'penarikan') => {
    setLoading(true);
    try {
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const endpoint = tab === 'transaksi'
        ? '/api/affiliate/riwayat/transaksi'
        : '/api/affiliate/riwayat/penarikan';

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      if (tab === 'transaksi') {
        setTransactions(result.data);
      } else {
        setWithdrawals(result.data);
      }
    } catch (error: any) {
      toast.error(error.message || `Gagal memuat riwayat ${tab}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData(activeTab);
    }
  }, [activeTab, isAuthenticated]);

  const switchTab = (tab: 'transaksi' | 'penarikan') => {
    setActiveTab(tab);
    router.push(`/affiliate/riwayat?tab=${tab}`);
  };

  if (!isAuthenticated && !authLoading) {
    router.push('/login?callbackUrl=/affiliate/riwayat');
    return null;
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="page-wrap">
      <Link href="/affiliate/dashboard" className="riwayat-back-link">
        <ChevronLeft size={16} />
        Kembali ke Dashboard
      </Link>

      <div className="page-title">Riwayat</div>
      <div className="page-sub">Pantau riwayat transaksi dan penarikan komisi kamu</div>

      <div className="riwayat-tabs">
        <button
          className={`riwayat-tab ${activeTab === 'transaksi' ? 'active' : ''}`}
          onClick={() => switchTab('transaksi')}
        >
          Riwayat Transaksi
        </button>
        <button
          className={`riwayat-tab ${activeTab === 'penarikan' ? 'active' : ''}`}
          onClick={() => switchTab('penarikan')}
        >
          Riwayat Penarikan
        </button>
      </div>

      {authLoading || loading ? (
        <div className="riwayat-loading-wrap">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : activeTab === 'transaksi' ? (
        transactions.length === 0 ? (
          <div className="riwayat-empty">
            <div className="riwayat-empty-icon">🧾</div>
            Belum ada transaksi dari link referral kamu.
          </div>
        ) : (
          <div className="riwayat-table-card">
            <div className="riwayat-table-scroll">
              <table className="riwayat-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Tanggal</th>
                    <th>Produk</th>
                    <th>Komisi</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, idx) => (
                    <tr key={tx.id}>
                      <td className="col-no">{idx + 1}</td>
                      <td>{formatDate(tx.created_at)}</td>
                      <td className="col-produk">{tx.product_name}</td>
                      <td className="col-komisi">{formatRupiah(tx.komisi)}</td>
                      <td><StatusBadge status={tx.status} type="transaksi" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : withdrawals.length === 0 ? (
        <div className="riwayat-empty">
          <div className="riwayat-empty-icon">💸</div>
          Belum ada pengajuan penarikan komisi.
        </div>
      ) : (
        <div className="riwayat-table-card">
          <div className="riwayat-table-scroll">
            <table className="riwayat-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Tanggal</th>
                  <th>Bank / E-Wallet</th>
                  <th>No. Rekening</th>
                  <th>Nominal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((wd, idx) => (
                  <tr key={wd.id}>
                    <td className="col-no">{idx + 1}</td>
                    <td>{formatDate(wd.created_at)}</td>
                    <td>{wd.bank}</td>
                    <td>{wd.no_rekening}</td>
                    <td className="col-nominal">{formatRupiah(wd.nominal)}</td>
                    <td><StatusBadge status={wd.status} type="penarikan" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
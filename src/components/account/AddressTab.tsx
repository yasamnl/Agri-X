// src/components/account/AddressTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { MapPin, Plus, Home, Edit, Trash2, Loader2, Star, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCookie } from '@/lib/auth';

export function AddressTab() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      if (!token) return;

      const res = await fetch('/api/address', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAddresses(data.data?.addresses || data.addresses || []);
      }
    } catch (error) {
      console.error('Fetch addresses error:', error);
      toast.error('Gagal memuat alamat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (addressId: number) => {
    try {
      const token = getCookie('accessToken');
      if (!token) return;

      const res = await fetch(`/api/address/${addressId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isDefault: true, id: addressId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal mengubah alamat utama');
      }

      toast.success('Alamat utama berhasil diubah');
      fetchAddresses();
    } catch (error: any) {
      toast.error(error.message || 'Gagal mengubah alamat utama');
    }
  };

  const handleDelete = async (addressId: number) => {
    if (!confirm('Yakin ingin menghapus alamat ini?')) return;

    try {
      const token = getCookie('accessToken');
      if (!token) return;

      const res = await fetch(`/api/address/${addressId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus alamat');
      }

      toast.success('Alamat berhasil dihapus');
      fetchAddresses();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus alamat');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">Alamat Saya</h2>
        <button
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Tambah Alamat
        </button>
      </div>

      {showForm && (
        <div className="card bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary">
              {editingId ? 'Edit Alamat' : 'Tambah Alamat Baru'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-text-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-text-secondary">
            Form akan diimplementasi sesuai dengan endpoint Anda.
          </p>
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="card text-center py-16">
          <MapPin className="w-16 h-16 mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary font-medium">Belum ada alamat</p>
          <p className="text-sm text-text-muted mt-1">
            Tambahkan alamat untuk memudahkan checkout
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => {
            const isDefault = addr.is_default === true || addr.is_default === 1;
            return (
              <div key={addr.id} className="card relative">
                {isDefault && (
                  <div className="absolute -top-2 left-4 px-3 py-0.5 bg-primary text-white text-xs font-semibold rounded-full shadow-sm">
                    ⭐ Alamat Utama
                  </div>
                )}
                <div className="flex items-start justify-between pt-2">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <Home className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary">
                        {addr.label || addr.recipientName || 'Alamat'}
                      </p>
                      <p className="text-sm text-text-secondary mt-1">
                        {addr.receiver_name || addr.recipientName}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {addr.phone || addr.recipientPhone}
                      </p>
                      <p className="text-sm text-text-secondary mt-2 break-words">
                        {addr.address || addr.detail}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(addr.id);
                        setShowForm(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {!isDefault && (
                      <button
                        onClick={() => handleSetDefault(addr.id)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        title="Jadikan Utama"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(addr.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// src/components/seller/ProductDeleteModal.tsx
'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCookie } from '@/lib/auth';

interface Product {
  id: number;
  name: string;
}

interface ProductDeleteModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProductDeleteModal({
  isOpen,
  product,
  onClose,
  onSuccess,
}: ProductDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!product) return;

    setIsDeleting(true);
    try {
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const res = await fetch(`/api/seller/products/${product.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Gagal menghapus produk');

      toast.success('Produk berhasil dihapus');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menghapus produk');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl w-full max-w-md p-6">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>

        <h3 className="text-xl font-bold text-text-primary text-center mb-2">
          Hapus Produk?
        </h3>

        <p className="text-text-secondary text-center mb-4">
          Apakah Anda yakin ingin menghapus produk{' '}
          <strong className="text-text-primary">"{product.name}"</strong>?
          Tindakan ini tidak dapat dibatalkan.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="btn-outline flex-1"
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-3 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Hapus
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
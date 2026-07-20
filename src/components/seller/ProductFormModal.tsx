'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCookie } from '@/lib/auth';
import { ProductImageUpload } from './ProductImageUpload';

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  stock: number;
  minOrder: number;
  category: string | null;
  categoryId: number | null;
  status: string;
  harvestDate: string | null;
  imagePath: string | null;
  poQuota: number | null;
  weight: number;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

export function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductFormModalProps) {
  const isEditMode = !!product;

  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'kg',
    unitCustom: '',
    stock: '',
    minOrder: '1',
    category: '',
    categoryId: '',
    status: 'ready_stock',
    harvestDate: '',
    poQuota: '',
    weight: '',
  });

  // Reset form saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setForm({
          name: product.name || '',
          description: product.description || '',
          price: product.price?.toString() || '',
          unit: product.unit || 'kg',
          unitCustom: !['kg', 'gram', 'liter', 'pcs', 'ikat', 'sisir'].includes(product.unit) ? product.unit : '',
          stock: product.stock?.toString() || '',
          minOrder: product.minOrder?.toString() || '1',
          category: product.category || '',
          categoryId: product.categoryId?.toString() || '',
          status: product.status || 'ready_stock',
          harvestDate: product.harvestDate ? product.harvestDate.split('T')[0] : '',
          poQuota: product.poQuota?.toString() || '',
          weight: product.weight?.toString() || '',
        });
        setImageFile(null);
        setRemoveImage(false);
      } else {
        setForm({
          name: '',
          description: '',
          price: '',
          unit: 'kg',
          unitCustom: '',
          stock: '',
          minOrder: '1',
          category: '',
          categoryId: '',
          status: 'ready_stock',
          harvestDate: '',
          poQuota: '',
          weight: '',
        });
        setImageFile(null);
        setRemoveImage(false);
      }
    }
  }, [isOpen, product]);

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    setRemoveImage(false);
  };

  const handleRemoveImage = () => {
    setRemoveImage(true);
    setImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Nama produk wajib diisi');
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      toast.error('Harga harus lebih dari 0');
      return;
    }
    if (!form.unit) {
      toast.error('Satuan wajib diisi');
      return;
    }
    if (form.status === 'pre_order' && !form.harvestDate) {
      toast.error('Tanggal panen wajib diisi untuk pre-order');
      return;
    }

     // ✅ Validasi satuan kustom
    const finalUnit = form.unit === 'custom' ? form.unitCustom.trim() : form.unit;
    
    if (form.unit === 'custom' && !finalUnit) {
      toast.error('Satuan kustom wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const token = getCookie('accessToken');
      if (!token) throw new Error('Token tidak ditemukan');

      const formData = new FormData();
      formData.append('name', form.name.trim());
      formData.append('description', form.description.trim());
      formData.append('price', form.price);
      formData.append('unit', finalUnit);
      formData.append('stock', form.stock || '0');
      formData.append('minOrder', form.minOrder || '1');
      formData.append('category', form.category.trim());
      if (form.categoryId) formData.append('categoryId', form.categoryId);
      formData.append('status', form.status);
      if (form.harvestDate) formData.append('harvestDate', form.harvestDate);
      if (form.poQuota) formData.append('poQuota', form.poQuota);
      formData.append('weight', form.weight || '0');

      if (imageFile) {
        formData.append('image', imageFile);
      } else if (removeImage) {
        formData.append('removeImage', 'true');
      }

      const url = isEditMode
        ? `/api/seller/products/${product!.id}`
        : '/api/seller/products';

      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      let result: any = null;
      try {
        result = await res.json();
      } catch {
        result = null;
      }

      if (!res.ok || !result?.success) {
        throw new Error(result?.error || `Gagal menyimpan produk (${res.status})`);
      }

      toast.success(isEditMode ? 'Produk berhasil diupdate!' : 'Produk berhasil ditambahkan!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Save product error:', error);
      toast.error(error.message || 'Gagal menyimpan produk');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* ✅ FIX: Modal container dengan flex layout yang proper */}
      <div className="bg-background w-full max-w-200 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        
        {/* ✅ Header - Fixed di atas */}
        <div className="shrink-0 border-b border-border p-4 md:p-6 flex items-center justify-between bg-background">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {isEditMode ? 'Edit Produk' : 'Tambah Produk Baru'}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-surface rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ✅ Content - Scrollable area dengan padding yang benar */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">
            {/* Image Upload - ✅ Tambah margin-top agar tidak tertutup header */}
            <div className="pt-2">
              <label className="block text-sm font-medium text-text-primary mb-3">
                Gambar Produk
              </label>
              <ProductImageUpload
                value={removeImage ? null : product?.imagePath}
                onChange={handleImageChange}
                maxSizeMB={5}
                //maxHeight="h-48 md:h-64"
                disabled={isLoading}
              />
              {!removeImage && product?.imagePath && !imageFile && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={isLoading}
                  className="mt-2 text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  Hapus gambar saat ini
                </button>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                required
                disabled={isLoading}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Deskripsi
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="input"
                disabled={isLoading}
              />
            </div>

            {/* Price & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Harga <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="input"
                  min="0"
                  required
                  disabled={isLoading}
                />
              </div>
              {/* Unit / Satuan */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Satuan <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="input"
                  required
                  disabled={isLoading}
                >
                  <option value="kg">Kilogram (kg)</option>
                  <option value="gram">Gram (g)</option>
                  <option value="liter">Liter (L)</option>
                  <option value="pcs">Pcs</option>
                  <option value="ikat">Ikat</option>
                  <option value="sisir">Sisir</option>
                  <option value="ton">Ton</option>
                  <option value="kwintal">Kwintal</option>
                  <option value="karung">Karung</option>
                  <option value="box">Box</option>
                  <option value="custom">Lainnya (Input Manual)</option>
                </select>

                {/* ✅ Input Manual - Muncul hanya saat pilih "Lainnya" */}
                {form.unit === 'custom' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={form.unitCustom}
                      onChange={(e) => setForm({ ...form, unitCustom: e.target.value })}
                      placeholder="Masukkan satuan (contoh: keranjang, karung, dll)"
                      className="input"
                      disabled={isLoading}
                      maxLength={20}
                    />
                    <p className="text-xs text-text-secondary mt-1">
                      💡 Masukkan satuan yang sesuai dengan produk Anda
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Stock & Min Order */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Stok
                </label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="input"
                  min="0"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Min. Order
                </label>
                <input
                  type="number"
                  value={form.minOrder}
                  onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                  className="input"
                  min="1"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Status Produk
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input"
                disabled={isLoading}
              >
                <option value="ready_stock">Ready Stock</option>
                <option value="pre_order">Pre-Order</option>
                <option value="sold_out">Sold Out</option>
              </select>
            </div>

            {/* Harvest Date & PO Quota */}
            {form.status === 'pre_order' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Tanggal Panen <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.harvestDate}
                    onChange={(e) => setForm({ ...form, harvestDate: e.target.value })}
                    className="input"
                    min={new Date().toISOString().split('T')[0]}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Kuota PO
                  </label>
                  <input
                    type="number"
                    value={form.poQuota}
                    onChange={(e) => setForm({ ...form, poQuota: e.target.value })}
                    className="input"
                    min="0"
                    placeholder="Kosongkan jika unlimited"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Berat per Unit (gram)
              </label>
              <input
                type="number"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input"
                min="0"
                placeholder="Untuk perhitungan ongkir"
                disabled={isLoading}
              />
            </div>
          </form>
        </div>

        {/* ✅ Footer - Fixed di bawah */}
        <div className="shrink-0 border-t border-border p-4 md:p-6 bg-background">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-outline flex-1"
            >
              Batal
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEditMode ? 'Simpan Perubahan' : 'Tambah Produk'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// src/components/seller/ProductImageUpload.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { normalizeImageUrl } from '@/lib/image-helpers';

interface ProductImageUploadProps {
  value?: string | null;
  onChange: (file: File | null, preview: string | null) => void;
  maxSizeMB?: number;
  disabled?: boolean;
}

// ✅ Convert image to WebP di client-side
async function convertToWebP(
  file: File,
  quality: number = 0.85,
  maxWidth: number = 1200
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File harus berupa gambar'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not supported'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to convert to WebP'));
              return;
            }

            const webpFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
            const webpFile = new File([blob], webpFileName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            resolve(webpFile);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function ProductImageUpload({
  value,
  onChange,
  maxSizeMB = 5,
  disabled = false,
}: ProductImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Load existing image saat component mount
  useEffect(() => {
    if (value && !preview) {
      setPreview(normalizeImageUrl(value));
    }
  }, [value]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validasi type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Format tidak valid. Gunakan: JPG, PNG, atau WebP');
      return;
    }

    // Validasi size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Ukuran file terlalu besar. Maksimal ${maxSizeMB}MB`);
      return;
    }

    // Show preview original dulu
    const originalPreview = URL.createObjectURL(file);
    setPreview(originalPreview);

    // Convert ke WebP
    setIsConverting(true);
    try {
      const webpFile = await convertToWebP(file, 0.85, 1200);
      const webpPreview = URL.createObjectURL(webpFile);
      setPreview(webpPreview);
      URL.revokeObjectURL(originalPreview);
      onChange(webpFile, webpPreview);
    } catch (err: any) {
      setError(err.message || 'Gagal convert image');
      onChange(file, originalPreview);
    } finally {
      setIsConverting(false);
    }
  };

  const handleRemove = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setError(null);
    onChange(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-border bg-surface group">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />

          {isConverting && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">Optimasi WebP...</p>
              </div>
            </div>
          )}

          {!disabled && !isConverting && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              title="Hapus gambar"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {!isConverting && preview && (
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full font-semibold shadow">
              WebP ✓
            </div>
          )}
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            disabled
              ? 'border-border bg-surface/50 cursor-not-allowed'
              : 'border-primary/30 hover:border-primary hover:bg-primary/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            disabled={disabled || isConverting}
            className="hidden"
          />

          <div className="text-center p-4">
            {isConverting ? (
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-2" />
            ) : (
              <Upload className="w-12 h-12 text-text-muted mx-auto mb-2" />
            )}
            <p className="text-sm font-medium text-text-primary mb-1">
              {isConverting ? 'Mengoptimasi...' : 'Klik untuk upload'}
            </p>
            <p className="text-xs text-text-secondary">
              JPG, PNG, atau WebP (max {maxSizeMB}MB)
            </p>
            <p className="text-xs text-primary mt-2">
              ✨ Auto-convert ke WebP
            </p>
          </div>
        </label>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
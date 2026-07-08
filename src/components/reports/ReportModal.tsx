// src/components/reports/ReportModal.tsx
'use client';

import { useState } from 'react';
import { X, AlertTriangle, Loader2, Send, Info, CheckCircle } from 'lucide-react';
import { getCookie } from '@/lib/auth';
import toast from 'react-hot-toast';

// ✅ UPDATED: Interface dengan semua props yang diperlukan
interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedType: 'product' | 'forum_post' | 'user' | 'order' | 'review' | 'comment' | 'general';
  reportedId: number;
  reportedName?: string;
  prefillReason?: string;
  contextSnapshot?: any; // ✅ Data kontekstual
  onSuccess?: () => void;
}

const REASONS = [
  { value: 'spam', label: 'Spam', icon: '🚫', description: 'Konten berulang, iklan, atau tidak relevan' },
  { value: 'fraud', label: 'Penipuan', icon: '⚠️', description: 'Penipuan, produk palsu, atau informasi menyesatkan' },
  { value: 'inappropriate', label: 'Tidak Pantas', icon: '🔞', description: 'Konten tidak pantas, kasar, atau menyinggung' },
  { value: 'copyright', label: 'Pelanggaran Hak Cipta', icon: '©️', description: 'Pelanggaran hak cipta atau merek dagang' },
  { value: 'others', label: 'Lainnya', icon: '📝', description: 'Masalah lain yang tidak termasuk di atas' },
];

export function ReportModal({ 
  isOpen, 
  onClose, 
  reportedType,
  reportedId,
  reportedName,
  prefillReason,
  contextSnapshot,
  onSuccess 
}: ReportModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [reason, setReason] = useState(prefillReason || '');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setStep('form');
    setReason(prefillReason || '');
    setDescription('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // ✅ FIXED: handleSubmit dengan semua perbaikan
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ Validasi reason
    if (!reason) {
      toast.error('Pilih kategori laporan');
      return;
    }

    // ✅ Validasi description minimal 20 karakter
    if (!description.trim() || description.trim().length < 2) {
      toast.error('Deskripsi minimal 2 karakter');
      return;
    }

    // ✅ FIX: Dapatkan token dari cookie
    const token = getCookie('accessToken');
    if (!token) {
      toast.error('Silakan login terlebih dahulu');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // ✅ DEBUG LOG
      if (process.env.NODE_ENV === 'development') console.log('📤 [REPORT MODAL] Submitting:', {
        reportedType,
        reportedId,
        reason,
        description_length: description.length,
        has_context: !!contextSnapshot,
      });

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          reported_type: reportedType,
          reported_id: reportedId,
          reason,
          description: description.trim(),
          context_snapshot: contextSnapshot || null, // ✅ FIX: Kirim contextSnapshot
        }),
      });

      const result = await res.json();
      
      // ✅ DEBUG LOG
      if (process.env.NODE_ENV === 'development') console.log('📥 [REPORT MODAL] Response:', result);

      // ✅ Handle error response
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Gagal mengirim laporan');
      }

      // ✅ Success - tampilkan success state
      setStep('success');
      toast.success('Laporan berhasil dikirim');
      
      // ✅ Panggil onSuccess callback
      onSuccess?.();
      
    } catch (error: any) {
      console.error('❌ [REPORT MODAL] Error:', error);
      toast.error(error.message || 'Gagal mengirim laporan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl w-full max-w-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">
                {step === 'success' ? 'Laporan Terkirim' : 'Laporkan'}
              </h2>
              <p className="text-sm text-text-secondary">
                {step === 'success' 
                  ? 'Tim kami akan segera meninjau laporan Anda' 
                  : 'Laporkan masalah yang Anda alami'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Info Banner */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-text-secondary">
                  <p className="font-medium text-text-primary mb-1">Bagaimana cara kerja laporan?</p>
                  <p>
                    Tim admin kami akan meninjau laporan Anda dalam 1-2 hari kerja. 
                    Kami akan menghubungi Anda jika diperlukan informasi tambahan.
                  </p>
                </div>
              </div>
            </div>

            {/* Reported Item Info */}
            {reportedName && (
              <div className="bg-surface rounded-xl p-4 border border-border">
                <p className="text-xs text-text-secondary mb-1">Melaporkan:</p>
                <p className="font-medium text-text-primary">{reportedName}</p>
                {reportedId && (
                  <p className="text-xs text-text-secondary mt-1">ID: #{reportedId}</p>
                )}
              </div>
            )}

            {/* Reason Selection */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-3">
                Kategori Laporan <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {REASONS.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      reason === r.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={(e) => setReason(e.target.value)}
                      className="mt-1 w-4 h-4 text-primary"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{r.icon}</span>
                        <span className="font-medium text-text-primary">{r.label}</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">{r.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Deskripsi Masalah <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan masalah yang Anda alami secara detail"
                rows={5}
                className="input resize-none"
                maxLength={1000}
                required
                minLength={2}
              />
              <div className="flex items-center justify-between mt-1">
                <p className={`text-xs ${description.length < 2 ? 'text-text-secondary' : 'text-primary'}`}>
                  {description.length}/1000
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="btn-outline flex-1"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !reason || description.length < 5}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Kirim Laporan
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          // ✅ Success State
          <div className="p-6">
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Terima Kasih!
              </h3>
              <p className="text-text-secondary mb-6">
                Laporan Anda telah kami terima dan akan ditinjau oleh tim admin dalam 1-2 hari kerja.
              </p>

              <div className="bg-surface rounded-xl p-4 mb-6 text-left">
                <p className="text-sm font-medium text-text-primary mb-2">Ringkasan Laporan:</p>
                <div className="space-y-1 text-sm">
                  <p className="text-text-secondary">
                    <span className="font-medium">Kategori:</span> {REASONS.find(r => r.value === reason)?.label}
                  </p>
                  <p className="text-text-secondary">
                    <span className="font-medium">Deskripsi:</span> {description.slice(0, 100)}...
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="btn-outline flex-1"
                >
                  Tutup
                </button>
                <button
                  onClick={resetForm}
                  className="btn-primary flex-1"
                >
                  Kirim Laporan Lain
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
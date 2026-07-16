'use client';

import { useState, useEffect, useCallback , useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Truck, Receipt, CreditCard, Building,
  Wallet, Plus, Loader2, CheckCircle, AlertCircle, Edit2, Trash2, Check, X, Star  
} from 'lucide-react';
import PaymentModal from '@/components/payment/PaymentModal';

// Helper: Read cookie
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Payment Methods
const paymentMethods = [
  {
    id: 'bank_transfer',
    name: 'Transfer Bank (Midtrans)',
    icon: Building,
    type: 'midtrans',
    fee: 0,
    description: 'BCA, Mandiri, BRI, BNI via Virtual Account',
  },
  {
    id: 'cod',
    name: 'Cash on Delivery (COD)',
    icon: Wallet,
    type: 'cod',
    fee: 5000,
    description: 'Bayar tunai saat barang diterima',
  },
];

// Toast Types
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// ✅ HELPER: Find location item with type-flexible comparison
const findLocationItem = (items: any[], searchValue: string | number): any | undefined => {
  if (!searchValue) return undefined;
  const searchStr = String(searchValue).trim();
  
  return items.find(item => {
    if (!item?.id) return false;
    if (String(item.id) === searchStr) return true;
    if (item.code && String(item.code) === searchStr) return true;
    return false;
  });
};

// ✅ HELPER: Get code for API call
const getLocationCode = (item: any): string => {
  if (!item) return '';
  if (item.code && /^\d+$/.test(String(item.code))) {
    return String(item.code);
  }
  if (item.id && /^\d{10}$/.test(String(item.id))) {
    return String(item.id);
  }
  return String(item.id ?? '');
};

export default function CheckoutPage() {
  const router = useRouter();
  
  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Cart & Pricing State
  const [items, setItems] = useState<any[]>([]);
  const [totalWeight, setTotalWeight] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [paymentFee, setPaymentFee] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  
  // Address State
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedAddressData, setSelectedAddressData] = useState<any>(null);
  const [originVillageCode, setOriginVillageCode] = useState('');
  
  // Shipping State
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState('');
  
  // Payment State
  const [selectedPayment, setSelectedPayment] = useState('');
  
  // Loading & UI State
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [autoEstimating, setAutoEstimating] = useState(false);
  const [hasEstimated, setHasEstimated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [snapToken] = useState('');
  const [currentOrderId] = useState('');

  // Location State
  const [provinces, setProvinces] = useState<any[]>([]);
  const [regencies, setRegencies] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);

  // Address Form State
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState({
    detail: '',
    province: '', city: '', district: '',
    villageCode: '', villageName: '',
    zipCode: '',
    recipientName: '',
    recipientPhone: '',
  });

  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('');
  const [selectedRegencyId, setSelectedRegencyId] = useState<string>('');  
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');

  const [loadingAddAddress, setLoadingAddAddress] = useState(false);

  // Toast Functions
  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, message, type, duration };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showError = (message: string) => showToast(message, 'error');
  const showSuccess = (message: string) => showToast(message, 'success');

  // Load initial data
  useEffect(() => {
    loadCheckoutData();
  }, [router]);

  const loadCheckoutData = async () => {
    try {
      setError('');
      setLoading(true);

      const token = getCookie('accessToken');
      if (!token) {
        showError('Sesi tidak ditemukan. Silakan login kembali.');
        router.push('/login');
        return;
      }

      await loadAllLocations(token);
      await fetchAddresses();

      const cartRes = await fetch('/api/cart', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!cartRes.ok) throw new Error(`API Cart Error: ${cartRes.status}`);

      const cartData = await cartRes.json();
      if (!cartData.success) throw new Error(cartData.error || 'API Cart returned error');

      setItems(Array.isArray(cartData.formattedCartItems) ? cartData.formattedCartItems : []);
      setTotalWeight(cartData.totalWeight || 0);

      const calculatedTotal = (cartData.formattedCartItems || []).reduce((sum: number, item: any) => {
        return sum + ((item.product?.price || 0) * (item.quantity || 1));
      }, 0);
      setTotalPrice(calculatedTotal);

      if (Array.isArray(cartData.formattedCartItems) && cartData.formattedCartItems.length > 0) {
        const product = cartData.formattedCartItems[0].product;
        setOriginVillageCode(product?.originVillageCode ?? product?.origin_village_code ?? '');
      } else {
        setOriginVillageCode('');
        setTotalPrice(0);
      }

    } catch (err: any) {
      console.error('Error loading checkout:', err);
      showError(err.message || 'Gagal memuat data checkout');
      if (err.message?.includes('Unauthorized')) router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadAllLocations = async (token: string) => {
    try {
      const provRes = await fetch('/api/locations/provinces', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const provData = await provRes.json();
      if (provData.success) {
        setProvinces(provData.data || []);
      }
    } catch (err) {
      console.error('Error loading locations:', err);
      showError('Gagal memuat data lokasi');
    }
  };

  const fetchAddresses = async () => {
    try {
      const token = getCookie('accessToken');
      if (!token) return;

      const addrRes = await fetch('/api/address', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (addrRes.ok) {
        const addrData = await addrRes.json();
        if (addrData.success) {
          const addrList = Array.isArray(addrData.addresses) ? addrData.addresses : [];
          setAddresses(addrList);
          if (addrList.length > 0) {
            setSelectedAddressId(addrList[0].id);
            setSelectedAddressData(addrList[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
      showError('Gagal memuat alamat');
    }
  };

  const clearLocations = () => {
    setRegencies([]);
    setDistricts([]);
    setVillages([]);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const addrId = e.target.value;
    setSelectedAddressId(addrId ? Number(addrId) : null);
    const addr = addresses.find(a => String(a.id) === String(addrId));
    if (addr) setSelectedAddressData(addr);
  };

  const openAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      detail: '', province: '', city: '', district: '',
      villageCode: '', villageName: '', zipCode: '',
      recipientName: '', recipientPhone: '',
    });
    setSelectedProvinceId('');
    setSelectedRegencyId('');
    setSelectedDistrictId('');
    clearLocations();
    setShowAddressForm(true);
  };

  const openEditAddress = (address: any) => {
    setEditingAddressId(address.id);
    setAddressForm({
      detail: address.detail || '',
      province: address.province || '',
      city: address.city || '',
      district: address.district || '',
      villageCode: address.villageCode || '',
      villageName: address.villageName || '',
      zipCode: address.zipCode || '',
      recipientName: address.recipientName || '',
      recipientPhone: address.recipientPhone || '',
    });
    setShowAddressForm(true);
  };

  const handleSaveAddress = async () => {
    if (!addressForm.detail?.trim() || !addressForm.villageCode?.trim()) {
      showError('Lengkapi detail alamat dan pilih desa.');
      return;
    }
    if (!addressForm.province?.trim() || !addressForm.city?.trim() || !addressForm.district?.trim()) {
      showError('Lengkapi Provinsi, Kota, dan Kecamatan.');
      return;
    }
    if (!/^\d{10}$/.test(addressForm.villageCode)) {
      showError('Kode desa harus 10 digit angka');
      return;
    }

    setLoadingAddAddress(true);
    
    try {
      const token = getCookie('accessToken');
      const url = editingAddressId ? `/api/address/${editingAddressId}` : '/api/address';
      const method = editingAddressId ? 'PUT' : 'POST';
      
      const payload = {
        ...(editingAddressId && { id: editingAddressId }),
        province: addressForm.province.trim(),
        city: addressForm.city.trim(),
        district: addressForm.district.trim(),
        villageCode: addressForm.villageCode,
        villageName: addressForm.villageName.trim(),
        detail: addressForm.detail.trim(),
        zipCode: addressForm.zipCode.trim(),
        recipientName: addressForm.recipientName.trim(),
        recipientPhone: addressForm.recipientPhone.trim(),
        isDefault: editingAddressId === null,
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Gagal menyimpan alamat');
      }

      showSuccess(`Alamat berhasil ${editingAddressId ? 'diedit' : 'ditambahkan'}!`);
      setShowAddressForm(false);
      await fetchAddresses();
      
    } catch (error: any) {
      console.error('❌ [ERROR]', error);
      showError(error.message);
    } finally {
      setLoadingAddAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: number) => {
    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/address/${addressId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus alamat');
      }

      showSuccess('Alamat berhasil dihapus!');
      if (selectedAddressId === addressId) {
        setSelectedAddressId(null);
        setSelectedAddressData(null);
      }
      await fetchAddresses();
    } catch (error: any) {
      console.error('Delete address error:', error);
      showError(error.message || 'Gagal menghapus alamat');
    }
  };

  const handleSetDefaultAddress = async (addressId: number) => {
  try {
    const token = getCookie('accessToken');
    if (!token) {
      showError('Sesi tidak ditemukan');
      return;
    }

    const res = await fetch(`/api/address/${addressId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ isDefault: true }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Gagal mengubah alamat utama');
    }

    showSuccess('Alamat utama berhasil diubah!');
    
    // Refresh addresses dan update selected address
    await fetchAddresses();
    
    // Auto-select alamat yang baru dijadikan utama
    setSelectedAddressId(addressId);
    const updatedAddress = addresses.find(a => a.id === addressId);
    if (updatedAddress) {
      setSelectedAddressData(updatedAddress);
    }
    
  } catch (error: any) {
    console.error('Set default address error:', error);
    showError(error.message || 'Gagal mengubah alamat utama');
  }
};

  const handleEstimateShipping = async () => {
    if (!selectedAddressId || !selectedAddressData) {
      showError('Silakan pilih alamat terlebih dahulu.');
      return;
    }
    if (items.length === 0 || totalWeight <= 0) {
      showError('Keranjang kosong atau total berat tidak valid.');
      return;
    }
    if (!originVillageCode) {
      showError('Origin village code produk tidak ditemukan.');
      return;
    }
    if (!selectedAddressData.villageCode || selectedAddressData.villageCode.length !== 10) {
      showError('Alamat tidak memiliki kode desa yang valid untuk cek ongkir');
      return;
    }

    try {
      setError('');
      setEstimating(true);

      const token = getCookie('accessToken');
      if (!token) throw new Error('Sesi tidak ditemukan.');

      const res = await fetch('/api/rajaongkir/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          origin_village_code: originVillageCode,
          destination_village_code: selectedAddressData.villageCode,
          weight: totalWeight,
        })
      });

      if (!res.ok) throw new Error(`API Error: ${res.status}`);

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'API returned error');

      const formattedOptions = (data.formattedData || []).map((opt: any) => ({
        id: opt.service,
        name: opt.service,
        price: opt.value,
        etd: opt.etd,
      }));

      setCouriers(formattedOptions);
      
      if (formattedOptions.length > 0 && !selectedCourier) {
        setSelectedCourier(formattedOptions[0].id);
        setShippingCost(formattedOptions[0].price);
        updateGrandTotal(formattedOptions[0].price, paymentFee);
      }
      
      setHasEstimated(true);
      showSuccess('Opsi pengiriman berhasil dimuat!');

    } catch (err: any) {
      console.error('Error estimating shipping:', err);
      showError(err.message || 'Gagal menghitung ongkos kirim');
    } finally {
      setEstimating(false);
      setAutoEstimating(false);
    }
  };

  useEffect(() => {
    if (hasEstimated || estimating || autoEstimating || !selectedAddressId || !originVillageCode || totalWeight <= 0 || loading) return;
    const timer = setTimeout(() => {
      setAutoEstimating(true);
      handleEstimateShipping();
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedAddressId, originVillageCode, totalWeight, loading]);

  const handleShippingChange = (courierId: string, price: number) => {
    setSelectedCourier(courierId);
    setShippingCost(price);
    updateGrandTotal(price, paymentFee);
  };

  const handlePaymentChange = (paymentId: string) => {
    setSelectedPayment(paymentId);
    const method = paymentMethods.find(p => p.id === paymentId);
    const fee = method?.fee || 0;
    setPaymentFee(fee);
    updateGrandTotal(shippingCost, fee);
  };

  const updateGrandTotal = (shipping: number, fee: number) => {
    const total = (totalPrice || 0) + (shipping || 0) + (fee || 0);
    setGrandTotal(total);
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId || !selectedAddressData) {
      showError('Pilih alamat pengiriman terlebih dahulu.');
      return;
    }
    if (!selectedCourier) {
      showError('Pilih opsi pengiriman terlebih dahulu.');
      return;
    }
    if (!selectedPayment) {
      showError('Pilih metode pembayaran terlebih dahulu.');
      return; 
    }
    if (grandTotal <= 0) {
      showError('Total pembayaran tidak valid.');
      return;
    }

    try {
      setError('');
      setIsProcessing(true);

      const token = getCookie('accessToken');
      if (!token) throw new Error('Sesi tidak ditemukan.');

      const paymentMethod = paymentMethods.find(p => p.id === selectedPayment);

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          addressId: selectedAddressId,
          shippingCost: shippingCost,
          totalAmount: grandTotal,
          paymentMethod: paymentMethod?.type || 'cod',
          paymentGateway: selectedPayment,
          paymentFee: paymentFee,
          items: items.map((item: any) => ({
            productId: item.productId,
            price: item.product.price,
            quantity: item.quantity,
          })),
        })
      });

      const orderData = await orderRes.json();
      
      if (!orderRes.ok) throw new Error(orderData.error || 'Gagal membuat pesanan');

      const internalOrderId = orderData.orderId || orderData.data?.orderId || orderData.id;

      if (!internalOrderId) {
        throw new Error('Gagal mendapatkan ID Pesanan dari server');
      }

      if (paymentMethod?.id === 'bank_transfer') {
        showSuccess('Pesanan berhasil dibuat! Mengalihkan ke pembayaran...');
        setTimeout(() => router.push(`/orders/${internalOrderId}/pay`), 1000);
      } else {
        showSuccess('Pesanan COD berhasil dibuat!');
        setTimeout(() => router.push(`/orders/${internalOrderId}/cod`), 1000);
      }

    } catch (err: any) {
      console.error('Checkout failed:', err);
      showError(err.message || 'Gagal memproses pesanan');
      setIsProcessing(false);
    }
  };

  const handlePaymentModalClose = async (result?: any) => {
    setShowPaymentModal(false);
    if (result?.eventType === 'success') {
      showSuccess('Pembayaran berhasil! Terima kasih telah berbelanja.');
      router.push(`/orders/${currentOrderId}?payment=success`);
    } else if (result?.eventType === 'pending') {
      showSuccess('Menunggu konfirmasi pembayaran.');
      router.push(`/orders/${currentOrderId}?payment=pending`);
    } else if (result?.eventType === 'error') {
      showError('Pembayaran gagal. Silakan coba lagi.');
    } else {
      showToast('Pembayaran dibatalkan', 'warning');
      router.push(`/orders/${currentOrderId}`);
    }
  };

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provinceId = e.target.value;
    
    if (provinceId && !/^\d+$/.test(provinceId)) {
      showError('Kode provinsi tidak valid');
      return;
    }
    
    const province = findLocationItem(provinces, provinceId);
    const provinceName = province?.name || '';
    
    setAddressForm(prev => ({ 
      ...prev, 
      province: provinceName,
      city: '', district: '', villageCode: '', villageName: '',
    }));
    
    setSelectedProvinceId(provinceId);
    setSelectedRegencyId('');
    setSelectedDistrictId('');
    setRegencies([]); setDistricts([]); setVillages([]);
    
    if (provinceId) {
      try {
        const token = getCookie('accessToken');
        const res = await fetch(`/api/locations/regencies/${provinceId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
          setRegencies(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching regencies:', err);
        showError('Gagal memuat data kota/kabupaten');
      }
    }
  };

  const handleRegencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const regencyId = e.target.value;
    
    if (regencyId && !/^\d+$/.test(regencyId)) {
      showError('Kode kabupaten/kota tidak valid');
      return;
    }
    
    const regency = findLocationItem(regencies, regencyId);
    const regencyName = regency?.name || '';
    
    setAddressForm(prev => ({ 
      ...prev, 
      city: regencyName,
      district: '', villageCode: '', villageName: '',
    }));
    
    setSelectedRegencyId(regencyId);
    setSelectedDistrictId('');
    setDistricts([]); setVillages([]);
    
    if (regencyId) {
      try {
        const token = getCookie('accessToken');
        const res = await fetch(`/api/locations/districts/${regencyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
          setDistricts(data.data || []);
        }
      } catch (err: any) {
        console.error('Error fetching districts:', err);
        showError('Gagal memuat data kecamatan');
        setDistricts([]);
      }
    }
  };

  const handleDistrictChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const districtId = e.target.value;
    
    if (districtId && !/^\d+$/.test(districtId)) {
      showError('Kode kecamatan tidak valid');
      return;
    }
    
    const district = findLocationItem(districts, districtId);
    const districtName = district?.name || '';
    
    setAddressForm(prev => ({ 
      ...prev, 
      district: districtName,
      villageCode: '', villageName: '',
    }));
    
    setSelectedDistrictId(districtId);
    setVillages([]);
    
    if (districtId) {
      try {
        const token = getCookie('accessToken');
        const res = await fetch(`/api/locations/villages/${districtId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
          setVillages(data.data || []);
        }
      } catch (err: any) {
        console.error('Error fetching villages:', err);
        showError('Gagal memuat data desa');
        setVillages([]);
      }
    }
  };

  const handleVillageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    const village = findLocationItem(villages, selectedValue);

    if (village) {
      const villageCode = getLocationCode(village);
      
      if (!/^\d{10}$/.test(villageCode)) {
        if (process.env.NODE_ENV === 'development') console.warn('⚠️ Kode desa TIDAK 10 DIGIT!');
      }
      
      setAddressForm(prev => ({ 
        ...prev, 
        villageCode: villageCode,
        villageName: village.name,
      }));
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-text-primary">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Memuat checkout...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 relative">
      
      {/* TOAST CONTAINER */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              flex items-start gap-3 p-4 rounded-xl shadow-lg border animate-slide-in
              ${toast.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : toast.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
              }
            `}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5" />}
              {toast.type === 'info' && <AlertCircle className="w-5 h-5" />}
            </div>
            <div className="flex-1 text-sm">{toast.message}</div>
            <button onClick={() => removeToast(toast.id)} className="flex-shrink-0 p-1 hover:bg-black/5 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Back Button */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-text-secondary hover:text-primary mb-6 transition-colors">
        <ArrowLeft className="w-5 h-5" />
        <span>Kembali</span>
      </button>

      <h1 className="text-3xl font-bold text-text-primary mb-6">Checkout</h1>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Address Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold text-text-primary">Alamat Pengiriman</h2>
              </div>
              <button onClick={openAddAddress} className="btn-primary text-sm py-2 px-4">
                <Plus className="w-4 h-4 inline mr-1" /> Tambah Alamat
              </button>
            </div>

            {showAddressForm && (
              <div className="bg-surface rounded-xl p-4 mb-4 space-y-4 animate-fade-in">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-text-primary">{editingAddressId ? 'Edit Alamat' : 'Tambah Alamat Baru'}</h3>
                  <button onClick={() => setShowAddressForm(false)} className="text-text-secondary hover:text-primary">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              
                {/* Penerima */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Nama Penerima <span className="text-red-500">*</span></label>
                    <input type="text" value={addressForm.recipientName} onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })} placeholder="Nama lengkap" className="input" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">No. Telepon <span className="text-red-500">*</span></label>
                    <input type="tel" value={addressForm.recipientPhone} onChange={(e) => setAddressForm({ ...addressForm, recipientPhone: e.target.value })} placeholder="081234567890" className="input" required />
                  </div>
                </div>

                {/* Alamat Lengkap */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Alamat Lengkap <span className="text-red-500">*</span></label>
                  <textarea value={addressForm.detail} onChange={(e) => setAddressForm({ ...addressForm, detail: e.target.value })} placeholder="Jl. Nama Jalan No. 123" rows={3} className="input" required />
                </div>

                {/* PROVINSI */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Provinsi <span className="text-red-500">*</span></label>
                  <select 
                    value={selectedProvinceId} 
                    onChange={handleProvinceChange} 
                    className="input" 
                    required
                  >
                    <option value="">Pilih Provinsi</option>
                    {provinces.map((prov: any) => (
                      <option key={prov.id} value={prov.id}>{prov.name}</option>
                    ))}
                  </select>
                </div>

                {/* KOTA & KECAMATAN */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Kota/Kabupaten <span className="text-red-500">*</span></label>
                    <select 
                      value={selectedRegencyId} 
                      onChange={handleRegencyChange} 
                      className="input" 
                      disabled={!selectedProvinceId || regencies.length === 0}
                      required
                    >
                      <option value="">Pilih Kota</option>
                      {regencies.map((reg: any) => (
                        <option key={reg.id} value={reg.id}>{reg.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Kecamatan <span className="text-red-500">*</span></label>
                    <select 
                      value={selectedDistrictId} 
                      onChange={handleDistrictChange} 
                      className="input" 
                      disabled={!selectedRegencyId || districts.length === 0}
                    >
                      <option value="">Pilih Kecamatan</option>
                      {districts.map((dist: any) => (
                        <option key={dist.id} value={dist.id}>{dist.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* DESA */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Desa/Kelurahan <span className="text-red-500">*</span></label>
                    <select 
                      value={addressForm.villageCode ? (villages.find(v => getLocationCode(v) === addressForm.villageCode)?.id ?? '') : ''} 
                      onChange={handleVillageChange} 
                      className="input" 
                      disabled={!selectedDistrictId} 
                      required
                    >
                      <option value="">Pilih Desa</option>
                      {villages.map((village: any) => (
                        <option key={village.id} value={village.id}>{village.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Kode Pos <span className="text-red-500">*</span></label>
                    <input type="text" value={addressForm.zipCode} onChange={(e) => setAddressForm({ ...addressForm, zipCode: e.target.value })} placeholder="65111" className="input" required />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSaveAddress} className="btn-primary flex-1" disabled={loadingAddAddress}>
                    {loadingAddAddress ? <><Loader2 className="w-4 h-4 inline mr-1 animate-spin" />Menyimpan...</> : <><Check className="w-4 h-4 inline mr-1" />Simpan</>}
                  </button>
                  <button onClick={() => setShowAddressForm(false)} className="btn-outline flex-1" disabled={loadingAddAddress}>Batal</button>
                </div>
              </div>
            )}

            {/* Address List */}
            {addresses.length > 0 ? (
              <div className="space-y-3">
                {addresses.map((address: any) => {
                  const isSelected = selectedAddressId === address.id;
                  const isDefault = address.is_default === true || address.is_default === 1 || address.isDefault === true;
                  
                  return (
                    <div 
                      key={address.id} 
                      className={`relative border-2 rounded-xl p-4 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-primary bg-primary/5 shadow-md' 
                          : 'border-border hover:border-primary/50 hover:shadow-sm'
                      }`}
                      onClick={() => { 
                        setSelectedAddressId(address.id); 
                        setSelectedAddressData(address); 
                      }}
                    >
                      {/* Badge "Alamat Utama" */}
                      {isDefault && (
                        <div className="absolute -top-2 left-4 px-3 py-0.5 bg-primary text-white text-xs font-semibold rounded-full shadow-sm">
                          ⭐ Alamat Utama
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        {/* Radio Button */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 flex-shrink-0 transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary' 
                            : 'border-border'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>

                        {/* Address Content */}
                        <div className="flex-1 min-w-0">
                          {/* Recipient Name & Phone */}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-semibold text-text-primary">
                              {address.recipientName || 'Penerima'}
                            </p>
                            {address.recipientPhone && (
                              <span className="text-sm text-text-secondary">
                                • {address.recipientPhone}
                              </span>
                            )}
                          </div>

                          {/* Full Address */}
                          <p className="text-sm text-text-secondary leading-relaxed break-words">
                            {address.detail}
                          </p>
                          <p className="text-sm text-text-secondary mt-1">
                            {address.villageName && `${address.villageName}, `}
                            {address.district && `${address.district}, `}
                            {address.city && `${address.city}, `}
                            {address.province} {address.zipCode}
                          </p>
                        </div>

                        {/* Action Buttons - Rapi & Clean */}
                        <div 
                          className="flex flex-col gap-1 flex-shrink-0" 
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Edit Button */}
                          <button
                            onClick={() => openEditAddress(address)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Alamat"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Set as Default Button (hanya muncul jika bukan default) */}
                          {!isDefault && (
                            <button
                              onClick={() => handleSetDefaultAddress(address.id)}
                              className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                              title="Jadikan Alamat Utama"
                            >
                              <Star className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              if (confirm('Yakin ingin menghapus alamat ini?')) {
                                handleDeleteAddress(address.id);
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus Alamat"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-text-secondary">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="font-medium">Belum ada alamat tersimpan</p>
                <p className="text-sm mt-1">Tambahkan alamat untuk memulai checkout</p>
                <button onClick={openAddAddress} className="btn-primary mt-4">
                  <Plus className="w-4 h-4 inline mr-1" />
                  Tambah Alamat Pertama
                </button>
              </div>
            )}
          </div>

          {/* Shipping Card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-text-primary">Pilih Pengiriman</h2>
            </div>
            {(autoEstimating || estimating) && couriers.length === 0 && (
              <div className="flex items-center justify-center gap-3 py-6 text-text-secondary">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span>Menghitung ongkos kirim...</span>
              </div>
            )}
            {couriers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary mb-2">Pilih Layanan Pengiriman</h3>
                {couriers.map((courier: any) => (
                  <div 
                    key={courier.id} 
                    onClick={() => handleShippingChange(courier.id, courier.price)} 
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                      selectedCourier === courier.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-text-primary">{courier.name}</p>
                        <p className="text-sm text-text-secondary">Estimasi: {courier.etd}</p>
                      </div>
                      <p className="font-bold text-primary">{formatCurrency(courier.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(!selectedAddressId || totalWeight <= 0) && couriers.length === 0 && !estimating && !autoEstimating && (
              <p className="text-sm text-text-secondary text-center py-4">Pilih alamat untuk menghitung ongkos kirim</p>
            )}
          </div>

          {/* Payment Methods */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-text-primary">Metode Pembayaran</h2>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Virtual Account</h3>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.filter(p => p.type === 'midtrans').map((method) => {
                    const Icon = method.icon;
                    return (
                      <div 
                        key={method.id} 
                        onClick={() => handlePaymentChange(method.id)} 
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                          selectedPayment === method.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-6 h-6 text-primary" />
                          <div>
                            <p className="font-semibold text-text-primary text-sm">{method.name}</p>
                            <p className="text-xs text-text-secondary">{method.fee === 0 ? 'Gratis' : formatCurrency(method.fee)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Lainnya</h3>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.filter(p => p.type === 'cod').map((method) => {
                    const Icon = method.icon;
                    return (
                      <div 
                        key={method.id} 
                        onClick={() => handlePaymentChange(method.id)} 
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                          selectedPayment === method.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-6 h-6 text-primary" />
                          <div>
                            <p className="font-semibold text-text-primary text-sm">{method.name}</p>
                            <p className="text-xs text-text-secondary">{formatCurrency(method.fee)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {selectedPayment && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">⏰ <strong>Batas Pembayaran:</strong> 24 jam dari sekarang.</p>
                {paymentMethods.find(p => p.id === selectedPayment)?.type !== 'cod' && (
                  <p className="text-sm text-blue-800 mt-2">💡 Pembayaran akan dibuka di popup.</p>
                )}
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-text-primary">Ringkasan Pesanan</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-text-secondary">
                <span>Total Produk</span>
                <span className="font-medium text-text-primary">{formatCurrency(totalPrice || 0)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Ongkos Kirim</span>
                <span className="font-medium text-text-primary">{shippingCost > 0 ? formatCurrency(shippingCost) : '-'}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Biaya Pembayaran</span>
                <span className="font-medium text-text-primary">{paymentFee > 0 ? formatCurrency(paymentFee) : 'Gratis'}</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-lg font-bold text-text-primary">
                  <span>Total Bayar</span>
                  <span className="text-primary">{formatCurrency(grandTotal || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1">
          <div className="card sticky top-20">
            <h3 className="font-bold text-text-primary mb-4">Produk ({items.length})</h3>
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {items.map((item: any) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-16 h-16 bg-surface rounded-lg flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                    {item.product?.image_path ? (
                      <img src={item.product.image_path} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>🌾</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary text-sm line-clamp-1">{item.product?.name}</p>
                    <p className="text-xs text-text-secondary">{item.quantity} {item.product?.unit}</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency((item.product?.price || 0) * (item.quantity || 1))}</p>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={handlePlaceOrder} 
              disabled={isProcessing || !selectedCourier || !selectedAddressId || !selectedPayment} 
              className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>Memproses...</span></>
              ) : (
                `Buat Pesanan (${formatCurrency(grandTotal || 0)})`
              )}
            </button>
            {!selectedPayment && (
              <p className="text-xs text-red-600 text-center mt-2">⚠️ Pilih metode pembayaran</p>
            )}
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <PaymentModal 
          isOpen={showPaymentModal} 
          onClose={(result) => handlePaymentModalClose(result)} 
          snapToken={snapToken} 
          orderId={currentOrderId} 
        />
      )}
    </div>
  );
}
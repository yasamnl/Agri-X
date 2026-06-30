// src/lib/courier-api.ts
// Library untuk tracking resi menggunakan BinderByte API

export interface TrackingEvent {
  date: string;
  description: string;
  location: string;
}

export interface TrackingResult {
  trackingNumber: string;
  courier: string;
  status: string;
  history: TrackingEvent[];
  lastUpdate: string | null;
}

// ============================================
// Courier Code Mapping
// ============================================
const COURIER_MAP: Record<string, string> = {
  'jne': 'jne',
  'jnt': 'jnt',
  'j&t': 'jnt',
  'sicepat': 'sicepat',
  'si cepat': 'sicepat',
  'pos': 'pos',
  'pos indonesia': 'pos',
  'tiki': 'tiki',
  'anteraja': 'anteraja',
  'anter': 'anteraja',
  'wahana': 'wahana',
  'ninja': 'ninja',
  'ninja van': 'ninja',
  'lion': 'lion',
  'lion parcel': 'lion',
  'sap': 'sap',
  'rex': 'rex',
  'first': 'first',
  'first logistics': 'first',
};

// ============================================
// Tracking via BinderByte API
// ============================================
async function trackViaBinderByte(
  courier: string, 
  waybill: string
): Promise<TrackingResult> {
  const apiKey = process.env.BINDERBYTE_API_KEY;
  
  if (!apiKey) {
    throw new Error('BINDERBYTE_API_KEY tidak ditemukan di .env.local');
  }

  // Normalize courier code
  const normalizedCourier = COURIER_MAP[courier.toLowerCase()] || courier.toLowerCase();

  console.log('🔍 [TRACKING] Request:', {
    courier: courier,
    normalizedCourier: normalizedCourier,
    waybill: waybill,
  });

  // Validate waybill format (minimal 10 karakter)
  if (!waybill || waybill.trim().length < 10) {
    throw new Error('Nomor resi tidak valid (minimal 10 karakter)');
  }

  // Build URL
  const url = `https://api.binderbyte.com/v1/track?api_key=${apiKey}&courier=${normalizedCourier}&awb=${waybill}`;
  
  console.log('🌐 [TRACKING] Calling API:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  // Log response status
  console.log('📡 [TRACKING] Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [TRACKING] API error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    throw new Error(`BinderByte API error: ${response.status} - ${errorText}`);
  }

  const rawData = await response.json();

  console.log('📦 [TRACKING] Response data:', JSON.stringify(rawData, null, 2));

  // Check API response status
  if (rawData.status !== 200) {
    throw new Error(rawData.message || `Tracking failed with status ${rawData.status}`);
  }

  const data = rawData.data;

  if (!data) {
    throw new Error('No tracking data in response');
  }

  // Normalize history
  const history: TrackingEvent[] = [];
  if (Array.isArray(data.history)) {
    data.history.forEach((event: any) => {
      history.push({
        date: event.date || event.timestamp || '',
        description: event.desc || event.description || event.note || '',
        location: event.location || event.city || '',
      });
    });
  }

  // Get status from summary
  const status = data.summary?.status || 'Unknown';

  console.log('✅ [TRACKING] Success:', {
    trackingNumber: waybill,
    courier: normalizedCourier,
    status: status,
    historyCount: history.length,
  });

  return {
    trackingNumber: waybill,
    courier: normalizedCourier,
    status: status,
    history,
    lastUpdate: history.length > 0 ? history[0].date : null,
  };
}

// ============================================
// Main function with error handling
// ============================================
export async function trackShipment(
  courierCode: string, 
  waybill: string
): Promise<TrackingResult> {
  if (!waybill || waybill.trim() === '') {
    throw new Error('Nomor resi tidak boleh kosong');
  }

  if (!courierCode || courierCode.trim() === '') {
    throw new Error('Kode kurir tidak boleh kosong');
  }

  const courier = courierCode.toLowerCase().trim();
  const trimmedWaybill = waybill.trim();

  try {
    return await trackViaBinderByte(courier, trimmedWaybill);
  } catch (error: any) {
    console.error('❌ [TRACKING] Error:', error.message);
    
    // Provide more helpful error messages
    if (error.message.includes('400')) {
      throw new Error('Nomor resi atau kode kurir tidak valid. Pastikan format benar.');
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      throw new Error('API key tidak valid atau belum diset di .env.local');
    }
    if (error.message.includes('404')) {
      throw new Error('Nomor resi tidak ditemukan. Pastikan resi sudah aktif.');
    }
    if (error.message.includes('BINDERBYTE_API_KEY')) {
      throw new Error('Konfigurasi API key belum lengkap. Hubungi administrator.');
    }
    
    throw error;
  }
}

// ============================================
// Normalize status ke status order yang sudah ada
// ============================================
export function normalizeToOrderStatus(rawStatus: string): string | null {
  if (!rawStatus) return null;
  
  const status = rawStatus.toLowerCase();

  // Map ke status orders yang sudah ada
  if (status.includes('deliver') || status.includes('terkirim') || status.includes('terima')) {
    return 'delivered';
  }
  if (status.includes('transit') || status.includes('perjalanan') || status.includes('kirim') || status.includes('diantar')) {
    return 'shipped';
  }
  if (status.includes('process') || status.includes('proses') || status.includes('manifest')) {
    return 'processing';
  }

  return null; // Tidak perlu update
}

// ============================================
// Status label untuk display
// ============================================
export function getTrackingStatusLabel(status: string): string {
  if (!status) return 'Tidak Diketahui';
  
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('deliver') || statusLower.includes('terkirim')) {
    return 'Sudah Diterima';
  }
  if (statusLower.includes('transit') || statusLower.includes('diantar')) {
    return 'Dalam Perjalanan';
  }
  if (statusLower.includes('pickup') || statusLower.includes('manifest')) {
    return 'Sudah Diambil Kurir';
  }
  if (statusLower.includes('process')) {
    return 'Sedang Diproses';
  }
  
  return status;
}

// ============================================
// Get supported couriers
// ============================================
export function getSupportedCouriers(): string[] {
  return Object.keys(COURIER_MAP);
}
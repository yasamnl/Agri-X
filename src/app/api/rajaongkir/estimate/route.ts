// src/app/api/rajaongkir/estimate/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { origin_village_code, destination_village_code, weight } = body;

    if (process.env.NODE_ENV === 'development') console.log('🚚 [SHIPPING API] Request:', {
      origin_village_code,
      destination_village_code,
      weight,
    });

    // Validasi input
    if (!origin_village_code || !destination_village_code || !weight) {
      return NextResponse.json(
        { success: false, error: 'Data tidak lengkap. Origin, destination, dan weight wajib diisi.' },
        { status: 400 }
      );
    }

    if (weight <= 0) {
      return NextResponse.json(
        { success: false, error: 'Berat harus lebih dari 0 gram.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.API_CO_ID_KEY;
    if (!apiKey) {
      console.error('❌ [SHIPPING API] API Key Missing');
      return NextResponse.json(
        { success: false, error: 'Konfigurasi server salah (API Key hilang).' },
        { status: 500 }
      );
    }

    // Request ke API Eksternal
    const url = `https://use.api.co.id/expedition/shipping-cost?origin_village_code=${origin_village_code}&destination_village_code=${destination_village_code}&weight=${weight}`;
    
    if (process.env.NODE_ENV === 'development') console.log('🚚 [SHIPPING API] Calling external API...');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-co-id': apiKey,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ [SHIPPING API] External API Error:', response.status, errText);
      throw new Error(`External API Error: ${response.status} - ${errText}`);
    }

    const rawData = await response.json();
    
    // ✅ DEBUG: Log struktur asli response
    if (process.env.NODE_ENV === 'development') console.log('📦 [SHIPPING API] Raw Response Structure:', {
      is_success: rawData.is_success,
      hasData: !!rawData.data,
      dataType: typeof rawData.data,
      isArray: Array.isArray(rawData.data),
      hasCouriers: !!rawData.data?.couriers,
      couriersCount: rawData.data?.couriers?.length || 0,
    });

    // Validasi struktur response
    if (!rawData.is_success) {
      throw new Error(rawData.message || 'API returned error');
    }

    // ✅ Handle berbagai format response
    let couriers: any[] = [];
    
    if (rawData.data?.couriers && Array.isArray(rawData.data.couriers)) {
      // Format 1: { data: { couriers: [...] } }
      couriers = rawData.data.couriers;
    } else if (Array.isArray(rawData.data)) {
      // Format 2: { data: [...] }
      couriers = rawData.data;
    } else if (rawData.couriers && Array.isArray(rawData.couriers)) {
      // Format 3: { couriers: [...] }
      couriers = rawData.couriers;
    } else {
      console.error('❌ [SHIPPING API] Unexpected response structure:', rawData);
      throw new Error('Format response API tidak dikenali.');
    }

    if (couriers.length === 0) {
      return NextResponse.json({
        success: true,
        formattedData: [],
        message: 'Tidak ada opsi pengiriman tersedia untuk rute ini.',
      });
    }

    // ✅ DEBUG: Log item pertama untuk analisis struktur
    if (couriers.length > 0) {
      if (process.env.NODE_ENV === 'development') console.log('🔍 [SHIPPING API] First courier sample:', JSON.stringify(couriers[0], null, 2));
    }

    // ✅ Format ulang dengan normalisasi harga
    const formattedData = couriers.map((item: any, index: number) => {
      // ✅ Ambil price dari berbagai kemungkinan field
      let rawPrice = item.price || item.cost || item.value || item.amount || 0;
      
      // ✅ Convert ke number
      let price = Number(rawPrice);
      
      // ✅ DEBUG: Log price sebelum normalisasi
      if (index === 0) {
        if (process.env.NODE_ENV === 'development') console.log('💰 [SHIPPING API] Price analysis:', {
          rawPrice,
          rawPriceType: typeof rawPrice,
          parsedPrice: price,
          isNaN: isNaN(price),
        });
      }
      
      // ✅ Handle NaN
      if (isNaN(price)) {
        if (process.env.NODE_ENV === 'development') console.warn('⚠️ [SHIPPING API] Invalid price, using 0:', rawPrice);
        price = 0;
      }
      
      // ✅ NORMALISASI HARGA
      // Jika price > 1.000.000 (1 juta), kemungkinan salah format
      // Ongkir normal di Indonesia: Rp 5.000 - Rp 500.000
      // Jika dapat Rp 45.000.000, berarti ada faktor 1000x
      if (price > 1000000) {
        if (process.env.NODE_ENV === 'development') console.warn('⚠️ [SHIPPING API] Abnormal price detected:', price, '→ Normalizing...');
        
        // Cek apakah ini hasil dari string "45000" yang somehow jadi 45000000
        // Atau memang API return dalam satuan berbeda
        
        // Coba bagi 1000 (jika API return dalam satuan "per gram" atau similar)
        const normalizedPrice = price / 1000;
        
        // Validasi: jika hasil bagi masuk akal (5000 - 500000), gunakan
        if (normalizedPrice >= 5000 && normalizedPrice <= 500000) {
          if (process.env.NODE_ENV === 'development') console.log('✅ [SHIPPING API] Price normalized:', price, '→', normalizedPrice);
          price = normalizedPrice;
        } else {
          if (process.env.NODE_ENV === 'development') console.warn('⚠️ [SHIPPING API] Normalized price still abnormal:', normalizedPrice);
          // Tetap gunakan price asli, tapi log warning
        }
      }
      
      // ✅ Round ke integer (tidak ada desimal untuk Rupiah)
      price = Math.round(price);
      
      // ✅ Ambil field lainnya dengan fallback
      const courierCode = item.courier_code || item.code || item.courier || 'unknown';
      const courierName = item.courier_name || item.service || item.name || 'Layanan Tidak Dikenal';
      const estimation = item.estimation || item.etd || item.delivery_time || '-';
      
      return {
        code: courierCode,
        service: courierName,
        value: price, // ✅ Sudah dinormalisasi ke Rupiah
        etd: estimation,
        description: `${courierName} (${estimation})`,
      };
    });

    // ✅ DEBUG: Log hasil akhir
    if (process.env.NODE_ENV === 'development') console.log('✅ [SHIPPING API] Formatted data:', formattedData);

    return NextResponse.json({
      success: true,
      formattedData,
      meta: {
        origin: origin_village_code,
        destination: destination_village_code,
        weight,
        totalOptions: formattedData.length,
      },
    });

  } catch (error: any) {
    console.error('❌ [SHIPPING API] Error:', error);
    
    // Handle specific errors
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      return NextResponse.json(
        { success: false, error: 'Tidak dapat terhubung ke server ongkir. Silakan coba lagi.' },
        { status: 503 }
      );
    }
    
    if (error.message?.includes('timeout')) {
      return NextResponse.json(
        { success: false, error: 'Request timeout. Silakan coba lagi.' },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghitung ongkos kirim' },
      { status: 500 }
    );
  }
}
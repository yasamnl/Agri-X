// src/app/api/affiliate/record-transaction/route.ts
//
// SEMENTARA (testing): mencatat transaksi + komisi affiliate langsung saat
// tombol "Beli Sekarang" diklik di halaman produk — bukan saat order/checkout
// beneran selesai dibuat. Endpoint /api/orders juga masih mencatat komisi
// sendiri (lihat lib/affiliate.ts -> createAffiliateTransaction), jadi untuk
// sementara satu pembelian bisa tercatat dua kali (dari sini + dari orders).

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { getAffiliateByCode, calculateCommission } from '@/lib/affiliate';

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;

    // 2. Parse body
    const body = await req.json();
    const { productId, quantity, referralCode } = body;

    if (!productId || !referralCode) {
      return NextResponse.json(
        { success: false, error: 'productId dan referralCode wajib diisi' },
        { status: 400 }
      );
    }

    // 3. Resolusi affiliate — `ref` biasanya berisi affiliate_application_id (angka),
    //    sama seperti cara track-click/route.ts bekerja. Fallback ke referral_code
    //    kalau bukan angka (untuk jaga-jaga jika suatu saat dipakai kode custom).
    let affiliate: any = null;
    const numericId = parseInt(referralCode, 10);
    if (!Number.isNaN(numericId)) {
      const [rows] = await pool.query(
        `SELECT * FROM affiliate_applications WHERE id = ? AND status = 'approved' LIMIT 1`,
        [numericId]
      );
      affiliate = (rows as any[])[0] || null;
    }
    if (!affiliate) {
      affiliate = await getAffiliateByCode(referralCode);
    }

    if (!affiliate) {
      // Kode tidak valid — jangan gagalkan tombol beli, cukup lewati pencatatan
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Kode referral tidak valid, pencatatan dilewati',
      });
    }

    // 4. Cegah self-referral
    if (affiliate.user_id === userId) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Self-referral, pencatatan dilewati',
      });
    }

    // 5. Ambil data produk dari tabel products
    const [productRows] = await pool.query(
      `SELECT id, name, price FROM products WHERE id = ?`,
      [productId]
    );
    const product = (productRows as any[])[0];
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      );
    }

    // 6. Hitung nominal & komisi
    const qty = Number(quantity) || 1;
    const nominalTransaksi = Number(product.price) * qty;
    const commissionRate = Number(affiliate.commission_rate) || 5.0;
    const komisi = calculateCommission(nominalTransaksi, commissionRate);

    // 7. Insert langsung dengan status 'sukses' (testing)
    const [result] = await pool.query(
      `INSERT INTO referral_transactions 
       (affiliate_application_id, product_id, product_name, 
        nominal_transaksi, komisi, persen_komisi, 
        status, catatan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'sukses', ?, NOW(), NOW())`,
      [
        affiliate.id,
        product.id,
        product.name,
        nominalTransaksi,
        komisi,
        commissionRate,
        'Klik Beli Sekarang (testing)',
      ]
    );

    console.log(
      `✅ [AFFILIATE] Komisi dicatat saat klik Beli Sekarang: affiliate=${affiliate.id}, produk=${product.name}, komisi=${komisi}`
    );

    return NextResponse.json({
      success: true,
      data: {
        transactionId: (result as any).insertId,
        komisi,
      },
    });
  } catch (error: any) {
    console.error('❌ Record transaction error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
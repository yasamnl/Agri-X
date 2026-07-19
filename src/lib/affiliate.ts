// src/lib/affiliate.ts
import pool from "@/lib/db";

//  Interface untuk statistik afiliasi
//  Menyimpan data ringkasan performa afiliasi
export interface AffiliateStats {
  totalClicks: number; // Total klik referral
  totalTransactions: number; // Total transaksi yang berhasil
  totalCommission: number; // Total komisi yang diperoleh
  availableBalance: number; // Saldo yang dapat ditarik
  withdrawnAmount: number; // Jumlah yang sudah ditarik
  commissionRate: number; // Persentase komisi (dalam %)
  referralCode: string; // Kode referral unik
}

// Interface untuk transaksi afiliasi
// Detail setiap transaksi yang terjadi melalui referral
export interface AffiliateTransaction {
  id: number;
  orderId: number;
  productName: string;
  nominalTransaksi: number;
  komisi: number;
  persenKomisi: number;
  status: "pending" | "completed" | "cancelled" | "refunded";
  createdAt: string;
  completedAt: string | null;
}

// HELPER FUNCTIONS

//  Mendapatkan data afiliasi berdasarkan ID user
export async function getAffiliateByUserId(userId: string | number) {
  const [rows] = await pool.query(
    `SELECT * FROM affiliate_applications 
     WHERE user_id = ? AND status = 'approved' 
     LIMIT 1`,
    [userId]
  );

  return (rows as any[])[0] || null;
}

//  * Mendapatkan data afiliasi berdasarkan kode referral
export async function getAffiliateByCode(referralCode: string) {
  const [rows] = await pool.query(
    `SELECT * FROM affiliate_applications 
     WHERE referral_code = ? AND status = 'approved' 
     LIMIT 1`,
    [referralCode]
  );

  return (rows as any[])[0] || null;
}

//  * Mencatat klik referral ke database
//  * Fungsi ini akan menambahkan record klik baru dan mengupdate total klik afiliasi
export async function trackReferralClick(
  affiliateApplicationId: number,
  ipAddress: string,
  userAgent: string
) {
  try {
    // Insert click
    await pool.query(
      `INSERT INTO refferal_clicks 
       (affiliate_application_id, ip_address, user_agent, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [affiliateApplicationId, ipAddress, userAgent]
    );

    // Update total clicks
    await pool.query(
      `UPDATE affiliate_applications 
       SET total_clicks = total_clicks + 1, updated_at = NOW()
       WHERE id = ?`,
      [affiliateApplicationId]
    );

    return { success: true };
  } catch (error: any) {
    console.error("Track click error:", error);
    return { success: false, error: error.message };
  }
}

// Menghitung komisi berdasarkan nominal transaksi dan rate komisi
export function calculateCommission(
  amount: number,
  commissionRate: number = 5.0
): number {
  return Math.round((amount * commissionRate) / 100);
}

//  Membuat transaksi afiliasi baru
//  Dicatat ke tabel `referral_transactions` (bukan `affiliate_transactions`, tabel itu tidak dipakai lagi)
export async function createAffiliateTransaction(params: {
  affiliateApplicationId: number;
  orderId: number;
  userId: number;
  productId?: number;
  productName: string;
  nominalTransaksi: number;
  commissionRate: number;
}) {
  try {
    const komisi = calculateCommission(
      params.nominalTransaksi,
      params.commissionRate
    );

    const [result] = await pool.query(
      `INSERT INTO referral_transactions 
       (affiliate_application_id, product_id, product_name, 
        nominal_transaksi, komisi, persen_komisi, 
        status, catatan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'sukses', ?, NOW(), NOW())`,
      [
        params.affiliateApplicationId,
        params.productId || null,
        params.productName,
        params.nominalTransaksi,
        komisi,
        params.commissionRate,
        `Order #${params.orderId}`,
      ]
    );

    return {
      success: true,
      transactionId: (result as any).insertId,
      komisi,
    };
  } catch (error: any) {
    console.error("Create transaction error:", error);
    return { success: false, error: error.message };
  }
}

// Menyelesaikan transaksi afiliasi setelah pembayaran berhasil
// Menggunakan transaction database untuk memastikan konsistensi data
export async function completeAffiliateTransaction(orderId: number) {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get transaction
    const [transactions] = await connection.query(
      `SELECT rt.* 
       FROM referral_transactions rt
       WHERE rt.catatan = ? AND rt.status = 'pending'`,
      [`Order #${orderId}`]
    );

    const transaction = (transactions as any[])[0];
    if (!transaction) {
      await connection.rollback();
      return { success: false, error: "Transaction not found" };
    }

    // Update transaction status
    await connection.query(
      `UPDATE referral_transactions 
       SET status = 'sukses', updated_at = NOW()
       WHERE id = ?`,
      [transaction.id]
    );

    await connection.commit();
    return { success: true, komisi: transaction.komisi };
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error("Complete transaction error:", error);
    return { success: false, error: error.message };
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Membatalkan transaksi afiliasi
 * Mengubah status transaksi pending menjadi cancelled
 *
 * @param orderId - ID order yang akan dibatalkan
 * @returns Object berisi status sukses atau error
 */
export async function cancelAffiliateTransaction(orderId: number) {
  try {
    await pool.query(
      `UPDATE referral_transactions 
       SET status = 'cancelled', updated_at = NOW()
       WHERE catatan = ? AND status = 'pending'`,
      [`Order #${orderId}`]
    );

    return { success: true };
  } catch (error: any) {
    console.error("Cancel transaction error:", error);
    return { success: false, error: error.message };
  }
}

// Mendapatkan daftar transaksi afiliasi dengan pagination dan filter status
export async function getAffiliateTransactions(
  affiliateApplicationId: number,
  page: number = 1,
  limit: number = 10,
  status?: string
) {
  let whereClause = "WHERE rt.affiliate_application_id = ?";
  const params: any[] = [affiliateApplicationId];

  if (status && status !== "all") {
    whereClause += " AND rt.status = ?";
    params.push(status);
  }

  const offset = (page - 1) * limit;

  const [transactions] = await pool.query(
    `SELECT 
      rt.id,
      rt.product_id,
      rt.product_name,
      rt.nominal_transaksi,
      rt.komisi,
      rt.persen_komisi,
      rt.status,
      rt.catatan,
      rt.created_at,
      rt.updated_at
     FROM referral_transactions rt
     ${whereClause}
     ORDER BY rt.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Count total
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total 
     FROM referral_transactions rt
     ${whereClause}`,
    params
  );

  const total = Number((countResult as any[])[0]?.total || 0);

  return {
    transactions: (transactions as any[]).map((t: any) => ({
      id: Number(t.id),
      productId: t.product_id ? Number(t.product_id) : null,
      productName: t.product_name,
      nominalTransaksi: Number(t.nominal_transaksi),
      komisi: Number(t.komisi),
      persenKomisi: Number(t.persen_komisi),
      status: t.status,
      catatan: t.catatan,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Membuat link referral lengkap dengan kode referral
export function generateReferralLink(
  referralCode: string,
  baseUrl: string
): string {
  return `${baseUrl}?ref=${referralCode}`;
}

// Membuat teks share untuk media sosial/messaging
export function generateShareText(
  referralCode: string,
  baseUrl: string
): string {
  const link = generateReferralLink(referralCode, baseUrl);
  return `🛒 Belanja produk pertanian segar di Agri-X!\n\nGunakan kode referral saya: ${referralCode}\n\n${link}\n\nDapatkan diskon spesial! 🎉`;
}

//  * Membuat link produk dengan parameter referral
export const getProductLink = (
  productId: number,
  affiliateId?: number,
  platform?: string
) => {
  let url = `/produk/${productId}`;

  if (affiliateId) {
    url += `?ref=${affiliateId}`;
    // Tambahkan platform jika ada (opsional)
    if (platform) {
      url += `&platform=${platform}`;
    }
  }

  return url;
};

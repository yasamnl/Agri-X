// src/lib/affiliate.ts
import pool from '@/lib/db';

// ============================================
// TYPES
// ============================================
export interface AffiliateStats {
  totalClicks: number;
  totalTransactions: number;
  totalCommission: number;
  availableBalance: number;
  withdrawnAmount: number;
  commissionRate: number;
  referralCode: string;
}

export interface AffiliateTransaction {
  id: number;
  orderId: number;
  productName: string;
  nominalTransaksi: number;
  komisi: number;
  persenKomisi: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  createdAt: string;
  completedAt: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get affiliate application by user ID
 */
export async function getAffiliateByUserId(userId: string | number) {
  const [rows] = await pool.query(
    `SELECT * FROM affiliate_applications 
     WHERE user_id = ? AND status = 'approved' 
     LIMIT 1`,
    [userId]
  );
  
  return (rows as any[])[0] || null;
}

/**
 * Get affiliate by referral code
 */
export async function getAffiliateByCode(referralCode: string) {
  const [rows] = await pool.query(
    `SELECT * FROM affiliate_applications 
     WHERE referral_code = ? AND status = 'approved' 
     LIMIT 1`,
    [referralCode]
  );
  
  return (rows as any[])[0] || null;
}

/**
 * Track referral click
 */
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
    console.error('Track click error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate commission
 */
export function calculateCommission(
  amount: number,
  commissionRate: number = 5.00
): number {
  return Math.round((amount * commissionRate) / 100);
}

/**
 * Create affiliate transaction
 */
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
      `INSERT INTO affiliate_transactions 
       (affiliate_application_id, order_id, user_id, product_id, 
        product_name, nominal_transaksi, persen_komisi, komisi, 
        status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        params.affiliateApplicationId,
        params.orderId,
        params.userId,
        params.productId || null,
        params.productName,
        params.nominalTransaksi,
        params.commissionRate,
        komisi,
      ]
    );

    return { 
      success: true, 
      transactionId: (result as any).insertId,
      komisi 
    };
  } catch (error: any) {
    console.error('Create transaction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete affiliate transaction (after payment success)
 */
export async function completeAffiliateTransaction(orderId: number) {
  let connection;
  
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get transaction
    const [transactions] = await connection.query(
      `SELECT at.*, aa.commission_rate 
       FROM affiliate_transactions at
       JOIN affiliate_applications aa ON at.affiliate_application_id = aa.id
       WHERE at.order_id = ? AND at.status = 'pending'`,
      [orderId]
    );

    const transaction = (transactions as any[])[0];
    if (!transaction) {
      await connection.rollback();
      return { success: false, error: 'Transaction not found' };
    }

    // Update transaction status
    await connection.query(
      `UPDATE affiliate_transactions 
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [transaction.id]
    );

    // Update affiliate stats
    await connection.query(
      `UPDATE affiliate_applications 
       SET total_transactions = total_transactions + 1,
           total_commission = total_commission + ?,
           available_balance = available_balance + ?,
           updated_at = NOW()
       WHERE id = ?`,
      [transaction.komisi, transaction.komisi, transaction.affiliate_application_id]
    );

    await connection.commit();
    return { success: true, komisi: transaction.komisi };
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Complete transaction error:', error);
    return { success: false, error: error.message };
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Cancel affiliate transaction
 */
export async function cancelAffiliateTransaction(orderId: number) {
  try {
    await pool.query(
      `UPDATE affiliate_transactions 
       SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE order_id = ? AND status = 'pending'`,
      [orderId]
    );

    return { success: true };
  } catch (error: any) {
    console.error('Cancel transaction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get affiliate dashboard stats
 */
export async function getAffiliateDashboardStats(affiliateApplicationId: number) {
  const [rows] = await pool.query(
    `SELECT 
      total_clicks,
      total_transactions,
      total_commission,
      available_balance,
      withdrawn_amount,
      commission_rate,
      referral_code
     FROM affiliate_applications 
     WHERE id = ?`,
    [affiliateApplicationId]
  );

  const stats = (rows as any[])[0];
  if (!stats) return null;

  return {
    totalClicks: Number(stats.total_clicks || 0),
    totalTransactions: Number(stats.total_transactions || 0),
    totalCommission: Number(stats.total_commission || 0),
    availableBalance: Number(stats.available_balance || 0),
    withdrawnAmount: Number(stats.withdrawn_amount || 0),
    commissionRate: Number(stats.commission_rate || 5),
    referralCode: stats.referral_code,
  };
}

/**
 * Get affiliate transactions list
 */
export async function getAffiliateTransactions(
  affiliateApplicationId: number,
  page: number = 1,
  limit: number = 10,
  status?: string
) {
  let whereClause = 'WHERE at.affiliate_application_id = ?';
  const params: any[] = [affiliateApplicationId];

  if (status && status !== 'all') {
    whereClause += ' AND at.status = ?';
    params.push(status);
  }

  const offset = (page - 1) * limit;

  const [transactions] = await pool.query(
    `SELECT 
      at.id,
      at.order_id,
      at.product_name,
      at.nominal_transaksi,
      at.komisi,
      at.persen_komisi,
      at.status,
      at.created_at,
      at.completed_at
     FROM affiliate_transactions at
     LEFT JOIN orders o ON at.order_id = o.id
     ${whereClause}
     ORDER BY at.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Count total
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total 
     FROM affiliate_transactions at
     ${whereClause}`,
    params
  );

  const total = Number((countResult as any[])[0]?.total || 0);

  return {
    transactions: (transactions as any[]).map((t: any) => ({
      id: Number(t.id),
      orderId: Number(t.order_id),
      orderNumber: t.order_number,
      productName: t.product_name,
      nominalTransaksi: Number(t.nominal_transaksi),
      komisi: Number(t.komisi),
      persenKomisi: Number(t.persen_komisi),
      status: t.status,
      createdAt: t.created_at,
      completedAt: t.completed_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Generate referral link
 */
export function generateReferralLink(referralCode: string, baseUrl: string): string {
  return `${baseUrl}?ref=${referralCode}`;
}

/**
 * Generate share text
 */
export function generateShareText(referralCode: string, baseUrl: string): string {
  const link = generateReferralLink(referralCode, baseUrl);
  return `🛒 Belanja produk pertanian segar di Agri-X!\n\nGunakan kode referral saya: ${referralCode}\n\n${link}\n\nDapatkan diskon spesial! 🎉`;
}
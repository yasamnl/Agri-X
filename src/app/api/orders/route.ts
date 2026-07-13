// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { snap } from '@/lib/midtrans';
import { calculateCommission, createAffiliateTransaction, getAffiliateByCode } from '@/lib/affiliate';

// ============================================================================
// GET: List orders untuk buyer (user yang login)
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    // 1. AUTH CHECK
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decoded.sub;

    // 2. PARSE QUERY PARAMS
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10'), 1), 50);
    const offset = (page - 1) * limit;

    // 3. BUILD STATUS FILTER
    let statusFilter = '';
    const params: any[] = [userId];

    if (status !== 'all') {
      statusFilter = ' AND o.status = ?';
      params.push(status);
    }

    // 4. FETCH ORDERS
    const [orders] = await pool.query(
      `SELECT 
        o.id,
        o.user_id,
        o.address_id,
        o.transaction_id,
        o.status,
        o.payment_status,
        o.payment_method,
        o.payment_gateway,
        o.payment_url,
        o.payment_deadline,
        o.total_product_price,
        o.shipping_cost,
        o.payment_fee,
        o.grand_total,
        o.is_pre_order,
        o.estimated_ship_date,
        o.po_status,
        o.created_at,
        o.updated_at,
        a.recipient_name,
        a.recipient_phone,
        a.detail as address_detail,
        a.province,
        a.city,
        a.district,
        a.village,
        a.zip_code
      FROM orders o
      LEFT JOIN address a ON o.address_id = a.id
      WHERE o.user_id = ? ${statusFilter}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // 5. COUNT TOTAL
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM orders o WHERE o.user_id = ? ${statusFilter}`,
      params
    );
    const total = Number((countResult as any[])[0]?.total || 0);

    // 6. STATUS COUNTS (untuk filter tabs)
    const [statusCounts] = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM orders 
       WHERE user_id = ? 
       GROUP BY status`,
      [userId]
    );

    const countMap: Record<string, number> = {
      all: total,
      pending_payment: 0,
      paid: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
    };

    (statusCounts as any[]).forEach((row: any) => {
      countMap[row.status] = Number(row.count);
    });

    // 7. FETCH ORDER ITEMS & PAYMENT PER ORDER
    const ordersWithDetails = await Promise.all(
      (orders as any[]).map(async (order) => {
        // Fetch order items
        const [items] = await pool.query(
          `SELECT 
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.price_at_order,
            oi.quantity,
            oi.subtotal,
            p.image_path as product_image,
            p.unit
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?`,
          [order.id]
        );

        // Fetch latest payment
        const [payments] = await pool.query(
          `SELECT id, method, amount, status, transaction_id, payment_type, created_at
           FROM payment
           WHERE order_id = ?
           ORDER BY created_at DESC
           LIMIT 1`,
          [order.id]
        );

        return {
          id: Number(order.id),
          orderId: Number(order.id),
          userId: Number(order.user_id),
          addressId: Number(order.address_id),
          transactionId: order.transaction_id,
          status: order.status,
          paymentStatus: order.payment_status,
          paymentMethod: order.payment_method,
          paymentGateway: order.payment_gateway,
          paymentUrl: order.payment_url,
          paymentDeadline: order.payment_deadline,
          totalProductPrice: Number(order.total_product_price || 0),
          shippingCost: Number(order.shipping_cost || 0),
          paymentFee: Number(order.payment_fee || 0),
          grandTotal: Number(order.grand_total || 0),
          isPreOrder: Boolean(order.is_pre_order),
          estimatedShipDate: order.estimated_ship_date,
          poStatus: order.po_status,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          address: {
            recipientName: order.recipient_name,
            recipientPhone: order.recipient_phone,
            detail: order.address_detail,
            province: order.province,
            city: order.city,
            district: order.district,
            village: order.village,
            zipCode: order.zip_code,
          },
          items: (items as any[]).map((item: any) => ({
            id: Number(item.id),
            orderId: Number(item.order_id),
            productId: Number(item.product_id),
            productImage: item.product_image,
            price: Number(item.price_at_order),
            quantity: Number(item.quantity),
            subtotal: Number(item.subtotal),
            unit: item.unit,
          })),
          payment: (payments as any[])[0] || null,
        };
      })
    );

    // 8. RETURN RESPONSE
    return NextResponse.json({
      success: true,
      orders: ordersWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
      statusCounts: countMap,
    });

  } catch (error: any) {
    console.error('❌ GET /api/orders error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Checkout - Buat order baru
// ============================================================================
export async function POST(req: NextRequest) {
  let connection;

  try {
    // ============================================
    // 1. AUTH CHECK
    // ============================================
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

    // ============================================
    // 2. PARSE BODY
    // ============================================
    const body = await req.json();
    const addressId = body.addressId || body.address_id;
    const shippingCost = Number(body.shippingCost || body.shipping_cost || 0);
    const paymentFee = Number(body.paymentFee || body.payment_fee || 0);
    const paymentMethod = body.paymentMethod || body.payment_method || 'cod';
    const paymentGateway = body.paymentGateway || body.payment_gateway || null;
    const items = body.items || body.cartItems || body.products;

    if (process.env.NODE_ENV === 'development') console.log('🛒 [CHECKOUT] Request:', {
      userId, addressId, shippingCost, paymentFee,
      paymentMethod, paymentGateway, itemsCount: items?.length,
    });

    // ============================================
    // 3. VALIDASI INPUT
    // ============================================
    if (!addressId) {
      return NextResponse.json({ success: false, error: 'Address ID is required' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Cart items are required' }, { status: 400 });
    }
    if (!['cod', 'midtrans'].includes(paymentMethod)) {
      return NextResponse.json({ success: false, error: 'Invalid payment method' }, { status: 400 });
    }
    if (paymentMethod === 'midtrans' && !paymentGateway) {
      return NextResponse.json({ success: false, error: 'Payment gateway required' }, { status: 400 });
    }

    // ============================================
    // 4. ✅ HANDLE REFERRAL CODE
    // ============================================
    let referralCode: string | null = body.referralCode || body.referral_code || null;
    let affiliateApplicationId: number | null = null;
    let commissionRate = 5.00; // Default 5%
    let commissionAmount = 0;

    // ✅ Check referral code dari cookie jika tidak ada di body
    if (!referralCode) {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);
        
        referralCode = cookies.referral_code || null;
      }
    }

    // ✅ Validate referral code
    if (referralCode) {
      try {
        const affiliate = await getAffiliateByCode(referralCode);
        
        if (affiliate) {
          // ✅ Prevent self-referral (user tidak bisa pakai kode sendiri)
          if (affiliate.user_id === userId) {
            if (process.env.NODE_ENV === 'development') console.log('⚠️ [REFERRAL] Self-referral detected, skipping');
            referralCode = null;
          } else {
            affiliateApplicationId = affiliate.id;
            commissionRate = Number(affiliate.commission_rate) || 5.00;
            
            if (process.env.NODE_ENV === 'development') console.log(`🎯 [REFERRAL] Valid code: ${referralCode}, Rate: ${commissionRate}%`);
          }
        } else {
          if (process.env.NODE_ENV === 'development') console.log(`⚠️ [REFERRAL] Invalid code: ${referralCode}`);
          referralCode = null; // Reset jika invalid
        }
      } catch (error: any) {
        console.error('❌ [REFERRAL] Error validating code:', error.message);
        referralCode = null; // Continue checkout meskipun referral error
      }
    }

    // ============================================
    // 5. START TRANSACTION
    // ============================================
    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // ============================================
      // 6. VALIDATE PRODUCTS & CALCULATE TOTALS
      // ============================================
      let totalProductPrice = 0;
      let hasPreOrder = false;
      let preOrderHarvestDate: string | null = null;

      for (const item of items) {
        const productId = item.productId || item.id;
        const quantity = Number(item.quantity || 1);

        if (!productId || quantity <= 0) {
          throw new Error(`Invalid item: productId=${productId}`);
        }

        const [productRows] = await connection.query(
          `SELECT id, name, price, stock, status, harvest_date, 
                  po_quota, po_sold, seller_id
           FROM products 
           WHERE id = ? AND status != 'deleted' 
           FOR UPDATE`,
          [productId]
        );

        const product = (productRows as any[])[0];
        if (!product) throw new Error(`Produk tidak ditemukan (ID: ${productId})`);

        const normalizedStatus = String(product.status).toLowerCase().replace('-', '_');
        const isProductPreOrder = normalizedStatus === 'pre_order';
        const isProductSoldOut = normalizedStatus === 'sold_out';

        if (isProductSoldOut) throw new Error(`"${product.name}" sudah habis`);

        if (isProductPreOrder) {
          hasPreOrder = true;
          preOrderHarvestDate = product.harvest_date;

          const poQuota = Number(product.po_quota) || 0;
          const poSold = Number(product.po_sold) || 0;
          const remainingQuota = poQuota - poSold;

          if (poQuota > 0 && quantity > remainingQuota) {
            throw new Error(`Kuota PO "${product.name}" tersisa ${remainingQuota}`);
          }

          if (!product.harvest_date) {
            throw new Error(`Tanggal panen "${product.name}" belum ditetapkan`);
          }

          const harvestDate = new Date(product.harvest_date);
          const today = new Date();
          harvestDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);

          if (harvestDate < today) {
            throw new Error(`Masa panen "${product.name}" sudah lewat`);
          }
        } else {
          if (product.stock < quantity) {
            throw new Error(`Stok "${product.name}" tidak cukup. Tersedia: ${product.stock}`);
          }
        }

        const price = Number(item.price || product.price);
        totalProductPrice += price * quantity;

        (item as any)._product = product;
        (item as any)._price = price;
        (item as any)._isPreOrder = isProductPreOrder;
      }

      const grandTotal = totalProductPrice + shippingCost + paymentFee;
      const isPreOrder = hasPreOrder ? 1 : 0;
      let estimatedShipDate: string | null = null;
      if (hasPreOrder && preOrderHarvestDate) {
        estimatedShipDate = new Date(preOrderHarvestDate).toISOString().split('T')[0];
      }
      const poStatus = hasPreOrder ? 'pending' : null;
      const paymentDeadline = paymentMethod !== 'cod'
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : null;

      // ✅ Calculate commission jika ada referral
      if (affiliateApplicationId) {
        commissionAmount = calculateCommission(grandTotal, commissionRate);
        if (process.env.NODE_ENV === 'development') console.log(`💰 [COMMISSION] ${commissionRate}% of ${grandTotal} = ${commissionAmount}`);
      }

      if (process.env.NODE_ENV === 'development') console.log('🛒 [CHECKOUT] Totals:', {
        totalProductPrice, shippingCost, paymentFee, grandTotal,
        isPreOrder, estimatedShipDate, poStatus,
        referralCode, commissionRate, commissionAmount,
      });

      // ============================================
      // 7. INSERT ORDER (dengan referral info)
      // ============================================
      const [orderResult] = await connection.query(
        `INSERT INTO orders (
          user_id, address_id, status, payment_status,
          payment_method, payment_gateway, payment_deadline,
          total_product_price, shipping_cost, payment_fee, grand_total,
          is_pre_order, estimated_ship_date, po_status,
          referral_code, affiliate_application_id, commission_amount,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId, addressId,
          'pending_payment', 'pending',
          paymentMethod, paymentGateway, paymentDeadline,
          totalProductPrice, shippingCost, paymentFee, grandTotal,
          isPreOrder, estimatedShipDate, poStatus,
          referralCode, affiliateApplicationId, commissionAmount,
        ]
      );

      const orderId = (orderResult as any).insertId;
      if (process.env.NODE_ENV === 'development') console.log(`✅ [CHECKOUT] Order created: ${orderId}`);

      // ============================================
      // 8. INSERT ORDER ITEMS & UPDATE STOCK/PO
      // ============================================
      for (const item of items) {
        const productId = item.productId || item.id;
        const quantity = Number(item.quantity || 1);
        const price = (item as any)._price;
        const subtotal = price * quantity;
        const product = (item as any)._product;
        const itemIsPreOrder = (item as any)._isPreOrder;

        await connection.query(
          `INSERT INTO order_items (
            order_id, product_id, seller_id,
            price_at_order, quantity, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            orderId, productId, product.seller_id,
            price, quantity, subtotal,
          ]
        );

        if (itemIsPreOrder) {
          await connection.query(
            'UPDATE products SET po_sold = po_sold + ? WHERE id = ?',
            [quantity, productId]
          );
        } else {
          await connection.query(
            'UPDATE products SET stock = stock - ?, sold_count = sold_count + ? WHERE id = ?',
            [quantity, quantity, productId]
          );
        }
      }

      // ============================================
      // 9. ✅ CREATE AFFILIATE TRANSACTION (jika ada referral)
      // ============================================
      if (affiliateApplicationId) {
        try {
          // Ambil produk pertama untuk tracking (atau bisa loop semua items)
          const firstItem = items[0];
          const productId = firstItem.productId || firstItem.id;
          const product = (firstItem as any)._product;

          const affiliateTxResult = await createAffiliateTransaction({
            affiliateApplicationId,
            orderId,
            userId: Number(userId),
            productId,
            productName: product.name || 'Multiple Products',
            nominalTransaksi: grandTotal,
            commissionRate,
          });

          if (affiliateTxResult.success) {
            if (process.env.NODE_ENV === 'development') console.log(`✅ [AFFILIATE] Transaction created: ${affiliateTxResult.transactionId}, Commission: ${affiliateTxResult.komisi}`);
          } else {
            console.error('❌ [AFFILIATE] Failed to create transaction:', affiliateTxResult.error);
            // Jangan throw error, biarkan checkout lanjut
          }
        } catch (error: any) {
          console.error('❌ [AFFILIATE] Error creating transaction:', error.message);
          // Continue checkout meskipun affiliate transaction gagal
        }
      }

      // ============================================
      // 10. CLEAR CART
      // ============================================
      await connection.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

      // ============================================
      // 11. HANDLE PAYMENT
      // ============================================
      let paymentUrl: string | null = null;
      let transactionId: string | null = null;

      if (paymentMethod === 'midtrans') {
        const [userRows] = await connection.query(
          `SELECT name, email, no_telp FROM users WHERE id = ?`,
          [userId]
        );

        const [addressRows] = await connection.query(
          `SELECT 
            recipient_name, recipient_phone, detail,
            province, city, district, village, zip_code
          FROM address WHERE id = ?`,
          [addressId]
        );

        const user = (userRows as any[])[0] || {};
        const address = (addressRows as any[])[0] || {};

        const midtransOrderId = `AGR-${orderId}-${Date.now()}`;

        const formatMidtransDateTime = (date: Date): string => {
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} +0700`;
        };

        const fullAddress = [
          address.detail,
          address.village,
          address.district,
          address.city,
          address.province,
          address.zip_code,
        ].filter(Boolean).join(', ');

        const parameter = {
          transaction_details: {
            order_id: midtransOrderId,
            gross_amount: grandTotal,
          },
          customer_details: {
            first_name: user.name || 'Customer',
            email: user.email || '',
            phone: user.no_telp || address.recipient_phone || '',
            billing_address: {
              first_name: user.name || 'Customer',
              address: fullAddress,
              city: address.city || '',
              postal_code: address.zip_code || '',
              phone: user.no_telp || address.recipient_phone || '',
              country_code: 'IDN',
            },
            shipping_address: {
              first_name: address.recipient_name || user.name || 'Customer',
              address: fullAddress,
              city: address.city || '',
              postal_code: address.zip_code || '',
              phone: address.recipient_phone || user.no_telp || '',
              country_code: 'IDN',
            },
          },
          enabled_payments: [paymentGateway],
          expiry: {
            start_time: formatMidtransDateTime(new Date()),
            unit: 'hours',
            duration: 24,
          },
        };

        const snapResponse = await snap.createTransaction(parameter);
        paymentUrl = snapResponse.redirect_url;
        transactionId = snapResponse.token;

        await connection.query(
          `UPDATE orders 
           SET transaction_id = ?, payment_url = ?
           WHERE id = ?`,
          [midtransOrderId, paymentUrl, orderId]
        );

        await connection.query(
          `INSERT INTO payment (
            order_id, method, amount, status,
            transaction_id, payment_type, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [orderId, paymentGateway, grandTotal, 'pending', transactionId, paymentGateway]
        );
      } else {
        await connection.query(
          `INSERT INTO payment (
            order_id, method, amount, status,
            transaction_id, payment_type, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NULL, NULL, NOW(), NOW())`,
          [orderId, 'cod', grandTotal, 'pending']
        );
      }

      // ============================================
      // 12. COMMIT
      // ============================================
      await connection.commit();

      return NextResponse.json({
        success: true,
        orderId,
        transactionId,
        paymentUrl,
        message: paymentMethod === 'cod'
          ? 'Pesanan berhasil dibuat!'
          : 'Pesanan berhasil dibuat! Silakan lakukan pembayaran.',
        data: {
          orderId,
          transactionId,
          paymentUrl,
          grandTotal,
          itemCount: items.length,
          paymentMethod,
          paymentGateway,
          isPreOrder: Boolean(isPreOrder),
          estimatedShipDate,
          poStatus,
          paymentDeadline: paymentDeadline?.toISOString() || null,
          // ✅ Affiliate info
          referralCode,
          commissionAmount,
          hasReferral: Boolean(affiliateApplicationId),
        },
      }, { status: 201 });

    } catch (error: any) {
      await connection.rollback();
      console.error('❌ [CHECKOUT] Rolled back:', error.message);
      throw error;
    }

  } catch (err: any) {
    console.error('❌ [CHECKOUT] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Terjadi kesalahan' },
      { status: err.message?.includes('Unauthorized') ? 401 : 400 }
    );
  } finally {
    if (connection) connection.release();
  }
}
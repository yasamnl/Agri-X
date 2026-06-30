// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';
// ✅ Import snap yang sudah dibuat di lib/midtrans
import { snap } from '@/lib/midtrans';

// ============================================
// GET: Ambil daftar order user
// ============================================
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No token provided', code: 'NO_TOKEN' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    const userId = decoded.sub;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    // ✅ Filter Status - MySQL uses ? placeholder
    let statusCondition = '';
    const queryParams: any[] = [userId];

    if (status) {
      switch (status) {
        case 'pending':
          statusCondition = `AND o.status IN (?, ?)`;
          queryParams.push('pending', 'paid');
          break;

        case 'processing':
          statusCondition = `AND o.status = ?`;
          queryParams.push('processing');
          break;

        case 'shipped':
          statusCondition = `AND o.status = ?`;
          queryParams.push('shipped');
          break;

        case 'completed':
          statusCondition = `AND o.status IN (?, ?)`;
          queryParams.push('delivered', 'completed');
          break;

        case 'cancelled':
          statusCondition = `AND o.status = ?`;
          queryParams.push('cancelled');
          break;

        default:
          statusCondition = `AND o.status != ?`;
          queryParams.push('cancelled');
          break;
      }
    }

    // ✅ Query orders menggunakan pool.query (MySQL)
    const [ordersArray]: any = await pool.query(
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
        o.updated_at
      FROM orders o
      WHERE o.user_id = ?
      ${statusCondition}
      ORDER BY o.created_at DESC`,
      queryParams
    );

    // ✅ Fetch details for each order (parallel)
    const ordersWithDetails = await Promise.all(
      ordersArray.map(async (order: any) => {
        // 1. Get Order Items
        const [itemsRows]: any = await pool.query(
          `SELECT 
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.seller_id,
            oi.price_at_order,
            oi.quantity,
            oi.subtotal,
            p.name as current_product_name,
            p.image_path as product_image,
            p.unit
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?`,
          [order.id]
        );

        // 2. Get Address
        const [addressRows]: any = await pool.query(
          `SELECT 
            detail,
            province,
            city,
            district,
            village_code,
            zip_code,
            recipient_name,
            recipient_phone
          FROM address
          WHERE id = ?`,
          [order.address_id]
        );

        const address = addressRows[0] || {};

        // 3. Get Latest Payment Info
        const [paymentRows]: any = await pool.query(
          `SELECT 
            id,
            method,
            amount,
            status,
            transaction_id,
            payment_type,
            created_at
          FROM payment
          WHERE order_id = ?
          ORDER BY created_at DESC
          LIMIT 1`,
          [order.id]
        );

        const payment = paymentRows[0] || null;

        // ✅ Format response
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
            detail: address.detail || '',
            province: address.province || '',
            city: address.city || '',
            district: address.district || '',
            villageCode: address.village_code || '',
            villageName: address.village_code || '',
            zipCode: address.zip_code || '',
            recipientName: address.recipient_name || '',
            recipientPhone: address.recipient_phone || '',
          },
          items: itemsRows.map((item: any) => ({
            id: Number(item.id),
            orderId: Number(item.order_id),
            productId: Number(item.product_id),
            productName: item.product_name || item.current_product_name || 'Produk Dihapus',
            priceAtOrder: Number(item.price_at_order || 0),
            price: Number(item.price_at_order || 0),
            quantity: Number(item.quantity || 0),
            subtotal: Number(item.subtotal || 0),
            unit: item.unit || 'pcs',
            productImage: item.product_image || null,
          })),
          payment,
        };
      })
    );

    return NextResponse.json({
      success: true,
      orders: ordersWithDetails,
      count: ordersWithDetails.length,
    });

  } catch (err: any) {
    console.error('❌ GET /api/orders error:', err);
    return handleAPIError(err, 'GET /api/orders');
  }
}

// ============================================
// POST: Buat order baru dengan Midtrans Payment
// ============================================
export async function POST(req: NextRequest) {
  let connection;
  
  try {
    // ============================================
    // 1. AUTHENTICATION
    // ============================================
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

    // ============================================
    // 2. PARSE & VALIDATE REQUEST BODY
    // ============================================
    const body = await req.json();

    const addressId = body.addressId || body.address_id;
    const shippingCost = Number(body.shippingCost || body.shipping_cost || 0);
    const paymentFee = Number(body.paymentFee || body.payment_fee || 0);
    const paymentMethod = body.paymentMethod || body.payment_method || 'cod';
    const paymentGateway = body.paymentGateway || body.payment_gateway || null;
    const items = body.items || body.cartItems || body.products;

    console.log('🛒 [CHECKOUT] Request body:', {
      userId,
      addressId,
      shippingCost,
      paymentFee,
      paymentMethod,
      paymentGateway,
      itemsCount: items?.length,
    });

    // Validation
    if (!addressId) {
      return NextResponse.json(
        { success: false, error: 'Address ID is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cart items are required' },
        { status: 400 }
      );
    }

    if (!['cod', 'midtrans'].includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    if (paymentMethod === 'midtrans' && !paymentGateway) {
      return NextResponse.json(
        { success: false, error: 'Payment gateway is required for non-COD payments' },
        { status: 400 }
      );
    }

    // ============================================
    // 3. GET DATABASE CONNECTION & START TRANSACTION
    // ============================================
    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // ============================================
      // 4. VALIDATE ALL PRODUCTS & CALCULATE TOTALS
      // ============================================
      let totalProductPrice = 0;
      let hasPreOrder = false;
      let preOrderProduct: any = null;

      for (const item of items) {
        const productId = item.productId || item.id;
        const quantity = Number(item.quantity || 1);

        if (!productId || quantity <= 0) {
          throw new Error(`Invalid item: productId=${productId}, quantity=${quantity}`);
        }

        // Get product details with FOR UPDATE lock
        const [productRows] = await connection.query(
          `SELECT id, name, price, stock, status, harvest_date, po_quota, po_sold, unit
           FROM products WHERE id = ? FOR UPDATE`,
          [productId]
        );

        const product = (productRows as any[])[0];

        if (!product) {
          throw new Error(`Product ${productId} not found`);
        }

        if (product.status === 'deleted') {
          throw new Error(`Product "${product.name}" sudah tidak tersedia`);
        }

        if (product.status === 'sold_out') {
          throw new Error(`Product "${product.name}" sudah habis`);
        }

        // Handle Pre-Order logic
        if (product.status === 'pre_order') {
          hasPreOrder = true;
          preOrderProduct = product;

          const poQuota = Number(product.po_quota) || 0;
          const poSold = Number(product.po_sold) || 0;
          const remainingQuota = poQuota - poSold;

          if (poQuota > 0 && quantity > remainingQuota) {
            throw new Error(
              `Kuota Pre-Order "${product.name}" tersisa ${remainingQuota}. Anda memesan ${quantity}.`
            );
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
          // Ready stock - check stock availability
          if (product.stock < quantity) {
            throw new Error(
              `Stok "${product.name}" tidak mencukupi. Tersedia: ${product.stock}, diminta: ${quantity}`
            );
          }
        }

        // Calculate subtotal
        const price = Number(item.price || product.price);
        const subtotal = price * quantity;
        totalProductPrice += subtotal;

        // Attach product data to item for later use
        (item as any)._product = product;
        (item as any)._price = price;
        (item as any)._subtotal = subtotal;
      }

      const grandTotal = totalProductPrice + shippingCost + paymentFee;

      // ============================================
      // 5. DETERMINE PRE-ORDER FIELDS
      // ============================================
      const isPreOrder = hasPreOrder ? 1 : 0;
      
      let estimatedShipDate: string | null = null;
      if (hasPreOrder && preOrderProduct?.harvest_date) {
        estimatedShipDate = new Date(preOrderProduct.harvest_date)
          .toISOString()
          .split('T')[0];
      }

      const poStatus = hasPreOrder ? 'pending' : null;

      const paymentDeadline = paymentMethod !== 'cod'
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : null;

      console.log('🛒 [CHECKOUT] Calculated totals:', {
        totalProductPrice,
        shippingCost,
        paymentFee,
        grandTotal,
        isPreOrder,
        estimatedShipDate,
        poStatus,
      });

      // ============================================
      // 6. INSERT ORDER (LENGKAP - SEMUA KOLOM)
      // ============================================
      const [orderResult] = await connection.query(
        `INSERT INTO orders (
          user_id,
          address_id,
          transaction_id,
          status,
          payment_status,
          payment_method,
          payment_url,
          payment_gateway,
          payment_deadline,
          total_product_price,
          shipping_cost,
          payment_fee,
          grand_total,
          is_pre_order,
          estimated_ship_date,
          po_status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId,
          addressId,
          null,                    // transaction_id
          'pending',               // status
          'pending',               // payment_status
          paymentMethod,           // payment_method
          null,                    // payment_url
          paymentGateway,          // payment_gateway
          paymentDeadline,         // payment_deadline
          totalProductPrice,       // total_product_price
          shippingCost,            // shipping_cost
          paymentFee,              // payment_fee
          grandTotal,              // grand_total
          isPreOrder,              // is_pre_order
          estimatedShipDate,       // estimated_ship_date
          poStatus,                // po_status
        ]
      );

      const orderId = (orderResult as any).insertId;
      console.log('✅ [CHECKOUT] Order created:', orderId);

      // ============================================
      // 7. INSERT ORDER ITEMS & UPDATE STOCK/PO
      // ============================================
      for (const item of items) {
        const productId = item.productId || item.id;
        const quantity = Number(item.quantity || 1);
        const price = (item as any)._price;
        const subtotal = (item as any)._subtotal;
        const product = (item as any)._product;

        await connection.query(
          `INSERT INTO order_items (
            order_id,
            product_id,
            seller_id,
            price_at_order,
            quantity,
            subtotal
          ) VALUES (?, ?, ?, ?, ?)`,
          [orderId, productId, product.seller_id, price, quantity, subtotal]
        );

        if (product.status === 'pre_order') {
          await connection.query(
            `UPDATE products SET po_sold = po_sold + ? WHERE id = ?`,
            [quantity, productId]
          );
          console.log(`📦 [PO] Updated po_sold for product ${productId}: +${quantity}`);
        } else {
          await connection.query(
            `UPDATE products SET stock = stock - ? WHERE id = ?`,
            [quantity, productId]
          );
          console.log(`📦 [STOCK] Updated stock for product ${productId}: -${quantity}`);
        }
      }

      // ============================================
      // 8. CLEAR CART
      // ============================================
      await connection.query(
        `DELETE FROM cart_items WHERE user_id = ?`,
        [userId]
      );
      console.log('🗑️ [CHECKOUT] Cart cleared for user', userId);

      // ============================================
      // 9. HANDLE PAYMENT
      // ============================================
      let paymentUrl: string | null = null;
      let transactionId: string | null = null;
      let vaNumber: string | null = null;

      if (paymentMethod !== 'cod') {
        // ============================================
        // MIDTRANS PAYMENT
        // ============================================
        
        // ✅ Single query untuk user & address details
        const [orderDetailsRows] = await connection.query(
          `SELECT 
            u.name as user_name,
            u.email as user_email,
            u.no_telp as user_phone,
            a.recipient_name,
            a.recipient_phone,
            a.province,
            a.city,
            a.district,
            a.village,
            a.village_code,
            a.zip_code,
            a.detail as address_detail
          FROM orders o
          JOIN users u ON o.user_id = u.id
          JOIN address a ON o.address_id = a.id
          WHERE o.id = ?`,
          [orderId]
        );

        const orderDetails = (orderDetailsRows as any[])[0];

        const midtransOrderId = `AGR-${orderId}-${Date.now()}`;

        const formatMidtransDateTime = (date: Date): string => {
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} +0700`;
        };

        // ✅ Build address string dengan fallback untuk berbagai field name
        const fullAddress = [
          orderDetails?.address_detail || orderDetails?.address || orderDetails?.detail,
          orderDetails?.village_code || orderDetails?.village,
          orderDetails?.district,
          orderDetails?.city,
          orderDetails?.province,
          orderDetails?.postal_code || orderDetails?.zip_code,
        ].filter(Boolean).join(', ');

        const parameter = {
          transaction_details: {
            order_id: midtransOrderId,
            gross_amount: grandTotal,
          },
          customer_details: {
            first_name: orderDetails?.user_name || 'Customer',
            email: orderDetails?.user_email || '',
            phone: orderDetails?.user_phone || orderDetails?.recipient_phone || '',
            billing_address: {
              first_name: orderDetails?.user_name || 'Customer',
              address: fullAddress,
              city: orderDetails?.city || '',
              postal_code: orderDetails?.postal_code || orderDetails?.zip_code || '',
              phone: orderDetails?.user_phone || orderDetails?.recipient_phone || '',
              country_code: 'IDN',
            },
            shipping_address: {
              first_name: orderDetails?.recipient_name || orderDetails?.user_name || 'Customer',
              address: fullAddress,
              city: orderDetails?.city || '',
              postal_code: orderDetails?.postal_code || orderDetails?.zip_code || '',
              phone: orderDetails?.recipient_phone || orderDetails?.user_phone || '',
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

        console.log('💳 [MIDTRANS] Creating transaction:', midtransOrderId);

        // ✅ Gunakan snap yang sudah diimport dari lib/midtrans
        const snapResponse = await snap.createTransaction(parameter);

        paymentUrl = snapResponse.redirect_url;
        transactionId = snapResponse.token;

        if (snapResponse.va_numbers && snapResponse.va_numbers.length > 0) {
          vaNumber = snapResponse.va_numbers[0].va_number;
        }

        console.log('✅ [MIDTRANS] Transaction created:', {
          transactionId,
          paymentUrl: paymentUrl ? '✓' : '✗',
          vaNumber: vaNumber || 'N/A',
        });

        // Update order with payment info
        await connection.query(
          `UPDATE orders 
           SET transaction_id = ?, 
               payment_url = ?
           WHERE id = ?`,
          [midtransOrderId, paymentUrl, orderId]
        );

        // Insert payment record
        await connection.query(
          `INSERT INTO payment (
            order_id,
            method,
            amount,
            status,
            transaction_id,
            payment_type,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [orderId, paymentGateway, grandTotal, 'pending', transactionId, paymentGateway]
        );

      } else {
        // ============================================
        // COD PAYMENT
        // ============================================
        await connection.query(
          `INSERT INTO payment (
            order_id,
            method,
            amount,
            status,
            transaction_id,
            payment_type,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, NULL, NULL, NOW(), NOW())`,
          [orderId, 'cod', grandTotal, 'pending']
        );
        console.log('💵 [COD] Payment record created for order', orderId);
      }

      // ============================================
      // 10. COMMIT TRANSACTION
      // ============================================
      await connection.commit();
      console.log('✅ [CHECKOUT] Transaction committed. Order ID:', orderId);

      // ============================================
      // 11. RETURN SUCCESS RESPONSE
      // ============================================
      return NextResponse.json({
        success: true,
        orderId,
        transactionId,
        paymentUrl,
        vaNumber,
        message: paymentMethod === 'cod'
          ? 'Pesanan berhasil dibuat! Silakan siapkan uang tunai saat barang diterima.'
          : 'Pesanan berhasil dibuat! Silakan lakukan pembayaran sebelum batas waktu.',
        data: {
          orderId,
          transactionId,
          paymentUrl,
          vaNumber,
          grandTotal,
          itemCount: items.length,
          paymentMethod,
          paymentGateway,
          isPreOrder: Boolean(isPreOrder),
          estimatedShipDate,
          poStatus,
          paymentDeadline: paymentDeadline?.toISOString() || null,
        },
      }, { status: 201 });

    } catch (error: any) {
      await connection.rollback();
      console.error('❌ [CHECKOUT] Transaction rolled back:', error.message);
      throw error;
    }

  } catch (err: any) {
    console.error('❌ [CHECKOUT] Error:', err);

    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Terjadi kesalahan saat memproses pesanan',
      },
      { status: err.message?.includes('Unauthorized') ? 401 : 400 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
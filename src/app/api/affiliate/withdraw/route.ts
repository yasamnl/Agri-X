// src/app/api/affiliate/withdraw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { getAffiliateByUserId } from '@/lib/affiliate';
import { sendWithdrawalInvoiceEmail  } from '@/lib/email';

export async function POST(req: NextRequest) {
  let connection;

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

    // 2. Parse body
    const body = await req.json();
    const { bank, noRekening, namaPemilik, nominal } = body;

    // 3. Validate
    if (!bank || !noRekening || !namaPemilik || !nominal) {
      return NextResponse.json(
        { success: false, error: 'Semua field wajib diisi' },
        { status: 400 }
      );
    }

    if (nominal < 10000) {
      return NextResponse.json(
        { success: false, error: 'Minimal penarikan Rp 10.000' },
        { status: 400 }
      );
    }

    // 4. Get affiliate
    const affiliate = await getAffiliateByUserId(decoded.sub);
    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Anda belum terdaftar sebagai affiliate' },
        { status: 404 }
      );
    }

    // 5. Get user data
    const [userRows] = await pool.query(
      `SELECT id, name, email, no_telp FROM users WHERE id = ?`,
      [decoded.sub]
    );
    const user = (userRows as any[])[0];
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User tidak ditemukan' },
        { status: 404 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 6. Recompute & lock saldo (total_komisi) dari sumber asli sebelum dipakai,
      //    supaya tidak withdraw pakai angka cache yang basi/race condition
      const [appRows] = await connection.query(
        `SELECT total_komisi FROM affiliate_applications WHERE id = ? FOR UPDATE`,
        [affiliate.id]
      );
      const currentTotalKomisi = Number((appRows as any[])[0]?.total_komisi || 0);

      if (currentTotalKomisi < nominal) {
        await connection.rollback();
        return NextResponse.json(
          {
            success: false,
            error: `Saldo tidak mencukupi. Saldo tersedia: Rp ${currentTotalKomisi.toLocaleString('id-ID')}`,
          },
          { status: 400 }
        );
      }

      // 7. Insert withdrawal request
      const [result] = await connection.query(
        `INSERT INTO affiliate_withdrawals 
         (affiliate_application_id, bank, no_rekening, nama_pemilik, nominal, 
          status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
        [affiliate.id, bank, noRekening, namaPemilik, nominal]
      );

      const withdrawalId = (result as any).insertId;

      // 8. Kurangi langsung kolom total_komisi di affiliate_applications
      await connection.query(
        `UPDATE affiliate_applications SET total_komisi = total_komisi - ? WHERE id = ?`,
        [nominal, affiliate.id]
      );

      // 9. Get the inserted withdrawal data
      const [withdrawalRows] = await connection.query(
        `SELECT * FROM affiliate_withdrawals WHERE id = ?`,
        [withdrawalId]
      );
      const withdrawal = (withdrawalRows as any[])[0];

      await connection.commit();

      // 10. Send invoice email (asynchronous - don't await to avoid blocking response)
      const adminFee = 0; // Atur biaya admin sesuai kebutuhan
      const invoiceNumber = `INV-AFF-${withdrawalId}-${Date.now()}`;
        
      // Kirim email tanpa blocking response
      sendWithdrawalInvoiceEmail({
        email: user.email,
        name: user.name,
        withdrawal: {
          id: withdrawal.id,
          affiliate_application_id: withdrawal.affiliate_application_id,
          bank: withdrawal.bank,
          no_rekening: withdrawal.no_rekening,
          nominal: withdrawal.nominal,
          status: withdrawal.status,
          created_at: withdrawal.created_at,
        },
        user: {
          nama_lengkap: user.name,
          email: user.email,
          no_telp: user.no_telp || '-',
        },
        invoiceNumber,
        adminFee,
        date: new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
      }).catch((emailError) => {
        console.error('❌ Failed to send invoice email:', emailError);
        // Email gagal tidak mengganggu proses penarikan
      });
  
      return NextResponse.json({
        success: true,
        message: 'Permintaan penarikan berhasil diajukan. Invoice telah dikirim ke email Anda.',
        data: {
          withdrawalId,
          nominal,
          status: 'PENDING',
        },
      });
    
    } catch (error: any) {
      await connection.rollback();
      throw error;
    }

  } catch (error: any) {
    console.error('❌ Withdraw error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
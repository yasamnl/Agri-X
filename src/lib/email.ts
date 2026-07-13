// src/lib/email.ts
import nodemailer from 'nodemailer';
import type { TransportOptions } from 'nodemailer';
import path from 'path';

// ============================================
// TRANSPORTER CONFIG
// ============================================
let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // LOGGING: cek apakah environment terbaca
  console.log('🔍 SMTP_USER:', smtpUser ? '✅ Ada (' + smtpUser + ')' : '❌ Tidak ada');
  console.log('🔍 SMTP_PASS:', smtpPass ? '✅ Ada (length: ' + smtpPass.length + ')' : '❌ Tidak ada');
  console.log('🔍 NODE_ENV:', process.env.NODE_ENV);

  // Jika ada kredensial SMTP, gunakan itu (prioritas utama)
  if (smtpUser && smtpPass) {
    try {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: smtpUser, pass: smtpPass },
        timeout: 10000,
        connectionTimeout: 10000,
        tls: { rejectUnauthorized: false },
      } as TransportOptions);

      // Verifikasi koneksi
      await transporter.verify();
      console.log('📧 SMTP ready (Gmail):', smtpUser);
      return transporter;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ SMTP connection failed:', errMsg);
      // Di development, jika SMTP gagal, kita bisa fallback ke Ethereal
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  Fallback ke Ethereal karena SMTP gagal.');
      } else {
        // Di production, throw error
        throw new Error('SMTP connection failed: ' + errMsg);
      }
    }
  }

  // Fallback: Ethereal untuk development (jika tidak ada SMTP atau SMTP gagal)
  if (process.env.NODE_ENV === 'development') {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
        timeout: 5000,
        connectionTimeout: 5000,
      } as TransportOptions);
      console.log('📧 Ethereal ready:', testAccount.user);
      return transporter;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to create Ethereal account:', errMsg);
      throw new Error('No email transporter available');
    }
  }

  throw new Error('SMTP credentials required in production');
}

// ============================================
// EMAIL STYLES
// ============================================
const emailStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #F0FDF4;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 40px 20px;
  }
  .card {
    background: white;
    border-radius: 1.5rem;
    padding: 40px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }
  .logo-container {
    text-align: center;
    margin-bottom: 30px;
  }
  .logo-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 1rem;
    background-color: rgba(22, 101, 52, 0.1);
    margin-bottom: 1rem;
  }
  .title {
    color: #1C1917;
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 16px;
  }
  .text {
    color: #78716C;
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 24px;
  }
  .button {
    display: inline-block;
    background: linear-gradient(135deg, #166534 0%, #22c55e 100%);
    color: white !important;
    text-decoration: none;
    padding: 14px 32px;
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 16px;
    margin: 20px 0;
  }
  .link-box {
    background: #F0FDF4;
    border: 1px solid #DCFCE7;
    border-radius: 0.5rem;
    padding: 16px;
    margin: 20px 0;
    word-break: break-all;
    font-family: monospace;
    font-size: 13px;
    color: #166534;
  }
  .warning {
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgba(234, 179, 8, 0.2);
    border-radius: 0.75rem;
    padding: 16px;
    margin: 20px 0;
    font-size: 14px;
    color: #92400e;
  }
  .footer {
    text-align: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #E5E7EB;
    color: #A8A29E;
    font-size: 12px;
  }
  /* Invoice specific styles */
  .invoice-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px 40px;
    background: #f8f9f4;
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 30px;
  }
  .invoice-grid-item label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #8d8daa;
    letter-spacing: 0.5px;
    display: block;
    margin-bottom: 3px;
  }
  .invoice-grid-item .value {
    font-size: 0.9rem;
    font-weight: 600;
    color: #0c2b4e;
  }
  .invoice-grid-item .value.highlight {
    color: #f4991a;
    font-size: 1rem;
  }
  .invoice-divider {
    border: none;
    border-top: 1px solid #e8e9e0;
    margin: 24px 0;
  }
  .invoice-details {
    margin-bottom: 24px;
  }
  .invoice-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #f0f1ea;
    font-size: 0.9rem;
  }
  .invoice-row:last-child {
    border-bottom: none;
  }
  .invoice-row .label {
    color: #6b6d7a;
  }
  .invoice-row .value {
    font-weight: 600;
    color: #0c2b4e;
  }
  .invoice-row.total {
    border-top: 2px solid #0c2b4e;
    border-bottom: none;
    padding-top: 16px;
    margin-top: 4px;
  }
  .invoice-row.total .label {
    font-weight: 700;
    font-size: 1rem;
    color: #0c2b4e;
  }
  .invoice-row.total .value {
    font-size: 1.2rem;
    color: #f4991a;
  }
  .invoice-status-badge {
    background: rgba(67, 233, 123, 0.15);
    border: 1px solid rgba(67, 233, 123, 0.3);
    color: #43e97b;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .invoice-header-custom {
    background: #0c2b4e;
    padding: 30px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 4px solid #f4991a;
    border-radius: 1.5rem 1.5rem 0 0;
  }
  .invoice-logo {
    font-family: 'Sora', sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: #f4991a;
    letter-spacing: 0.5px;
  }
  .invoice-logo span {
    color: #eef0f8;
  }
  @media (max-width: 480px) {
    .invoice-grid {
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 16px;
    }
    .invoice-header-custom {
      padding: 20px;
      flex-direction: column;
      gap: 12px;
      text-align: center;
    }
  }
`;

// ============================================
// TEMPLATES
// ============================================
const resetPasswordTemplate = (userName: string, resetLink: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <div class="logo-wrapper">
          <img src="cid:agri-x-logo" alt="Agri X" style="width: 48px; height: 48px; object-fit: contain;" />
        </div>
        <h1 style="color: #166534; margin: 0; font-size: 28px;">Agri X</h1>
        <p style="color: #78716C; font-size: 12px; margin-top: 4px;">Platform Pertanian Digital</p>
      </div>
      
      <h2 class="title">Reset Password Anda</h2>
      
      <p class="text">
        Halo <strong>${userName}</strong>,<br><br>
        Kami menerima permintaan untuk mereset password akun Agri X Anda. 
        Klik tombol di bawah untuk melanjutkan:
      </p>
      
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password Sekarang</a>
      </div>
      
      <p class="text" style="font-size: 14px;">
        Atau salin link berikut ke browser Anda:
      </p>
      
      <div class="link-box">${resetLink}</div>
      
      <div class="warning">
        ⚠️ <strong>Perhatian:</strong> Link ini akan kedaluwarsa dalam <strong>1 jam</strong>. 
        Jika Anda tidak merasa meminta reset password, abaikan email ini.
      </div>
      
      <div class="footer">
        <p>© 2026 Agri X - Platform Pertanian Digital</p>
        <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const passwordChangedTemplate = (userName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <div class="logo-wrapper">
          <img src="cid:agri-x-logo" alt="Agri X" style="width: 48px; height: 48px; object-fit: contain;" />
        </div>
        <h1 style="color: #166534; margin: 0; font-size: 28px;">Agri X</h1>
      </div>
      
      <h2 class="title">✅ Password Berhasil Diubah</h2>
      
      <p class="text">
        Halo <strong>${userName}</strong>,<br><br>
        Password akun Agri X Anda telah berhasil diubah pada ${new Date().toLocaleString('id-ID')}.
      </p>
      
      <div class="warning">
        🔒 Jika Anda tidak melakukan perubahan ini, segera hubungi admin kami 
        dan amankan akun Anda.
      </div>
      
      <div class="footer">
        <p>© 2026 Agri X - Platform Pertanian Digital</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const accountVerificationTemplate = (userName: string, verifyLink: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <div class="logo-wrapper">
          <img src="cid:agri-x-logo" alt="Agri X" style="width: 48px; height: 48px; object-fit: contain;" />
        </div>
        <h1 style="color: #166534; margin: 0; font-size: 28px;">Agri X</h1>
        <p style="color: #78716C; font-size: 12px; margin-top: 4px;">Platform Pertanian Digital</p>
      </div>

      <h2 class="title">Verifikasi Akun Anda</h2>

      <p class="text">
        Halo <strong>${userName}</strong>,<br><br>
        Terima kasih telah mendaftar di Agri X! Klik tombol di bawah untuk
        memverifikasi email Anda dan mengaktifkan akun.
      </p>

      <div style="text-align: center;">
        <a href="${verifyLink}" class="button">Verifikasi Email Saya</a>
      </div>

      <p class="text" style="font-size: 14px;">
        Atau salin link berikut ke browser Anda:
      </p>

      <div class="link-box">${verifyLink}</div>

      <div class="warning">
        ⚠️ <strong>Perhatian:</strong> Link ini akan kedaluwarsa dalam <strong>24 jam</strong>.<br>
        Jika Anda tidak merasa mendaftar di Agri X, abaikan email ini.
      </div>

      <div class="footer">
        <p>© 2026 Agri X - Platform Pertanian Digital</p>
        <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const verificationEmailTemplate = (platform: string, username: string, link: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <div class="logo-wrapper">
          <img src="cid:agri-x-logo" alt="Agri X" style="width: 48px; height: 48px; object-fit: contain;" />
        </div>
        <h1 style="color: #166534; margin: 0; font-size: 28px;">Agri X</h1>
      </div>
      
      <h2 class="title">Verifikasi Akun Sosial Media</h2>
      
      <p class="text">
        Halo,<br><br>
        Kami menerima permintaan verifikasi akun <strong>${platform}</strong> 
        dengan username <strong>${username}</strong> untuk program affiliate Agri-X.
      </p>
      
      <p class="text">
        Klik tombol di bawah untuk memverifikasi kepemilikan akun Anda:
      </p>
      
      <div style="text-align: center;">
        <a href="${link}" class="button">Verifikasi Akun</a>
      </div>
      
      <p class="text" style="font-size: 14px;">
        Atau salin link berikut ke browser Anda:
      </p>
      
      <div class="link-box">${link}</div>
      
      <div class="warning">
        ⚠️ <strong>Perhatian:</strong> Link ini akan kedaluwarsa dalam <strong>24 jam</strong>.<br>
        Jika Anda tidak melakukan permintaan ini, abaikan email ini.
      </div>
      
      <div class="footer">
        <p>© 2026 Agri X - Platform Pertanian Digital</p>
        <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const affiliateApprovedTemplate = (userName: string, dashboardLink: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <div class="logo-wrapper">
          <img src="cid:agri-x-logo" alt="Agri X" style="width: 48px; height: 48px; object-fit: contain;" />
        </div>
        <h1 style="color: #166534; margin: 0; font-size: 28px;">Agri X</h1>
        <p style="color: #78716C; font-size: 12px; margin-top: 4px;">Platform Pertanian Digital</p>
      </div>

      <h2 class="title">🎉 Pengajuan Affiliate Anda Disetujui!</h2>

      <p class="text">
        Halo <strong>${userName}</strong>,<br><br>
        Selamat! Pengajuan Anda untuk bergabung sebagai <strong>Affiliate Agri X</strong> 
        telah <strong>disetujui</strong> oleh tim kami. Anda sekarang dapat mulai 
        membagikan link referral dan mendapatkan komisi dari setiap transaksi.
      </p>

      <div style="text-align: center;">
        <a href="${dashboardLink}" class="button">Buka Dashboard Affiliate</a>
      </div>

      <p class="text" style="font-size: 14px;">
        Atau salin link berikut ke browser Anda:
      </p>

      <div class="link-box">${dashboardLink}</div>

      <div class="footer">
        <p>© 2026 Agri X - Platform Pertanian Digital</p>
        <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// ============================================
// INVOICE TEMPLATE
// ============================================
const reactivationRequestTemplate = (
  affiliateUserName: string,
  affiliateEmail: string,
  adminLink: string
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <div class="logo-wrapper">
          <img src="cid:agri-x-logo" alt="Agri X" style="width: 48px; height: 48px; object-fit: contain;" />
        </div>
        <h1 style="color: #166534; margin: 0; font-size: 28px;">Agri X</h1>
        <p style="color: #78716C; font-size: 12px; margin-top: 4px;">Platform Pertanian Digital</p>
      </div>

      <h2 class="title">Permintaan Reaktivasi Akun Affiliate</h2>

      <p class="text">
        Halo Admin,<br><br>
        Affiliate <strong>${affiliateUserName}</strong> (${affiliateEmail}) yang akunnya
        dinonaktifkan mengajukan permintaan untuk diaktifkan kembali. Mohon
        ditinjau di panel admin.
      </p>

      <div style="text-align: center;">
        <a href="${adminLink}" class="button">Tinjau di Panel Admin</a>
      </div>

      <div class="footer">
        <p>© 2026 Agri X - Platform Pertanian Digital</p>
        <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const withdrawalOtpTemplate = (userName: string, otp: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <div class="logo-wrapper">
          <img src="cid:agri-x-logo" alt="Agri X" style="width: 48px; height: 48px; object-fit: contain;" />
        </div>
        <h1 style="color: #166534; margin: 0; font-size: 28px;">Agri X</h1>
        <p style="color: #78716C; font-size: 12px; margin-top: 4px;">Platform Pertanian Digital</p>
      </div>

      <h2 class="title">Kode Verifikasi Penarikan Komisi</h2>

      <p class="text">
        Halo <strong>${userName}</strong>,<br><br>
        Gunakan kode berikut untuk memverifikasi permintaan penarikan komisi
        affiliate Anda:
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #166534; background: #F0FDF4; border: 1px solid #DCFCE7; border-radius: 0.75rem; padding: 16px 24px;">
          ${otp}
        </span>
      </div>

      <div class="warning">
        ⚠️ <strong>Perhatian:</strong> Kode ini akan kedaluwarsa dalam <strong>5 menit</strong>.
        Jangan bagikan kode ini kepada siapa pun, termasuk pihak yang mengaku dari Agri X.
      </div>

      <div class="footer">
        <p>© 2026 Agri X - Platform Pertanian Digital</p>
        <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const invoiceTemplate = (params: {
  invoiceNumber: string;
  user: { nama_lengkap: string; email: string; no_telp: string };
  withdrawal: { bank: string; no_rekening: string; nominal: number; status: string; affiliate_application_id: number };
  adminFee: number;
  date: string;
}) => {
  const { invoiceNumber, user, withdrawal, adminFee, date } = params;
  const total = withdrawal.nominal - adminFee;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card" style="padding: 0; overflow: hidden;">
      
      <!-- HEADER -->
      <div class="invoice-header-custom">
        <div class="invoice-logo">AGRI-<span>X</span></div>
        <div class="invoice-status-badge">✓ SUKSES</div>
      </div>

      <!-- BODY -->
      <div style="padding: 35px 40px 25px;">
        <div style="font-family: 'Sora', sans-serif; font-size: 1.6rem; font-weight: 700; color: #0c2b4e; margin-bottom: 6px;">
          INVOICE
        </div>
        <div style="color: #8d8daa; font-size: 0.85rem; margin-bottom: 30px;">
          ID: ${invoiceNumber}
        </div>

        <!-- PENERIMA -->
        <div class="invoice-grid">
          <div class="invoice-grid-item">
            <label>Nama Affiliator</label>
            <div class="value">${user.nama_lengkap}</div>
          </div>
          <div class="invoice-grid-item">
            <label>E-mail</label>
            <div class="value">${user.email}</div>
          </div>
          <div class="invoice-grid-item">
            <label>ID Affiliate</label>
            <div class="value">#${withdrawal.affiliate_application_id}</div>
          </div>
          <div class="invoice-grid-item">
            <label>No. Telepon</label>
            <div class="value">${user.no_telp || '-'}</div>
          </div>
          <div class="invoice-grid-item">
            <label>Tanggal</label>
            <div class="value">${date}</div>
          </div>
          <div class="invoice-grid-item">
            <label>Bank Tujuan</label>
            <div class="value highlight">${withdrawal.bank} - ${withdrawal.no_rekening}</div>
          </div>
        </div>

        <hr class="invoice-divider">

        <!-- DESKRIPSI -->
        <div class="invoice-details">
          <div class="invoice-row">
            <span class="label">Komisi Dicairkan</span>
            <span class="value">Rp ${withdrawal.nominal.toLocaleString('id-ID')}</span>
          </div>
          <div class="invoice-row">
            <span class="label">Biaya Admin</span>
            <span class="value">Rp ${adminFee.toLocaleString('id-ID')}</span>
          </div>
          <div class="invoice-row total">
            <span class="label">TOTAL</span>
            <span class="value">Rp ${total.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <hr class="invoice-divider">

        <!-- STATUS -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
          <div>
            <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #8d8daa;">Status</span>
            <div style="font-weight: 700; color: #43e97b; font-size: 0.95rem;">✓ ${withdrawal.status}</div>
          </div>
          <div style="font-size: 0.7rem; color: #b0b2b8;">
            Dokumen ini merupakan bukti penarikan komisi affiliate<br>
            yang dilakukan melalui sistem Agri-X.
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="background: #f7f8f0; padding: 20px 40px; border-top: 1px solid #e8e9e0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="font-size: 0.8rem; color: #6b6d7a;">
          <strong>CONTACT PERSON AGRI-X</strong><br>
          Email: <a href="mailto:admin.agrix@gmail.com" style="color: #f4991a; text-decoration: none;">admin.agrix@gmail.com</a><br>
          Phone: 123-456-7890
        </div>
        <div style="font-size: 0.7rem; color: #b0b2b8; text-align: right;">
          <strong>Agri-X</strong> • Agrix.com
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

// ============================================
// SEND EMAIL FUNCTIONS
// ============================================

// 1. Reset Password
export async function sendResetPasswordEmail(
  to: string,
  userName: string,
  resetToken: string
): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  try {
    const transporter = await getTransporter();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
    const logoPath = path.join(process.cwd(), 'public', 'Agri-X.png');

    const info = await transporter.sendMail({
      from: `"Agri X" <${process.env.SMTP_FROM || 'noreply@agri-x.com'}>`,
      to,
      subject: '🔐 Reset Password Agri X',
      html: resetPasswordTemplate(userName, resetLink),
      attachments: [{ filename: 'Agri-X.png', path: logoPath, cid: 'agri-x-logo' }],
    });

    console.log('📧 Email reset password terkirim:', { to, messageId: info.messageId });

    let previewUrl: string | undefined;
    if (process.env.NODE_ENV === 'development' && info?.messageId) {
      previewUrl = nodemailer.getTestMessageUrl(info) as string;
      if (previewUrl) console.log('👀 Preview email:', previewUrl);
    }

    return { success: true, previewUrl };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Gagal mengirim email reset password:', errMsg);
    return { success: false, error: errMsg };
  }
}

// 2. Password Berhasil Diubah
export async function sendPasswordChangedEmail(
  to: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = await getTransporter();
    const logoPath = path.join(process.cwd(), 'public', 'Agri-X.png');

    await transporter.sendMail({
      from: `"Agri X" <${process.env.SMTP_FROM || 'noreply@agri-x.com'}>`,
      to,
      subject: '✅ Password Agri X Berhasil Diubah',
      html: passwordChangedTemplate(userName),
      attachments: [{ filename: 'Agri-X.png', path: logoPath, cid: 'agri-x-logo' }],
    });

    return { success: true };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Gagal mengirim email konfirmasi password:', errMsg);
    return { success: false, error: errMsg };
  }
}

// 3. Verifikasi Akun Sosial Media
// 3a. Verifikasi Akun saat Register (BUKAN verifikasi sosmed)
export async function sendAccountVerificationEmail(
  to: string,
  userName: string,
  verifyLink: string
): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  try {
    const transporter = await getTransporter();
    const logoPath = path.join(process.cwd(), 'public', 'Agri-X.png');

    const info = await transporter.sendMail({
      from: `"Agri X" <${process.env.SMTP_FROM || 'noreply@agri-x.com'}>`,
      to,
      subject: '✅ Verifikasi Akun Agri X Anda',
      html: accountVerificationTemplate(userName, verifyLink),
      attachments: [{ filename: 'Agri-X.png', path: logoPath, cid: 'agri-x-logo' }],
    });

    console.log('📧 Email verifikasi akun terkirim ke:', to);

    let previewUrl: string | undefined;
    if (process.env.NODE_ENV === 'development' && info?.messageId) {
      previewUrl = nodemailer.getTestMessageUrl(info) as string;
      if (previewUrl) console.log('👀 Preview email:', previewUrl);
    }

    return { success: true, previewUrl };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Gagal mengirim email verifikasi akun:', errMsg);

    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Development fallback: email tidak terkirim, gunakan link langsung.');
      return {
        success: true,
        previewUrl: verifyLink,
        error: 'Email tidak terkirim (dev fallback)',
      };
    }
    return { success: false, error: errMsg };
  }
}

// 3b. Verifikasi Akun Sosial Media (untuk pendaftaran affiliate)
export async function sendVerificationEmail(
  to: string,
  platform: string,
  username: string,
  link: string
): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  try {
    const transporter = await getTransporter();
    const logoPath = path.join(process.cwd(), 'public', 'Agri-X.png');

    const info = await transporter.sendMail({
      from: `"Agri X" <${process.env.SMTP_FROM || 'noreply@agri-x.com'}>`,
      to,
      subject: `📧 Verifikasi Akun ${platform} - Affiliate Agri X`,
      html: verificationEmailTemplate(platform, username, link),
      attachments: [{ filename: 'Agri-X.png', path: logoPath, cid: 'agri-x-logo' }],
    });

    console.log('📧 Email verifikasi TERKIRIM ke:', to);
    console.log(`   Platform: ${platform}, Username: ${username}`);
    console.log(`   Message ID: ${info?.messageId}`);

    let previewUrl: string | undefined;
    if (process.env.NODE_ENV === 'development' && info?.messageId) {
      previewUrl = nodemailer.getTestMessageUrl(info) as string;
      if (previewUrl) console.log('👀 Preview link (Ethereal):', previewUrl);
    }

    return { success: true, previewUrl };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Gagal kirim email ke', to, errMsg);

    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Development fallback: email tidak terkirim, gunakan link langsung.');
      return {
        success: true,
        previewUrl: link,
        error: 'Email tidak terkirim (dev fallback)',
      };
    }
    return { success: false, error: errMsg };
  }
}

// 4. Pengajuan Affiliate Disetujui
export async function sendAffiliateApprovedEmail(
  to: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = await getTransporter();
    const logoPath = path.join(process.cwd(), 'public', 'Agri-X.png');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:3000';
    const dashboardLink = `${baseUrl}/affiliate/dashboard`;

    await transporter.sendMail({
      from: `"Agri X" <${process.env.SMTP_FROM || 'noreply@agri-x.com'}>`,
      to,
      subject: '🎉 Pengajuan Affiliate Anda Disetujui - Agri X',
      html: affiliateApprovedTemplate(userName, dashboardLink),
      attachments: [{ filename: 'Agri-X.png', path: logoPath, cid: 'agri-x-logo' }],
    });

    console.log('📧 Email approval affiliate terkirim ke:', to);

    return { success: true };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Gagal mengirim email approval affiliate:', errMsg);
    return { success: false, error: errMsg };
  }
}

// 5. INVOICE WITHDRAWAL EMAIL (BARU)
// Permintaan Reaktivasi Akun Affiliate (ke admin)
export async function sendReactivationRequestEmail(
  to: string,
  affiliateUserName: string,
  affiliateEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = await getTransporter();
    const logoPath = path.join(process.cwd(), 'public', 'Agri-X.png');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:3000';
    const adminLink = `${baseUrl}/admin/affiliates`;

    await transporter.sendMail({
      from: `"Agri X" <${process.env.SMTP_FROM || 'noreply@agri-x.com'}>`,
      to,
      subject: '🔔 Permintaan Reaktivasi Akun Affiliate - Agri X',
      html: reactivationRequestTemplate(affiliateUserName, affiliateEmail, adminLink),
      attachments: [{ filename: 'Agri-X.png', path: logoPath, cid: 'agri-x-logo' }],
    });

    console.log('📧 Email permintaan reaktivasi terkirim ke admin:', to);

    return { success: true };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Gagal mengirim email permintaan reaktivasi:', errMsg);
    return { success: false, error: errMsg };
  }
}

// OTP Penarikan Komisi
export async function sendWithdrawalOtpEmail(
  to: string,
  userName: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = await getTransporter();
    const logoPath = path.join(process.cwd(), 'public', 'Agri-X.png');

    await transporter.sendMail({
      from: `"Agri X" <${process.env.SMTP_FROM || 'noreply@agri-x.com'}>`,
      to,
      subject: `🔐 Kode OTP Penarikan Komisi: ${otp}`,
      html: withdrawalOtpTemplate(userName, otp),
      attachments: [{ filename: 'Agri-X.png', path: logoPath, cid: 'agri-x-logo' }],
    });

    console.log('📧 Email OTP penarikan terkirim ke:', to);

    return { success: true };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Gagal mengirim email OTP penarikan:', errMsg);
    return { success: false, error: errMsg };
  }
}

export async function sendWithdrawalInvoiceEmail(params: {
  email: string;
  name: string;
  withdrawal: {
    id: number;
    affiliate_application_id: number;
    bank: string;
    no_rekening: string;
    nominal: number;
    status: string;
    created_at: Date;
  };
  user: {
    nama_lengkap: string;
    email: string;
    no_telp: string;
  };
  invoiceNumber: string;
  adminFee: number;
  date: string;
}): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  try {
    const transporter = await getTransporter();
    const logoPath = path.join(process.cwd(), 'public', 'Agri-X.png');

    const { email, withdrawal, user, invoiceNumber, adminFee, date } = params;

    const info = await transporter.sendMail({
      from: `"Agri X" <${process.env.SMTP_FROM || 'noreply@agri-x.com'}>`,
      to: email,
      subject: `🧾 Invoice Penarikan Komisi #${invoiceNumber}`,
      html: invoiceTemplate({
        invoiceNumber,
        user,
        withdrawal,
        adminFee,
        date,
      }),
      attachments: [{ filename: 'Agri-X.png', path: logoPath, cid: 'agri-x-logo' }],
    });

    console.log('📧 Invoice withdrawal email terkirim ke:', email);
    console.log(`   Invoice: ${invoiceNumber}, Nominal: Rp ${withdrawal.nominal.toLocaleString('id-ID')}`);
    console.log(`   Message ID: ${info?.messageId}`);

    let previewUrl: string | undefined;
    if (process.env.NODE_ENV === 'development' && info?.messageId) {
      previewUrl = nodemailer.getTestMessageUrl(info) as string;
      if (previewUrl) console.log('👀 Preview invoice (Ethereal):', previewUrl);
    }

    return { success: true, previewUrl };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Gagal mengirim invoice withdrawal:', errMsg);
    return { success: false, error: errMsg };
  }
}

// 6. Test Koneksi
export async function testEmailConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const transporter = await getTransporter();
    await transporter.verify();
    return { success: true, message: '✅ Koneksi SMTP berhasil' };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `❌ ${errMsg}` };
  }
}
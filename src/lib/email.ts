// src/lib/email.ts
import nodemailer from 'nodemailer';

// ============================================
// TRANSPORTER CONFIG
// ============================================
const createTransporter = () => {
  if (process.env.NODE_ENV === 'development') {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_USER || 'noreply@ethereal.email',
        pass: process.env.ETHEREAL_PASS || 'password',
      },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const transporter = createTransporter();

// ============================================
// EMAIL TEMPLATES
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
`;

const resetPasswordTemplate = (userName: string, resetLink: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

// ============================================
// SEND EMAIL FUNCTIONS
// ============================================
export async function sendResetPasswordEmail(
  to: string,
  userName: string,
  resetToken: string
): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
    
    // ✅ Attach logo sebagai CID (Content-ID)
    const logoPath = require('path').join(process.cwd(), 'public', 'Agri-X.png');
    
    const info = await transporter.sendMail({
      from: `"Agri X" <${process.env.SMTP_FROM || 'noreply@agri-x.com'}>`,
      to,
      subject: ' Reset Password Agri X',
      html: resetPasswordTemplate(userName, resetLink),
      attachments: [
        {
          filename: 'Agri-X.png',
          path: logoPath,
          cid: 'agri-x-logo', // ✅ Content-ID untuk inline image
        },
      ],
    });

    console.log('📧 Email reset password terkirim:', {
      to,
      messageId: info.messageId,
    });

    let previewUrl: string | undefined;
    if (process.env.NODE_ENV === 'development') {
      previewUrl = nodemailer.getTestMessageUrl(info) as string;
      console.log('👀 Preview email:', previewUrl);
    }

    return { success: true, previewUrl };
  } catch (error: any) {
    console.error('❌ Gagal mengirim email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendPasswordChangedEmail(
  to: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const logoPath = require('path').join(process.cwd(), 'public', 'Agri-X.png');
    
    await transporter.sendMail({
      from: `"Agri X" <${process.env.SMTP_FROM || 'noreply@agri-x.com'}>`,
      to,
      subject: '✅ Password Agri X Berhasil Diubah',
      html: passwordChangedTemplate(userName),
      attachments: [
        {
          filename: 'Agri-X.png',
          path: logoPath,
          cid: 'agri-x-logo',
        },
      ],
    });

    return { success: true };
  } catch (error: any) {
    console.error('❌ Gagal mengirim email konfirmasi:', error);
    return { success: false, error: error.message };
  }
}

export async function testEmailConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    await transporter.verify();
    return { success: true, message: '✅ Koneksi SMTP berhasil' };
  } catch (error: any) {
    return { success: false, message: `❌ ${error.message}` };
  }
}
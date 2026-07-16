// src/lib/mailer.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // true kalau pakai port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
) {
  const verifyUrl = `${process.env.APP_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(to)}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Verifikasi Email Anda - Agri X',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Halo, ${name} 👋</h2>
        <p>Terima kasih sudah mendaftar di <strong>Agri X</strong>. Klik tombol di bawah untuk memverifikasi email Anda:</p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;
                  text-decoration:none;border-radius:8px;margin:16px 0;">
          Verifikasi Email
        </a>
        <p>Atau salin link berikut ke browser Anda:</p>
        <p style="word-break:break-all;color:#16a34a;">${verifyUrl}</p>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          Jika Anda tidak merasa mendaftar di Agri X, abaikan email ini.
        </p>
      </div>
    `,
  });
}
// src/lib/withdrawal-otp.ts
import pool from '@/lib/db';
import { sendWithdrawalOtpEmail } from '@/lib/email';

interface WithdrawalOtpRow {
  id: number;
  user_id: number;
  otp_code: string;
  expired_at: string | Date;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class WithdrawalOtp {
  id: number;
  userId: number;
  otpCode: string;
  expiredAt: Date;

  constructor(row: WithdrawalOtpRow) {
    this.id = row.id;
    this.userId = row.user_id;
    this.otpCode = row.otp_code;
    this.expiredAt = new Date(row.expired_at);
  }

  /**
   * Generate kode OTP baru untuk user, simpan ke tabel WithdrawalOTP.
   */
  static async generate(userId: number | string): Promise<WithdrawalOtp> {
    const code = generateCode();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit
    const numericUserId = Number(userId);

    const [result] = await pool.query(
      `INSERT INTO \`WithdrawalOTP\` (user_id, otp_code, expired_at, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [numericUserId, code, expiredAt]
    );

    const insertId = (result as any).insertId;

    return new WithdrawalOtp({
      id: insertId,
      user_id: numericUserId,
      otp_code: code,
      expired_at: expiredAt,
    });
  }

  /**
   * Cari OTP berdasarkan kode (yang paling baru dibuat).
   * Mengembalikan null kalau tidak ditemukan atau sudah kedaluwarsa.
   */
  static async verify(code: string): Promise<WithdrawalOtp | null> {
    const [rows] = await pool.query(
      `SELECT * FROM \`WithdrawalOTP\` WHERE otp_code = ? ORDER BY id DESC LIMIT 1`,
      [code]
    );
    const row = (rows as any[])[0];
    if (!row) return null;

    const otp = new WithdrawalOtp(row);
    if (otp.isExpired()) return null;

    return otp;
  }

  /**
   * Cek apakah OTP ini sudah kedaluwarsa.
   */
  isExpired(): boolean {
    return this.expiredAt.getTime() < Date.now();
  }

  /**
   * Invalidate OTP ini (sekali pakai) — langsung expire-kan supaya
   * tidak bisa dipakai ulang.
   */
  async invalidate(): Promise<void> {
    await pool.query(
      `UPDATE \`WithdrawalOTP\` SET expired_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [this.id]
    );
    this.expiredAt = new Date();
  }

  /**
   * Kirim kode OTP ini ke email yang diberikan.
   */
  async sendOtp(email: string): Promise<{ success: boolean; error?: string }> {
    const user = await this.user();
    const userName = user?.name || '';
    return sendWithdrawalOtpEmail(email, userName, this.otpCode);
  }

  /**
   * Ambil data user pemilik OTP ini.
   */
  async user(): Promise<{ id: number; name: string; email: string } | null> {
    const [rows] = await pool.query(
      `SELECT id, name, email FROM users WHERE id = ?`,
      [this.userId]
    );
    return (rows as any[])[0] || null;
  }
}
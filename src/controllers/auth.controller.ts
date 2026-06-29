import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../lib/db';
import { generateTokens } from '@/lib/auth'; // Pastikan fungsi ini menghasilkan access dan refresh token
import { getDeviceType } from '@/lib/device.util';

// ✅ Tipe user dari database
interface DbUser {
  id: number;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'buyer' | 'seller';
}

const getBrowser = (ua: string): string => {
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'Other';
};

// ✅ LOGIN
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || 'unknown';

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password required',
      code: 'MISSING_CREDENTIALS'
    });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, email, password, name, role FROM `user` WHERE email = ?',
      [email]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = rows[0] as DbUser;

    const validRoles = ['admin', 'buyer', 'seller'];
    if (
      typeof user.id !== 'number' ||
      typeof user.password !== 'string' ||
      typeof user.name !== 'string' ||
      !validRoles.includes(user.role)
    ) {
      console.error('User data invalid:', user);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'USER_DATA_ERROR'
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const { accessToken, refreshToken } = generateTokens(String(user.id), user.role);
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await pool.execute('CALL log_user_session_v2(?, ?, ?, ?, ?, ?)', [
      user.id,
      refreshToken,
      userAgent,
      getDeviceType(userAgent),
      getBrowser(userAgent),
      ip
    ]);

    // Kirim accessToken (bisa dibaca frontend)
    res.cookie('accessToken', accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    // Kirim refreshToken (HttpOnly → aman)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      user: {
        id: String(user.id),
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err: any) {
    console.error('🔐 Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication service unavailable',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// ✅ LOGOUT
export const logout = async (req: Request, res: Response) => {
  try {
    // Opsional: hapus session dari DB berdasarkan refreshToken
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await pool.execute('DELETE FROM user_sessions WHERE refresh_token_hash = ?', [hash]);
    }
  } catch (err) {
    console.warn('Failed to delete session from DB:', err);
  }

  // Clear cookies
  res.clearCookie('accessToken', { 
    httpOnly: false, 
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  res.clearCookie('refreshToken', { 
    httpOnly: true, 
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  return res.status(200).json({ success: true });
};

const getBrowser = (ua: string): string => {
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'Other';
};

export const register = async (req: Request, res: Response) => {
  const { name, email, password, role = 'buyer' } = req.body; // Default role ke 'buyer'
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || 'unknown';

  // Validasi input sederhana
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and password are required',
      code: 'MISSING_FIELDS'
    });
  }

  // Validasi role (opsional)
  const validRoles = ['admin', 'buyer', 'seller'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid role specified',
      code: 'INVALID_ROLE'
    });
  }

  try {
    // Cek apakah email sudah digunakan
    const [existingUsers] = await pool.execute(
      'SELECT id FROM user WHERE email = ?',
      [email]
    );

    if ((existingUsers as any[]).length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate tokens untuk langsung login setelah register
    // Kita hanya perlu generate token untuk login otomatis, tidak perlu langsung simpan refresh token ke DB sekarang
    const { accessToken, refreshToken } = generateTokens('0', role); // ID sementara, akan diganti setelah insert

    // Insert user baru ke database
    const insertResult = await pool.execute(
      'INSERT INTO user (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    const newUserId = (insertResult as any).insertId; // Ambil ID user yang baru dibuat

    // Sekarang generate token dengan ID yang benar
    const { accessToken: finalAccessToken, refreshToken: finalRefreshToken } = generateTokens(String(newUserId), role);

    // Hash refresh token untuk disimpan di DB (jika kamu ingin menyimpannya di tabel user)
    const refreshTokenHash = crypto.createHash('sha256').update(finalRefreshToken).digest('hex');

    // Update record user dengan refresh token yang benar
    await pool.execute(
      'UPDATE user SET refresh_token = ? WHERE id = ?',
      [refreshTokenHash, newUserId] // Simpan hash, bukan token asli
    );

    // Simpan session via stored procedure (jika kamu ingin mencatat session pertama)
    // Pastikan stored procedure log_user_session_v2 bisa menangani ID baru
    await pool.execute('CALL log_user_session_v2(?, ?, ?, ?, ?, ?)', [
      newUserId,
      finalRefreshToken, // Token asli dikirim ke stored procedure
      userAgent,
      getDeviceType(userAgent),
      getBrowser(userAgent),
      ip
    ]);

    // Kirim cookie seperti pada login
    res.cookie('accessToken', finalAccessToken, {
      httpOnly: false, // Dibaca oleh frontend
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 menit
    });

    res.cookie('refreshToken', finalRefreshToken, {
      httpOnly: true, // Tidak bisa dibaca JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 hari
    });

    // Kirim respons tanpa token di body
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: String(newUserId),
        name: name,
        email: email,
        role: role
      }
    });

  } catch (err: any) {
    console.error('🔐 Registration error:', err);
    // Tangani error database umum
    if (err.code === 'ER_DUP_ENTRY') {
      // Jika terjadi error duplikat (meski sudah dicek), tangani
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Registration service unavailable',
      code: 'REG_SERVICE_ERROR'
    });
  }
};

// ... (kode logout sebelumnya)
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Gunakan non-null assertion (!) karena kita asumsikan nilai ini wajib ada di .env.local
const JWT_SECRET = process.env.JWT_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

// Fungsi untuk menghasilkan access dan refresh token
export const generateTokens = (userId: string, role: string) => {
  const accessToken = jwt.sign(
    { sub: userId, role }, // payload
    JWT_SECRET,
    { expiresIn: '1h' } // 1 jam
  );

  const refreshToken = jwt.sign(
    { sub: userId }, // payload hanya user ID untuk refresh token
    REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' } // 7 hari
  );

  return { accessToken, refreshToken };
};

// Fungsi untuk verifikasi access token
export const verifyAccessToken = (token: string): { sub: string; role: string } => {
  return jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
};

// Fungsi untuk verifikasi refresh token
export const verifyRefreshToken = (token: string): { sub: string } => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as { sub: string };
};

// Fungsi untuk hash password
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Fungsi untuk verifikasi password
export const verifyPassword = async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};
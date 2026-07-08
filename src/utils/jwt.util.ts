import jwt, { JwtPayload } from 'jsonwebtoken';

// Validasi environment variables saat startup
if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  throw new Error('JWT_SECRET and REFRESH_TOKEN_SECRET must be defined in .env');
}

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Tipe eksplisit untuk payload
interface AccessTokenPayload extends JwtPayload {
  sub: string; // user ID
  role: 'admin' | 'buyer' | 'seller';
}

interface RefreshTokenPayload extends JwtPayload {
  sub: string;
}

// ✅ Generate Tokens
export const generateTokens = (userId: string, role: AccessTokenPayload['role']) => {
  const accessToken = jwt.sign({ sub: userId, role }, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

  const refreshToken = jwt.sign({ sub: userId }, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
};

// ✅ Verifikasi Access Token (dengan error handling)
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AccessTokenPayload;

    // Validasi struktur payload
    if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
      throw new Error('Invalid token structure');
    }

    // Validasi role
    const validRoles = ['admin', 'buyer', 'seller'];
    if (!validRoles.includes(decoded.role)) {
      throw new Error('Invalid role in token');
    }

    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error('ACCESS_TOKEN_EXPIRED');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_ACCESS_TOKEN');
    }
    throw new Error('ACCESS_TOKEN_VERIFICATION_FAILED');
  }
};

// ✅ Verifikasi Refresh Token (dengan error handling)
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!) as RefreshTokenPayload;

    if (typeof decoded.sub !== 'string') {
      throw new Error('Invalid refresh token structure');
    }

    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }
    throw new Error('REFRESH_TOKEN_VERIFICATION_FAILED');
  }
};
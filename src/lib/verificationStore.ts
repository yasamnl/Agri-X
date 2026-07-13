export interface VerificationToken {
    token: string;
    email: string;
    platform: string;
    username: string;
    sessionKey: string;
    verified: boolean;
    createdAt: number;
  }
  
  const tokens = new Map<string, VerificationToken>();
  
  export const verificationStore = {
    createToken: (email: string, platform: string, username: string, sessionKey: string): string => {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const data: VerificationToken = {
        token,
        email,
        platform,
        username,
        sessionKey,
        verified: false,
        createdAt: Date.now(),
      };
      tokens.set(token, data);
      console.log('✅ Token created:', token);
      return token;
    },
  
    getToken: (token: string): VerificationToken | undefined => {
      return tokens.get(token);
    },
  
    verifyToken: (token: string): boolean => {
      const data = tokens.get(token);
      if (!data) return false;
      data.verified = true;
      tokens.set(token, data);
      console.log('✅ Token verified:', token);
      return true;
    },
  
    getVerifiedTokens: (email: string, sessionKey: string): VerificationToken[] => {
      const result: VerificationToken[] = [];
      for (const [, data] of tokens) {
        if (data.email === email && data.sessionKey === sessionKey && data.verified) {
          result.push(data);
        }
      }
      return result;
    },
  };
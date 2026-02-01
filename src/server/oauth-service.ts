import * as crypto from 'crypto';
const BASE_URL = process.env.BASE_URL || 'https://adskoekoleso.ru';
export const OAUTH_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: `${BASE_URL}/api/auth/google/callback`,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'email profile'
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    redirectUri: `${BASE_URL}/api/auth/github/callback`,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    emailsUrl: 'https://api.github.com/user/emails',
    scope: 'user:email'
  }
};
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.google.clientId,
    redirect_uri: OAUTH_CONFIG.google.redirectUri,
    response_type: 'code',
    scope: OAUTH_CONFIG.google.scope,
    state: state,
    access_type: 'offline',
    prompt: 'consent'
  });
  return `${OAUTH_CONFIG.google.authUrl}?${params.toString()}`;
}
export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
} | null> {
  try {
    const response = await fetch(OAUTH_CONFIG.google.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: OAUTH_CONFIG.google.clientId,
        client_secret: OAUTH_CONFIG.google.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: OAUTH_CONFIG.google.redirectUri
      })
    });

    if (!response.ok) {
      console.error('Google token exchange failed:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Google token exchange error:', error);
    return null;
  }
}
export async function getGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: string;
} | null> {
  try {
    const response = await fetch(OAUTH_CONFIG.google.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      console.error('Google user info failed:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Google user info error:', error);
    return null;
  }
}

export function getGithubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.github.clientId,
    redirect_uri: OAUTH_CONFIG.github.redirectUri,
    scope: OAUTH_CONFIG.github.scope,
    state: state
  });
  return `${OAUTH_CONFIG.github.authUrl}?${params.toString()}`;
}
export async function exchangeGithubCode(code: string): Promise<{
  access_token: string;
  token_type: string;
  scope: string;
} | null> {
  try {
    const response = await fetch(OAUTH_CONFIG.github.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: OAUTH_CONFIG.github.clientId,
        client_secret: OAUTH_CONFIG.github.clientSecret,
        code: code,
        redirect_uri: OAUTH_CONFIG.github.redirectUri
      })
    });

    if (!response.ok) {
      console.error('GitHub token exchange failed:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('GitHub token exchange error:', error);
    return null;
  }
}
export async function getGithubUserInfo(accessToken: string): Promise<{
  id: number;
  login: string;
  name: string;
  email: string | null;
  avatar_url?: string;
} | null> {
  try {
    const response = await fetch(OAUTH_CONFIG.github.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'MYCSC-Database'
      }
    });

    if (!response.ok) {
      console.error('GitHub user info failed:', await response.text());
      return null;
    }

    const user = await response.json();
    if (!user.email) {
      const emailResponse = await fetch(OAUTH_CONFIG.github.emailsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'MYCSC-Database'
        }
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        const primaryEmail = emails.find((e: any) => e.primary) || emails[0];
        if (primaryEmail) {
          user.email = primaryEmail.email;
        }
      }
    }

    return user;
  } catch (error) {
    console.error('GitHub user info error:', error);
    return null;
  }
}
export type OAuthProvider = 'google' | 'github';
export interface OAuthUserData {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  username: string;
  name?: string;
  avatar?: string;
}
export async function processOAuthCallback(
  provider: OAuthProvider,
  code: string
): Promise<OAuthUserData | null> {
  if (provider === 'google') {
    const tokens = await exchangeGoogleCode(code);
    if (!tokens || !tokens.access_token) return null;

    const userInfo = await getGoogleUserInfo(tokens.access_token);
    if (!userInfo) return null;

    return {
      provider: 'google',
      providerId: userInfo.id,
      email: userInfo.email,
      username: userInfo.email.split('@')[0],
      name: userInfo.name,
      avatar: userInfo.picture
    };
  }

  if (provider === 'github') {
    const tokens = await exchangeGithubCode(code);
    if (!tokens || !tokens.access_token) return null;

    const userInfo = await getGithubUserInfo(tokens.access_token);
    if (!userInfo) return null;

    return {
      provider: 'github',
      providerId: String(userInfo.id),
      email: userInfo.email || `${userInfo.login}@github.local`,
      username: userInfo.login,
      name: userInfo.name || userInfo.login,
      avatar: userInfo.avatar_url
    };
  }

  return null;
}

export default {
  OAUTH_CONFIG,
  generateOAuthState,
  getGoogleAuthUrl,
  getGithubAuthUrl,
  processOAuthCallback
};

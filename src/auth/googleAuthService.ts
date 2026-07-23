import type { AuthService, AuthSession, AuthUser } from './types';

interface GoogleAuthServiceOptions {
  clientId: string;
  scriptSrc?: string;
  storageKey?: string;
  userInfoEndpoint?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface GoogleTokenClient {
  requestAccessToken(): void;
}

interface GoogleTokenClientConfig {
  callback: (response: GoogleTokenResponse) => void;
  client_id: string;
  error_callback?: () => void;
  prompt: string;
  scope: string;
}

interface GoogleIdentityServices {
  accounts?: {
    oauth2?: {
      initTokenClient(config: GoogleTokenClientConfig): GoogleTokenClient;
    };
  };
}

const defaultScriptSrc = 'https://accounts.google.com/gsi/client';
const defaultStorageKey = 'assisted-cms.google-session';
const defaultUserInfoEndpoint = 'https://www.googleapis.com/oauth2/v3/userinfo';

function createSession(user: AuthUser): AuthSession {
  return {
    user,
    authenticatedAt: new Date().toISOString(),
  };
}

function readSession(storageKey: string): AuthSession | null {
  const rawSession = window.localStorage.getItem(storageKey);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function getGoogle(): GoogleIdentityServices | undefined {
  return (globalThis as typeof globalThis & { google?: GoogleIdentityServices }).google;
}

async function loadGoogleIdentityServices(scriptSrc: string): Promise<void> {
  if (getGoogle()?.accounts?.oauth2) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google authentication could not be loaded.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Google authentication could not be loaded.')), {
      once: true,
    });
    document.head.appendChild(script);
  });

  if (!getGoogle()?.accounts?.oauth2) {
    throw new Error('Google authentication could not be loaded.');
  }
}

async function requestAccessToken(clientId: string, scriptSrc: string): Promise<string> {
  await loadGoogleIdentityServices(scriptSrc);

  const oauth2 = getGoogle()?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google authentication could not be loaded.');
  }

  return new Promise<string>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      prompt: 'select_account',
      scope: 'openid email profile',
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || 'Google authentication failed. Please try again.'));
          return;
        }

        if (!response.access_token) {
          reject(new Error('Google authentication did not return an access token.'));
          return;
        }

        resolve(response.access_token);
      },
      error_callback: () => {
        reject(new Error('Google authentication was cancelled. Please try again.'));
      },
    });

    tokenClient.requestAccessToken();
  });
}

async function fetchGoogleUserInfo(accessToken: string, userInfoEndpoint: string): Promise<AuthUser> {
  const response = await fetch(userInfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Google profile could not be loaded. Please try again.');
  }

  const profile = (await response.json()) as GoogleUserInfo;
  if (!profile.sub || !profile.email) {
    throw new Error('Google profile did not include the required account identity.');
  }

  return {
    id: profile.sub,
    email: profile.email,
    name: profile.name || profile.email,
    avatarUrl: profile.picture || '',
    provider: 'google',
  };
}

export function createGoogleAuthService(options: GoogleAuthServiceOptions): AuthService {
  const clientId = options.clientId.trim();
  const scriptSrc = options.scriptSrc ?? defaultScriptSrc;
  const storageKey = options.storageKey ?? defaultStorageKey;
  const userInfoEndpoint = options.userInfoEndpoint ?? defaultUserInfoEndpoint;

  return {
    async refreshSession() {
      return readSession(storageKey);
    },

    async signInWithGoogle() {
      if (!clientId) {
        throw new Error('Google client id is not configured.');
      }

      const accessToken = await requestAccessToken(clientId, scriptSrc);
      const user = await fetchGoogleUserInfo(accessToken, userInfoEndpoint);
      const session = createSession(user);
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      return session;
    },

    async signOut() {
      window.localStorage.removeItem(storageKey);
    },
  };
}

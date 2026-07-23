import type { AuthService, AuthSession, AuthUser } from './types';

interface LocalAuthServiceOptions {
  failNextSignIn?: boolean;
  initialUser?: AuthUser;
  storageKey?: string;
}

const defaultGoogleUser: AuthUser = {
  id: 'google-demo-user',
  email: 'taylor.morgan@example.com',
  name: 'Taylor Morgan',
  avatarUrl: '',
  provider: 'google',
};

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

export function createLocalAuthService(options: LocalAuthServiceOptions = {}): AuthService {
  const storageKey = options.storageKey ?? 'assisted-cms.google-session';
  let shouldFailNextSignIn = options.failNextSignIn ?? false;

  if (options.initialUser) {
    window.localStorage.setItem(storageKey, JSON.stringify(createSession(options.initialUser)));
  }

  return {
    async refreshSession() {
      return readSession(storageKey);
    },

    async signInWithGoogle() {
      if (shouldFailNextSignIn) {
        shouldFailNextSignIn = false;
        throw new Error('Google authentication failed. Please try again.');
      }

      const session = createSession(defaultGoogleUser);
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      return session;
    },

    async signOut() {
      window.localStorage.removeItem(storageKey);
    },
  };
}

export type AuthProvider = 'google';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  provider: AuthProvider;
}

export interface AuthSession {
  user: AuthUser;
  authenticatedAt: string;
}

export interface AuthService {
  refreshSession(): Promise<AuthSession | null>;
  signInWithGoogle(): Promise<AuthSession>;
  signOut(): Promise<void>;
}

import { describe, expect, test, vi } from 'vitest';
import { createGoogleAuthService } from './googleAuthService';

describe('Google auth service', () => {
  test('opens Google account selection and stores the authenticated Google profile', async () => {
    const appendChildSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      script.dispatchEvent(new Event('load'));
      return node;
    });
    const requestAccessToken = vi.fn();
    const initTokenClient = vi.fn().mockImplementation((config) => {
      queueMicrotask(() => {
        config.callback({ access_token: 'google-access-token' });
      });
      return { requestAccessToken };
    });

    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient,
        },
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sub: 'google-123',
          email: 'owner@example.com',
          name: 'Owner Example',
          picture: 'https://accounts.google.com/avatar.png',
        }),
      }),
    );

    const authService = createGoogleAuthService({
      clientId: 'google-client-id.apps.googleusercontent.com',
      storageKey: 'google-auth-service-test',
    });

    const session = await authService.signInWithGoogle();

    expect(initTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'google-client-id.apps.googleusercontent.com',
        prompt: 'select_account',
        scope: 'openid email profile',
      }),
    );
    expect(requestAccessToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer google-access-token' },
    });
    expect(session.user).toMatchObject({
      id: 'google-123',
      email: 'owner@example.com',
      name: 'Owner Example',
      avatarUrl: 'https://accounts.google.com/avatar.png',
      provider: 'google',
    });
    expect(window.localStorage.getItem('google-auth-service-test')).toContain('owner@example.com');
    expect(window.localStorage.getItem('google-auth-service-test')).not.toContain(
      'taylor.morgan@example.com',
    );

    appendChildSpy.mockRestore();
  });

  test('refuses to sign in when the Google client id is missing', async () => {
    const authService = createGoogleAuthService({
      clientId: '',
      storageKey: 'google-auth-service-missing-client-id',
    });

    await expect(authService.signInWithGoogle()).rejects.toThrow(/google client id is not configured/i);
  });

  test('does not restore the legacy demo Google session', async () => {
    window.localStorage.setItem(
      'google-auth-service-legacy-demo',
      JSON.stringify({
        user: {
          id: 'google-demo-user',
          email: 'taylor.morgan@example.com',
          name: 'Taylor Morgan',
          avatarUrl: '',
          provider: 'google',
        },
        authenticatedAt: new Date().toISOString(),
      }),
    );

    const authService = createGoogleAuthService({
      clientId: 'google-client-id.apps.googleusercontent.com',
      storageKey: 'google-auth-service-legacy-demo',
    });

    await expect(authService.refreshSession()).resolves.toBeNull();
    expect(window.localStorage.getItem('google-auth-service-legacy-demo')).toBeNull();
  });
});

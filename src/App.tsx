import React from 'react';
import { AlertCircle, LogOut, ShieldCheck } from 'lucide-react';
import type { AuthService, AuthSession } from './auth/types';

interface AppProps {
  authService: AuthService;
}

type AuthViewState =
  | { status: 'loading'; session: null; error: '' }
  | { status: 'signed-out'; session: null; error: string }
  | { status: 'signed-in'; session: AuthSession; error: '' };

export function App({ authService }: AppProps) {
  const [authState, setAuthState] = React.useState<AuthViewState>({
    status: 'loading',
    session: null,
    error: '',
  });

  React.useEffect(() => {
    let isMounted = true;

    authService
      .refreshSession()
      .then((session) => {
        if (!isMounted) {
          return;
        }

        setAuthState(
          session
            ? { status: 'signed-in', session, error: '' }
            : { status: 'signed-out', session: null, error: '' },
        );
      })
      .catch(() => {
        if (isMounted) {
          setAuthState({
            status: 'signed-out',
            session: null,
            error: 'Unable to restore your Google session. Please try again.',
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authService]);

  async function handleGoogleSignIn() {
    setAuthState({ status: 'loading', session: null, error: '' });

    try {
      const session = await authService.signInWithGoogle();
      setAuthState({ status: 'signed-in', session, error: '' });
    } catch (error) {
      setAuthState({
        status: 'signed-out',
        session: null,
        error: error instanceof Error ? error.message : 'Google authentication failed. Please try again.',
      });
    }
  }

  async function handleSignOut() {
    await authService.signOut();
    setAuthState({ status: 'signed-out', session: null, error: '' });
  }

  if (authState.status === 'loading') {
    return (
      <main className="auth-screen">
        <p className="loading-text">Loading Google session...</p>
      </main>
    );
  }

  if (authState.status === 'signed-out') {
    return (
      <main className="auth-screen">
        <section className="auth-panel" aria-labelledby="auth-title">
          <span className="eyebrow">
            <ShieldCheck size={16} />
            Google authenticated CMS
          </span>
          <h1 id="auth-title">Assisted Multi-Site Content CMS</h1>
          <p>
            Sign in with Google to open your content workspace and keep draft, media, and published
            page records tied to your account.
          </p>
          {authState.error ? (
            <div className="auth-error" role="alert">
              <AlertCircle size={18} />
              <span>{authState.error}</span>
            </div>
          ) : null}
          <button className="button primary" type="button" onClick={handleGoogleSignIn}>
            {authState.error ? 'Try again' : 'Continue with Google'}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div>
          <span className="eyebrow">Authenticated workspace</span>
          <h1>Content Workspace</h1>
          <p>{authState.session.user.email}</p>
        </div>
        <div className="account-chip">
          <span>{authState.session.user.name}</span>
          <button className="icon-button" type="button" onClick={handleSignOut} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>
    </main>
  );
}

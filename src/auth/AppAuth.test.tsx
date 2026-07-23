import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from './localAuthService';

describe('Google sign-in gate', () => {
  test('keeps signed-out users out of the workspace and starts Google auth', async () => {
    const authService = createLocalAuthService({ storageKey: 'auth-gate-signed-out' });

    render(<App authService={authService} />);

    expect(screen.queryByRole('heading', { name: /content workspace/i })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }));

    expect(await screen.findByText('Taylor Morgan')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /content workspace/i })).toBeInTheDocument();
  });

  test('shows recoverable authentication errors', async () => {
    const authService = createLocalAuthService({
      failNextSignIn: true,
      storageKey: 'auth-gate-error',
    });

    render(<App authService={authService} />);
    await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/google authentication failed/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeEnabled();
  });

  test('loads an existing Google session into the workspace', async () => {
    const authService = createLocalAuthService({
      initialUser: {
        id: 'google-999',
        email: 'owner@example.com',
        name: 'Owner Example',
        avatarUrl: '',
        provider: 'google',
      },
      storageKey: 'auth-gate-existing-session',
    });

    render(<App authService={authService} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /content workspace/i })).toBeInTheDocument();
    });
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
  });
});

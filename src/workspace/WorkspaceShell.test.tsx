import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalWorkspaceService } from './localWorkspaceService';

const user: AuthUser = {
  id: 'google-shell-user',
  email: 'shell@example.com',
  name: 'Shell User',
  avatarUrl: '',
  provider: 'google',
};

describe('CMS workspace shell', () => {
  test('lands authenticated users in the three-pane CMS workspace', async () => {
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'workspace-shell-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'workspace-shell-data',
    });

    render(<App authService={authService} workspaceService={workspaceService} />);

    expect(await screen.findByRole('heading', { name: /content workspace/i })).toBeInTheDocument();
    expect(screen.queryByText(/static frontend/i)).not.toBeInTheDocument();
    expect(await screen.findByRole('region', { name: /content hierarchy/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /page preview/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /page inputs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
  });

  test('shows clear empty workspace and page selection states', async () => {
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'workspace-shell-empty-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'workspace-shell-empty-data',
    });

    render(<App authService={authService} workspaceService={workspaceService} />);

    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument();
    expect(screen.getByText(/create a category to start organizing pages/i)).toBeInTheDocument();
    expect(screen.getByText(/no page selected/i)).toBeInTheDocument();
    expect(screen.getByText(/select a page to collect inputs/i)).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { createLocalContentService } from './localContentService';

const user: AuthUser = {
  id: 'google-create-user',
  email: 'create@example.com',
  name: 'Create User',
  avatarUrl: '',
  provider: 'google',
};

describe('content node creation controls', () => {
  test('creates categories, subcategories, pages, and nested pages from the shell', async () => {
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'create-nodes-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'create-nodes-workspace',
    });
    const contentService = createLocalContentService({
      storageKey: 'create-nodes-content',
    });

    render(
      <App
        authService={authService}
        workspaceService={workspaceService}
        contentService={contentService}
      />,
    );

    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^create page$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /create category/i }));
    expect(await screen.findByRole('button', { name: /category 1 category/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /create subcategory/i }));
    expect(await screen.findByRole('button', { name: /subcategory 1 subcategory/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /category 1 category/i }));
    await userEvent.click(screen.getByRole('button', { name: /^create page$/i }));
    expect(await screen.findByRole('button', { name: /page 1 page/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /subcategory 1 subcategory/i }));
    await userEvent.click(screen.getByRole('button', { name: /^create page$/i }));
    expect(await screen.findByRole('button', { name: /page 2 page/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    await userEvent.click(screen.getByRole('button', { name: /create child page/i }));
    expect(await screen.findByRole('button', { name: /child page 1 page/i })).toBeInTheDocument();
  });

  test('created nodes remain after reload', async () => {
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'create-nodes-reload-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'create-nodes-reload-workspace',
    });
    const contentService = createLocalContentService({
      storageKey: 'create-nodes-reload-content',
    });

    const { unmount } = render(
      <App
        authService={authService}
        workspaceService={workspaceService}
        contentService={contentService}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /create category/i }));
    expect(await screen.findByRole('button', { name: /category 1 category/i })).toBeInTheDocument();

    unmount();
    render(
      <App
        authService={authService}
        workspaceService={workspaceService}
        contentService={contentService}
      />,
    );

    expect(await screen.findByRole('button', { name: /category 1 category/i })).toBeInTheDocument();
  });
});

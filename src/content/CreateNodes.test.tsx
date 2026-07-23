import { render, screen, waitFor } from '@testing-library/react';
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
  test('creates categories, pages, and nested pages from the shell', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: /create root category/i }));
    expect(await screen.findByRole('button', { name: /category 1 category/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /create child category/i }));
    expect(await screen.findByRole('button', { name: /category 2 category/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /category 1 category/i }));
    await userEvent.click(screen.getByRole('button', { name: /^create page$/i }));
    expect(await screen.findByRole('button', { name: /page 1 page/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /category 2 category/i }));
    await userEvent.click(screen.getByRole('button', { name: /^create page$/i }));
    expect(await screen.findByRole('button', { name: /page 2 page/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    await userEvent.click(screen.getByRole('button', { name: /create child page/i }));
    expect(await screen.findByRole('button', { name: /child page 1 page/i })).toBeInTheDocument();
  });

  test('creates cascading categories and generates page content on any selected tree item', async () => {
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'create-cascading-categories-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'create-cascading-categories-workspace',
    });
    const contentService = createLocalContentService({
      storageKey: 'create-cascading-categories-content',
    });

    render(
      <App
        authService={authService}
        workspaceService={workspaceService}
        contentService={contentService}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /create root category/i }));
    await userEvent.click(await screen.findByRole('button', { name: /category 1 category/i }));
    await userEvent.click(screen.getByRole('button', { name: /create child category/i }));
    await userEvent.click(await screen.findByRole('button', { name: /category 2 category/i }));
    await userEvent.click(screen.getByRole('button', { name: /create child category/i }));

    expect(await screen.findByRole('button', { name: /category 3 category/i })).toBeInTheDocument();
    expect(screen.getByText(/inputs for category 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate/i })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(await screen.findByText(/generated category 3/i)).toBeInTheDocument();
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

    await userEvent.click(await screen.findByRole('button', { name: /create root category/i }));
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

  test('edits category name and slug and deletes only empty categories', async () => {
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'category-edit-delete-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'category-edit-delete-workspace',
    });
    const contentService = createLocalContentService({
      storageKey: 'category-edit-delete-content',
    });

    render(
      <App
        authService={authService}
        workspaceService={workspaceService}
        contentService={contentService}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /create root category/i }));
    await userEvent.click(await screen.findByRole('button', { name: /category 1 category/i }));
    await userEvent.click(screen.getByRole('button', { name: /create child category/i }));
    await userEvent.click(await screen.findByRole('button', { name: /category 1 category/i }));

    await userEvent.clear(screen.getByLabelText(/category name/i));
    await userEvent.type(screen.getByLabelText(/category name/i), 'Campaign Hub');
    await userEvent.clear(screen.getByLabelText(/category slug/i));
    await userEvent.type(screen.getByLabelText(/category slug/i), 'campaign-hub');
    await userEvent.click(screen.getByRole('button', { name: /save category/i }));

    expect(await screen.findByRole('button', { name: /campaign hub category/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/category slug/i)).toHaveValue('campaign-hub');
    expect(screen.getByRole('button', { name: /delete category/i })).toBeDisabled();
    expect(screen.getByText(/delete child items before deleting this category/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /category 2 category/i }));
    expect(screen.getByRole('button', { name: /delete category/i })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /delete category/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /category 2 category/i })).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /delete category/i })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /delete category/i }));

    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument();
  });

  test('edits page name and slug and deletes only empty pages', async () => {
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'page-edit-delete-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'page-edit-delete-workspace',
    });
    const contentService = createLocalContentService({
      storageKey: 'page-edit-delete-content',
    });

    render(
      <App
        authService={authService}
        workspaceService={workspaceService}
        contentService={contentService}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /create root category/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^create page$/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^page 1 page$/i }));
    await userEvent.click(screen.getByRole('button', { name: /create child page/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^page 1 page$/i }));

    await userEvent.clear(screen.getByLabelText(/page name/i));
    await userEvent.type(screen.getByLabelText(/page name/i), 'Landing Page');
    await userEvent.clear(screen.getByLabelText(/page slug/i));
    await userEvent.type(screen.getByLabelText(/page slug/i), 'landing-page');
    await userEvent.click(screen.getByRole('button', { name: /save page/i }));

    expect(await screen.findByRole('button', { name: /landing page page/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/page slug/i)).toHaveValue('landing-page');
    expect(screen.getByRole('button', { name: /delete page/i })).toBeDisabled();
    expect(screen.getByText(/delete child items before deleting this page/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /child page 1 page/i }));
    expect(screen.getByRole('button', { name: /delete page/i })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /delete page/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /child page 1 page/i })).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /delete page/i })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /delete page/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /landing page page/i })).not.toBeInTheDocument();
    });
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { createLocalContentService } from './localContentService';

const user: AuthUser = {
  id: 'google-selection-user',
  email: 'selection@example.com',
  name: 'Selection User',
  avatarUrl: '',
  provider: 'google',
};

async function renderWorkspaceWithContent(storageSuffix: string) {
  const authService = createLocalAuthService({
    initialUser: user,
    storageKey: `selection-auth-${storageSuffix}`,
  });
  const workspaceService = createLocalWorkspaceService({
    storageKey: `selection-workspace-${storageSuffix}`,
  });
  const contentService = createLocalContentService({
    storageKey: `selection-content-${storageSuffix}`,
  });
  const workspace = await workspaceService.loadOrCreateWorkspace(user);
  const existingNodes = await contentService.listNodes(workspace.workspace.id);
  if (existingNodes.length === 0) {
    const category = await contentService.createNode({
      workspaceId: workspace.workspace.id,
      parentId: null,
      type: 'category',
      title: 'Category 1',
    });
    await contentService.createNode({
      workspaceId: workspace.workspace.id,
      parentId: category.id,
      type: 'page',
      title: 'Page 1',
    });
  }

  const rendered = render(
    <App
      authService={authService}
      workspaceService={workspaceService}
      contentService={contentService}
    />,
  );

  await screen.findByRole('button', { name: /page 1 page/i });
  return rendered;
}

describe('page selection and context loading', () => {
  test('selecting a page loads page preview and page-specific context panel', async () => {
    await renderWorkspaceWithContent('page-context');

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));

    expect(await screen.findByText(/selected page: page 1/i)).toBeInTheDocument();
    const inputsPanel = screen.getByRole('region', { name: /page inputs/i });
    expect(within(inputsPanel).getByText(/inputs for page 1/i)).toBeInTheDocument();
    expect(within(inputsPanel).getByText(/no inputs have been added to this page/i)).toBeInTheDocument();
    expect(within(inputsPanel).getByText(/draft: not generated/i)).toBeInTheDocument();
    expect(within(inputsPanel).getByText(/versions: 0/i)).toBeInTheDocument();
    expect(within(inputsPanel).getByText(/active version: none/i)).toBeInTheDocument();
  });

  test('selecting a category loads page context and category creation options', async () => {
    await renderWorkspaceWithContent('category-context');

    await userEvent.click(screen.getByRole('button', { name: /category 1 category/i }));

    expect(await screen.findByText(/selected page: category 1/i)).toBeInTheDocument();
    expect(screen.getByText(/inputs for category 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /create child category/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create page$/i })).toBeInTheDocument();
  });

  test('selected page survives a reload', async () => {
    const rendered = await renderWorkspaceWithContent('reload-context');

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    expect(await screen.findByText(/selected page: page 1/i)).toBeInTheDocument();

    rendered.unmount();
    await renderWorkspaceWithContent('reload-context');

    expect(await screen.findByText(/selected page: page 1/i)).toBeInTheDocument();
  });
});

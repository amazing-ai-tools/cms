import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { buildGenerationPayload } from '../generation/payload';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { createLocalPageContextService } from './localPageContextService';

const user: AuthUser = {
  id: 'google-link-user',
  email: 'links@example.com',
  name: 'Link User',
  avatarUrl: '',
  provider: 'google',
};

async function renderWorkspaceWithPage() {
  const authService = createLocalAuthService({
    initialUser: user,
    storageKey: 'page-links-auth',
  });
  const workspaceService = createLocalWorkspaceService({
    storageKey: 'page-links-workspace',
  });
  const contentService = createLocalContentService({
    storageKey: 'page-links-content',
  });
  const pageContextService = createLocalPageContextService({
    storageKey: 'page-links-context',
  });
  const workspace = await workspaceService.loadOrCreateWorkspace(user);
  const category = await contentService.createNode({
    workspaceId: workspace.workspace.id,
    parentId: null,
    type: 'category',
    title: 'Category 1',
  });
  const page = await contentService.createNode({
    workspaceId: workspace.workspace.id,
    parentId: category.id,
    type: 'page',
    title: 'Page 1',
  });

  render(
    <App
      authService={authService}
      contentService={contentService}
      pageContextService={pageContextService}
      workspaceService={workspaceService}
    />,
  );

  await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
  return { inputsPanel: screen.getByRole('region', { name: /page inputs/i }), page, pageContextService };
}

describe('page link capture', () => {
  test('rejects invalid URLs with a visible message', async () => {
    const { inputsPanel } = await renderWorkspaceWithPage();

    await userEvent.type(within(inputsPanel).getByLabelText(/message the page ai/i), 'Review https://bad');
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /send/i }));

    expect(await within(inputsPanel).findByRole('alert')).toHaveTextContent(/enter a valid url/i);
  });

  test('stores normalized links and includes them in the generation payload', async () => {
    const { inputsPanel, page, pageContextService } = await renderWorkspaceWithPage();

    await userEvent.type(
      within(inputsPanel).getByLabelText(/message the page ai/i),
      'Review example.com/launch-brief before generating.',
    );
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /send/i }));

    expect(await within(inputsPanel).findByText('https://example.com/launch-brief')).toBeInTheDocument();
    const pageContext = await pageContextService.loadPageContext(page.id);
    expect(buildGenerationPayload(pageContext).links).toEqual([
      'https://example.com/launch-brief',
    ]);
  });
});

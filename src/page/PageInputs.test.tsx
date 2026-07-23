import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { createLocalPageContextService } from './localPageContextService';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';

const user: AuthUser = {
  id: 'google-input-user',
  email: 'inputs@example.com',
  name: 'Input User',
  avatarUrl: '',
  provider: 'google',
};

async function renderWorkspaceWithPages() {
  const authService = createLocalAuthService({
    initialUser: user,
    storageKey: 'page-inputs-auth',
  });
  const workspaceService = createLocalWorkspaceService({
    storageKey: 'page-inputs-workspace',
  });
  const contentService = createLocalContentService({
    storageKey: 'page-inputs-content',
  });
  const pageContextService = createLocalPageContextService({
    storageKey: 'page-inputs-context',
  });
  const workspace = await workspaceService.loadOrCreateWorkspace(user);
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
  await contentService.createNode({
    workspaceId: workspace.workspace.id,
    parentId: category.id,
    type: 'page',
    title: 'Page 2',
  });

  render(
    <App
      authService={authService}
      contentService={contentService}
      pageContextService={pageContextService}
      workspaceService={workspaceService}
    />,
  );

  await screen.findByRole('button', { name: /page 1 page/i });
}

describe('right-side page input panel', () => {
  test('saves ideas and desired descriptions against the selected page in chronological order', async () => {
    await renderWorkspaceWithPages();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    const inputsPanel = screen.getByRole('region', { name: /page inputs/i });

    await userEvent.type(
      within(inputsPanel).getByLabelText(/idea or content description/i),
      'Use a concise launch narrative.',
    );
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /add input/i }));
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /description/i }));
    await userEvent.type(
      within(inputsPanel).getByLabelText(/idea or content description/i),
      'Describe the customer problem and the generated page goal.',
    );
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /add input/i }));

    const entries = await within(inputsPanel).findAllByRole('article');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent(/idea/i);
    expect(entries[0]).toHaveTextContent(/concise launch narrative/i);
    expect(entries[1]).toHaveTextContent(/description/i);
    expect(entries[1]).toHaveTextContent(/customer problem/i);
  });

  test('does not mix inputs between selected pages', async () => {
    await renderWorkspaceWithPages();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    await userEvent.type(
      screen.getByLabelText(/idea or content description/i),
      'Page one input only.',
    );
    await userEvent.click(screen.getByRole('button', { name: /add input/i }));

    await userEvent.click(screen.getByRole('button', { name: /page 2 page/i }));
    expect(await screen.findByText(/inputs for page 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/page one input only/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    expect(await screen.findByText(/page one input only/i)).toBeInTheDocument();
  });
});

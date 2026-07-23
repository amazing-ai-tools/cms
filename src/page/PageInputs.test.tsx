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
  test('saves instructions and desired descriptions against the selected page in chronological order', async () => {
    await renderWorkspaceWithPages();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    const inputsPanel = screen.getByRole('region', { name: /page inputs/i });

    await userEvent.type(
      within(inputsPanel).getByLabelText(/message the page ai/i),
      'Use a concise launch narrative.',
    );
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /send/i }));
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /description/i }));
    await userEvent.type(
      within(inputsPanel).getByLabelText(/message the page ai/i),
      'Describe the customer problem and the generated page goal.',
    );
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /send/i }));

    const inputFeed = await within(inputsPanel).findByLabelText(/saved inputs for page 1/i);
    const entries = within(inputFeed).getAllByRole('article');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent(/instruction/i);
    expect(entries[0]).toHaveTextContent(/concise launch narrative/i);
    expect(entries[1]).toHaveTextContent(/description/i);
    expect(entries[1]).toHaveTextContent(/customer problem/i);
  });

  test('sends a chat instruction with reference links and materials together', async () => {
    await renderWorkspaceWithPages();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    const inputsPanel = screen.getByRole('region', { name: /page inputs/i });
    const material = new File(['launch requirements'], 'brief.pdf', { type: 'application/pdf' });

    await userEvent.type(
      within(inputsPanel).getByLabelText(/message the page ai/i),
      'Use this positioning and review example.com/source before generating.',
    );
    await userEvent.upload(within(inputsPanel).getByLabelText(/attach materials/i), material);
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /send/i }));

    const inputFeed = await within(inputsPanel).findByLabelText(/saved inputs for page 1/i);
    const entries = within(inputFeed).getAllByRole('article');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent(/instruction/i);
    expect(entries[0]).toHaveTextContent(/use this positioning/i);
    expect(entries[1]).toHaveTextContent(/link/i);
    expect(entries[1]).toHaveTextContent('https://example.com/source');
    expect(await within(inputsPanel).findByText('brief.pdf')).toBeInTheDocument();
    expect(within(inputsPanel).getByText(/^pdf$/i)).toBeInTheDocument();
  });

  test('does not mix inputs between selected pages', async () => {
    await renderWorkspaceWithPages();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    await userEvent.type(
      screen.getByLabelText(/message the page ai/i),
      'Page one input only.',
    );
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    await userEvent.click(screen.getByRole('button', { name: /page 2 page/i }));
    expect(await screen.findByText(/inputs for page 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/page one input only/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    expect(await screen.findByText(/page one input only/i)).toBeInTheDocument();
  });
});

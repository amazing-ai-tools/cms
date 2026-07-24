import { fireEvent, render, screen, within } from '@testing-library/react';
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
  const pageOne = await contentService.createNode({
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

  return { pageContextService, pageOne };
}

describe('right-side page input panel', () => {
  test('keeps the composer simple and lets the system categorize plain text and links', async () => {
    await renderWorkspaceWithPages();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    const inputsPanel = screen.getByRole('region', { name: /page inputs/i });

    expect(within(inputsPanel).queryByRole('button', { name: /^instruction$/i })).not.toBeInTheDocument();
    expect(within(inputsPanel).queryByRole('button', { name: /^idea$/i })).not.toBeInTheDocument();
    expect(within(inputsPanel).queryByRole('button', { name: /^description$/i })).not.toBeInTheDocument();
    expect(within(inputsPanel).getByRole('button', { name: /must appear on page/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await userEvent.type(
      within(inputsPanel).getByLabelText(/message the page ai/i),
      'Use a concise launch narrative and review example.com/source.',
    );
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /send/i }));

    const inputFeed = await within(inputsPanel).findByLabelText(/saved inputs for page 1/i);
    const entries = within(inputFeed).getAllByRole('article');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent(/instruction/i);
    expect(entries[0]).toHaveTextContent(/concise launch narrative/i);
    expect(entries[1]).toHaveTextContent(/link/i);
    expect(entries[1]).toHaveTextContent('https://example.com/source');
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

  test('marks page inputs and uploads as AI context or required page content', async () => {
    const { pageContextService, pageOne } = await renderWorkspaceWithPages();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    const inputsPanel = screen.getByRole('region', { name: /page inputs/i });
    const logo = new File(['logo'], 'client-logo.png', { type: 'image/png' });

    expect(within(inputsPanel).getByRole('button', { name: /must appear on page/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await userEvent.click(within(inputsPanel).getByRole('button', { name: /must appear on page/i }));
    await userEvent.type(
      within(inputsPanel).getByLabelText(/message the page ai/i),
      'Use this exact guarantee: setup in 48 hours.',
    );
    await userEvent.upload(within(inputsPanel).getByLabelText(/attach materials/i), logo);
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /send/i }));

    const context = await pageContextService.loadPageContext(pageOne.id);
    expect(context.inputs[0]).toMatchObject({
      content: 'Use this exact guarantee: setup in 48 hours.',
      sourceIntent: 'required',
    });
    expect(context.assets[0]).toMatchObject({
      filename: 'client-logo.png',
      sourceIntent: 'required',
    });

    const inputFeed = await within(inputsPanel).findByLabelText(/saved inputs for page 1/i);
    expect(within(inputFeed).getByText(/must appear/i)).toBeInTheDocument();
    const assetList = await within(inputsPanel).findByLabelText(/uploaded materials for page 1/i);
    expect(within(assetList).getByText(/must appear/i)).toBeInTheDocument();
  });

  test('accepts pasted media files as pending attachments without extra categorization fields', async () => {
    const { pageContextService, pageOne } = await renderWorkspaceWithPages();

    await userEvent.click(screen.getByRole('button', { name: /page 1 page/i }));
    const inputsPanel = screen.getByRole('region', { name: /page inputs/i });
    const image = new File(['pasted image'], 'pasted-hero.png', { type: 'image/png' });
    const composer = within(inputsPanel).getByLabelText(/message the page ai/i);

    fireEvent.paste(composer, {
      clipboardData: {
        files: [image],
      },
    });

    expect(await within(inputsPanel).findByText('pasted-hero.png')).toBeInTheDocument();
    await userEvent.click(within(inputsPanel).getByRole('button', { name: /send/i }));

    const context = await pageContextService.loadPageContext(pageOne.id);
    expect(context.assets).toHaveLength(1);
    expect(context.assets[0]).toMatchObject({
      family: 'image',
      filename: 'pasted-hero.png',
      sourceIntent: 'context',
    });
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

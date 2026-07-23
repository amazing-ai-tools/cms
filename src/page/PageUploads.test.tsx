import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { createLocalPageContextService } from './localPageContextService';

const user: AuthUser = {
  id: 'google-upload-user',
  email: 'uploads@example.com',
  name: 'Upload User',
  avatarUrl: '',
  provider: 'google',
};

async function renderWorkspaceWithPage() {
  const authService = createLocalAuthService({
    initialUser: user,
    storageKey: 'page-uploads-auth',
  });
  const workspaceService = createLocalWorkspaceService({
    storageKey: 'page-uploads-workspace',
  });
  const contentService = createLocalContentService({
    storageKey: 'page-uploads-content',
  });
  const pageContextService = createLocalPageContextService({
    storageKey: 'page-uploads-context',
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

  render(
    <App
      authService={authService}
      contentService={contentService}
      pageContextService={pageContextService}
      workspaceService={workspaceService}
    />,
  );

  await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
  return screen.getByRole('region', { name: /page inputs/i });
}

describe('page material uploads', () => {
  test('uploads images, media, PDFs, and Word files against the selected page', async () => {
    const inputsPanel = await renderWorkspaceWithPage();
    const uploadInput = within(inputsPanel).getByLabelText(/upload page materials/i);
    const image = new File(['image'], 'hero.png', { type: 'image/png' });
    const media = new File(['media'], 'launch.mp4', { type: 'video/mp4' });
    const pdf = new File(['pdf'], 'brief.pdf', { type: 'application/pdf' });
    const word = new File(['word'], 'outline.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    await userEvent.upload(uploadInput, [image, media, pdf, word]);

    for (const [filename, family] of [
      ['hero.png', 'image'],
      ['launch.mp4', 'media'],
      ['brief.pdf', 'pdf'],
      ['outline.docx', 'word'],
    ] as const) {
      const asset = await within(inputsPanel).findByText(filename);
      const assetCard = asset.closest('article');
      expect(assetCard).not.toBeNull();
      expect(assetCard!).toHaveTextContent(family);
      expect(assetCard!).toHaveTextContent(/uploaded/i);
    }
  });

  test('shows a failure state for unsupported file families', async () => {
    const inputsPanel = await renderWorkspaceWithPage();
    const uploadInput = within(inputsPanel).getByLabelText(/upload page materials/i);
    const text = new File(['notes'], 'notes.txt', { type: 'text/plain' });

    await userEvent.upload(uploadInput, text);

    expect(await within(inputsPanel).findByRole('alert')).toHaveTextContent(
      /notes.txt is not a supported material/i,
    );
    expect(within(inputsPanel).queryByText(/uploaded/i)).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { createLocalPageContextService } from './localPageContextService';
import type { PageDraft } from './types';

const user: AuthUser = {
  id: 'google-edit-user',
  email: 'edit@example.com',
  name: 'Edit User',
  avatarUrl: '',
  provider: 'google',
};

function draftFor(pageId: string): PageDraft {
  return {
    id: 'draft-1',
    pageId,
    title: 'Initial launch page',
    isDirty: true,
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        content: 'Initial launch page',
        layout: {
          column: 1,
          row: 1,
          width: 12,
        },
        visual: {
          backgroundColor: '#f7fbf5',
          textColor: '#17211b',
          accentColor: '#2f7d5f',
          size: 'large',
        },
      },
      {
        id: 'block-proof',
        type: 'text',
        content: 'Proof points for the generated offer.',
        layout: {
          column: 1,
          row: 2,
          width: 6,
        },
        visual: {
          backgroundColor: '#ffffff',
          textColor: '#17211b',
          accentColor: '#2f7d5f',
          size: 'standard',
        },
      },
    ],
    layout: {
      canvas: {
        maxWidth: 1120,
      },
      sections: [
        {
          id: 'section-generated-proposal',
          blockIds: ['block-hero', 'block-proof'],
        },
      ],
    },
    visual: {
      accentColor: '#2f7d5f',
      backgroundColor: '#fbfcf8',
      textColor: '#18201c',
      spacing: 'balanced',
    },
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  };
}

async function renderWorkspaceWithDraft() {
  const authService = createLocalAuthService({
    initialUser: user,
    storageKey: 'page-edit-auth',
  });
  const workspaceService = createLocalWorkspaceService({
    storageKey: 'page-edit-workspace',
  });
  const contentService = createLocalContentService({
    storageKey: 'page-edit-content',
  });
  const pageContextService = createLocalPageContextService({
    storageKey: 'page-edit-context',
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
  await pageContextService.saveDraft(draftFor(page.id));

  render(
    <App
      authService={authService}
      contentService={contentService}
      pageContextService={pageContextService}
      workspaceService={workspaceService}
    />,
  );

  await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
  return { page, pageContextService };
}

describe('draft attribute editing', () => {
  test('edits generated title, colors, size, and layout attributes in draft state', async () => {
    const { page, pageContextService } = await renderWorkspaceWithDraft();
    const previewPanel = screen.getByRole('region', { name: /page preview/i });

    expect(
      await within(previewPanel).findByRole('heading', { name: /initial launch page/i }),
    ).toBeInTheDocument();

    fireEvent.change(within(previewPanel).getByLabelText(/draft title/i), {
      target: { value: 'Edited launch page' },
    });
    fireEvent.change(within(previewPanel).getByLabelText(/page background color/i), {
      target: { value: '#ffffff' },
    });
    await userEvent.selectOptions(
      within(previewPanel).getByLabelText(/element size/i),
      'compact',
    );
    fireEvent.change(within(previewPanel).getByLabelText(/element width/i), {
      target: { value: '6' },
    });

    expect(
      await within(previewPanel).findByRole('heading', { name: /edited launch page/i }),
    ).toBeInTheDocument();
    await waitFor(async () => {
      const savedDraft = (await pageContextService.loadPageContext(page.id)).draft;
      expect(savedDraft?.title).toBe('Edited launch page');
      expect(savedDraft?.visual.backgroundColor).toBe('#ffffff');
      expect(savedDraft?.blocks[0].visual.size).toBe('compact');
      expect(savedDraft?.blocks[0].layout.width).toBe(6);
    });
    expect(within(previewPanel).getByTestId('draft-preview')).toHaveStyle({
      backgroundColor: '#ffffff',
    });
    expect(within(previewPanel).getByTestId('draft-block-block-hero')).toHaveClass('compact');
    expect(within(previewPanel).getByTestId('draft-block-block-hero')).toHaveStyle({
      gridColumn: '1 / span 6',
    });
  });

  test('saves direct preview text edits back into the page draft', async () => {
    const { page, pageContextService } = await renderWorkspaceWithDraft();
    const previewPanel = screen.getByRole('region', { name: /page preview/i });
    const heroEditor = await within(previewPanel).findByRole('textbox', {
      name: /edit block block-hero content/i,
    });

    heroEditor.textContent = 'Edited directly inside the preview canvas.';
    fireEvent.blur(heroEditor);

    await waitFor(async () => {
      const savedDraft = (await pageContextService.loadPageContext(page.id)).draft;
      expect(savedDraft?.blocks[0].content).toBe('Edited directly inside the preview canvas.');
      expect(savedDraft?.isDirty).toBe(true);
    });
  });

  test('selects a preview element and edits its size, colors, and formatting', async () => {
    const { page, pageContextService } = await renderWorkspaceWithDraft();
    const previewPanel = screen.getByRole('region', { name: /page preview/i });

    await userEvent.click(await within(previewPanel).findByTestId('draft-block-block-proof'));

    expect(within(previewPanel).getByLabelText(/selected element/i)).toHaveValue('block-proof');

    fireEvent.change(within(previewPanel).getByLabelText(/element background color/i), {
      target: { value: '#fff4e6' },
    });
    fireEvent.change(within(previewPanel).getByLabelText(/element text color/i), {
      target: { value: '#101820' },
    });
    await userEvent.selectOptions(within(previewPanel).getByLabelText(/element size/i), 'large');
    fireEvent.change(within(previewPanel).getByLabelText(/element width/i), {
      target: { value: '8' },
    });
    await userEvent.selectOptions(
      within(previewPanel).getByLabelText(/element alignment/i),
      'center',
    );
    await userEvent.selectOptions(
      within(previewPanel).getByLabelText(/element weight/i),
      'bold',
    );

    await waitFor(async () => {
      const savedDraft = (await pageContextService.loadPageContext(page.id)).draft;
      const editedBlock = savedDraft?.blocks.find((block) => block.id === 'block-proof');
      expect(editedBlock?.visual).toMatchObject({
        backgroundColor: '#fff4e6',
        textColor: '#101820',
        size: 'large',
        textAlign: 'center',
        fontWeight: 'bold',
      });
      expect(editedBlock?.layout.width).toBe(8);
    });
    expect(within(previewPanel).getByTestId('draft-block-block-proof')).toHaveClass('selected');
    expect(within(previewPanel).getByTestId('draft-block-block-proof')).toHaveStyle({
      backgroundColor: '#fff4e6',
      color: '#101820',
      gridColumn: '1 / span 8',
      textAlign: 'center',
    });
  });
});

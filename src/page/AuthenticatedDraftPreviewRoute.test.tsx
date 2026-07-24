import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { createLocalPageContextService } from './localPageContextService';
import type { PageDraft } from './types';

const user: AuthUser = {
  id: 'google-preview-user',
  email: 'preview@example.com',
  name: 'Preview User',
  avatarUrl: '',
  provider: 'google',
};

function draftFor(pageId: string): PageDraft {
  return {
    id: `draft-${pageId}`,
    pageId,
    title: 'Partner Launch Draft',
    isDirty: true,
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        content: 'Partner launch experience built from the uploaded brief.',
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
    ],
    layout: {
      canvas: {
        maxWidth: 1120,
      },
      sections: [
        {
          id: 'section-generated-proposal',
          blockIds: ['block-hero'],
        },
      ],
    },
    visual: {
      accentColor: '#2f7d5f',
      backgroundColor: '#fbfcf8',
      textColor: '#18201c',
      spacing: 'balanced',
    },
    language: 'en',
    localizations: {
      fr: {
        title: 'Apercu partenaire',
        blocks: [
          {
            id: 'block-hero',
            type: 'hero',
            content: 'Experience partenaire localisee depuis le brief.',
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
        ],
      },
    },
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  };
}

function navigateTo(pathname: string) {
  window.history.pushState({}, '', pathname);
}

afterEach(() => {
  navigateTo('/');
  vi.restoreAllMocks();
});

describe('authenticated draft preview route', () => {
  test('renders the requested draft without the CMS workspace shell for signed-in users', async () => {
    navigateTo('/preview/page-1');
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'preview-route-auth',
    });
    const pageContextService = createLocalPageContextService({
      storageKey: 'preview-route-context',
    });
    await pageContextService.saveDraft(draftFor('page-1'));

    render(<App authService={authService} pageContextService={pageContextService} />);

    expect(await screen.findByRole('heading', { name: /partner launch draft/i })).toBeInTheDocument();
    expect(screen.getByText(/uploaded brief/i)).toBeInTheDocument();
    expect(screen.getByTestId('draft-preview')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /content hierarchy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /page inputs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish draft/i })).not.toBeInTheDocument();
  });

  test('lets signed-in users switch draft preview language from the standalone preview page', async () => {
    navigateTo('/preview/page-1');
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'preview-route-language-auth',
    });
    const pageContextService = createLocalPageContextService({
      storageKey: 'preview-route-language-context',
    });
    await pageContextService.saveDraft(draftFor('page-1'));

    render(<App authService={authService} pageContextService={pageContextService} />);

    await userEvent.selectOptions(await screen.findByLabelText(/preview language/i), 'fr');

    expect(screen.getByRole('heading', { name: /apercu partenaire/i })).toBeInTheDocument();
    expect(screen.getByText(/experience partenaire localisee/i)).toBeInTheDocument();
    expect(screen.getByTestId('draft-preview')).toHaveAttribute('lang', 'fr');
  });

  test('lets signed-in users inspect standalone previews at desktop tablet and mobile sizes', async () => {
    navigateTo('/preview/page-1');
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'preview-route-viewport-auth',
    });
    const pageContextService = createLocalPageContextService({
      storageKey: 'preview-route-viewport-context',
    });
    await pageContextService.saveDraft(draftFor('page-1'));

    render(<App authService={authService} pageContextService={pageContextService} />);

    expect(await screen.findByRole('heading', { name: /partner launch draft/i })).toBeInTheDocument();
    expect(screen.getByTestId('preview-viewport-frame')).toHaveAttribute('data-viewport', 'desktop');

    await userEvent.click(screen.getByRole('button', { name: /mobile 390/i }));

    expect(screen.getByTestId('preview-viewport-frame')).toHaveAttribute('data-viewport', 'mobile');
    expect(screen.getByTestId('preview-viewport-frame')).toHaveStyle({
      maxWidth: '390px',
    });

    await userEvent.click(screen.getByRole('button', { name: /tablet 768/i }));

    expect(screen.getByTestId('preview-viewport-frame')).toHaveAttribute('data-viewport', 'tablet');
    expect(screen.getByTestId('preview-viewport-frame')).toHaveStyle({
      maxWidth: '768px',
    });
  });

  test('requires Google sign-in before showing a draft preview', async () => {
    navigateTo('/preview/page-1');
    const authService = createLocalAuthService({ storageKey: 'preview-route-signed-out-auth' });
    const pageContextService = createLocalPageContextService({
      storageKey: 'preview-route-signed-out-context',
    });
    await pageContextService.saveDraft(draftFor('page-1'));

    render(<App authService={authService} pageContextService={pageContextService} />);

    expect(await screen.findByRole('heading', { name: /assisted multi-site content cms/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.queryByText(/partner launch draft/i)).not.toBeInTheDocument();
  });

  test('opens the selected draft preview route in a new tab from the workspace', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'preview-action-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'preview-action-workspace',
    });
    const contentService = createLocalContentService({
      storageKey: 'preview-action-content',
    });
    const pageContextService = createLocalPageContextService({
      storageKey: 'preview-action-context',
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
    const previewPanel = screen.getByRole('region', { name: /page preview/i });
    await waitFor(() => {
      expect(within(previewPanel).getByRole('button', { name: /open draft preview/i })).toBeEnabled();
    });

    expect(within(previewPanel).getByTestId('preview-viewport-frame')).toHaveAttribute(
      'data-viewport',
      'desktop',
    );
    await userEvent.click(within(previewPanel).getByRole('button', { name: /tablet 768/i }));
    expect(within(previewPanel).getByTestId('preview-viewport-frame')).toHaveAttribute(
      'data-viewport',
      'tablet',
    );

    await userEvent.click(within(previewPanel).getByRole('button', { name: /open draft preview/i }));

    expect(openSpy).toHaveBeenCalledWith(`/preview/${page.id}?lang=en`, '_blank', 'noopener,noreferrer');
  });
});

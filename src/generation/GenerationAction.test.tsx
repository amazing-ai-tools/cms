import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ComponentType } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { createLocalPageContextService } from '../page/localPageContextService';
import type { PageDraft } from '../page/types';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import type { GenerationResult, GenerationService } from './types';

const user: AuthUser = {
  id: 'google-generation-user',
  email: 'generation@example.com',
  name: 'Generation User',
  avatarUrl: '',
  provider: 'google',
};

type AppWithGenerationProps = ComponentProps<typeof App> & {
  generationService?: unknown;
};

const AppWithGeneration = App as ComponentType<AppWithGenerationProps>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function structuredDraft(pageId: string, title: string): PageDraft {
  return {
    id: 'draft-1',
    pageId,
    title,
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        content: title,
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
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  };
}

async function renderWorkspaceWithPage(generationService: GenerationService) {
  const authService = createLocalAuthService({
    initialUser: user,
    storageKey: 'generation-auth',
  });
  const workspaceService = createLocalWorkspaceService({
    storageKey: 'generation-workspace',
  });
  const contentService = createLocalContentService({
    storageKey: 'generation-content',
  });
  const pageContextService = createLocalPageContextService({
    storageKey: 'generation-context',
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
  await pageContextService.addInput({
    pageId: page.id,
    type: 'idea',
    content: 'Focus on the launch narrative.',
  });

  render(
    <AppWithGeneration
      authService={authService}
      contentService={contentService}
      generationService={generationService}
      pageContextService={pageContextService}
      workspaceService={workspaceService}
    />,
  );

  await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
  return { page, pageContextService };
}

describe('generate action and generation visibility', () => {
  test('runs a page-scoped generation job and saves a successful proposed draft', async () => {
    const generation = deferred<GenerationResult>();
    const generationService: GenerationService = {
      generateDraft: vi.fn(() => generation.promise),
    };
    const { page, pageContextService } = await renderWorkspaceWithPage(generationService);
    const previewPanel = screen.getByRole('region', { name: /page preview/i });

    const generateButton = within(previewPanel).getByRole('button', { name: /generate/i });
    expect(generateButton).toBeEnabled();
    await userEvent.click(generateButton);

    expect(generationService.generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        hierarchyPath: ['Category 1', 'Page 1'],
        pageId: page.id,
        pageTitle: 'Page 1',
        pageContext: expect.objectContaining({
          inputs: [expect.objectContaining({ content: 'Focus on the launch narrative.' })],
        }),
      }),
    );
    expect(await within(previewPanel).findByText(/generation running/i)).toBeInTheDocument();
    expect(within(previewPanel).getByText(/collecting page inputs/i)).toBeInTheDocument();
    expect(within(previewPanel).getByText(/preparing draft request/i)).toBeInTheDocument();

    generation.resolve({
      draft: structuredDraft(page.id, 'Generated launch page'),
      job: {
        id: 'job-1',
        pageId: page.id,
        status: 'succeeded',
        steps: ['Collecting page inputs', 'Saving proposed draft'],
      },
    });

    expect(await within(previewPanel).findByText(/generation succeeded/i)).toBeInTheDocument();
    expect(
      await within(previewPanel).findByRole('heading', { name: /generated launch page/i }),
    ).toBeInTheDocument();
    await waitFor(async () => {
      expect((await pageContextService.loadPageContext(page.id)).draft?.title).toBe(
        'Generated launch page',
      );
    });
    expect(await screen.findByText(/draft: generated/i)).toBeInTheDocument();
  });

  test('shows failed generation without replacing the existing draft', async () => {
    const success = deferred<GenerationResult>();
    const failure = deferred<GenerationResult>();
    const generationService: GenerationService = {
      generateDraft: vi
        .fn()
        .mockReturnValueOnce(success.promise)
        .mockReturnValueOnce(failure.promise),
    };
    const { page, pageContextService } = await renderWorkspaceWithPage(generationService);
    const previewPanel = screen.getByRole('region', { name: /page preview/i });
    const generateButton = within(previewPanel).getByRole('button', { name: /generate/i });

    await userEvent.click(generateButton);
    success.resolve({
      draft: structuredDraft(page.id, 'Generated launch page'),
      job: { id: 'job-1', pageId: page.id, status: 'succeeded', steps: [] },
    });
    expect(await within(previewPanel).findByText(/generation succeeded/i)).toBeInTheDocument();

    await userEvent.click(generateButton);
    failure.resolve({
      job: {
        error: 'AI provider unavailable',
        id: 'job-2',
        pageId: page.id,
        status: 'failed',
        steps: ['Collecting page inputs', 'AI provider unavailable'],
      },
    });

    expect(await within(previewPanel).findByRole('alert')).toHaveTextContent(
      /ai provider unavailable/i,
    );
    expect((await pageContextService.loadPageContext(page.id)).draft?.title).toBe(
      'Generated launch page',
    );
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { createLocalPageContextService } from '../page/localPageContextService';
import type { PageDraft } from '../page/types';
import { createLocalCdnService } from '../publication/localCdnService';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { buildEmbedSnippet, renderEmbedFromCdn } from './embedScript';

const user: AuthUser = {
  id: 'google-embed-user',
  email: 'embed@example.com',
  name: 'Embed User',
  avatarUrl: '',
  provider: 'google',
};

function draftFor(pageId: string, title: string): PageDraft {
  return {
    id: `draft-${pageId}`,
    pageId,
    title,
    isDirty: true,
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        content: `${title} external content`,
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
    seo: {
      title: `${title} | Customer site`,
      description: `${title} embed optimized for search discovery.`,
      keywords: ['embedded content', 'customer site'],
    },
    language: 'en',
    localizations: {
      fr: {
        title: 'Page integree',
        seo: {
          title: 'Page integree | Site client',
          description: 'Page integree optimisee pour la recherche.',
          keywords: ['page integree', 'site client'],
        },
        blocks: [
          {
            id: 'block-hero',
            type: 'hero',
            content: 'Experience de lancement partenaire issue du brief.',
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

async function createEmbedFixture(storagePrefix: string, publish: boolean) {
  const cdnService = createLocalCdnService({ storageKey: `${storagePrefix}-cdn` });
  const authService = createLocalAuthService({
    initialUser: user,
    storageKey: `${storagePrefix}-auth`,
  });
  const workspaceService = createLocalWorkspaceService({
    storageKey: `${storagePrefix}-workspace`,
  });
  const contentService = createLocalContentService({
    storageKey: `${storagePrefix}-content`,
  });
  const pageContextService = createLocalPageContextService({
    cdnService,
    storageKey: `${storagePrefix}-page`,
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
  await pageContextService.saveDraft(draftFor(page.id, 'Embedded page'));
  if (publish) {
    await pageContextService.publishDraft({ createdBy: user.id, pageId: page.id });
  }

  return {
    authService,
    cdnService,
    contentService,
    page,
    pageContextService,
    workspaceService,
  };
}

describe('external embed script', () => {
  test('builds a script snippet for the active version and renders CDN content into a target', async () => {
    const { cdnService, page, pageContextService } = await createEmbedFixture('embed-runtime', true);
    const activeVersion = await pageContextService.getActivePublishedVersion(page.id);
    expect(activeVersion).not.toBeNull();

    const snippet = buildEmbedSnippet(activeVersion!, 'fr');

    expect(snippet).toContain(`src="${activeVersion!.cdnUrls.script}"`);
    expect(snippet).toContain(`data-page-id="${page.id}"`);
    expect(snippet).toContain('data-language="fr"');
    expect(snippet).toContain(`data-content-url="${activeVersion!.cdnUrls.content}"`);

    const target = document.createElement('div');
    await renderEmbedFromCdn({
      cdnService,
      contentUrl: activeVersion!.cdnUrls.content,
      language: 'fr',
      target,
    });

    expect(target).toHaveTextContent('Page integree');
    expect(target).toHaveTextContent('Experience de lancement partenaire');
    expect(target.querySelector('h1')).toHaveTextContent('Page integree');
    expect(target.querySelector('script[type="application/ld+json"]')).toHaveTextContent(
      'Page integree | Site client',
    );
  });

  test('renders embedded SEO metadata as semantic article attributes and JSON-LD', async () => {
    const target = document.createElement('div');
    await renderEmbedFromCdn({
      cdnService: {
        publishVersion: async () => {
          throw new Error('publishVersion is not used by this test.');
        },
        readJson: async <T,>() => ({
          title: 'Searchable service page',
          seo: {
            title: 'Searchable Service Page | Example',
            description: 'A searchable embedded service page with crawlable sections and links.',
            keywords: ['service page', 'embedded SEO'],
          },
          blocks: [
            {
              id: 'block-hero',
              type: 'hero',
              content: 'Searchable hero copy for the embedded service.',
              layout: { column: 1, row: 1, width: 12 },
              visual: {
                backgroundColor: '#ffffff',
                textColor: '#17211b',
                accentColor: '#2f7d5f',
                size: 'large',
              },
            },
          ],
          layout: {
            canvas: { maxWidth: 1120 },
            sections: [{ id: 'section-main', title: 'Service details', blockIds: ['block-hero'] }],
          },
          visual: {
            accentColor: '#2f7d5f',
            backgroundColor: '#fbfcf8',
            textColor: '#18201c',
            spacing: 'balanced',
          },
          mediaAssets: [],
        }) as T,
        verifyUrl: async () => false,
      },
      contentUrl: 'https://cdn.local/page/content.json',
      target,
    });

    const article = target.querySelector('article');
    expect(article).toHaveAttribute('aria-label', 'Searchable Service Page | Example');
    expect(article).toHaveAttribute(
      'data-seo-description',
      'A searchable embedded service page with crawlable sections and links.',
    );
    expect(target.querySelector('h1')).toHaveTextContent('Searchable service page');
    expect(target.querySelector('h2')).toHaveTextContent('Service details');
    expect(target.querySelector('script[type="application/ld+json"]')).toHaveTextContent(
      'Searchable Service Page | Example',
    );
  });

  test('renders required media blocks as CDN-backed image, audio, video, and download elements', async () => {
    const cdnService = createLocalCdnService({ storageKey: 'embed-runtime-media-cdn' });
    const pageContextService = createLocalPageContextService({
      cdnService,
      storageKey: 'embed-runtime-media-page',
    });
    await pageContextService.addAsset({
      pageId: 'page-media',
      filename: 'hero.png',
      mimeType: 'image/png',
      size: 4,
      sourceContent: 'data:image/png;base64,aGVybw==',
      sourceEncoding: 'data-url',
      sourceIntent: 'required',
    });
    await pageContextService.addAsset({
      pageId: 'page-media',
      filename: 'intro.mp3',
      mimeType: 'audio/mpeg',
      size: 5,
      sourceContent: 'data:audio/mpeg;base64,YXVkaW8=',
      sourceEncoding: 'data-url',
      sourceIntent: 'required',
    });
    await pageContextService.addAsset({
      pageId: 'page-media',
      filename: 'tour.mp4',
      mimeType: 'video/mp4',
      size: 5,
      sourceContent: 'data:video/mp4;base64,dmlkZW8=',
      sourceEncoding: 'data-url',
      sourceIntent: 'required',
    });
    await pageContextService.addAsset({
      pageId: 'page-media',
      filename: 'offer.pdf',
      mimeType: 'application/pdf',
      size: 3,
      sourceContent: 'data:application/pdf;base64,cGRm',
      sourceEncoding: 'data-url',
      sourceIntent: 'required',
    });
    await pageContextService.saveDraft({
      ...draftFor('page-media', 'Media embed page'),
      blocks: ['asset-1', 'asset-2', 'asset-3', 'asset-4'].map((assetId, index) => ({
        id: `block-${assetId}`,
        type: 'media',
        assetId,
        content: ['hero.png', 'intro.mp3', 'tour.mp4', 'offer.pdf'][index],
        layout: {
          column: index % 2 === 0 ? 1 : 7,
          row: Math.floor(index / 2) + 1,
          width: 6,
        },
        visual: {
          backgroundColor: '#f7fbf5',
          textColor: '#17211b',
          accentColor: '#2f7d5f',
          size: 'standard',
        },
      })),
      layout: {
        canvas: { maxWidth: 1120 },
        sections: [
          {
            id: 'section-media',
            blockIds: ['block-asset-1', 'block-asset-2', 'block-asset-3', 'block-asset-4'],
          },
        ],
      },
    });
    const version = await pageContextService.publishDraft({
      createdBy: user.id,
      pageId: 'page-media',
    });

    const target = document.createElement('div');
    await renderEmbedFromCdn({
      cdnService,
      contentUrl: version.cdnUrls.content,
      target,
    });

    expect(target.querySelector('img')?.getAttribute('src')).toBe(version.cdnUrls.media[0]);
    expect(target.querySelector('audio')?.getAttribute('src')).toBe(version.cdnUrls.media[1]);
    expect(target.querySelector('video')?.getAttribute('src')).toBe(version.cdnUrls.media[2]);
    expect(target.querySelector('a[download]')?.getAttribute('href')).toBe(version.cdnUrls.media[3]);
  });

  test('renders child content href blocks as links in the embedded site', async () => {
    const target = document.createElement('div');
    await renderEmbedFromCdn({
      cdnService: {
        publishVersion: async () => {
          throw new Error('publishVersion is not used by this test.');
        },
        readJson: async <T,>() => ({
          title: 'Project index',
          blocks: [
            {
              id: 'block-child-project-alpha',
              type: 'text',
              content: 'Open Project Alpha',
              href: '/category-1/page-1/project-alpha',
              layout: {
                column: 1,
                row: 1,
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
            canvas: { maxWidth: 1120 },
            sections: [{ id: 'section-children', blockIds: ['block-child-project-alpha'] }],
          },
          visual: {
            accentColor: '#2f7d5f',
            backgroundColor: '#fbfcf8',
            textColor: '#18201c',
            spacing: 'balanced',
          },
          mediaAssets: [],
        }) as T,
        verifyUrl: async () => false,
      },
      contentUrl: 'https://cdn.local/page/content.json',
      target,
    });

    expect(target.querySelector('a')?.getAttribute('href')).toBe(
      '/category-1/page-1/project-alpha',
    );
    expect(target.querySelector('a')).toHaveTextContent('Open Project Alpha');
  });

  test('CMS displays an embed script after publish and explains when publishing is required', async () => {
    const unpublishedServices = await createEmbedFixture('embed-unpublished-ui', false);

    const firstRender = render(
      <App
        authService={unpublishedServices.authService}
        contentService={unpublishedServices.contentService}
        pageContextService={unpublishedServices.pageContextService}
        workspaceService={unpublishedServices.workspaceService}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
    expect(await screen.findByText(/publish this page before embedding/i)).toBeInTheDocument();

    firstRender.unmount();
    const publishedServices = await createEmbedFixture('embed-published-ui', true);
    render(
      <App
        authService={publishedServices.authService}
        contentService={publishedServices.contentService}
        pageContextService={publishedServices.pageContextService}
        workspaceService={publishedServices.workspaceService}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));

    const snippet = await screen.findByLabelText(/embed script/i);
    const snippetValue = (snippet as HTMLTextAreaElement).value;
    expect(snippetValue).toContain('<script');
    expect(snippetValue).toContain('https://cdn.local/assisted-cms/renderers/assisted-cms-embed.js');
  });
});

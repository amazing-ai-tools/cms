import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PageDraftPreview } from './PageDraftPreview';
import type { PageAsset, PageDraft } from './types';

const draft: PageDraft = {
  id: 'draft-1',
  pageId: 'page-1',
  title: 'Membership Launch',
  isDirty: true,
  blocks: [
    {
      id: 'block-hero',
      type: 'hero',
      content: 'Launch the editorial membership with a concise promise.',
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
      content: 'Add workflow proof points for content operations teams.',
      layout: {
        column: 1,
        row: 2,
        width: 7,
      },
      visual: {
        backgroundColor: '#ffffff',
        textColor: '#2c332f',
        accentColor: '#d66b3d',
        size: 'standard',
      },
    },
    {
      id: 'block-asset-1',
      type: 'media',
      assetId: 'asset-1',
      content: 'hero.jpg',
      layout: {
        column: 8,
        row: 2,
        width: 5,
      },
      visual: {
        backgroundColor: '#eef3f1',
        textColor: '#27302b',
        accentColor: '#2f7d5f',
        size: 'compact',
      },
    },
  ],
  layout: {
    canvas: {
      maxWidth: 1120,
    },
    sections: [
      {
        id: 'section-1',
        blockIds: ['block-hero', 'block-proof', 'block-asset-1'],
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
    title: 'Membership Launch | Editorial CMS',
    description: 'Launch an editorial membership with workflow proof points and publishable assets.',
    keywords: ['membership launch', 'editorial workflow', 'content operations'],
  },
  language: 'en',
  localizations: {
    fr: {
      title: 'Lancement Adhesion',
      seo: {
        title: 'Lancement Adhesion | CMS Editorial',
        description: 'Lancez une adhesion editoriale avec des preuves de workflow.',
        keywords: ['adhesion editoriale', 'workflow editorial'],
      },
      blocks: [
        {
          id: 'block-hero',
          type: 'hero',
          content: 'Lancez ladhesion editoriale avec une promesse claire.',
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
          content: 'Ajoutez des preuves de workflow pour les equipes de contenu.',
          layout: {
            column: 1,
            row: 2,
            width: 7,
          },
          visual: {
            backgroundColor: '#ffffff',
            textColor: '#2c332f',
            accentColor: '#d66b3d',
            size: 'standard',
          },
        },
        {
          id: 'block-asset-1',
          type: 'media',
          assetId: 'asset-1',
          content: 'hero.jpg',
          layout: {
            column: 8,
            row: 2,
            width: 5,
          },
          visual: {
            backgroundColor: '#eef3f1',
            textColor: '#27302b',
            accentColor: '#2f7d5f',
            size: 'compact',
          },
        },
      ],
    },
  },
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

const assets: PageAsset[] = [
  {
    id: 'asset-1',
    pageId: 'page-1',
    filename: 'hero.jpg',
    mimeType: 'image/jpeg',
    size: 2048,
    family: 'image',
    storageUrl: 'local://assets/page-1/asset-1/hero.jpg',
    cdnUrl: null,
    sourceIntent: 'required',
    uploadState: 'uploaded',
    createdAt: '2026-07-23T00:00:00.000Z',
  },
];

describe('page draft preview', () => {
  test('renders structured text and media blocks with stored positioning and visual attributes', () => {
    render(<PageDraftPreview assets={assets} draft={draft} />);

    expect(screen.getByRole('heading', { level: 1, name: /membership launch/i })).toBeInTheDocument();
    expect(screen.getByText(/concise promise/i)).toBeInTheDocument();
    expect(screen.getByText(/workflow proof points/i)).toBeInTheDocument();
    expect(screen.getByText(/hero.jpg/i)).toBeInTheDocument();

    expect(screen.getByTestId('draft-preview')).toHaveStyle({
      backgroundColor: '#fbfcf8',
      color: '#18201c',
      maxWidth: '1120px',
    });
    expect(screen.getByTestId('draft-block-block-hero')).toHaveStyle({
      backgroundColor: '#f7fbf5',
      color: '#17211b',
      gridColumn: '1 / span 12',
      gridRow: '1',
    });
    expect(screen.getByTestId('draft-block-block-asset-1')).toHaveAttribute(
      'data-asset-family',
      'image',
    );
  });

  test('renders draft media blocks as image, audio, video, and download elements in the preview', () => {
    const mediaAssets: PageAsset[] = [
      {
        ...assets[0],
        id: 'asset-image',
        filename: 'hero.png',
        mimeType: 'image/png',
        family: 'image',
        sourceContent: 'data:image/png;base64,aGVybw==',
        sourceEncoding: 'data-url',
      },
      {
        ...assets[0],
        id: 'asset-audio',
        filename: 'intro.mp3',
        mimeType: 'audio/mpeg',
        family: 'audio',
        sourceContent: 'data:audio/mpeg;base64,YXVkaW8=',
        sourceEncoding: 'data-url',
      },
      {
        ...assets[0],
        id: 'asset-video',
        filename: 'tour.mp4',
        mimeType: 'video/mp4',
        family: 'video',
        sourceContent: 'data:video/mp4;base64,dmlkZW8=',
        sourceEncoding: 'data-url',
      },
      {
        ...assets[0],
        id: 'asset-document',
        filename: 'terms.pdf',
        mimeType: 'application/pdf',
        family: 'pdf',
        sourceContent: 'data:application/pdf;base64,cGRm',
        sourceEncoding: 'data-url',
      },
    ];
    const mediaBlocks = mediaAssets.map((asset, index) => ({
      id: `block-${asset.id}`,
      type: 'media' as const,
      assetId: asset.id,
      content: asset.filename,
      layout: {
        column: index % 2 === 0 ? 1 : 7,
        row: Math.floor(index / 2) + 1,
        width: 6,
      },
      visual: {
        backgroundColor: '#eef3f1',
        textColor: '#27302b',
        accentColor: '#2f7d5f',
        size: 'standard' as const,
      },
    }));

    const { container } = render(
      <PageDraftPreview
        assets={mediaAssets}
        draft={{
          ...draft,
          blocks: mediaBlocks,
          layout: {
            ...draft.layout,
            sections: [
              {
                id: 'section-media',
                blockIds: mediaBlocks.map((block) => block.id),
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByRole('img', { name: /hero.png/i })).toHaveAttribute(
      'src',
      'data:image/png;base64,aGVybw==',
    );
    expect(container.querySelector('audio')?.getAttribute('src')).toBe(
      'data:audio/mpeg;base64,YXVkaW8=',
    );
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      'data:video/mp4;base64,dmlkZW8=',
    );
    expect(screen.getByRole('link', { name: /download terms.pdf/i })).toHaveAttribute(
      'href',
      'data:application/pdf;base64,cGRm',
    );
  });

  test('renders localized draft copy when a preview language is selected', () => {
    render(<PageDraftPreview assets={assets} draft={draft} language="fr" />);

    expect(screen.getByRole('heading', { level: 1, name: /lancement adhesion/i })).toBeInTheDocument();
    expect(screen.getByText(/promesse claire/i)).toBeInTheDocument();
    expect(screen.queryByText(/concise promise/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('draft-preview')).toHaveAttribute('lang', 'fr');
  });

  test('exposes SEO metadata on the preview article for crawlers and embed consumers', () => {
    render(<PageDraftPreview assets={assets} draft={draft} language="fr" />);

    expect(screen.getByTestId('draft-preview')).toHaveAttribute(
      'data-seo-title',
      'Lancement Adhesion | CMS Editorial',
    );
    expect(screen.getByTestId('draft-preview')).toHaveAttribute(
      'data-seo-description',
      'Lancez une adhesion editoriale avec des preuves de workflow.',
    );
    expect(screen.getByTestId('draft-preview')).toHaveAttribute(
      'data-seo-keywords',
      'adhesion editoriale, workflow editorial',
    );
  });

  test('renders draft text blocks with href as clickable child content links', () => {
    const linkBlock = {
      ...draft.blocks[1],
      content: 'Open Project Alpha',
      href: '/category-1/page-1/project-alpha',
      id: 'block-child-project-alpha',
    } as PageDraft['blocks'][number] & { href: string };
    render(
      <PageDraftPreview
        assets={assets}
        draft={{
          ...draft,
          blocks: [linkBlock],
          layout: {
            ...draft.layout,
            sections: [{ id: 'section-children', blockIds: [linkBlock.id] }],
          },
        }}
      />,
    );

    expect(screen.getByRole('link', { name: /open project alpha/i })).toHaveAttribute(
      'href',
      '/category-1/page-1/project-alpha',
    );
  });

  test('lets editors change base draft title and block copy directly in the preview', () => {
    const changedDrafts: PageDraft[] = [];
    render(
      <PageDraftPreview
        assets={assets}
        draft={draft}
        editable
        onDraftChange={(nextDraft) => {
          changedDrafts.push(nextDraft);
        }}
      />,
    );

    const titleEditor = screen.getByRole('textbox', { name: /edit preview title/i });
    titleEditor.textContent = 'Edited membership launch';
    fireEvent.blur(titleEditor);

    expect(changedDrafts[changedDrafts.length - 1]?.title).toBe('Edited membership launch');

    const blockEditor = screen.getByRole('textbox', { name: /edit block block-proof content/i });
    blockEditor.textContent = 'Edited proof points from the preview.';
    fireEvent.blur(blockEditor);

    const latestDraft = changedDrafts[changedDrafts.length - 1];
    expect(latestDraft?.blocks.find((block) => block.id === 'block-proof')?.content).toBe(
      'Edited proof points from the preview.',
    );
  });

  test('lets editors change localized draft copy without overwriting the base language', () => {
    const changedDrafts: PageDraft[] = [];
    render(
      <PageDraftPreview
        assets={assets}
        draft={draft}
        editable
        language="fr"
        onDraftChange={(nextDraft) => {
          changedDrafts.push(nextDraft);
        }}
      />,
    );

    const titleEditor = screen.getByRole('textbox', { name: /edit preview title/i });
    titleEditor.textContent = 'Lancement adhesion edite';
    fireEvent.blur(titleEditor);

    const latestDraft = changedDrafts[changedDrafts.length - 1];
    expect(latestDraft?.title).toBe('Membership Launch');
    expect(latestDraft?.localizations?.fr?.title).toBe('Lancement adhesion edite');
  });
});

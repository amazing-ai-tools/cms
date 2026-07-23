import { render, screen } from '@testing-library/react';
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
    uploadState: 'uploaded',
    createdAt: '2026-07-23T00:00:00.000Z',
  },
];

describe('page draft preview', () => {
  test('renders structured text and media blocks with stored positioning and visual attributes', () => {
    render(<PageDraftPreview assets={assets} draft={draft} />);

    expect(screen.getByRole('heading', { name: /membership launch/i })).toBeInTheDocument();
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
});

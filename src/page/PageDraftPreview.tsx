import type { CSSProperties } from 'react';
import type { PageAsset, PageDraft, PageDraftBlock } from './types';

interface PageDraftPreviewProps {
  assets: PageAsset[];
  draft: PageDraft;
  language?: string;
}

function localizedDraftContent(draft: PageDraft, language?: string) {
  const requestedLanguage = language || draft.language || 'en';
  const localization =
    requestedLanguage && requestedLanguage !== (draft.language ?? 'en')
      ? draft.localizations?.[requestedLanguage]
      : null;

  return {
    blocks: localization?.blocks ?? draft.blocks,
    layout: localization?.layout ?? draft.layout,
    language: requestedLanguage,
    title: localization?.title ?? draft.title,
    visual: localization?.visual ?? draft.visual,
  };
}

function blockStyle(block: PageDraftBlock): CSSProperties {
  return {
    backgroundColor: block.visual.backgroundColor,
    color: block.visual.textColor,
    gridColumn: `${block.layout.column} / span ${block.layout.width}`,
    gridRow: `${block.layout.row}`,
  };
}

function classNameFor(block: PageDraftBlock) {
  return `draft-block ${block.type} ${block.visual.size}`;
}

export function PageDraftPreview({ assets, draft, language }: PageDraftPreviewProps) {
  const localizedDraft = localizedDraftContent(draft, language);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const blocksById = new Map(localizedDraft.blocks.map((block) => [block.id, block]));

  return (
    <article
      className={`draft-preview ${localizedDraft.visual.spacing}`}
      data-testid="draft-preview"
      lang={localizedDraft.language}
      style={{
        backgroundColor: localizedDraft.visual.backgroundColor,
        color: localizedDraft.visual.textColor,
        maxWidth: `${localizedDraft.layout.canvas.maxWidth}px`,
      }}
    >
      <header className="draft-preview-header">
        <span style={{ color: localizedDraft.visual.accentColor }}>Draft proposal</span>
        <h3>{localizedDraft.title}</h3>
      </header>
      {localizedDraft.layout.sections.map((section) => (
        <section className="draft-preview-section" key={section.id}>
          {section.title ? <h4>{section.title}</h4> : null}
          <div className="draft-preview-grid">
            {section.blockIds.map((blockId) => {
              const block = blocksById.get(blockId);
              if (!block) {
                return null;
              }
              const asset = block.assetId ? assetsById.get(block.assetId) : null;

              return (
                <article
                  className={classNameFor(block)}
                  data-asset-family={asset?.family}
                  data-testid={`draft-block-${block.id}`}
                  key={block.id}
                  style={blockStyle(block)}
                >
                  {block.type === 'hero' ? <strong>{block.content}</strong> : null}
                  {block.type === 'text' ? <p>{block.content}</p> : null}
                  {block.type === 'media' ? (
                    <div className="draft-media-block">
                      <span>{asset?.filename ?? block.content}</span>
                      <small>{asset?.family ?? 'media'}</small>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </article>
  );
}

import type { CSSProperties, FocusEvent, ReactNode } from 'react';
import type {
  PageAsset,
  PageDraft,
  PageDraftBlock,
  PageDraftLayout,
  PageDraftSeo,
  PageDraftVisual,
} from './types';

interface PageDraftPreviewProps {
  assets: PageAsset[];
  draft: PageDraft;
  editable?: boolean;
  language?: string;
  onDraftChange?: (draft: PageDraft) => void;
}

export function contentForPreviewLanguage(draft: PageDraft, language?: string): {
  blocks: PageDraftBlock[];
  layout: PageDraftLayout;
  language: string;
  seo?: PageDraftSeo;
  title: string;
  visual: PageDraftVisual;
} {
  const requestedLanguage = language || draft.language || 'en';
  const localization =
    requestedLanguage && requestedLanguage !== (draft.language ?? 'en')
      ? draft.localizations?.[requestedLanguage]
      : null;

  return {
    blocks: localization?.blocks ?? draft.blocks,
    layout: localization?.layout ?? draft.layout,
    language: requestedLanguage,
    seo: localization?.seo ?? draft.seo,
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

function linkedContent(block: PageDraftBlock, children?: ReactNode) {
  const content = children ?? block.content;
  return block.href ? <a href={block.href}>{content}</a> : content;
}

function mediaSourceFor(asset: PageAsset | null) {
  if (!asset) {
    return '';
  }

  if (asset.cdnUrl) {
    return asset.cdnUrl;
  }

  if (asset.sourceEncoding === 'data-url' && asset.sourceContent) {
    return asset.sourceContent;
  }

  if (/^https?:\/\//i.test(asset.storageUrl) || asset.storageUrl.startsWith('data:')) {
    return asset.storageUrl;
  }

  return '';
}

function MediaPreviewElement({
  asset,
  block,
}: {
  asset: PageAsset | null;
  block: PageDraftBlock;
}) {
  const label = block.content || asset?.filename || 'Media';
  const source = mediaSourceFor(asset);

  if (!asset || !source) {
    return (
      <div className="draft-media-placeholder">
        <span>Media preview unavailable</span>
        <small>{asset?.family ?? 'media'}</small>
      </div>
    );
  }

  if (asset.mimeType.startsWith('image/')) {
    return <img alt={label} className="draft-media-element" loading="lazy" src={source} />;
  }

  if (asset.mimeType.startsWith('audio/')) {
    return <audio className="draft-media-element" controls src={source} />;
  }

  if (asset.mimeType.startsWith('video/')) {
    return <video className="draft-media-element" controls playsInline src={source} />;
  }

  return (
    <a className="draft-media-download" download={asset.filename} href={source}>
      Download {asset.filename}
    </a>
  );
}

function textFrom(element: HTMLElement) {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function updatedLocalizationLayout(draft: PageDraft, language: string) {
  return draft.localizations?.[language]?.layout ?? {
    ...draft.layout,
    sections: draft.layout.sections.map((section) => ({ ...section })),
  };
}

function updateLocalizedDraftTitle(draft: PageDraft, language: string, title: string): PageDraft {
  if (language === (draft.language ?? 'en')) {
    return { ...draft, title, updatedAt: new Date().toISOString() };
  }

  const currentLocalization = draft.localizations?.[language] ?? {
    blocks: draft.blocks,
    title: draft.title,
  };

  return {
    ...draft,
    localizations: {
      ...draft.localizations,
      [language]: {
        ...currentLocalization,
        title,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function updateLocalizedBlockContent(
  draft: PageDraft,
  language: string,
  blockId: string,
  content: string,
): PageDraft {
  if (language === (draft.language ?? 'en')) {
    return {
      ...draft,
      blocks: draft.blocks.map((block) => (block.id === blockId ? { ...block, content } : block)),
      updatedAt: new Date().toISOString(),
    };
  }

  const currentLocalization = draft.localizations?.[language] ?? {
    blocks: draft.blocks,
    title: draft.title,
  };

  return {
    ...draft,
    localizations: {
      ...draft.localizations,
      [language]: {
        ...currentLocalization,
        blocks: currentLocalization.blocks.map((block) =>
          block.id === blockId ? { ...block, content } : block,
        ),
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function updateLocalizedSectionTitle(
  draft: PageDraft,
  language: string,
  sectionId: string,
  title: string,
): PageDraft {
  if (language === (draft.language ?? 'en')) {
    return {
      ...draft,
      layout: {
        ...draft.layout,
        sections: draft.layout.sections.map((section) =>
          section.id === sectionId ? { ...section, title } : section,
        ),
      },
      updatedAt: new Date().toISOString(),
    };
  }

  const currentLocalization = draft.localizations?.[language] ?? {
    blocks: draft.blocks,
    title: draft.title,
  };
  const layout = updatedLocalizationLayout(draft, language);

  return {
    ...draft,
    localizations: {
      ...draft.localizations,
      [language]: {
        ...currentLocalization,
        layout: {
          ...layout,
          sections: layout.sections.map((section) =>
            section.id === sectionId ? { ...section, title } : section,
          ),
        },
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function InlineEditableText({
  ariaLabel,
  children,
  className,
  editable,
  onCommit,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  editable: boolean;
  onCommit: (value: string) => void;
}) {
  function handleBlur(event: FocusEvent<HTMLElement>) {
    const value = textFrom(event.currentTarget);
    if (value) {
      onCommit(value);
    }
  }

  if (!editable) {
    return <>{children}</>;
  }

  return (
    <span
      aria-label={ariaLabel}
      className={className ? `draft-inline-editor ${className}` : 'draft-inline-editor'}
      contentEditable
      role="textbox"
      suppressContentEditableWarning
      tabIndex={0}
      onBlur={handleBlur}
    >
      {children}
    </span>
  );
}

export function PageDraftPreview({
  assets,
  draft,
  editable = false,
  language,
  onDraftChange,
}: PageDraftPreviewProps) {
  const localizedDraft = contentForPreviewLanguage(draft, language);
  const canEdit = editable && Boolean(onDraftChange);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const blocksById = new Map(localizedDraft.blocks.map((block) => [block.id, block]));

  function commitTitle(title: string) {
    onDraftChange?.(updateLocalizedDraftTitle(draft, localizedDraft.language, title));
  }

  function commitBlockContent(blockId: string, content: string) {
    onDraftChange?.(updateLocalizedBlockContent(draft, localizedDraft.language, blockId, content));
  }

  function commitSectionTitle(sectionId: string, title: string) {
    onDraftChange?.(updateLocalizedSectionTitle(draft, localizedDraft.language, sectionId, title));
  }

  return (
    <article
      className={`draft-preview ${localizedDraft.visual.spacing}`}
      aria-label={localizedDraft.seo?.title ?? localizedDraft.title}
      data-seo-description={localizedDraft.seo?.description}
      data-seo-keywords={localizedDraft.seo?.keywords.join(', ')}
      data-seo-title={localizedDraft.seo?.title}
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
        <h1>
          <InlineEditableText editable={canEdit} ariaLabel="Edit preview title" onCommit={commitTitle}>
            {localizedDraft.title}
          </InlineEditableText>
        </h1>
      </header>
      {localizedDraft.layout.sections.map((section) => (
        <section className="draft-preview-section" key={section.id}>
          {section.title ? (
            <h2>
              <InlineEditableText
                editable={canEdit}
                ariaLabel={`Edit section ${section.id} title`}
                onCommit={(value) => commitSectionTitle(section.id, value)}
              >
                {section.title}
              </InlineEditableText>
            </h2>
          ) : null}
          <div className="draft-preview-grid">
            {section.blockIds.map((blockId) => {
              const block = blocksById.get(blockId);
              if (!block) {
                return null;
              }
              const asset = block.assetId ? assetsById.get(block.assetId) ?? null : null;

              return (
                <article
                  className={classNameFor(block)}
                  data-asset-family={asset?.family}
                  data-testid={`draft-block-${block.id}`}
                  key={block.id}
                  style={blockStyle(block)}
                >
                  {block.type === 'hero' ? (
                    <strong>
                      {block.href && !canEdit ? (
                        linkedContent(block)
                      ) : (
                        <InlineEditableText
                          editable={canEdit}
                          ariaLabel={`Edit block ${block.id} content`}
                          onCommit={(value) => commitBlockContent(block.id, value)}
                        >
                          {block.content}
                        </InlineEditableText>
                      )}
                    </strong>
                  ) : null}
                  {block.type === 'text' ? (
                    <p>
                      {block.href && !canEdit ? (
                        linkedContent(block)
                      ) : (
                        <InlineEditableText
                          editable={canEdit}
                          ariaLabel={`Edit block ${block.id} content`}
                          onCommit={(value) => commitBlockContent(block.id, value)}
                        >
                          {block.content}
                        </InlineEditableText>
                      )}
                    </p>
                  ) : null}
                  {block.type === 'media' ? (
                    <div className="draft-media-block">
                      <MediaPreviewElement asset={asset} block={block} />
                      <span className="draft-media-caption">
                        <InlineEditableText
                          editable={canEdit}
                          ariaLabel={`Edit block ${block.id} content`}
                          onCommit={(value) => commitBlockContent(block.id, value)}
                        >
                          {block.content || asset?.filename || 'Media'}
                        </InlineEditableText>
                      </span>
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

import type { PageDraft, PageDraftBlock, PageDraftSize, PageDraftSpacing } from './types';

interface PageDraftEditorProps {
  draft: PageDraft;
  onDraftChange: (draft: PageDraft) => void;
}

function updatePrimaryBlock(
  draft: PageDraft,
  updateBlock: (block: PageDraftBlock) => PageDraftBlock,
): PageDraft {
  const primaryBlock = draft.blocks[0];
  if (!primaryBlock) {
    return draft;
  }

  return {
    ...draft,
    blocks: draft.blocks.map((block) => (block.id === primaryBlock.id ? updateBlock(block) : block)),
  };
}

export function PageDraftEditor({ draft, onDraftChange }: PageDraftEditorProps) {
  const primaryBlock = draft.blocks[0];

  function emitDraft(nextDraft: PageDraft) {
    onDraftChange({
      ...nextDraft,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <fieldset className="draft-editor" aria-label="Draft attributes">
      <label htmlFor="draft-title">Draft title</label>
      <input
        id="draft-title"
        type="text"
        value={draft.title}
        onChange={(event) =>
          emitDraft({
            ...draft,
            title: event.target.value,
          })
        }
      />

      <div className="draft-editor-grid">
        <label htmlFor="draft-background-color">
          Page background color
          <input
            id="draft-background-color"
            type="color"
            value={draft.visual.backgroundColor}
            onChange={(event) =>
              emitDraft({
                ...draft,
                visual: {
                  ...draft.visual,
                  backgroundColor: event.target.value,
                },
              })
            }
          />
        </label>
        <label htmlFor="draft-text-color">
          Page text color
          <input
            id="draft-text-color"
            type="color"
            value={draft.visual.textColor}
            onChange={(event) =>
              emitDraft({
                ...draft,
                visual: {
                  ...draft.visual,
                  textColor: event.target.value,
                },
              })
            }
          />
        </label>
        <label htmlFor="draft-accent-color">
          Page accent color
          <input
            id="draft-accent-color"
            type="color"
            value={draft.visual.accentColor}
            onChange={(event) =>
              emitDraft({
                ...draft,
                visual: {
                  ...draft.visual,
                  accentColor: event.target.value,
                },
              })
            }
          />
        </label>
      </div>

      <label htmlFor="draft-spacing">Page spacing</label>
      <select
        id="draft-spacing"
        value={draft.visual.spacing}
        onChange={(event) =>
          emitDraft({
            ...draft,
            visual: {
              ...draft.visual,
              spacing: event.target.value as PageDraftSpacing,
            },
          })
        }
      >
        <option value="tight">Tight</option>
        <option value="balanced">Balanced</option>
        <option value="airy">Airy</option>
      </select>

      {primaryBlock ? (
        <>
          <label htmlFor="primary-block-size">Primary block size</label>
          <select
            id="primary-block-size"
            value={primaryBlock.visual.size}
            onChange={(event) =>
              emitDraft(
                updatePrimaryBlock(draft, (block) => ({
                  ...block,
                  visual: {
                    ...block.visual,
                    size: event.target.value as PageDraftSize,
                  },
                })),
              )
            }
          >
            <option value="compact">Compact</option>
            <option value="standard">Standard</option>
            <option value="large">Large</option>
          </select>

          <label htmlFor="primary-block-width">Primary block width</label>
          <input
            id="primary-block-width"
            max={12}
            min={1}
            type="number"
            value={primaryBlock.layout.width}
            onChange={(event) =>
              emitDraft(
                updatePrimaryBlock(draft, (block) => ({
                  ...block,
                  layout: {
                    ...block.layout,
                    width: Number(event.target.value),
                  },
                })),
              )
            }
          />
        </>
      ) : null}
    </fieldset>
  );
}

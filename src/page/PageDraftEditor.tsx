import type {
  PageDraft,
  PageDraftBlock,
  PageDraftFontWeight,
  PageDraftSize,
  PageDraftSpacing,
  PageDraftTextAlign,
} from './types';

interface PageDraftEditorProps {
  draft: PageDraft;
  onDraftChange: (draft: PageDraft) => void;
  onSelectedBlockChange?: (blockId: string) => void;
  selectedBlockId?: string | null;
}

function updateBlock(
  draft: PageDraft,
  blockId: string,
  updateBlock: (block: PageDraftBlock) => PageDraftBlock,
): PageDraft {
  if (!draft.blocks.some((block) => block.id === blockId)) {
    return draft;
  }

  return {
    ...draft,
    blocks: draft.blocks.map((block) => (block.id === blockId ? updateBlock(block) : block)),
  };
}

function blockLabel(block: PageDraftBlock, index: number) {
  const content = block.content.trim();
  return `${index + 1}. ${block.type} - ${content ? content.slice(0, 42) : block.id}`;
}

export function PageDraftEditor({
  draft,
  onDraftChange,
  onSelectedBlockChange,
  selectedBlockId,
}: PageDraftEditorProps) {
  const selectedBlock =
    draft.blocks.find((block) => block.id === selectedBlockId) ?? draft.blocks[0] ?? null;

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

      {selectedBlock ? (
        <>
          <label htmlFor="selected-block-id">Selected element</label>
          <select
            id="selected-block-id"
            value={selectedBlock.id}
            onChange={(event) => onSelectedBlockChange?.(event.target.value)}
          >
            {draft.blocks.map((block, index) => (
              <option key={block.id} value={block.id}>
                {blockLabel(block, index)}
              </option>
            ))}
          </select>

          <label htmlFor="element-content">Element text</label>
          <textarea
            id="element-content"
            value={selectedBlock.content}
            onChange={(event) =>
              emitDraft(
                updateBlock(draft, selectedBlock.id, (block) => ({
                  ...block,
                  content: event.target.value,
                })),
              )
            }
          />

          <div className="draft-editor-grid">
            <label htmlFor="element-background-color">
              Element background color
              <input
                id="element-background-color"
                type="color"
                value={selectedBlock.visual.backgroundColor}
                onChange={(event) =>
                  emitDraft(
                    updateBlock(draft, selectedBlock.id, (block) => ({
                      ...block,
                      visual: {
                        ...block.visual,
                        backgroundColor: event.target.value,
                      },
                    })),
                  )
                }
              />
            </label>
            <label htmlFor="element-text-color">
              Element text color
              <input
                id="element-text-color"
                type="color"
                value={selectedBlock.visual.textColor}
                onChange={(event) =>
                  emitDraft(
                    updateBlock(draft, selectedBlock.id, (block) => ({
                      ...block,
                      visual: {
                        ...block.visual,
                        textColor: event.target.value,
                      },
                    })),
                  )
                }
              />
            </label>
            <label htmlFor="element-accent-color">
              Element accent color
              <input
                id="element-accent-color"
                type="color"
                value={selectedBlock.visual.accentColor ?? draft.visual.accentColor}
                onChange={(event) =>
                  emitDraft(
                    updateBlock(draft, selectedBlock.id, (block) => ({
                      ...block,
                      visual: {
                        ...block.visual,
                        accentColor: event.target.value,
                      },
                    })),
                  )
                }
              />
            </label>
          </div>

          <label htmlFor="element-size">Element size</label>
          <select
            id="element-size"
            value={selectedBlock.visual.size}
            onChange={(event) =>
              emitDraft(
                updateBlock(draft, selectedBlock.id, (block) => ({
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

          <label htmlFor="element-width">Element width</label>
          <input
            id="element-width"
            max={12}
            min={1}
            type="number"
            value={selectedBlock.layout.width}
            onChange={(event) =>
              emitDraft(
                updateBlock(draft, selectedBlock.id, (block) => ({
                  ...block,
                  layout: {
                    ...block.layout,
                    width: Math.max(1, Math.min(12, Number(event.target.value))),
                  },
                })),
              )
            }
          />

          <div className="draft-editor-grid two">
            <label htmlFor="element-alignment">
              Element alignment
              <select
                id="element-alignment"
                value={selectedBlock.visual.textAlign ?? 'left'}
                onChange={(event) =>
                  emitDraft(
                    updateBlock(draft, selectedBlock.id, (block) => ({
                      ...block,
                      visual: {
                        ...block.visual,
                        textAlign: event.target.value as PageDraftTextAlign,
                      },
                    })),
                  )
                }
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label htmlFor="element-weight">
              Element weight
              <select
                id="element-weight"
                value={selectedBlock.visual.fontWeight ?? 'regular'}
                onChange={(event) =>
                  emitDraft(
                    updateBlock(draft, selectedBlock.id, (block) => ({
                      ...block,
                      visual: {
                        ...block.visual,
                        fontWeight: event.target.value as PageDraftFontWeight,
                      },
                    })),
                  )
                }
              >
                <option value="regular">Regular</option>
                <option value="semibold">Semibold</option>
                <option value="bold">Bold</option>
              </select>
            </label>
          </div>
        </>
      ) : null}
    </fieldset>
  );
}

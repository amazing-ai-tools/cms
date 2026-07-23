import type { PageDraft, PageDraftBlock, SavePageDraftInput } from './types';

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertColor(value: string, fieldName: string) {
  assert(HEX_COLOR_PATTERN.test(value), `${fieldName} must be a hex color.`);
}

function validateBlock(block: PageDraftBlock) {
  assert(block.id.trim(), 'Each content block must have an id.');
  assert(block.content.trim(), 'Each content block must include content.');
  assert(['hero', 'text', 'media'].includes(block.type), 'Content block type is not supported.');

  if (block.type === 'media') {
    assert(block.assetId?.trim(), 'Media blocks must reference an uploaded asset.');
  }

  assert(block.layout.row >= 1, 'Content block row must be at least 1.');
  assert(block.layout.column >= 1, 'Content block column must be at least 1.');
  assert(block.layout.width >= 1, 'Content block width must be at least 1.');
  if (block.layout.height !== undefined) {
    assert(block.layout.height >= 1, 'Content block height must be at least 1.');
  }

  assertColor(block.visual.backgroundColor, 'Content block background color');
  assertColor(block.visual.textColor, 'Content block text color');
  if (block.visual.accentColor) {
    assertColor(block.visual.accentColor, 'Content block accent color');
  }
  assert(
    ['compact', 'standard', 'large'].includes(block.visual.size),
    'Content block size is not supported.',
  );
}

export function validatePageDraft(input: SavePageDraftInput | PageDraft) {
  assert(input.pageId.trim(), 'Draft page id is required.');
  assert(input.title.trim(), 'Draft title is required.');
  assert(input.blocks.length > 0, 'Draft must include at least one content block.');
  assert(input.layout.canvas.maxWidth >= 320, 'Draft canvas width must be at least 320.');
  assert(input.layout.sections.length > 0, 'Draft must include at least one layout section.');

  const blockIds = new Set<string>();
  input.blocks.forEach((block) => {
    validateBlock(block);
    assert(!blockIds.has(block.id), `Content block id ${block.id} is duplicated.`);
    blockIds.add(block.id);
  });

  input.layout.sections.forEach((section) => {
    assert(section.id.trim(), 'Each layout section must have an id.');
    assert(section.blockIds.length > 0, 'Each layout section must reference content blocks.');
    section.blockIds.forEach((blockId) => {
      assert(blockIds.has(blockId), `Layout section references unknown block ${blockId}.`);
    });
  });

  assertColor(input.visual.accentColor, 'Draft accent color');
  assertColor(input.visual.backgroundColor, 'Draft background color');
  assertColor(input.visual.textColor, 'Draft text color');
  assert(
    ['tight', 'balanced', 'airy'].includes(input.visual.spacing),
    'Draft spacing is not supported.',
  );
}

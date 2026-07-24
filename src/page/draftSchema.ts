import type {
  PageDraft,
  PageDraftBlock,
  PageDraftLayout,
  PageDraftSeo,
  PageDraftVisual,
  SavePageDraftInput,
} from './types';

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
  if (block.visual.textAlign) {
    assert(
      ['left', 'center', 'right'].includes(block.visual.textAlign),
      'Content block text alignment is not supported.',
    );
  }
  if (block.visual.fontWeight) {
    assert(
      ['regular', 'semibold', 'bold'].includes(block.visual.fontWeight),
      'Content block font weight is not supported.',
    );
  }
}

function validateLayout(layout: PageDraftLayout, blockIds: Set<string>) {
  assert(layout.canvas.maxWidth >= 320, 'Draft canvas width must be at least 320.');
  assert(layout.sections.length > 0, 'Draft must include at least one layout section.');

  layout.sections.forEach((section) => {
    assert(section.id.trim(), 'Each layout section must have an id.');
    assert(section.blockIds.length > 0, 'Each layout section must reference content blocks.');
    section.blockIds.forEach((blockId) => {
      assert(blockIds.has(blockId), `Layout section references unknown block ${blockId}.`);
    });
  });
}

function validateVisual(visual: PageDraftVisual, prefix = 'Draft') {
  assertColor(visual.accentColor, `${prefix} accent color`);
  assertColor(visual.backgroundColor, `${prefix} background color`);
  assertColor(visual.textColor, `${prefix} text color`);
  assert(
    ['tight', 'balanced', 'airy'].includes(visual.spacing),
    `${prefix} spacing is not supported.`,
  );
}

function validateSeo(seo: PageDraftSeo | undefined, prefix = 'Draft') {
  if (!seo) {
    return;
  }

  assert(seo.title.trim(), `${prefix} SEO title is required.`);
  assert(seo.description.trim(), `${prefix} SEO description is required.`);
  assert(Array.isArray(seo.keywords), `${prefix} SEO keywords must be an array.`);
  assert(
    seo.keywords.every((keyword) => keyword.trim()),
    `${prefix} SEO keywords must not be empty.`,
  );
}

function validateBlocks(blocks: PageDraftBlock[]) {
  assert(blocks.length > 0, 'Draft must include at least one content block.');
  const blockIds = new Set<string>();
  blocks.forEach((block) => {
    validateBlock(block);
    assert(!blockIds.has(block.id), `Content block id ${block.id} is duplicated.`);
    blockIds.add(block.id);
  });

  return blockIds;
}

export function validatePageDraft(input: SavePageDraftInput | PageDraft) {
  assert(input.pageId.trim(), 'Draft page id is required.');
  assert(input.title.trim(), 'Draft title is required.');
  const blockIds = validateBlocks(input.blocks);
  validateLayout(input.layout, blockIds);
  validateVisual(input.visual);
  validateSeo(input.seo);

  Object.entries(input.localizations ?? {}).forEach(([language, localization]) => {
    assert(language.trim(), 'Localization language is required.');
    assert(localization.title.trim(), `Localization ${language} title is required.`);
    const localizedBlockIds = validateBlocks(localization.blocks);
    if (localization.layout) {
      validateLayout(localization.layout, localizedBlockIds);
    }
    if (localization.visual) {
      validateVisual(localization.visual, `Localization ${language}`);
    }
    validateSeo(localization.seo, `Localization ${language}`);
  });
}

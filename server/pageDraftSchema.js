const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertColor(value, fieldName) {
  assert(HEX_COLOR_PATTERN.test(value), `${fieldName} must be a hex color.`);
}

export const embeddedPageDraftSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'blocks', 'layout', 'visual'],
  properties: {
    title: {
      type: 'string',
      minLength: 3,
      maxLength: 96,
    },
    blocks: {
      type: 'array',
      minItems: 2,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'content', 'layout', 'visual'],
        properties: {
          id: { type: 'string', minLength: 3, maxLength: 64 },
          type: { type: 'string', enum: ['hero', 'text', 'media'] },
          content: { type: 'string', minLength: 8, maxLength: 1200 },
          assetId: { type: 'string', maxLength: 128 },
          layout: {
            type: 'object',
            additionalProperties: false,
            required: ['column', 'row', 'width'],
            properties: {
              column: { type: 'integer', minimum: 1, maximum: 12 },
              row: { type: 'integer', minimum: 1, maximum: 12 },
              width: { type: 'integer', minimum: 1, maximum: 12 },
              height: { type: 'integer', minimum: 1, maximum: 6 },
            },
          },
          visual: {
            type: 'object',
            additionalProperties: false,
            required: ['backgroundColor', 'textColor', 'size'],
            properties: {
              backgroundColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              textColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              accentColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              size: { type: 'string', enum: ['compact', 'standard', 'large'] },
            },
          },
        },
      },
    },
    layout: {
      type: 'object',
      additionalProperties: false,
      required: ['canvas', 'sections'],
      properties: {
        canvas: {
          type: 'object',
          additionalProperties: false,
          required: ['maxWidth'],
          properties: {
            maxWidth: { type: 'integer', minimum: 720, maximum: 1440 },
          },
        },
        sections: {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'blockIds'],
            properties: {
              id: { type: 'string', minLength: 3, maxLength: 64 },
              title: { type: 'string', maxLength: 96 },
              blockIds: {
                type: 'array',
                minItems: 1,
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
    visual: {
      type: 'object',
      additionalProperties: false,
      required: ['accentColor', 'backgroundColor', 'textColor', 'spacing'],
      properties: {
        accentColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        backgroundColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        textColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        spacing: { type: 'string', enum: ['tight', 'balanced', 'airy'] },
      },
    },
  },
};

function validateBlock(block) {
  assert(block.id?.trim(), 'Each content block must have an id.');
  assert(block.content?.trim(), 'Each content block must include content.');
  assert(['hero', 'text', 'media'].includes(block.type), 'Content block type is not supported.');
  if (block.type === 'media') {
    assert(block.assetId?.trim(), 'Media blocks must reference an uploaded asset.');
  }
  assert(block.layout?.row >= 1, 'Content block row must be at least 1.');
  assert(block.layout?.column >= 1, 'Content block column must be at least 1.');
  assert(block.layout?.width >= 1, 'Content block width must be at least 1.');
  assertColor(block.visual?.backgroundColor, 'Content block background color');
  assertColor(block.visual?.textColor, 'Content block text color');
  if (block.visual?.accentColor) {
    assertColor(block.visual.accentColor, 'Content block accent color');
  }
  assert(['compact', 'standard', 'large'].includes(block.visual?.size), 'Content block size is not supported.');
}

export function normalizeAndValidateDraftResponse(responseDraft, request, now) {
  assert(responseDraft && typeof responseDraft === 'object', 'AI response must be a draft object.');
  const timestamp = now().toISOString();
  const draft = {
    id: `draft-${request.pageId}`,
    pageId: request.pageId,
    title: String(responseDraft.title || request.pageTitle || 'Generated page').trim(),
    isDirty: true,
    blocks: responseDraft.blocks ?? [],
    layout: responseDraft.layout,
    visual: responseDraft.visual,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  assert(draft.pageId?.trim(), 'Draft page id is required.');
  assert(draft.title?.trim(), 'Draft title is required.');
  assert(Array.isArray(draft.blocks) && draft.blocks.length > 0, 'Draft must include content blocks.');
  assert(draft.layout?.canvas?.maxWidth >= 320, 'Draft canvas width must be at least 320.');
  assert(Array.isArray(draft.layout?.sections) && draft.layout.sections.length > 0, 'Draft must include sections.');
  draft.blocks.forEach(validateBlock);
  assertColor(draft.visual?.accentColor, 'Draft accent color');
  assertColor(draft.visual?.backgroundColor, 'Draft background color');
  assertColor(draft.visual?.textColor, 'Draft text color');
  assert(['tight', 'balanced', 'airy'].includes(draft.visual?.spacing), 'Draft spacing is not supported.');

  return draft;
}

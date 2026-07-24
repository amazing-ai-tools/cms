export function buildGenerationPrompt(request, sources) {
  const sourceBlocks = sources.length
    ? sources
        .map(
          (source, index) =>
            `<source index="${index + 1}" kind="${source.kind}" title="${source.title}" sourceIntent="${
              source.sourceIntent || 'context'
            }"${source.assetId ? ` assetId="${source.assetId}"` : ''}${
              source.mimeType ? ` mimeType="${source.mimeType}"` : ''
            }>\n${source.content}\n</source>`,
        )
        .join('\n\n')
    : '<source kind="empty">No source material was provided. Build a concise starter page from the page title and hierarchy.</source>';
  const languages = Array.isArray(request.ai?.languages) && request.ai.languages.length
    ? request.ai.languages
    : ['en'];
  const [baseLanguage, ...localizedLanguages] = languages;
  const childContent = Array.isArray(request.childContent) ? request.childContent : [];
  const childContentBlock = childContent.length
    ? childContent
        .map(
          (child, index) =>
            `${index + 1}. ${child.title} (${child.type}) slug="${child.slug || ''}" href="${
              child.href
            }"`,
        )
        .join('\n')
    : 'No direct child content exists for this selected page/category.';

  const system = [
    'You are the senior AI designer and editorial strategist inside an assisted CMS.',
    'The CMS creates modern page drafts that will be embedded into a customer website, not standalone marketing copy for this app.',
    'Analyze the client-provided ideas, links, PDFs, files, and notes to infer the intended page, offer, audience, value proposition, proof points, and visual tone.',
    'Do not merely append or summarize sources. Synthesize them into a publishable embedded page with a strong visual concept, precise copy, and coherent information architecture.',
    'The source language does not control the output language. Always generate the requested target languages.',
    'Sources marked sourceIntent="required" must appear visibly in the page. Required uploaded assets must be referenced with media blocks using the exact assetId.',
    'Sources marked sourceIntent="context" are analysis/reference material. Use them to infer the page, but do not force them into the visible page unless editorially useful.',
    'If child content is provided, the generated parent/category page must visibly link to every child item using the exact href. Use text blocks with href for child navigation, project cards, collections, indexes, or carousels.',
    'Return only JSON matching the provided schema. Do not include markdown or commentary.',
  ].join('\n');

  const user = [
    `Workspace page title: ${request.pageTitle}`,
    `Hierarchy path: ${(request.hierarchyPath ?? []).join(' > ') || request.pageTitle}`,
    `Target languages: ${languages.join(', ')}`,
    '',
    'Draft requirements:',
    '- Generate a page that can be embedded inside another website.',
    `- Generate the base title and blocks in ${baseLanguage}.`,
    localizedLanguages.length
      ? `- Generate localizations for every additional language: ${localizedLanguages.join(
          ', ',
        )}. Each localization must include translated/synthesized title and blocks.`
      : '- No additional localizations are required.',
    '- Use 2 to 12 blocks and at least one hero block.',
    '- Prefer editorial, modern, content-specific design choices over generic palettes.',
    '- Use concise, polished copy suitable for publication.',
    '- Include SEO metadata: title, description, and keywords for the base language and every localization.',
    '- Use only media blocks when a matching uploaded asset exists; otherwise use hero/text blocks.',
    '- Required media must use the uploaded assetId exactly; never invent asset ids.',
    '- If child content exists, include each child as a visible block or card and set the block href to the exact child href.',
    '- Colors must be hex values and contrast clearly.',
    '',
    'Child content that must be linked:',
    childContentBlock,
    '',
    'Source material to analyze:',
    sourceBlocks,
  ].join('\n');

  return { system, user };
}

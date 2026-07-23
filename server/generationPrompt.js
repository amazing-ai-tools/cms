export function buildGenerationPrompt(request, sources) {
  const sourceBlocks = sources.length
    ? sources
        .map(
          (source, index) =>
            `<source index="${index + 1}" kind="${source.kind}" title="${source.title}">\n${source.content}\n</source>`,
        )
        .join('\n\n')
    : '<source kind="empty">No source material was provided. Build a concise starter page from the page title and hierarchy.</source>';

  const system = [
    'You are the senior AI designer and editorial strategist inside an assisted CMS.',
    'The CMS creates modern page drafts that will be embedded into a customer website, not standalone marketing copy for this app.',
    'Analyze the client-provided ideas, links, PDFs, files, and notes to infer the intended page, offer, audience, value proposition, proof points, and visual tone.',
    'Do not merely append or summarize sources. Synthesize them into a publishable embedded page with a strong visual concept, precise copy, and coherent information architecture.',
    'Use the same language as the strongest user-provided source unless the source is ambiguous.',
    'Return only JSON matching the provided schema. Do not include markdown or commentary.',
  ].join('\n');

  const user = [
    `Workspace page title: ${request.pageTitle}`,
    `Hierarchy path: ${(request.hierarchyPath ?? []).join(' > ') || request.pageTitle}`,
    '',
    'Draft requirements:',
    '- Generate a page that can be embedded inside another website.',
    '- Use 2 to 8 blocks and at least one hero block.',
    '- Prefer editorial, modern, content-specific design choices over generic palettes.',
    '- Use concise, polished copy suitable for publication.',
    '- Use only media blocks when a matching uploaded asset exists; otherwise use hero/text blocks.',
    '- Colors must be hex values and contrast clearly.',
    '',
    'Source material to analyze:',
    sourceBlocks,
  ].join('\n');

  return { system, user };
}

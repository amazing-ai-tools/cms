import { PDFParse } from 'pdf-parse';

const MAX_LINKS = 5;
const MAX_SOURCE_CHARS = 12000;
const MAX_TOTAL_SOURCE_CHARS = 42000;

function truncateText(text, maxLength = MAX_SOURCE_CHARS) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) {
    return null;
  }

  return Buffer.from(match[2], 'base64');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function uniqueLinks(inputs) {
  const links = inputs
    .filter((input) => input.type === 'link')
    .map((input) => input.content)
    .filter(Boolean);

  return Array.from(new Set(links)).slice(0, MAX_LINKS);
}

async function textFromPdfDataUrl(sourceContent) {
  const buffer = dataUrlToBuffer(sourceContent);
  if (!buffer) {
    return '';
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

async function textFromAsset(asset) {
  if (asset.sourceEncoding === 'text') {
    return truncateText(asset.sourceContent);
  }

  if (asset.family === 'pdf' && asset.sourceEncoding === 'data-url') {
    try {
      return truncateText(await textFromPdfDataUrl(asset.sourceContent));
    } catch {
      return '';
    }
  }

  return '';
}

async function textFromLink(url, fetcher) {
  try {
    const response = await fetcher(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.2',
        'User-Agent': 'AmazingCMSAI/1.0',
      },
    });

    if (!response.ok) {
      return '';
    }

    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    return truncateText(contentType.includes('html') ? stripHtml(body) : body);
  } catch {
    return '';
  }
}

function appendWithinLimit(sources, nextSource) {
  const currentLength = sources.reduce((total, source) => total + source.content.length, 0);
  const remaining = MAX_TOTAL_SOURCE_CHARS - currentLength;
  if (remaining <= 0) {
    return sources;
  }

  sources.push({
    ...nextSource,
    content: truncateText(nextSource.content, Math.min(MAX_SOURCE_CHARS, remaining)),
  });

  return sources;
}

export async function collectSourceMaterial(request, options = {}) {
  const fetcher = options.fetcher ?? fetch;
  const pageContext = request.pageContext ?? {};
  const inputs = Array.isArray(pageContext.inputs) ? pageContext.inputs : [];
  const assets = Array.isArray(pageContext.assets) ? pageContext.assets : [];
  const sources = [];

  for (const input of inputs) {
    if (input.type === 'link') {
      continue;
    }

    if (input.content) {
      appendWithinLimit(sources, {
        content: input.content,
        kind: input.type || 'input',
        sourceIntent: input.sourceIntent || 'context',
        title: input.type || 'input',
      });
    }
  }

  for (const url of uniqueLinks(inputs)) {
    const content = await textFromLink(url, fetcher);
    appendWithinLimit(sources, {
      content: content || `Reference URL provided: ${url}`,
      kind: 'link',
      sourceIntent:
        inputs.find((input) => input.type === 'link' && input.content === url)?.sourceIntent || 'context',
      title: url,
    });
  }

  for (const asset of assets) {
    const content = await textFromAsset(asset);
    appendWithinLimit(sources, {
      content:
        content ||
        `Uploaded ${asset.family || 'asset'}: ${asset.filename || 'untitled'} (${asset.mimeType || 'unknown type'})`,
      assetId: asset.id,
      kind: asset.family || 'asset',
      mimeType: asset.mimeType || 'unknown type',
      sourceIntent: asset.sourceIntent || 'context',
      title: asset.filename || 'uploaded asset',
    });
  }

  return sources;
}

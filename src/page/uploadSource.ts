import type { AddPageAssetInput } from './types';

export type UploadSource = Pick<AddPageAssetInput, 'sourceContent' | 'sourceEncoding'>;

const MAX_ANALYZABLE_UPLOAD_BYTES = 5 * 1024 * 1024;
const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/xml',
  'application/xhtml+xml',
  'text/csv',
  'text/html',
  'text/markdown',
  'text/plain',
  'text/xml',
]);

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isTextLike(file: File) {
  return file.type.startsWith('text/') || TEXT_MIME_TYPES.has(file.type);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 8192;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

async function fileToDataUrl(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = file.type || 'application/octet-stream';
  return `data:${mediaType};base64,${bytesToBase64(bytes)}`;
}

export async function readUploadSourceForFile(file: File): Promise<UploadSource> {
  if (file.size > MAX_ANALYZABLE_UPLOAD_BYTES) {
    return {};
  }

  if (isTextLike(file)) {
    return {
      sourceContent: await file.text(),
      sourceEncoding: 'text',
    };
  }

  if (isPdf(file)) {
    return {
      sourceContent: await fileToDataUrl(file),
      sourceEncoding: 'data-url',
    };
  }

  return {};
}

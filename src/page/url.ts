export function normalizeUrl(rawUrl: string) {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    throw new Error('Enter a valid URL.');
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;
  const url = new URL(withProtocol);

  if (!url.hostname || !url.hostname.includes('.')) {
    throw new Error('Enter a valid URL.');
  }

  return url.toString();
}

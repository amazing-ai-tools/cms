import type { CdnPublicationResult, CdnService } from './cdn';
import type { PublishedVersion } from '../page/types';
import { buildPublishableManifest } from './manifest';

interface LocalCdnServiceOptions {
  baseUrl?: string;
  failPublish?: boolean;
  storageKey?: string;
}

interface LocalCdnRecord {
  content: string;
  contentType: string;
}

interface LocalCdnStorage {
  records: Record<string, LocalCdnRecord>;
}

function readStorage(storageKey: string): LocalCdnStorage {
  const rawStorage = window.localStorage.getItem(storageKey);
  if (!rawStorage) {
    return { records: {} };
  }

  try {
    return JSON.parse(rawStorage) as LocalCdnStorage;
  } catch {
    window.localStorage.removeItem(storageKey);
    return { records: {} };
  }
}

function writeStorage(storageKey: string, storage: LocalCdnStorage) {
  window.localStorage.setItem(storageKey, JSON.stringify(storage));
}

function assetUrl(baseUrl: string, version: PublishedVersion, assetId: string, filename: string) {
  return `${baseUrl}/pages/${version.pageId}/assets/${assetId}/${encodeURIComponent(filename)}`;
}

export function createLocalCdnService(options: LocalCdnServiceOptions = {}): CdnService {
  const baseUrl = options.baseUrl ?? 'https://cdn.local/assisted-cms';
  const storageKey = options.storageKey ?? 'assisted-cms.local-cdn';

  return {
    async publishVersion(version: PublishedVersion): Promise<CdnPublicationResult> {
      if (options.failPublish) {
        throw new Error('CDN publish failed.');
      }

      const storage = readStorage(storageKey);
      const contentUrl = `${baseUrl}/pages/${version.pageId}/versions/${version.versionNumber}/content.json`;
      const scriptUrl = `${baseUrl}/renderers/assisted-cms-embed.js`;
      const mediaUrls = version.assetManifest.map((asset) =>
        assetUrl(baseUrl, version, asset.assetId, asset.filename),
      );
      const publicVersion = {
        ...version,
        assetManifest: version.assetManifest.map((asset, assetIndex) => ({
          ...asset,
          cdnUrl: mediaUrls[assetIndex] ?? asset.cdnUrl,
        })),
        cdnUrls: {
          content: contentUrl,
          media: mediaUrls,
          script: scriptUrl,
        },
      };
      const manifest = buildPublishableManifest(publicVersion);

      storage.records[contentUrl] = {
        content: JSON.stringify(manifest.content),
        contentType: 'application/json',
      };
      storage.records[scriptUrl] = {
        content: 'window.AssistedCmsEmbed = window.AssistedCmsEmbed || {};',
        contentType: 'application/javascript',
      };
      version.assetManifest.forEach((asset, index) => {
        storage.records[mediaUrls[index]] = {
          content: asset.sourceContent ?? asset.storageUrl,
          contentType: asset.mimeType,
        };
      });

      writeStorage(storageKey, storage);
      return { contentUrl, mediaUrls, scriptUrl };
    },

    async readJson<T = unknown>(url: string): Promise<T | null> {
      const record = readStorage(storageKey).records[url];
      if (!record || record.contentType !== 'application/json') {
        return null;
      }

      return JSON.parse(record.content) as T;
    },

    async verifyUrl(url: string): Promise<boolean> {
      return Boolean(readStorage(storageKey).records[url]);
    },
  };
}

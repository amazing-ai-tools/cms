import type { PublishedVersion } from '../page/types';

export interface CdnPublicationResult {
  contentUrl: string;
  mediaUrls: string[];
  scriptUrl: string;
}

export interface CdnService {
  publishVersion(version: PublishedVersion): Promise<CdnPublicationResult>;
  readJson<T = unknown>(url: string): Promise<T | null>;
  verifyUrl(url: string): Promise<boolean>;
}

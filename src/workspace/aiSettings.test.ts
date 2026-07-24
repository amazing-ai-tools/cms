import { describe, expect, test } from 'vitest';
import { WORKSPACE_LANGUAGE_OPTIONS } from './aiSettings';

describe('workspace AI language options', () => {
  test('includes Arabic for content generation', () => {
    expect(WORKSPACE_LANGUAGE_OPTIONS).toContainEqual({
      code: 'ar',
      label: 'Arabic',
    });
  });
});

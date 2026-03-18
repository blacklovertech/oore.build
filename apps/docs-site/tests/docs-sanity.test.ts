import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Documentation Sanity Tests', () => {
  const docsDir = path.resolve(__dirname, '../docs/getting-started');

  const criticalPages = [
    'install.md',
    'public-alpha.md',
    'hosted-ui-onboarding.md',
    'known-limitations.md'
  ];

  it('should have all critical getting-started pages', () => {
    criticalPages.forEach((page) => {
      const filePath = path.join(docsDir, page);
      const exists = fs.existsSync(filePath);
      expect(exists, `Page ${page} should exist in ${docsDir}`).toBe(true);
    });
  });
});

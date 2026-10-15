import { describe, expect, it } from 'vitest';

import { scrubNumbers } from './privacy';

describe('scrubNumbers', () => {
  it('removes step counts, decimals, times, and dates from error text', () => {
    expect(scrubNumbers('steps 8,412 over goal 5000 (1.68)')).toBe('steps # over goal # (#)');
    expect(scrubNumbers('read failed at 2026-10-14T07:31:02Z')).toBe('read failed at #-#-#T#Z');
  });

  it('leaves text without numbers alone', () => {
    expect(scrubNumbers("Cannot read property 'name' of undefined")).toBe(
      "Cannot read property 'name' of undefined",
    );
  });
});

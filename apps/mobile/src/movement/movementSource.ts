import type { MovementSource } from '@kithe/core';

// Fallback for platforms without a health store. Metro picks the .android.ts or .ios.ts
// sibling on device; TypeScript type-checks against this file's exports.
export const movementSource: MovementSource | null = null;

/** Development builds only: writes sample steps so the read path can be tested. */
export const seedTestSteps: (() => Promise<number>) | null = null;

/**
 * Deliberately separate file with zero dependencies. Client components
 * (BestOfTable.tsx, PhotoDialog.tsx) need this constant/type at runtime, but
 * must not import it from best-of.ts or client.ts — those pull in
 * `node:fs/promises` and the Immich SDK, which breaks the Next.js client bundle
 * if reached from a "use client" component.
 */

export const BEST_OF_CLASSES = [
  "Male",
  "Female",
  "Indeterminate",
  "Immature",
  "Multiple",
] as const;

export type BestOfClass = (typeof BEST_OF_CLASSES)[number];

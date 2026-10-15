import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ComparePage } from './compare';

export const metadata: Metadata = { title: 'Compare blocks', description: 'Compare HDB blocks side by side.' };

export default function Page() {
  // Reads the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <ComparePage />
    </Suspense>
  );
}

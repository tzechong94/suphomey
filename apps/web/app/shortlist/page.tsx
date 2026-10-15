import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ShortlistPage } from './shortlist';

export const metadata: Metadata = { title: 'Shortlist', description: 'Your saved HDB blocks.' };

export default function Page() {
  // Reads the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <ShortlistPage />
    </Suspense>
  );
}

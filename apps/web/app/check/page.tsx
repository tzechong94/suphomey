import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CheckPage } from './check';

export const metadata: Metadata = { title: 'Price check', description: 'Is an asking rent or price fair? Compare it with real HDB deals nearby.' };

export default function Page() {
  // Reads the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <CheckPage />
    </Suspense>
  );
}

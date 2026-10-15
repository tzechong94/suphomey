import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RentVsBuyPage } from './rent-vs-buy';

export const metadata: Metadata = { title: 'Rent vs buy', description: 'When does buying an HDB flat beat renting it?' };

export default function Page() {
  // Reads the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <RentVsBuyPage />
    </Suspense>
  );
}

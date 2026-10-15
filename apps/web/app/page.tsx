import { Suspense } from 'react';
import { Explore } from '@/components/explore/explore';

export default function Home() {
  // Explore reads the search state from the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}

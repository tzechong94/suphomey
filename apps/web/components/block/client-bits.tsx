'use client';

import dynamic from 'next/dynamic';

// MapLibre needs the browser; `ssr: false` is only allowed from a Client Component.
export const MiniMap = dynamic(() => import('./block-mini-map'), {
  ssr: false,
  loading: () => <div className="h-72 rounded-2xl border-2 border-ink bg-paper-2" />,
});

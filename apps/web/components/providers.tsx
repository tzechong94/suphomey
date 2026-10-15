'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  // The data changes at most daily, so nothing needs refetching while the tab is open.
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 60 * 1000, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

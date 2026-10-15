import type { Metadata } from 'next';
import { TeaPage } from './tea';

export const metadata: Metadata = { title: 'The Tea', description: 'What HDB rentals and resales say about rents, lease decay and location.' };

export default function Page() {
  return <TeaPage />;
}
